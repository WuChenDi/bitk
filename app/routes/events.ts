import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { db } from '../db'
import { findProject } from '../db/helpers'
import { issues as issuesTable } from '../db/schema'
import { issueEngine } from '../engines/issue-engine'
import { onChangesSummary } from '../events/changes-summary'
import { onIssueUpdated } from '../events/issue-events'
import { logger } from '../logger'

const TERMINAL = new Set(['completed', 'failed', 'cancelled'])

// In-memory cache: issueId → { projectId, expiresAt }
// TTL-based eviction prevents unbounded memory growth.
const ISSUE_CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes
const issueProjectCache = new Map<string, { projectId: string; expiresAt: number }>()

async function getIssueProjectId(issueId: string): Promise<string | null> {
  const cached = issueProjectCache.get(issueId)
  if (cached) {
    if (Date.now() < cached.expiresAt) return cached.projectId
    issueProjectCache.delete(issueId) // expired
  }

  const [row] = await db
    .select({ projectId: issuesTable.projectId })
    .from(issuesTable)
    .where(eq(issuesTable.id, issueId))

  if (row) {
    issueProjectCache.set(issueId, {
      projectId: row.projectId,
      expiresAt: Date.now() + ISSUE_CACHE_TTL_MS,
    })
    return row.projectId
  }
  return null
}

const events = new Hono()

// GET /api/events?projectId=... — Project-scoped SSE stream
// Broadcasts only events for issues belonging to the specified project.
// The projectId param can be a ULID or an alias — we resolve to the actual ULID.
events.get('/', async (c) => {
  const projectIdParam = c.req.query('projectId')?.trim()
  if (!projectIdParam) {
    return c.json({ success: false, error: 'Missing required query parameter: projectId' }, 400)
  }

  // Resolve alias or ULID to actual project ULID
  const project = await findProject(projectIdParam)
  if (!project) {
    return c.json({ success: false, error: 'Project not found' }, 404)
  }
  const projectId = project.id

  logger.debug({ projectId, param: projectIdParam }, 'project_sse_open')

  try {
    return streamSSE(c, async (stream) => {
      let done = false
      let resolveDone: (() => void) | undefined
      const donePromise = new Promise<void>((r) => {
        resolveDone = r
      })

      const stop = () => {
        if (!done) {
          done = true
          resolveDone?.()
        }
      }

      const writeEvent = (event: string, data: unknown) => {
        if (done) return
        stream.writeSSE({ event, data: JSON.stringify(data) }).catch(stop)
      }

      // Helper: check if an issue belongs to the subscribed project
      const isProjectScoped = async (issueId: string): Promise<boolean> => {
        const issueProjectId = await getIssueProjectId(issueId)
        return issueProjectId === projectId
      }

      // Subscribe to log events — filter by project
      // Note: callbacks are async but the emitter expects sync signatures.
      // We wrap each in a void IIFE to prevent unhandled promise rejections.
      const unsubLog = issueEngine.onLog((issueId, executionId, entry) => {
        void isProjectScoped(issueId)
          .then((scoped) => {
            if (scoped) writeEvent('log', { issueId, entry })
          })
          .catch((err) => logger.error({ err }, 'sse_log_filter_error'))
      })

      // Non-terminal state changes — filter by project
      const unsubState = issueEngine.onStateChange((issueId, executionId, state) => {
        if (TERMINAL.has(state)) return // handled by onIssueSettled below
        void isProjectScoped(issueId)
          .then((scoped) => {
            if (scoped) writeEvent('state', { issueId, executionId, state })
          })
          .catch((err) => logger.error({ err }, 'sse_state_filter_error'))
      })

      // Terminal state changes come AFTER DB is updated — filter by project
      const unsubSettled = issueEngine.onIssueSettled((issueId, executionId, state) => {
        void isProjectScoped(issueId)
          .then((scoped) => {
            if (scoped) {
              writeEvent('state', { issueId, executionId, state })
              writeEvent('done', { issueId, finalStatus: state })
            }
          })
          .catch((err) => logger.error({ err }, 'sse_settled_filter_error'))
      })

      // Issue data mutations (status changes, etc.) — filter by project
      const unsubIssueUpdated = onIssueUpdated((data) => {
        void isProjectScoped(data.issueId)
          .then((scoped) => {
            if (scoped) writeEvent('issue-updated', data)
          })
          .catch((err) => logger.error({ err }, 'sse_issue_updated_filter_error'))
      })

      // Changes summary (file count + line stats) — filter by project
      const unsubChangesSummary = onChangesSummary((summary) => {
        void isProjectScoped(summary.issueId)
          .then((scoped) => {
            if (scoped) writeEvent('changes-summary', summary)
          })
          .catch((err) => logger.error({ err }, 'sse_changes_summary_filter_error'))
      })

      // Heartbeat every 15s — keeps connection alive and detects client disconnect
      const heartbeat = setInterval(() => {
        if (done) return
        writeEvent('heartbeat', { ts: new Date().toISOString() })
      }, 15_000)

      // Wait until stream ends (client disconnect or write error)
      try {
        await donePromise
      } finally {
        clearInterval(heartbeat)
        unsubLog()
        unsubState()
        unsubSettled()
        unsubIssueUpdated()
        unsubChangesSummary()
        logger.debug({ projectId }, 'project_sse_closed')
      }
    })
  } catch (err) {
    logger.error(
      { err: err instanceof Error ? { message: err.message, stack: err.stack } : err },
      'project_sse_error',
    )
    return c.json({ success: false, error: 'Stream error' }, 500)
  }
})

export default events

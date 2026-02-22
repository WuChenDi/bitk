import type { IssueRow } from './_shared'
import { mkdir, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { zValidator } from '@hono/zod-validator'
import { eq, max } from 'drizzle-orm'
import { Hono } from 'hono'
import { db } from '../../db'
import { findProject, getAppSetting } from '../../db/helpers'
import { issueLogs, issues as issuesTable } from '../../db/schema'
import { issueEngine } from '../../engines/issue-engine'
import { emitIssueUpdated } from '../../events/issue-events'
import { logger } from '../../logger'
import {
  executeIssueSchema,
  followUpSchema,
  getPendingMessages,
  getProjectOwnedIssue,
  markPendingMessagesDispatched,
} from './_shared'

function normalizePrompt(input: string): string {
  return input.replace(/^(?:\\n|\s)+/g, '').replace(/(?:\\n|\s)+$/g, '')
}

async function persistPendingMessage(
  issueId: string,
  prompt: string,
  meta: Record<string, unknown> = { pending: true },
): Promise<void> {
  await db.transaction(async (tx) => {
    const [maxEntryRow] = await tx
      .select({ val: max(issueLogs.entryIndex) })
      .from(issueLogs)
      .where(eq(issueLogs.issueId, issueId))
    const entryIndex = (maxEntryRow?.val ?? -1) + 1

    const [maxTurnRow] = await tx
      .select({ val: max(issueLogs.turnIndex) })
      .from(issueLogs)
      .where(eq(issueLogs.issueId, issueId))
    const turnIndex = (maxTurnRow?.val ?? -1) + 1

    await tx.insert(issueLogs).values({
      issueId,
      turnIndex,
      entryIndex,
      entryType: 'user-message',
      content: prompt.trim(),
      metadata: JSON.stringify(meta),
      timestamp: new Date().toISOString(),
    })
  })
}

/**
 * Collect any queued pending messages, merge them into the prompt.
 * Returns the effective prompt and pending IDs for deferred deletion.
 * Callers MUST delete pending messages only AFTER the engine call succeeds
 * to prevent message loss on failure.
 */
async function collectPendingMessages(
  issueId: string,
  basePrompt: string,
): Promise<{ prompt: string; pendingIds: string[] }> {
  const pending = await getPendingMessages(issueId)
  if (pending.length === 0) return { prompt: basePrompt, pendingIds: [] }
  const prompt = [basePrompt, ...pending.map((m) => m.content)].filter(Boolean).join('\n\n')
  return { prompt, pendingIds: pending.map((m) => m.id) }
}

/**
 * Ensure an issue is in working status before AI execution begins.
 * - todo / done → reject (no execution allowed)
 * - review → move to working, then execute
 * - working → proceed as-is
 */
async function ensureWorking(issue: IssueRow): Promise<{ ok: boolean; reason?: string }> {
  if (issue.statusId === 'todo') {
    return { ok: false, reason: 'Cannot execute a todo issue — move to working first' }
  }
  if (issue.statusId === 'done') {
    return { ok: false, reason: 'Cannot execute a done issue' }
  }
  if (issue.statusId !== 'working') {
    // review → working
    await db.update(issuesTable).set({ statusId: 'working' }).where(eq(issuesTable.id, issue.id))
    emitIssueUpdated(issue.id, { statusId: 'working' })
    logger.info({ issueId: issue.id, from: issue.statusId }, 'moved_to_working')
  }
  return { ok: true }
}

const session = new Hono()

// POST /api/projects/:projectId/issues/:id/execute — Execute engine on issue
session.post(
  '/:id/execute',
  zValidator('json', executeIssueSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        { success: false, error: result.error.issues.map((i) => i.message).join(', ') },
        400,
      )
    }
  }),
  async (c) => {
    const projectId = c.req.param('projectId')!
    const project = await findProject(projectId)
    if (!project) {
      return c.json({ success: false, error: 'Project not found' }, 404)
    }

    const issueId = c.req.param('id')!
    const issue = await getProjectOwnedIssue(project.id, issueId)
    if (!issue) {
      return c.json({ success: false, error: 'Issue not found' }, 404)
    }

    const body = c.req.valid('json')
    const prompt = normalizePrompt(body.prompt)
    if (!prompt) {
      return c.json({ success: false, error: 'Prompt is required' }, 400)
    }

    // Resolve workingDir from project.directory
    const workingDir = project.directory || undefined

    // Ensure workingDir exists and is within the configured workspace root.
    let effectiveWorkingDir: string | undefined
    if (workingDir) {
      const resolvedDir = resolve(workingDir)

      // SEC-016: Validate directory is within workspace root
      const workspaceRoot = await getAppSetting('workspace:defaultPath')
      if (workspaceRoot && workspaceRoot !== '/') {
        const resolvedRoot = resolve(workspaceRoot)
        if (!resolvedDir.startsWith(`${resolvedRoot}/`) && resolvedDir !== resolvedRoot) {
          return c.json(
            {
              success: false,
              error: 'Project directory is outside the configured workspace',
            },
            403,
          )
        }
      }

      try {
        await mkdir(resolvedDir, { recursive: true })
      } catch {
        return c.json(
          {
            success: false,
            error: `Failed to create project directory: ${resolvedDir}`,
          },
          400,
        )
      }

      try {
        const s = await stat(resolvedDir)
        if (!s.isDirectory()) {
          return c.json({ success: false, error: 'Project directory is not a directory' }, 400)
        }
      } catch {
        return c.json(
          { success: false, error: `Project directory is unavailable: ${resolvedDir}` },
          400,
        )
      }
      effectiveWorkingDir = resolvedDir
    }

    try {
      const guard = await ensureWorking(issue)
      if (!guard.ok) {
        return c.json({ success: false, error: guard.reason! }, 400)
      }
      const { prompt: effectivePrompt, pendingIds } = await collectPendingMessages(issueId, prompt)
      const result = await issueEngine.executeIssue(issueId, {
        engineType: body.engineType,
        prompt: effectivePrompt,
        workingDir: effectiveWorkingDir,
        model: body.model,
        permissionMode: body.permissionMode,
      })
      await markPendingMessagesDispatched(pendingIds)
      return c.json({
        success: true,
        data: { executionId: result.executionId, issueId },
      })
    } catch (error) {
      logger.warn(
        {
          projectId: project.id,
          issueId,
          model: body.model,
          permissionMode: body.permissionMode,
          busyAction: body.busyAction,
          error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
        },
        'issue_followup_failed',
      )
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Execution failed',
        },
        400,
      )
    }
  },
)

// POST /api/projects/:projectId/issues/:id/follow-up — Follow-up
session.post(
  '/:id/follow-up',
  zValidator('json', followUpSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        { success: false, error: result.error.issues.map((i) => i.message).join(', ') },
        400,
      )
    }
  }),
  async (c) => {
    const projectId = c.req.param('projectId')!
    const project = await findProject(projectId)
    if (!project) {
      return c.json({ success: false, error: 'Project not found' }, 404)
    }

    const issueId = c.req.param('id')!
    const body = c.req.valid('json')
    const prompt = normalizePrompt(body.prompt)
    if (!prompt) {
      return c.json({ success: false, error: 'Prompt is required' }, 400)
    }
    const issue = await getProjectOwnedIssue(project.id, issueId)
    if (!issue) {
      return c.json({ success: false, error: 'Issue not found' }, 404)
    }

    // Queue message for todo/done issues instead of rejecting
    if (issue.statusId === 'todo') {
      await persistPendingMessage(issueId, prompt)
      return c.json({ success: true, data: { issueId, queued: true } })
    }
    if (issue.statusId === 'done') {
      await persistPendingMessage(issueId, prompt, { done: true })
      return c.json({ success: true, data: { issueId, queued: true } })
    }

    try {
      const guard = await ensureWorking(issue)
      if (!guard.ok) {
        return c.json({ success: false, error: guard.reason! }, 400)
      }
      const { prompt: effectivePrompt, pendingIds } = await collectPendingMessages(issueId, prompt)
      const result = await issueEngine.followUpIssue(
        issueId,
        effectivePrompt,
        body.model,
        body.permissionMode,
        body.busyAction,
      )
      await markPendingMessagesDispatched(pendingIds)
      return c.json({
        success: true,
        data: { executionId: result.executionId, issueId },
      })
    } catch (error) {
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Follow-up failed',
        },
        400,
      )
    }
  },
)

// POST /api/projects/:projectId/issues/:id/restart — Restart a failed issue session
session.post('/:id/restart', async (c) => {
  const projectId = c.req.param('projectId')!
  const project = await findProject(projectId)
  if (!project) {
    return c.json({ success: false, error: 'Project not found' }, 404)
  }

  const issueId = c.req.param('id')!
  const issue = await getProjectOwnedIssue(project.id, issueId)
  if (!issue) {
    return c.json({ success: false, error: 'Issue not found' }, 404)
  }

  try {
    const guard = await ensureWorking(issue)
    if (!guard.ok) {
      return c.json({ success: false, error: guard.reason! }, 400)
    }
    // Discard queued messages — restart means fresh start
    const { pendingIds } = await collectPendingMessages(issueId, '')
    await markPendingMessagesDispatched(pendingIds)
    const result = await issueEngine.restartIssue(issueId)
    return c.json({
      success: true,
      data: { executionId: result.executionId, issueId },
    })
  } catch (error) {
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Restart failed',
      },
      400,
    )
  }
})

// POST /api/projects/:projectId/issues/:id/cancel — Cancel
session.post('/:id/cancel', async (c) => {
  const projectId = c.req.param('projectId')!
  const project = await findProject(projectId)
  if (!project) {
    return c.json({ success: false, error: 'Project not found' }, 404)
  }

  const issueId = c.req.param('id')!
  const issue = await getProjectOwnedIssue(project.id, issueId)
  if (!issue) {
    return c.json({ success: false, error: 'Issue not found' }, 404)
  }

  try {
    const status = await issueEngine.cancelIssue(issueId)
    return c.json({ success: true, data: { issueId, status } })
  } catch (error) {
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Cancel failed',
      },
      400,
    )
  }
})

export default session

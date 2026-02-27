import { eq } from 'drizzle-orm'
import { db } from '../../db'
import { issues as issuesTable } from '../../db/schema'
import { emitIssueUpdated } from '../../events/issue-events'
import { logger } from '../../logger'

// ---------- Auto-title prompt ----------

export const AUTO_TITLE_PROMPT = [
  '[SYSTEM TASK] Generate a short title for this conversation.',
  'Reply with ONLY the title wrapped in the exact format below — nothing else.',
  '',
  'Format: <bitk><title>TITLE</title></bitk>',
  '',
  'Rules:',
  '- 50 characters max',
  '- No quotes around the title',
  '- No extra text, explanation, or markdown',
  '',
  'Example: <bitk><title>Fix login page crash</title></bitk>',
].join('\n')

// ---------- Title extraction ----------

const TITLE_RE = /<bitk><title>(.*?)<\/title><\/bitk>/

export function extractTitle(content: string): string | null {
  const match = content.match(TITLE_RE)
  const title = match?.[1]?.trim().slice(0, 200)
  return title || null
}

// ---------- Persist extracted title ----------

export function applyAutoTitle(issueId: string, content: string): void {
  const title = extractTitle(content)
  if (!title) return
  try {
    db.update(issuesTable).set({ title }).where(eq(issuesTable.id, issueId)).run()
    emitIssueUpdated(issueId, { title })
    logger.info({ issueId, title }, 'auto_title_updated')
  } catch (err) {
    logger.warn({ issueId, err }, 'auto_title_update_failed')
  }
}

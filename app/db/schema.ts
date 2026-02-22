import { sql } from 'drizzle-orm'
import { check, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { nanoid } from 'nanoid'
import { ulid } from 'ulid'

export function shortId() {
  return text('id')
    .primaryKey()
    .$defaultFn(() => nanoid(8))
}

export function id() {
  return text('id')
    .primaryKey()
    .$defaultFn(() => ulid())
}

export const commonFields = {
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
  isDeleted: integer('is_deleted').notNull().default(0),
}

export const projects = sqliteTable('projects', {
  id: shortId(),
  name: text('name').notNull(),
  alias: text('alias').notNull().unique(),
  description: text('description'),
  directory: text('directory'),
  repositoryUrl: text('repository_url'),
  ...commonFields,
})

export const issues = sqliteTable(
  'issues',
  {
    id: shortId(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id),
    statusId: text('status_id').notNull(),
    issueNumber: integer('issue_number').notNull(),
    title: text('title').notNull(),
    priority: text('priority').notNull().default('medium'),
    sortOrder: integer('sort_order').notNull().default(0),
    parentIssueId: text('parent_issue_id').references((): any => issues.id),
    useWorktree: integer('use_worktree', { mode: 'boolean' }).notNull().default(false),
    // Session fields (null = no engine session started)
    engineType: text('engine_type'),
    sessionStatus: text('session_status'),
    prompt: text('prompt'),
    externalSessionId: text('external_session_id'),

    model: text('model'),
    baseCommitHash: text('base_commit_hash'),
    ...commonFields,
  },
  (table) => [
    index('issues_project_id_idx').on(table.projectId),
    index('issues_status_id_idx').on(table.statusId),
    index('issues_parent_issue_id_idx').on(table.parentIssueId),
    check('issues_status_id_check', sql`${table.statusId} IN ('todo','working','review','done')`),
  ],
)

export const appSettings = sqliteTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  ...commonFields,
})

export const issueLogs = sqliteTable(
  'issue_logs',
  {
    id: id(),
    issueId: text('issue_id')
      .notNull()
      .references(() => issues.id),
    turnIndex: integer('turn_index').notNull().default(0),
    entryIndex: integer('entry_index').notNull(),
    entryType: text('entry_type').notNull(),
    content: text('content').notNull(),
    metadata: text('metadata'),
    toolAction: text('tool_action'),
    replyToMessageId: text('reply_to_message_id'),
    timestamp: text('timestamp'),
    ...commonFields,
  },
  (table) => [
    index('issue_logs_issue_id_idx').on(table.issueId),
    index('issue_logs_issue_id_turn_entry_idx').on(
      table.issueId,
      table.turnIndex,
      table.entryIndex,
    ),
  ],
)

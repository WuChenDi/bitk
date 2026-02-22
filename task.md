# Kanban App — Task List

> Updated: 2026-02-25
> Compressed from 170+ iterative tasks into feature-level tracking.

## Usage

### Task Format

- [ ] **PREFIX-001 Short imperative title** `P1`
  - description: What to do, context, and acceptance criteria
  - activeForm: Present-continuous spinner text
  - createdAt: YYYY-MM-DD HH:mm
  - blocked by: Prerequisite tasks (optional)
  - blocks: Downstream tasks (optional)
  - owner: Assignee (optional)

### Task ID

- Format: `PREFIX-NNN` — uppercase category prefix + sequential number.
- IDs are stable once assigned; never reuse or renumber.
- Next IDs: UI-014, FE-125, BUG-078, SEC-023, ARCH-015, AGENT-012, SSE-004, PERF-004, TEST-008, FEAT-005, OBS-005, AUDIT-006, CLEAN-007, ENG-003, API-006, UX-004

### Status Markers

| Marker | Meaning           |
| ------ | ----------------- |
| `[ ]`  | Pending           |
| `[-]`  | In progress       |
| `[x]`  | Completed         |
| `[~]`  | Closed / Won't do |

### Priority Levels

| Tag  | Meaning                            |
| ---- | ---------------------------------- |
| `P0` | Blocking issue, handle immediately |
| `P1` | High priority, current iteration   |
| `P2` | Medium priority, next iteration    |
| `P3` | Low priority, to be planned        |

---

## Completed Features (Summary)

### UI Foundation (UI-001 ~ UI-013)

- [x] Project dashboard as default homepage
- [x] Custom typography (DM Sans + JetBrains Mono)
- [x] Unified light/dark theme with OKLCH palette
- [x] Consistent border-radius (sharp corners)
- [x] Page/card entry animations (tw-animate-css)
- [x] Enhanced drag-and-drop visual feedback
- [x] Background texture and depth
- [x] Mobile: direct navigation to issue detail, simplified nav/drawer, modal sizing
- [x] Kanban/list view mode switcher (persisted to localStorage)
- [x] Dark theme logo variant
- [x] Worktree option on issue creation
- [x] BitK rebranding with BK logo (UI-014)

### Agent/Engine System (AGENT-001 ~ AGENT-011)

- [x] Database schema for agent execution (profiles, sessions, processes, logs)
- [x] Core TypeScript types (AgentType, AgentProtocol, AgentCapability, SpawnOptions)
- [x] CLI agent discovery with version/auth detection and caching
- [x] Fluent command builder for CLI invocations
- [x] Claude Code executor with stream-json parsing, model selection, permission modes
- [x] Codex and Gemini executor stubs with registry pattern
- [x] Log normalization system (JSONL → NormalizedLogEntry, async iterators)
- [x] Session management API routes and lifecycle
- [x] Process lifecycle manager (spawn, monitor, timeout, cancel, cleanup)
- [x] Startup agent probe with auto-detected models (cached 10min)
- [x] Claude Code bidirectional control protocol (tool permissions, interrupt, stdin reuse)

### Architecture (ARCH-001 ~ ARCH-014)

- [x] Suspense fallback + ErrorBoundary in main.tsx
- [x] QueryClient defaults (staleTime: 30s, retry: 1)
- [x] Merged agent_sessions into issues table (1:1 relationship)
- [x] Decoupled issue creation from process execution (fire-and-forget)
- [x] Removed statuses table → hardcoded constants (todo, in-progress, in-review, done)
- [x] Merged Session+Process into single IssueEngine class
- [x] Replaced @hono/vite-dev-server with Vite proxy + separate Bun API
- [x] Active process stdin reuse for same-issue chat turns (conversational mode)
- [x] Same-turn log grouping for active-process follow-ups
- [x] Follow-up write serialization by turn completion boundary
- [x] Per-issue process manager lock with pid tracing
- [x] Soft-cancel (interrupt-only) for active issue process
- [~] Repository interface for data layer (ARCH-001) — deferred, routes use Drizzle directly

### Database (DB-001 ~ DB-003)

- [x] Migrated projects to SQLite/Drizzle
- [x] Migrated issues to SQLite/Drizzle (removed mock middleware + memory-store)
- [x] Removed statuses table, using hardcoded constants
- [x] Added CHECK constraint on statusId column
- [x] Added reply_to_message_id column to issue_logs

### Security (SEC-001 ~ SEC-020)

- [x] Bearer token auth middleware on all /api/\* routes (timing-safe comparison)
- [x] Filesystem endpoint restricted to workspace root
- [x] Removed hardcoded dangerouslySkipPermissions, validate workingDir
- [x] Runtime endpoint gated behind ENABLE_RUNTIME_ENDPOINT env var
- [x] Security headers (hono/secure-headers), CORS (hono/cors)
- [x] Env var allowlist for child processes (no full process.env passthrough)
- [x] Engine type validated against enum
- [x] Bulk update array capped at .max(1000)
- [x] Workspace path validated in settings route
- [x] Default Claude permission mode changed to plan (not bypass)
- [x] SSE events filtered by project scope
- [x] Git path arguments validated against injection
- [x] AI subprocess working directory restricted to workspace setting
- [x] Workspace root check applied to fire-and-forget triggerIssueExecution (SEC-021)
- [~] Rate limiting (SEC-014) — deferred, personal project

### API Quality (API-001 ~ API-004)

- [x] Zod input validation on all POST/PATCH routes (@hono/zod-validator)
- [x] Global error handler with standardized envelope + winston logging
- [x] Cross-project ownership checks on all data operations
- [x] ProcessManager memory leak fixed (TTL cleanup, unsubscribe callbacks)

### Frontend — Chat & Issue Detail (FE-006 ~ FE-023)

- [x] Auto-execute on issue creation + navigate to detail page
- [x] Immediate user message echo + thinking placeholder
- [x] Markdown rendering in issue description and chat messages
- [x] Full datetime timestamps in chat
- [x] Removed fake TokenUsage component
- [x] Session status badges removed from header (kept in-stream only)
- [x] Cancel button on thinking bar with forced queue mode
- [x] User/assistant messages on same side, user messages boxed
- [x] Hidden duration summary and system init messages

### Frontend — Tool Rendering (FE-024 ~ FE-064)

- [x] Tool-use execution/result messages grouped into pairs
- [x] File tools rendered as collapsible editor blocks with code highlighting
- [x] Command tools: truncated title with inline code styling, expandable full command + output
- [x] Generic tool results collapsed by default with preview
- [x] Unified tool panel component (ToolPanel) with consistent borders/spacing/fold
- [x] Dedicated wrench icon for tool rows (separate from assistant avatar)
- [x] Per-tool inner icons by kind (file/command/search/web)
- [x] TodoWrite payloads hidden from chat, used for working-step state
- [x] File-edit diff rendered with react-diff-viewer-continued
- [x] CodeMirror syntax highlighting for tool-use code blocks
- [x] Enlarged chat text size, centered avatars, full-width messages

### Frontend — Diff Panel (FE-065 ~ FE-116)

- [x] Git workspace change tracking via backend API (changed files + per-file patches)
- [x] Per-file line change summary (+N -M) from server without preloading patches
- [x] Lazy-load per-file patch on expand
- [x] Changed-files badge in ChatInput wired to live git data
- [x] Final renderer: @pierre/diffs with bars indicators, GitHub light/dark themes, expand mode
- [x] File diffs collapsed by default, expandable with unchanged line expansion
- [x] Mobile scrolling fixed for diff panel
- Previous iterations tried and replaced: custom diff → react-diff-viewer → diff2html → Monaco → CodeMirror Merge → @git-diff-view/react → @pierre/diffs (final)

### Frontend — Settings & UI Polish

- [x] Hide unavailable engines on settings page (FE-009)
- [x] Dialog overflow/scroll fixed for small viewports (FE-010)
- [x] Markdown typography refined for tables/lists/code/spacing (FE-018)
- [x] Issue detail sidebar width compressed (FE-096)
- [x] Chat input padding optimized (FE-076)
- [x] Code highlight theme: project-native styles, compact line-height (FE-057/058/059/060)
- [x] File attachment UI removed (dead code, never wired to API) (FE-117)
- [x] Dead i18n keys from file attachment removal cleaned up (FE-124)
- [x] File deduplication logic extracted to shared utility (FE-118)
- [x] formatModelName extracted to shared format.ts (FE-119)
- [x] Window resize listener leak fixed in panel-store (FE-120)
- [x] ErrorBoundary i18n added (FE-121)
- [x] useUpdateIssue mutation type widened (FE-122)
- [~] IssueListPanel/IssueDetail consolidation (FE-123) — closed, minimal overlap found

### SSE & Real-time (SSE-001 ~ SSE-003)

- [x] Global SSE endpoint (/api/events) replacing per-issue connections
- [x] Status changes pushed via SSE (replaced 3s polling)
- [x] SSE projectId alias→ULID resolution + async callback safety + disconnect cleanup (SSE-003)

### Performance (PERF-001 ~ PERF-002)

- [x] unstorage-based unified cache layer (project lookups 60s TTL, agent discovery 5min TTL)
- [x] Replaced Winston with Pino + HTTP request logging

### Bug Fixes — Engine & Process (BUG-006 ~ BUG-026)

- [x] Stream cross-talk and follow-up trim (BUG-006)
- [x] Full multi-turn history preserved in logs API (BUG-007)
- [x] ChatArea null guard before issue load (BUG-008)
- [x] Auto permission mode effective (BUG-010), AskUserQuestion disallowed in follow-up (BUG-009)
- [x] Duplicate follow-up prevention: client send lock + server cross-turn dedup (BUG-013/014)
- [x] Follow-up handler this-binding fix (BUG-015)
- [x] Thinking indicator: aligned with process state, same-turn continued chat, stale indicator fix (BUG-016/017/020)
- [x] Missing execution events surfaced in chat (BUG-018)
- [x] error_during_execution treated as failed session (BUG-019)
- [x] Cancel noise suppressed (BUG-025/026)
- [x] Auto-create missing project directory on execute (BUG-021/022)
- [x] Auto-recreate missing Claude external session ID (BUG-023)
- [x] Thinking payloads filtered from logs/UI (BUG-024)
- [x] SessionStart hook messages suppressed from client logs (BUG-027/028)

### Bug Fixes — Frontend UI (BUG-001 ~ BUG-005, BUG-029 ~ BUG-065)

- [x] Mobile: send button clipping, toolbar line, keyboard layout, modal sizing (BUG-001 ~ BUG-005)
- [x] Command preview: unified truncation logic, short chain handling (BUG-029/030)
- [x] File-read panel interaction consistency (BUG-031)
- [x] Per-tool inner icons restored (BUG-032)
- [x] File-read indentation preserved when stripping line numbers (BUG-033)
- [x] Inline-code gray background on code fences fixed (BUG-034)
- [x] Empty string content treated as valid file write payload (BUG-035)
- [x] Diff panel: numbering, parse fallback, per-file loading, line overlap, scroll, CSS conflicts (BUG-036 ~ BUG-052)
- [x] Pierre diff null patch crash fixed (BUG-054), unchanged lines collapsed (BUG-055)
- [x] Mobile diff scrolling (BUG-056), issue list spacing (BUG-057)
- [x] Issue description field removed from API and UI (BUG-058)
- [x] Kanban drag-and-drop persistence fixed (flat payload vs nested) (BUG-059)
- [x] Issue list drag-and-drop with empty-state placeholders (BUG-061/062)
- [x] Issue list row padding reduced (BUG-063)
- [x] Sub-issue panel replaced with header button (BUG-064/065)

### Bug Fixes — Infrastructure (BUG-066 ~ BUG-072)

- [x] IssueEngine Map memory growth bounded (periodic GC sweep) (BUG-066)
- [x] DB write failures in persistLogEntry now logged (BUG-067)
- [x] Fire-and-forget execution error boundary added (BUG-068)
- [x] Global concurrency limit on IssueEngine (BUG-069)
- [x] Migration error silencing fixed (specific SQLite error code match) (BUG-070)
- [x] Pending message duplication on todo→in-progress fixed (BUG-072)

### Status-Driven Execution (FEAT-001 ~ FEAT-003)

- [x] Status-driven AI lifecycle: todo=planning, in-progress=active, completion→in-review
- [x] Pending message queue for todo issues (persisted, shown with amber indicator, auto-flushed)
- [x] Pending message architecture audit: dedup, SSE emit, failure handling, stale closure fix
- [x] reply_to_message_id field linking agent responses to user messages

### Observability (OBS-001 ~ OBS-004)

- [x] Detailed executor lifecycle logging (route context, queue/cancel decisions, spawn details)
- [x] Active follow-up hardened with fallback, IO logs at info level by default
- [x] Verbose result errors redacted in protocol logs
- [x] SessionStart startup noise suppressed from API protocol logs

### Code Cleanup (CLEAN-001 ~ CLEAN-005)

- [x] Backend code deduplication (classifyCommand, DEFAULT_STATUSES)
- [x] Priority icon inconsistency fixed
- [x] board-store magic timeout replaced with onSettled callback
- [x] Unused tags feature removed entirely (~535 lines)
- [x] Documented bypass permission mode behavioral change in claude.ts (CLEAN-005)

### Testing (TEST-001 ~ TEST-005)

- [x] Frontend test infrastructure (vitest + @testing-library/react + jsdom)
- [x] 15 failing backend tests fixed
- [x] Status transition API integration tests (13 tests)
- [x] Tests for engines, filesystem, settings API routes
- [~] Auth/engines/filesystem/settings route tests (TEST-001 original) — superseded by TEST-005

### Audit (AUDIT-001 ~ AUDIT-003)

- [x] Full project audit by 5 parallel agents (AUDIT-001)
- All critical/high findings from audit resolved (SEC-014 ~ SEC-020, BUG-066 ~ BUG-072, FE-117 ~ FE-122, TEST-003 ~ TEST-005)
- [x] Full project code review — 1 CRITICAL + 5 HIGH findings fixed (AUDIT-003)

---

## Active / Open Tasks

- [x] **BUG-074 Add reconciler to auto-fix stale in-progress issues to in-review** `P1`
  - description: Implement a state-process reconciliation path that moves issues from `in-progress` to `in-review` when no active process exists, instead of updating only `sessionStatus`. Cover startup cleanup and periodic/triggered checks used by the engine lifecycle.
  - activeForm: Implementing stale in-progress reconciler
  - createdAt: 2026-02-25 20:13
  - blocks: TEST-006

- [x] **BUG-075 Persist running follow-up inputs as pending entries** `P1`
  - description: When an issue is already running and receives follow-up input, persist the user message as `metadata.pending=true` in `issue_logs` before queueing for execution, so queued inputs survive restarts and remain auditable.
  - activeForm: Persisting running follow-up inputs
  - createdAt: 2026-02-25 20:13
  - blocks: BUG-076, TEST-006

- [x] **BUG-076 Replace pending deletion with pending=false transition** `P1`
  - description: Replace `deletePendingMessages(...)` after dispatch with metadata updates that mark messages `pending=false`, preserving full message history while still preventing duplicate resend.
  - activeForm: Converting pending cleanup to state transition
  - createdAt: 2026-02-25 20:13
  - blocked by: BUG-075
  - blocks: TEST-006

- [x] **CLEAN-006 Unify pending terminology across docs and API contracts** `P3`
  - description: Standardize wording to `pending` (remove ambiguous `padding` wording) in docs (`tmp/qa.md`, AGENTS guidance if applicable), API comments, and user-facing copy to avoid implementation mismatch.
  - activeForm: Unifying pending terminology
  - createdAt: 2026-02-25 20:13

- [x] **BUG-077 Fix pre-existing test failures in health, filesystem, engines, and pending tests** `P1`
  - description: Fixed 4 pre-existing test failures: (1) health test updated for `{success,data}` envelope, (2) filesystem tests updated for SEC-022 workspace root enforcement, (3) engines probe timeout increased from 5s to 30s, (4) pending-messages-unit test updated for `markPendingMessagesDispatched` rename.
  - activeForm: Fixing pre-existing test failures
  - createdAt: 2026-02-26 21:00

- [x] **TEST-007 Update pending-messages-unit tests for markPendingMessagesDispatched** `P1`
  - description: Updated test imports and assertions after BUG-076 renamed `deletePendingMessages` to `markPendingMessagesDispatched`. Tests now verify state transition (pending=false) instead of row deletion.
  - activeForm: Updating pending message unit tests
  - createdAt: 2026-02-26 21:00

- [x] **TEST-006 Add regression tests for pending/review reconciliation flows** `P1`
  - description: Add tests for three uncovered flows: (1) follow-up during active run persists pending markers, (2) execution failure/unknown error moves issue to `in-review`, (3) stale `in-progress` with missing process is auto-corrected to `in-review`.
  - activeForm: Adding reconciliation and pending regression tests
  - createdAt: 2026-02-25 20:13
  - blocked by: BUG-074, BUG-075, BUG-076

- [x] **FEAT-004 Rename issue status markers to Todo/Working/Review/Done** `P1`
  - description: Update the issue status marker set from todo/in-progress/in-review/done to Todo/Working/Review/Done consistently across backend constants, frontend status definitions, schema constraints, API validation, and tests. Keep workflow behavior unchanged while renaming status semantics.
  - activeForm: Renaming issue status markers
  - createdAt: 2026-02-25 20:13

- [x] **AUDIT-005 Write issue-status QA audit report to tmp/qa.md** `P1`
  - description: Consolidate the issue status lifecycle audit into `tmp/qa.md`, including severity-ranked findings, code evidence, coverage gaps, and recommended fixes for reconciler and pending/padding behavior.
  - activeForm: Writing issue-status QA report
  - createdAt: 2026-02-25 20:07
  - owner: codex

- [x] **AUDIT-004 Audit issue status execution logic against agreed state machine** `P1`
  - description: Review backend/frontend implementation against the agreed issue lifecycle rules for todo/in-progress/in-review/done, pending message flushing, agent run transitions, and process-state reconciliation. Report mismatches with severity and file/line evidence.
  - activeForm: Auditing issue status execution logic
  - createdAt: 2026-02-25 19:32
  - owner: codex

- [x] **AUDIT-002 Audit current project and write full report** `P1`
  - description: Perform a comprehensive audit of backend/frontend architecture, implemented features, and quality/security risks. Produce `tmp/audit.md` with complete functional inventory and issue list with severity and evidence.
  - activeForm: Auditing project and writing report
  - createdAt: 2026-02-25 14:16
  - owner: codex

- [x] **AUDIT-003 Fix all CRITICAL and HIGH findings from code review** `P0`
  - description: Fix 1 CRITICAL (SSE projectId alias→ULID mismatch) and 5 HIGH issues (async SSE callbacks, workspace root check in \_shared.ts, bypass mode docs, dead i18n keys, SSE connection leak) identified by full project code review.
  - activeForm: Fixing review findings
  - createdAt: 2026-02-26 14:20
  - owner: codex

- [x] **SEC-022 Restrict filesystem API to workspace root** `P0`
  - description: `app/routes/filesystem.ts` GET /dirs and POST /dirs accept arbitrary paths with no workspace boundary check. Apply `getAppSetting('workspace:defaultPath')` validation (same pattern as session.ts SEC-016). Also validate POST `name` is a basename only (no `../`, no absolute path). Audit ref: SEC-FS-001.
  - activeForm: Restricting filesystem API to workspace root
  - createdAt: 2026-02-26 14:30

- [x] **ENG-001 Disable unimplemented engines in UI** `P1`
  - description: Codex and Gemini executors throw on `spawn()`/`spawnFollowUp()` but remain selectable in CreateIssueDialog engine dropdown. Add `executable: false` to engine availability response for engines whose `spawn` is not implemented, and disable them in the frontend dropdown. Audit ref: ENG-EXEC-001.
  - activeForm: Disabling unimplemented engines in UI
  - createdAt: 2026-02-26 14:30

- [x] **API-005 Wrap /api and /api/health in standard envelope** `P2`
  - description: `/api` info and `/api/health` endpoints return raw JSON objects without the `{success, data}` envelope that the frontend API client expects. Wrap both in the standard envelope for contract consistency. Audit ref: API-CONTRACT-001.
  - activeForm: Wrapping health endpoints in standard envelope
  - createdAt: 2026-02-26 14:30

- [x] **UX-001 Wire permission mode from CreateIssueDialog to backend** `P2`
  - description: `CreateIssueDialog.tsx` maintains `permission` state but never sends it in the create mutation payload. Either add `permissionMode` to `createIssueSchema` and forward it through the auto-execute chain, or remove the UI control. Audit ref: UX-ISSUE-001.
  - activeForm: Wiring permission mode to create issue flow
  - createdAt: 2026-02-26 14:30

- [x] **ENG-002 Add timeout and background mode to engine probe** `P2`
  - description: `/api/engines/probe` is blocking with no global timeout. Codex probe can hang due to `app-server` subprocess. Add a total timeout (e.g. 30s), abort long probes, and consider returning a 202 with polling. Audit ref: ENG-PROBE-001.
  - activeForm: Adding timeout to engine probe
  - createdAt: 2026-02-26 14:30

- [x] **UX-002 Implement kanban search and filter** `P3`
  - description: KanbanHeader search input and Filter button are placeholder UI with no logic. Either implement client-side filtering or remove the controls to avoid misleading users. Audit ref: UX-KANBAN-001.
  - activeForm: Implementing kanban search/filter
  - createdAt: 2026-02-26 14:30

- [x] **UX-003 Fix mobile Agents button** `P3`
  - description: `MobileSidebar.tsx:195-202` Agents button has no `onClick` handler — dead interaction. Wire it to show agents/engine status or remove it. Audit ref: UX-MOBILE-001.
  - activeForm: Fixing mobile Agents button
  - createdAt: 2026-02-26 14:30

- [x] **PERF-003 Add TTL eviction to issueProjectCache** `P3`
  - description: `app/routes/events.ts` `issueProjectCache` Map grows unbounded. Add TTL-based eviction (e.g. 5min) or use the existing `unstorage` cache layer. Also invalidate entries when issues are deleted. Audit ref: PERF-SSE-001.
  - activeForm: Adding cache eviction to issueProjectCache
  - createdAt: 2026-02-26 14:30

---

## Deferred / Won't Do

- [~] **ARCH-001 Repository interface for data layer** — Routes use Drizzle directly; abstraction unnecessary for current scale.
- [~] **SEC-014 Rate limiting** — Personal project, not exposed to public internet.
- [~] **SEC-015 Filesystem path traversal re-fix** — Deferred pending workspace setting architecture.
- [~] **SEC-AUTH-001 Fail-open auth and CORS wildcard** — Personal tool, fail-open by design in dev. Audit ref: SEC-AUTH-001.
- [~] **SEC-RATE-001 API rate limiting** — Duplicate of SEC-014, personal tool. Audit ref: SEC-RATE-001.
- [~] **FE-088 ChatInput internal padding** — Kept compact per UI preference.
- [~] **FE-123 IssueListPanel/IssueDetail consolidation** — Minimal overlap found in audit.

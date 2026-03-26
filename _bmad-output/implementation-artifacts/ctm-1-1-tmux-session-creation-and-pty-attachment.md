# Story 1.1: tmux Session Creation & PTY Attachment

Status: review

## Story

As a founder,
I want my chat sessions to run inside persistent tmux sessions with a PTY I/O channel,
So that sessions survive app restarts and I never lose conversation context.

## Acceptance Criteria

1. **Given** I send the first message in a new chat session, **When** the system creates the session, **Then** a tmux session is created with name `tinsu-chat-{sessionId}`, environment variables `TINSU_TMUX_SESSION` and `TINSU_SESSION_UUID` are set via `tmux set-environment`, `claude --session-id {uuid} --append-system-prompt {persona}` is sent into the tmux session, a PTY is attached via `ptyService.spawn('bash', ['-c', 'tmux attach-session -t tinsu-chat-{sessionId}'])`, the `chat_sessions.tmux_session` column is populated with the tmux session name, and `sessionCache` is populated with the mapping.

2. **Given** the PTY is attached to the tmux session, **When** the TUI ready detection fires (`writeWhenReady`), **Then** the user's message is written via `ptyService.write()` (not `tmux send-keys`) and the existing 150ms delay between message content and Enter key is preserved.

3. **Given** the system creates a tmux session, **When** the session name is generated, **Then** it uses the `tinsu-chat-` prefix (distinct from task system's `tinsu-` prefix) and the session name passes `SAFE_SHELL_ARG_REGEX` validation.

4. **Given** the database schema, **When** the migration runs, **Then** the `chat_sessions` table has a new `tmux_session TEXT` column and existing rows have `tmux_session = NULL` (no backfill needed).

5. **Given** the ChatCliService is refactored, **When** the orphan logic methods are evaluated, **Then** `findOrphanSession()`, `discoverCorrectUuid()`, and `maybeRetryResume()` are removed and `IDLE_TIMEOUT_MS` is changed from 30 minutes to 2 hours.

6. **Given** session creation completes, **When** timing is measured, **Then** the full flow (tmux new-session + claude spawn + TUI ready) completes in <15 seconds (NFR31).

## Tasks / Subtasks

- [x] Task 1: Add `tmux_session` column to `chat_sessions` schema and migration (AC: #4)
  - [x] 1.1 Add `tmux_session: text('tmux_session')` to the `chat_sessions` table definition in `src/main/db/schema.ts`
  - [x] 1.2 Add incremental migration in `src/main/db/index.ts`: `ALTER TABLE chat_sessions ADD COLUMN tmux_session TEXT` (idempotent, check column existence first)
  - [x] 1.3 Add index: `CREATE INDEX IF NOT EXISTS idx_chat_sessions_tmux_session ON chat_sessions(tmux_session)`

- [x] Task 2: Add `sessionCache` and `sessionToChatCache` Maps to ChatCliService (AC: #1)
  - [x] 2.1 Add `private sessionCache: Map<string, string>` (chatSessionId -> tmuxSessionName)
  - [x] 2.2 Add `private sessionToChatCache: Map<string, string>` (tmuxSessionName -> chatSessionId) for reverse lookups used by hook routing in Story 1.2
  - [x] 2.3 Expose a getter/method for `sessionToChatCache` so `HookListenerService` can access it in Story 1.2

- [x] Task 3: Refactor `spawnSession()` to create tmux session + attach PTY (AC: #1, #2, #3)
  - [x] 3.1 Validate sessionId against `SAFE_SHELL_ARG_REGEX` (import/define the regex like task-terminal.service.ts line 24)
  - [x] 3.2 Check tmux is available via `TmuxService.checkTmuxInstalled()` (reuse from task-terminal.service.ts)
  - [x] 3.3 Create tmux session: `tmux new-session -d -s tinsu-chat-{sessionId}`
  - [x] 3.4 Set env vars: `tmux set-environment -t tinsu-chat-{sessionId} TINSU_TMUX_SESSION tinsu-chat-{sessionId}` and `tmux set-environment -t tinsu-chat-{sessionId} TINSU_SESSION_UUID {sessionUuid}`
  - [x] 3.5 Send claude command into tmux: `tmux send-keys -t tinsu-chat-{sessionId} 'claude --session-id {uuid} --settings <json> --append-system-prompt <persona>' Enter`
  - [x] 3.6 Attach PTY: `ptyService.spawn('bash', ['-c', 'tmux attach-session -t tinsu-chat-{sessionId}'])` -- this is the I/O layer
  - [x] 3.7 Populate both `sessionCache` and `sessionToChatCache` atomically
  - [x] 3.8 Update chat_sessions.tmux_session in DB
  - [x] 3.9 Preserve `writeWhenReady()` for TUI ready detection on the attached PTY (ctrl+g / /effort detection unchanged)
  - [x] 3.10 Preserve `busySessions.add(sessionId)` after spawn
  - [x] 3.11 Preserve 150ms delay between message content and Enter key in `writeWhenReady`

- [x] Task 4: Remove orphan logic methods from ChatCliService (AC: #5)
  - [x] 4.1 Remove `findOrphanSession()` method (lines 669-678)
  - [x] 4.2 Remove `discoverCorrectUuid()` method (lines 629-656)
  - [x] 4.3 Remove `maybeRetryResume()` method (lines 560-618)
  - [x] 4.4 Remove `updateSessionUuid()` method (lines 684-693)
  - [x] 4.5 Remove `PendingRetryContext` interface and `pendingRetries` Map
  - [x] 4.6 Remove `onResumeFailed` callback and `setOnResumeFailedCallback()`
  - [x] 4.7 Remove all retry/orphan logic from `handlePtyExit()` -- simplify to just update status

- [x] Task 5: Change `IDLE_TIMEOUT_MS` from 30 minutes to 2 hours (AC: #5)
  - [x] 5.1 Change `export const IDLE_TIMEOUT_MS = 30 * 60 * 1000` to `export const IDLE_TIMEOUT_MS = 2 * 60 * 60 * 1000`

- [x] Task 6: Update `sendMessage()` to work with tmux-attached PTY (AC: #2)
  - [x] 6.1 `sendMessage()` still uses `ptyService.write(info.processId, message)` -- the PTY is now attached to tmux, but writes go through the same way
  - [x] 6.2 Ensure the processId in `ChatCliSessionInfo` refers to the tmux-attach PTY process, not the old direct claude process

- [x] Task 7: Update `killSession()` to also kill the tmux session (AC: #1)
  - [x] 7.1 Add `tmux kill-session -t tinsu-chat-{sessionId}` before/after killing the PTY
  - [x] 7.2 Remove from `sessionCache` and `sessionToChatCache`
  - [x] 7.3 Update `killAll()` similarly

- [x] Task 8: Update `sendChatMessage` tRPC mutation for tmux-based flow (AC: #1)
  - [x] 8.1 Case C (no in-memory CLI session): call the refactored `spawnSession()` which now creates tmux + PTY
  - [x] 8.2 Case A (session alive): unchanged -- `sendMessage()` still works via PTY
  - [x] 8.3 Case B (session exited / paused): for this story, treat as Case C (create new tmux session) -- full recovery logic comes in Story 1.3
  - [x] 8.4 Remove the `resumeSession()` code path entirely -- replaced by tmux persistence in Story 1.3

- [x] Task 9: Write tests (AC: all)
  - [x] 9.1 Unit test: `spawnSession()` creates tmux session with correct name, sets env vars, attaches PTY
  - [x] 9.2 Unit test: `sessionCache` and `sessionToChatCache` populated after spawn
  - [x] 9.3 Unit test: `SAFE_SHELL_ARG_REGEX` validation rejects invalid session IDs
  - [x] 9.4 Unit test: `IDLE_TIMEOUT_MS` equals 2 hours
  - [x] 9.5 Unit test: orphan methods removed (verify `findOrphanSession` is not exported)
  - [x] 9.6 Unit test: `tmux_session` column exists in schema
  - [x] 9.7 Integration test: DB migration adds `tmux_session` column idempotently
  - [x] 9.8 Unit test: `killSession()` calls `tmux kill-session`

## Dev Notes

### Architecture Pattern: Two-Layer tmux Model

This story implements the core of the tmux migration using the exact same two-layer pattern the task system already uses:

```
tmux session (persistence layer) --- tinsu-chat-{sessionId}
  |-- PTY attached via ptyService.spawn(tmux attach ...) (I/O layer)
       |-- claude --session-id {uuid} (agent process)
```

The PTY is the I/O channel. Messages are written via `ptyService.write()` (byte-level stdin), NOT via `tmux send-keys` (which has escaping issues with multi-line messages, code blocks, special characters).

### Key Patterns to Reuse from Task System

Reference `src/main/services/task-terminal.service.ts` for:
- `SAFE_SHELL_ARG_REGEX` (line 24): `/^[a-zA-Z0-9_-]+$/`
- `TmuxService.checkTmuxInstalled()` check before creating sessions
- Session naming convention: task uses `tinsu-{projectName}-{taskId}`, chat uses `tinsu-chat-{sessionId}`
- `sessionCache` Map pattern for in-memory lookup
- `tmux new-session -d -s {name}` for detached session creation
- `execAsync('tmux kill-session -t ...')` for cleanup
- `TMUX_COMMAND_TIMEOUT = 5000` for command timeouts

Reference `src/main/services/task-session.service.ts` for:
- `sessionToTaskCache` pattern -> adapt to `sessionToChatCache` for O(1) reverse lookups

### What MUST Stay the Same

These patterns are unchanged and MUST be preserved exactly:
- `writeWhenReady()`: TUI detection via `ctrl+g` / `/effort` -- output flows through tmux transparently
- `busySessions` Set: application-level guard, independent of PTY backing
- 150ms delay between message content and Enter key (paste-mode bug mitigation)
- `buildChatSettingsJson()`: settings JSON for hook injection via `--settings`
- Persona injection via `--append-system-prompt`
- `onData` callback for output capture
- `checkIdleSessions()` periodic check (just change the timeout value)
- `processToSessionMap` for correlating PTY events

### What MUST Be Removed

Remove these methods/properties entirely from `ChatCliService`:
- `findOrphanSession()` (line 669-678) -- tmux names are stable, no orphan UUIDs
- `discoverCorrectUuid()` (line 629-656) -- filesystem scan no longer needed
- `maybeRetryResume()` (line 560-618) -- tmux doesn't need `--resume`
- `updateSessionUuid()` (line 684-693) -- no UUID mismatches with tmux
- `PendingRetryContext` interface (line 41-48) -- retry context no longer needed
- `pendingRetries` Map (line 93) -- retry tracking removed
- `onResumeFailed` callback (line 96) -- no resume failure callback needed
- `setOnResumeFailedCallback()` (line 126-128) -- removed with onResumeFailed
- `resumeSession()` method (line 413-460) -- tmux persistence replaces --resume

### Critical: `sendChatMessage` Router Changes

The three-case handler in `src/main/trpc/routers/chat-session.router.ts` (line 866) currently has:
- **Case A**: session alive -> `sendMessage()` (unchanged)
- **Case B**: session exited -> `resumeSession()` with `--resume` (remove this)
- **Case C**: no session -> `spawnSession()` (refactored to tmux)

For this story (1.1), simplify Cases B and C to both call the refactored `spawnSession()`. Full three-case recovery (Case B: tmux alive + PTY detached) is covered in Story 1.3.

### Schema Migration

Add to `src/main/db/index.ts` in the `applyIncrementalMigrations()` function, after the existing `skip_permissions` migration (around line 535):

```typescript
// CTM-1.1: Add tmux_session column to chat_sessions
const chatCols = new Set(chatSessionColumns.map((c) => c.name))
if (!chatCols.has('tmux_session')) {
  sqlite.exec('ALTER TABLE chat_sessions ADD COLUMN tmux_session TEXT')
}
sqlite.exec('CREATE INDEX IF NOT EXISTS idx_chat_sessions_tmux_session ON chat_sessions(tmux_session)')
```

Note: The `chatSessionColumns` variable is already populated on line 523 of `db/index.ts`. Reuse it -- do NOT query PRAGMA table_info again.

### Environment Variable Injection

tmux environment variables are set per-session, NOT per-shell:
```bash
tmux set-environment -t tinsu-chat-{sessionId} TINSU_TMUX_SESSION tinsu-chat-{sessionId}
tmux set-environment -t tinsu-chat-{sessionId} TINSU_SESSION_UUID {sessionUuid}
```

These variables are inherited by any process spawned inside the tmux session. The hook scripts (Story 1.2) will read `$TINSU_TMUX_SESSION` from the environment. For this story, just ensure the env vars are set -- the hook scripts will be updated in Story 1.2.

### Scope Boundary

This story covers ONLY:
- tmux session creation + PTY attachment for new sessions
- Schema migration for `tmux_session` column
- Orphan logic removal
- Idle timeout change
- Basic session lifecycle (spawn, send, kill)

Out of scope for this story:
- Hook routing changes (Story 1.2)
- Session recovery / startup validation / three-case handler (Story 1.3)
- Concurrent session management (CTM Epic 2)
- UI changes (CTM Epic 2)

### Project Structure Notes

Files to modify:
- `src/main/db/schema.ts` -- add `tmux_session` column to `chat_sessions` table definition
- `src/main/db/index.ts` -- add migration in `applyIncrementalMigrations()`
- `src/main/services/chat-cli.service.ts` -- major refactor (this is the primary file)
- `src/main/trpc/routers/chat-session.router.ts` -- update `sendChatMessage` three-case handler

Files to NOT modify (yet -- handled in subsequent stories):
- `src/main/services/hook-listener.service.ts` -- Story 1.2
- `src/main/resources/chat-hooks/*.sh` -- Story 1.2
- `src/renderer/src/components/planning/ChatPanel.tsx` -- CTM Epic 2

New files: None. All changes are refactors of existing files.

Test files to create:
- `src/main/services/chat-cli.service.test.ts` (co-located with source)

### References

- [Source: _bmad-output/planning-artifacts/epics-chat-tmux-migration.md#Story 1.1]
- [Source: _bmad-output/planning-artifacts/handoff-chat-tmux-migration.md#Architecture: Two-Layer Model]
- [Source: _bmad-output/planning-artifacts/architecture.md#Chat Session tmux Migration Feature Extension]
- [Source: src/main/services/task-terminal.service.ts - tmux session patterns]
- [Source: src/main/services/chat-cli.service.ts - current implementation to refactor]
- [Source: src/main/db/index.ts - migration pattern for chat_sessions]
- [Source: src/main/trpc/routers/chat-session.router.ts#sendChatMessage - three-case handler]
- [Source: _bmad-output/planning-artifacts/project-context.md - testing and naming conventions]

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6 (1M context)

### Debug Log References
- Pre-existing router test failures (47 test files) due to in-memory DB missing columns (workflow_key, context_notes etc.) -- unrelated to CTM-1.1 changes
- Fixed router test DB setup to include workflow_key, skip_permissions, and tmux_session columns
- Pre-existing TypeScript errors in velocity.router (DayData/WeekData types) -- unrelated

### Completion Notes List
- Task 1: Added `tmux_session` TEXT column to `chat_sessions` schema and idempotent migration with index
- Task 2: Added `sessionCache` (chatSessionId->tmuxSessionName) and `sessionToChatCache` (tmuxSessionName->chatSessionId) Maps with `getSessionToChatCache()` getter
- Task 3: Refactored `spawnSession()` from direct PTY spawn to two-layer tmux model: creates detached tmux session, sets env vars, sends claude command via send-keys, attaches PTY for I/O. Now async. Preserved writeWhenReady, busySessions, 150ms delay
- Task 4: Removed all orphan/resume logic: findOrphanSession, discoverCorrectUuid, maybeRetryResume, updateSessionUuid, PendingRetryContext, pendingRetries, onResumeFailed, setOnResumeFailedCallback, resumeSession. Simplified handlePtyExit to just update status
- Task 5: Changed IDLE_TIMEOUT_MS from 30 min to 2 hours (7,200,000 ms)
- Task 6: sendMessage unchanged -- PTY writes work identically through tmux attachment
- Task 7: killSession now calls `tmux kill-session` and cleans both caches. killAll does the same for all sessions
- Task 8: Updated sendChatMessage tRPC mutation: Case B/C now both call spawnSession (no more resumeSession). Mutation is now async. DB tmux_session column updated after spawn
- Task 9: Wrote 41 unit tests covering all ACs. Also updated 57 router tests (98 total passing)
- Additional: Updated hook-listener.service.ts tryRegisterChatOrphan to no-op (minimal change to prevent compilation errors from removed methods)
- Additional: Updated services/index.ts to remove setOnResumeFailedCallback wiring
- Additional: Fixed router test DB schema to include missing columns (workflow_key, skip_permissions, tmux_session)

### File List
- src/main/db/schema.ts (modified: added tmux_session column to chat_sessions table)
- src/main/db/index.ts (modified: added CTM-1.1 migration for tmux_session column + index)
- src/main/services/chat-cli.service.ts (modified: major refactor -- tmux session creation, orphan removal, idle timeout change)
- src/main/services/chat-cli.service.test.ts (modified: complete rewrite -- 41 tests for tmux-based service)
- src/main/services/index.ts (modified: removed setOnResumeFailedCallback wiring)
- src/main/services/hook-listener.service.ts (modified: tryRegisterChatOrphan changed to no-op)
- src/main/trpc/routers/chat-session.router.ts (modified: sendChatMessage now async, uses spawnSession for B/C cases)
- src/main/trpc/routers/chat-session.router.test.ts (modified: removed resumeSession mocks, updated tests for tmux-based flow, fixed DB schema)

### Change Log
- CTM-1.1: Migrated chat sessions from direct node-pty to tmux two-layer model (Date: 2026-03-26)

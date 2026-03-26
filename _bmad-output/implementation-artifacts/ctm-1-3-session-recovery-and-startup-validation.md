# Story 1.3: Session Recovery & Startup Validation

Status: review

## Story

As a founder,
I want the app to detect which chat sessions are still alive on startup and seamlessly recover them,
So that I can restart the app and continue conversations without losing context.

## Acceptance Criteria

1. **Given** the app starts and active chat sessions exist in the database, **When** `validateSessionsOnStartup()` runs, **Then** for each active session with a `tmux_session` value, it runs `tmux has-session -t {tmuxName}`, alive sessions rebuild the `sessionCache` and `sessionToChatCache`, dead sessions are marked `status = 'paused'` with updated `updatedAt`, and validation completes in <5 seconds for up to 20 sessions (NFR29).

2. **Given** I open a chat session that was validated as alive on startup, **When** the PTY was not re-attached yet (Case B: tmux alive, PTY detached), **Then** the system re-attaches a PTY via `ptyService.spawn('bash', ['-c', 'tmux attach-session -t ...'])` and I can send a message immediately after re-attachment.

3. **Given** I send a message to a session marked as 'paused' (tmux session died), **When** the system processes the message (Case C: no tmux), **Then** a new tmux session is created with a fresh `claude --session-id {existing-uuid}`, Claude Code restores conversation context via the session ID, the `--resume` flag is NOT used (tmux persistence replaces it), and `chat_sessions.tmux_session` is updated with the new tmux session name.

4. **Given** the `sendChatMessage` tRPC mutation, **When** it evaluates session state, **Then** it handles three cases:
   - Case A: tmux alive + PTY attached -> send message directly
   - Case B: tmux alive + PTY detached -> re-attach PTY, then send
   - Case C: no tmux session -> create new tmux session, spawn claude, then send

5. **Given** the app restarts and tmux sessions from a previous run are alive, **When** the founder resumes a conversation, **Then** zero context is lost -- the conversation continues from exact state (NFR28).

## Tasks / Subtasks

- [x] Task 1: Add `validateSessionsOnStartup()` to ChatCliService (AC: #1)
  - [x] 1.1 Add a private static-style helper `tmuxSessionExists(sessionName: string): Promise<boolean>` that runs `tmux has-session -t {sessionName}` with `TMUX_COMMAND_TIMEOUT`, returns true on exit code 0, false otherwise (same pattern as `TaskTerminalService.tmuxSessionExists()` at line 537 of task-terminal.service.ts)
  - [x] 1.2 Add `async validateSessionsOnStartup(): Promise<void>` that queries all `chat_sessions` with `status = 'active'` and a non-null `tmux_session`
  - [x] 1.3 Parallelize tmux checks with `Promise.allSettled()` (same pattern as TaskTerminalService line 277) to meet NFR29 (<5s for 20 sessions)
  - [x] 1.4 For alive sessions: populate `sessionCache` (sessionId -> tmuxName) and `sessionToChatCache` (tmuxName -> sessionId). Do NOT attach PTY yet -- that happens lazily in Case B when the user sends a message
  - [x] 1.5 For dead sessions: update DB `status = 'paused'` and `updated_at = new Date()`
  - [x] 1.6 For check failures (Promise rejected): treat conservatively as dead, same as task-terminal pattern
  - [x] 1.7 Log summary: `"[ChatCliService] Startup validation complete: N alive, M paused"`

- [x] Task 2: Add `reattachSession()` to ChatCliService (AC: #2)
  - [x] 2.1 Add `async reattachSession(sessionId: string, sessionUuid: string, projectPath: string): Promise<string>` that attaches a PTY to an existing alive tmux session
  - [x] 2.2 Look up tmux session name from `sessionCache`; throw if not found
  - [x] 2.3 Verify tmux session is still alive via `tmuxSessionExists()` before attempting PTY attach; throw if dead
  - [x] 2.4 Attach PTY: `ptyService.spawn('bash', ['-c', 'tmux attach-session -t {tmuxName}'], { cwd: projectPath })`
  - [x] 2.5 Update `sessions` Map with new `ChatCliSessionInfo` (processId, sessionUuid, status: 'running')
  - [x] 2.6 Update `processToSessionMap` and `lastActivityMap`
  - [x] 2.7 Return the new processId
  - [x] 2.8 Do NOT call `writeWhenReady()` or `busySessions.add()` -- the TUI is already initialized in the tmux session; the next `sendMessage()` call will handle writing

- [x] Task 3: Add `isTmuxAlive()` public method to ChatCliService (AC: #4)
  - [x] 3.1 Add `async isTmuxAlive(sessionId: string): Promise<boolean>` that checks if the tmux session exists (via sessionCache lookup + tmuxSessionExists)
  - [x] 3.2 This is used by the router to distinguish Case B (tmux alive, PTY detached) from Case C (tmux dead)

- [x] Task 4: Refactor `sendChatMessage` three-case handler in chat-session.router.ts (AC: #4)
  - [x] 4.1 Case A: `chatCliService.isSessionAlive(sessionId)` returns true -> call `chatCliService.sendMessage()` directly (unchanged from CTM-1.1)
  - [x] 4.2 Case B: `!isSessionAlive` BUT `await chatCliService.isTmuxAlive(sessionId)` returns true -> call `await chatCliService.reattachSession(sessionId, session.session_uuid, projectPath)`, then call `chatCliService.sendMessage(sessionId, cliMessage)`
  - [x] 4.3 Case C: both false -> call `await chatCliService.spawnSession(...)` as before (existing code). Update `chat_sessions.tmux_session` with new tmux name
  - [x] 4.4 The persona context loading logic (bmadRoot, PersonaContextService, buildContext) stays the same and applies to Case C only -- Cases A and B reuse the existing session's persona
  - [x] 4.5 Ensure Case C updates `chat_sessions.status` back to `'active'` (it was 'paused' from dead tmux detection)

- [x] Task 5: Call `validateSessionsOnStartup()` on app initialization (AC: #1)
  - [x] 5.1 In `src/main/services/index.ts`, after the `chatCliService` singleton is created (line 120), add a function `initializeChatSessions()` that calls `chatCliService.validateSessionsOnStartup()`
  - [x] 5.2 Export `initializeChatSessions` so it can be called during app startup (from `src/main/index.ts` or wherever services are initialized)
  - [x] 5.3 The call must be async and non-blocking -- startup should continue even if validation fails (catch and log errors, same pattern as TaskTerminalService)
  - [x] 5.4 Alternatively, add a `validateChatSessions` tRPC mutation that calls `chatCliService.validateSessionsOnStartup()` and invoke it from the router init path. Choose whichever pattern matches the existing app startup pattern for task session validation

- [x] Task 6: Write tests (AC: all)
  - [x] 6.1 Unit test: `validateSessionsOnStartup()` with 3 active sessions (2 alive, 1 dead) -> alive sessions populate caches, dead session marked 'paused'
  - [x] 6.2 Unit test: `validateSessionsOnStartup()` with no active sessions -> no-op, no errors
  - [x] 6.3 Unit test: `validateSessionsOnStartup()` with sessions that have no `tmux_session` column (legacy) -> skipped silently
  - [x] 6.4 Unit test: `tmuxSessionExists()` returns true when `tmux has-session` exits 0, false when exits non-zero
  - [x] 6.5 Unit test: `reattachSession()` spawns PTY with correct tmux attach command, updates sessions Map and processToSessionMap
  - [x] 6.6 Unit test: `reattachSession()` throws if tmux session is not alive (dead between cache lookup and attach)
  - [x] 6.7 Unit test: `isTmuxAlive()` returns true when sessionCache has entry and tmux session exists, false otherwise
  - [x] 6.8 Integration test: `sendChatMessage` Case B -- session in cache from startup validation, PTY not attached, router calls reattachSession then sendMessage
  - [x] 6.9 Integration test: `sendChatMessage` Case C -- session status 'paused', no tmux, router creates new tmux session, updates tmux_session and status in DB
  - [x] 6.10 Unit test: Parallel validation with `Promise.allSettled` -- one rejection doesn't block other checks
  - [x] 6.11 Unit test: `reattachSession()` does NOT call `writeWhenReady()` or add to `busySessions`

## Dev Notes

### Architecture: Three-Case sendChatMessage After This Story

This story completes the three-case handler that CTM-1.1 stubbed. The current implementation (after CTM-1.1) treats both Case B and Case C identically by calling `spawnSession()`. This story differentiates them:

```
sendChatMessage(sessionId, content):
  1. Look up session from DB
  2. Case A: chatCliService.isSessionAlive(sessionId)
     → PTY running, tmux alive → sendMessage() directly
  3. Case B: !isSessionAlive BUT isTmuxAlive(sessionId)
     → tmux alive, PTY detached (app restarted) → reattachSession() then sendMessage()
  4. Case C: both false
     → tmux dead or never existed → spawnSession() with full claude spawn
     → Update tmux_session and status='active' in DB
```

Case B is the key recovery path: the user restarted the app, `validateSessionsOnStartup()` rebuilt caches, but the PTY hasn't been re-attached yet. When the user sends a message, the router detects tmux is alive but PTY is detached, calls `reattachSession()`, and then sends the message.

### reattachSession() vs spawnSession() Key Differences

| Aspect | `reattachSession()` | `spawnSession()` |
|--------|---------------------|------------------|
| tmux session | Already exists | Creates new one |
| claude process | Already running in tmux | Spawned via tmux send-keys |
| `writeWhenReady()` | NOT called (TUI already initialized) | Called (waits for TUI ready) |
| `busySessions.add()` | NOT called | Called (marks busy during TUI detection) |
| env vars | Already set from original spawn | Set via `tmux set-environment` |
| Cache updates | `sessions`, `processToSessionMap`, `lastActivityMap` only | All caches + `sessionCache`/`sessionToChatCache` |
| PTY attachment | `ptyService.spawn('bash', ['-c', 'tmux attach-session -t ...'])` | Same PTY attachment pattern |

The critical difference: `reattachSession()` must NOT call `writeWhenReady()`. The TUI is already initialized and accepting input -- calling `writeWhenReady` would wait for "ctrl+g"/"/effort" output that may have already been emitted and won't repeat. The subsequent `sendMessage()` call writes the message directly via `ptyService.write()`.

### validateSessionsOnStartup() Pattern

Adapted from `TaskTerminalService.validateSessionsOnStartup()` (line 262-328):

```typescript
async validateSessionsOnStartup(): Promise<void> {
  try {
    // Query all active sessions with tmux_session set
    const activeSessions = db.select().from(chat_sessions)
      .where(and(
        eq(chat_sessions.status, 'active'),
        isNotNull(chat_sessions.tmux_session)
      )).all()

    if (activeSessions.length === 0) {
      console.log('[ChatCliService] Startup validation: 0 active sessions')
      return
    }

    // Parallelize tmux checks (NFR29: <5s for 20 sessions)
    const results = await Promise.allSettled(
      activeSessions.map(async (session) => ({
        session,
        alive: await this.tmuxSessionExists(session.tmux_session!)
      }))
    )

    let aliveCount = 0, pausedCount = 0
    for (const result of results) {
      if (result.status === 'rejected') {
        pausedCount++ // Conservative: treat failures as dead
        continue
      }
      const { session, alive } = result.value
      if (alive) {
        this.sessionCache.set(session.id, session.tmux_session!)
        this.sessionToChatCache.set(session.tmux_session!, session.id)
        aliveCount++
      } else {
        db.update(chat_sessions)
          .set({ status: 'paused', updated_at: new Date() })
          .where(eq(chat_sessions.id, session.id))
          .run()
        pausedCount++
      }
    }
    console.log(`[ChatCliService] Startup validation: ${aliveCount} alive, ${pausedCount} paused`)
  } catch (error) {
    console.warn('[ChatCliService] Startup validation error:', error)
    // Don't throw -- startup should continue
  }
}
```

### DB Access Pattern in ChatCliService

Currently `ChatCliService` does NOT import or use `db` directly. All DB operations happen in the router (`chat-session.router.ts`) or in `services/index.ts` callbacks. For `validateSessionsOnStartup()`, you have two options:

**Option A (recommended): Pass db operations via callback/dependency injection.**
Add a `setDbCallbacks()` method or accept a db adapter in the constructor, similar to how `setOnIdleCallback()` works. This keeps ChatCliService loosely coupled from the DB layer.

**Option B: Import db directly in ChatCliService.**
Import `{ db }` from `'../db'` and `{ chat_sessions }` from `'../db/schema'`. This is simpler but tightens coupling. The task-terminal.service.ts uses this approach (imports db directly at line 10). Since chat-cli.service.ts will need db access for both startup validation and potentially future operations, direct import is pragmatic.

Choose Option B for consistency with `TaskTerminalService` which imports `db` directly.

### Imports to Add to ChatCliService

```typescript
import { db } from '../db'
import { chat_sessions } from '../db/schema'
import { eq, and, isNotNull } from 'drizzle-orm'
```

### sendChatMessage Router Changes

The existing Case B/C block at line 956-994 of `chat-session.router.ts` currently does:
```typescript
} else {
  // Case B/C: Session exited or never started -- create new tmux session
  const projectPath = getProjectPath(session.project_id)
  // ... persona context loading ...
  await chatCliService.spawnSession(...)
  // Update tmux_session in DB
}
```

Replace with the three-case logic:
```typescript
} else {
  const projectPath = getProjectPath(session.project_id)

  if (await chatCliService.isTmuxAlive(input.sessionId)) {
    // Case B: tmux alive, PTY detached -> reattach and send
    await chatCliService.reattachSession(input.sessionId, session.session_uuid, projectPath)
    chatCliService.sendMessage(input.sessionId, cliMessage)
  } else {
    // Case C: no tmux -> create new session
    // ... existing persona context loading ...
    await chatCliService.spawnSession(...)
    // Update tmux_session and status='active' in DB
    db.update(chat_sessions)
      .set({
        tmux_session: `tinsu-chat-${input.sessionId}`,
        status: 'active',
        updated_at: now
      })
      .where(eq(chat_sessions.id, input.sessionId))
      .run()
  }
}
```

### What MUST Stay the Same

- `writeWhenReady()`: Only called from `spawnSession()`, never from `reattachSession()`
- `busySessions`: Only `spawnSession()` adds to it (during TUI detection). `sendMessage()` also adds, which is correct for Case B after reattach
- 150ms delay in `sendMessage()`: Unchanged
- `buildChatSettingsJson()`: Only used in `spawnSession()`, not in reattach
- `sessionCache`/`sessionToChatCache`: Populated by `validateSessionsOnStartup()` for alive sessions, and by `spawnSession()` for new sessions
- `handlePtyExit()`: Existing behavior -- marks PTY status as 'exited' but doesn't change DB. This is correct because PTY exit != tmux exit
- `killSession()`: Still kills both tmux session and PTY, removes from all caches
- All hook routing from CTM-1.2: Completely unchanged

### Scope Boundary

This story covers:
- `validateSessionsOnStartup()` in ChatCliService
- `reattachSession()` in ChatCliService
- `isTmuxAlive()` in ChatCliService
- `tmuxSessionExists()` private helper in ChatCliService
- Three-case `sendChatMessage` handler refactor in chat-session.router.ts
- Startup validation call in services/index.ts
- Tests for all new functionality

Out of scope:
- 2-second health monitoring polling (CTM Epic 2, Story 2.2)
- Session list with live status badges (CTM Epic 2, Story 2.3)
- Concurrent session switching without interruption (CTM Epic 2, Story 2.1)
- UI changes (CTM Epic 2)

### Previous Story Intelligence (CTM-1.1 and CTM-1.2)

Key learnings from previous stories:
- **CTM-1.1 Completion Notes:** `spawnSession()` is now async, creates tmux session + PTY, populates both caches atomically. `handlePtyExit()` was simplified to just update in-memory status (no DB changes). Router test DB setup was fixed to include `tmux_session` column.
- **CTM-1.2 Completion Notes:** `resolveChatSession()` was added to HookListenerService with 3-strategy lookup (cache -> DB by tmux_session -> DB by session_uuid). `tryRegisterChatOrphan()` was fully removed. All 5 hook scripts now inject `tmux_session` into payloads.
- **Pre-existing test failures:** 5 pre-existing test failures unrelated to CTM work. Do not attempt to fix these.
- **Router test patterns:** Router tests mock `chatCliService` methods. For the new `isTmuxAlive()` and `reattachSession()` methods, follow the same mocking pattern used for `isSessionAlive()` and `spawnSession()`.

### Project Structure Notes

Files to modify:
- `src/main/services/chat-cli.service.ts` -- add `validateSessionsOnStartup()`, `reattachSession()`, `isTmuxAlive()`, `tmuxSessionExists()`; add db imports
- `src/main/trpc/routers/chat-session.router.ts` -- refactor `sendChatMessage` Case B/C into three distinct cases
- `src/main/services/index.ts` -- add startup validation call or export for app init

Files to NOT modify:
- `src/main/services/hook-listener.service.ts` -- CTM-1.2 complete, no changes needed
- `src/main/resources/chat-hooks/*.sh` -- CTM-1.2 complete, no changes needed
- `src/main/db/schema.ts` -- tmux_session column already added in CTM-1.1
- `src/main/db/index.ts` -- migration already exists from CTM-1.1
- `src/renderer/` -- no frontend changes in this story

Test files to create/modify:
- `src/main/services/chat-cli.service.test.ts` -- add tests for new methods (co-located)
- `src/main/trpc/routers/chat-session.router.test.ts` -- add tests for Case B/C differentiation

### References

- [Source: _bmad-output/planning-artifacts/epics-chat-tmux-migration.md#Story 1.3]
- [Source: _bmad-output/planning-artifacts/architecture.md#Chat Session tmux Migration - Startup validation pattern]
- [Source: _bmad-output/planning-artifacts/architecture.md#Chat Session tmux Migration - tRPC Router Changes]
- [Source: _bmad-output/implementation-artifacts/ctm-1-1-tmux-session-creation-and-pty-attachment.md - previous story]
- [Source: _bmad-output/implementation-artifacts/ctm-1-2-hook-routing-by-tmux-session-name.md - previous story]
- [Source: src/main/services/task-terminal.service.ts#validateSessionsOnStartup - reference pattern]
- [Source: src/main/services/chat-cli.service.ts - current implementation to extend]
- [Source: src/main/trpc/routers/chat-session.router.ts#sendChatMessage - three-case handler to refactor]
- [Source: _bmad-output/planning-artifacts/project-context.md - testing and naming conventions]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

No debug issues encountered.

### Completion Notes List

- Implemented `tmuxSessionExists()` private helper in ChatCliService using same pattern as TaskTerminalService (runs `tmux has-session -t {name}`, returns boolean).
- Implemented `validateSessionsOnStartup()` in ChatCliService: queries active sessions with tmux_session set, parallelizes tmux checks via `Promise.allSettled()`, populates caches for alive sessions, marks dead sessions as 'paused' in DB. Non-blocking with error catch.
- Implemented `reattachSession()` in ChatCliService: re-attaches PTY to existing alive tmux session without calling `writeWhenReady()` or adding to `busySessions`. Updates `sessions`, `processToSessionMap`, `lastActivityMap` maps.
- Implemented `isTmuxAlive()` public method in ChatCliService: checks sessionCache + tmuxSessionExists for router use.
- Added db imports (db, chat_sessions, eq, and, isNotNull from drizzle-orm) to ChatCliService following Option B (direct import, consistent with TaskTerminalService).
- Refactored `sendChatMessage` in chat-session.router.ts from two-case (A, B/C combined) to three-case handler (A, B, C). Case B calls `reattachSession()` then `sendMessage()` without persona context reload. Case C now also updates `status = 'active'` in addition to `tmux_session`.
- Added `initializeChatSessions()` export to services/index.ts that calls `validateSessionsOnStartup()` on module load (async, non-blocking).
- 54 ChatCliService unit tests passing (including 15 new CTM-1.3 tests). 60 router tests passing (including 4 new CTM-1.3 tests). Total: 114 tests all passing.
- Pre-existing TS errors (DayData/WeekData in velocity.router) and 5 pre-existing test failures remain untouched as per Dev Notes.

### File List

- src/main/services/chat-cli.service.ts (modified) -- added tmuxSessionExists, validateSessionsOnStartup, reattachSession, isTmuxAlive; added db/schema/drizzle imports
- src/main/trpc/routers/chat-session.router.ts (modified) -- refactored sendChatMessage from 2-case to 3-case handler (Case A/B/C)
- src/main/services/index.ts (modified) -- added initializeChatSessions() export and startup call
- src/main/services/chat-cli.service.test.ts (modified) -- added 15 CTM-1.3 tests (tmuxSessionExists, validateSessionsOnStartup, reattachSession, isTmuxAlive)
- src/main/trpc/routers/chat-session.router.test.ts (modified) -- added 4 CTM-1.3 tests (Case B reattach, Case C new session, Case B no persona reload, mock updates)

## Change Log

- CTM-1.3: Implemented session recovery and startup validation (2026-03-26)
  - Added startup validation that detects alive/dead tmux sessions on app start
  - Added PTY re-attachment for alive tmux sessions (Case B recovery path)
  - Refactored sendChatMessage to three-case handler (A: PTY alive, B: tmux alive/PTY detached, C: tmux dead)
  - Added initializeChatSessions() to services barrel for async non-blocking startup validation
  - 114 tests passing (54 service + 60 router)

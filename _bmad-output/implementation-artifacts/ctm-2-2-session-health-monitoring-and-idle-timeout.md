# Story 2.2: Session Health Monitoring & Idle Timeout

Status: review

## Story

As a founder,
I want the system to detect when chat sessions exit or become idle,
So that I see accurate session status and resources are managed efficiently.

## Acceptance Criteria

1. **Given** the ChatCliService starts monitoring, **When** `startMonitoring()` is called, **Then** it polls `tmux has-session` for every cached session every 2 seconds.

2. **Given** a tmux session exits (Claude Code completes or crashes), **When** the next polling cycle detects `tmux has-session` returns false, **Then** the session is removed from `sessionCache` and `sessionToChatCache`, the DB record is updated to `status = 'paused'`, a session status event is emitted for the UI, and detection occurs within one polling interval -- <2 seconds (NFR32).

3. **Given** a chat session has been idle (no user messages) for 2 hours, **When** the idle timeout check runs, **Then** the tmux session is killed via `tmux kill-session`, the session status is updated to 'paused', and the session can be re-created on next user message (Case C from Story 1.3).

4. **Given** the idle timeout is configured, **When** the value is checked, **Then** chat sessions use 2 hours (not the 30-minute task timeout), and the timeout resets on each user message.

## Tasks / Subtasks

- [x] Task 1: Add `startMonitoring()` method to ChatCliService (AC: #1, #2)
  - [x] 1.1 Add a private `monitorInterval: ReturnType<typeof setInterval> | null = null` property to `ChatCliService` (alongside the existing `idleCheckInterval`)
  - [x] 1.2 Implement `startMonitoring()` that creates a 2-second interval polling `tmux has-session` for every entry in `sessionCache`
  - [x] 1.3 Inside the polling loop: for each `[sessionId, tmuxName]` in `sessionCache`, call `this.tmuxSessionExists(tmuxName)`. If returns `false`:
    - Remove from `sessionCache` and `sessionToChatCache`
    - Update DB: `db.update(chat_sessions).set({ status: 'paused', updated_at: Date.now() }).where(eq(chat_sessions.id, sessionId))`
    - Emit a session status event via `this.emitSessionStatus(sessionId, 'exited')` (see Task 2)
    - Log: `[ChatCliService] Health monitor: session {sessionId} tmux exited, marked paused`
  - [x] 1.4 Guard against concurrent iteration: snapshot `sessionCache` entries with `Array.from(this.sessionCache.entries())` before iterating, since dead session cleanup modifies the map

- [x] Task 2: Add `emitSessionStatus()` event emission method (AC: #2)
  - [x] 2.1 Add a private `statusListeners: Set<(sessionId: string, status: string) => void> = new Set()` property
  - [x] 2.2 Add `onSessionStatus(listener: (sessionId: string, status: string) => void): () => void` public method that registers a listener and returns an unsubscribe function
  - [x] 2.3 Add private `emitSessionStatus(sessionId: string, status: string): void` that invokes all registered listeners
  - [x] 2.4 Call `emitSessionStatus(sessionId, 'exited')` from `startMonitoring()` when a dead tmux session is detected (Task 1.3)

- [x] Task 3: Integrate `checkIdleSessions()` into the monitoring interval (AC: #3, #4)
  - [x] 3.1 The existing `checkIdleSessions()` method at line 327 already handles 2-hour idle timeout correctly (uses `IDLE_TIMEOUT_MS = 2 * 60 * 60 * 1000`, resets via `lastActivityMap` updates in `sendMessage`)
  - [x] 3.2 Move the idle check from the constructor's standalone 60-second interval into `startMonitoring()`. Call `this.checkIdleSessions()` at the END of each 2-second polling cycle (after health checks)
  - [x] 3.3 Remove the `this.idleCheckInterval = setInterval(() => this.checkIdleSessions(), 60_000)` from the constructor (line 121). The idle check now runs as part of health monitoring
  - [x] 3.4 Update `checkIdleSessions()` to also call `emitSessionStatus(sessionId, 'idle-timeout')` before/after killing idle sessions, so the UI can react
  - [x] 3.5 Update `killAll()` to also clear `this.monitorInterval` (currently only clears `idleCheckInterval`)

- [x] Task 4: Call `startMonitoring()` from the constructor (AC: #1)
  - [x] 4.1 In the constructor (after `ptyService.on('exit', ...)` line 116), call `this.startMonitoring()`
  - [x] 4.2 Remove the old `this.idleCheckInterval` setup from constructor (replaced by Task 3.3)
  - [x] 4.3 Ensure `startMonitoring()` is idempotent -- if `monitorInterval` is already set, clear it before creating a new one (defensive)

- [x] Task 5: Verify idle timeout resets on user messages (AC: #4)
  - [x] 5.1 Verify that `sendMessage()` already updates `lastActivityMap.set(sessionId, Date.now())` -- it does at the start of the method. No change needed
  - [x] 5.2 Verify that `spawnSession()` already initializes `lastActivityMap.set(sessionId, Date.now())` -- it does. No change needed
  - [x] 5.3 Document in code comment that the idle timeout resets on each `sendMessage()` call (user message), not on agent output

- [x] Task 6: Write tests (AC: all)
  - [x] 6.1 Test: `startMonitoring()` creates a 2-second interval -- mock `setInterval`, verify it is called with 2000ms
  - [x] 6.2 Test: Health poll detects dead tmux session -- set up `sessionCache` with an entry, mock `execAsync` (tmux has-session) to reject (exit code 1), advance timer by 2 seconds, verify `sessionCache` no longer has the entry and `mockDbUpdate` was called with `status: 'paused'`
  - [x] 6.3 Test: Health poll keeps alive tmux sessions -- set up `sessionCache` with an entry, mock `execAsync` to resolve (exit code 0), advance timer, verify `sessionCache` still has the entry
  - [x] 6.4 Test: `emitSessionStatus()` notifies registered listeners -- register a listener via `onSessionStatus`, trigger a dead session detection, verify listener was called with `(sessionId, 'exited')`
  - [x] 6.5 Test: `onSessionStatus` returns unsubscribe function -- register, unsubscribe, trigger event, verify listener NOT called
  - [x] 6.6 Test: Idle timeout kills session after 2 hours -- set `lastActivityMap` entry to `Date.now() - IDLE_TIMEOUT_MS - 1`, call `checkIdleSessions()`, verify session killed
  - [x] 6.7 Test: Idle timeout does NOT kill session within 2 hours -- set `lastActivityMap` entry to `Date.now() - (IDLE_TIMEOUT_MS - 60000)`, call `checkIdleSessions()`, verify session NOT killed
  - [x] 6.8 Test: `killAll()` clears `monitorInterval` -- start monitoring, call `killAll()`, verify `clearInterval` was called
  - [x] 6.9 Test: Concurrent health poll does not modify `sessionCache` during iteration -- add 3 sessions to cache, mock first as dead and others as alive, verify iteration completes without errors and only dead session removed

## Dev Notes

### Architecture Reference: Health Polling Pattern

The architecture document (`architecture.md` lines 2085-2107) specifies the exact implementation pattern for `startMonitoring()`:

```typescript
// Poll every 2 seconds (same interval as task system)
private monitorInterval: NodeJS.Timeout

startMonitoring(): void {
  this.monitorInterval = setInterval(async () => {
    for (const [sessionId, tmuxName] of this.sessionCache) {
      const alive = await tmuxHasSession(tmuxName)
      if (!alive) {
        // Session exited -- update status (NFR32: <2s detection)
        this.sessionCache.delete(sessionId)
        await db.update(chatSessions)
          .set({ status: 'paused', updatedAt: Date.now() })
          .where(eq(chatSessions.id, sessionId))
        // Emit status change event for UI
        this.emitSessionStatus(sessionId, 'exited')
      }
    }
  }, 2000)
}
```

**IMPORTANT:** Use `this.tmuxSessionExists(tmuxName)` (private method already exists at line 144) instead of a raw `tmuxHasSession()` call. The method wraps `execAsync` with the standard `TMUX_COMMAND_TIMEOUT`.

### Existing Infrastructure to Reuse

| Component | Location | Status | Use in This Story |
|-----------|----------|--------|-------------------|
| `tmuxSessionExists(sessionName)` | `chat-cli.service.ts` line 144 | Exists (CTM-1.3) | Use for health poll |
| `sessionCache` (Map) | `chat-cli.service.ts` line 107 | Exists (CTM-1.1) | Iterate for health checks |
| `sessionToChatCache` (Map) | `chat-cli.service.ts` line 110 | Exists (CTM-1.1) | Remove dead entries |
| `checkIdleSessions()` | `chat-cli.service.ts` line 327 | Exists (Story 10.6) | Integrate into monitoring loop |
| `IDLE_TIMEOUT_MS` | `chat-cli.service.ts` line 65 | Already 2 hours (CTM-1.1) | No change needed |
| `lastActivityMap` | `chat-cli.service.ts` line 84 | Exists (Story 10.6) | Already tracks activity timestamps |
| `killSession(sessionId)` | `chat-cli.service.ts` line 689 | Exists | Already cleans up tmux + caches |
| `getSessionStatus(sessionId)` | `chat-cli.service.ts` line 645 | Exists (CTM-2.1) | Foundation for status events |
| `isSessionAlive(sessionId)` | Exists | Exists | Used by `checkIdleSessions` |
| `handlePtyExit(event)` | `chat-cli.service.ts` line 751 | Exists | PTY-level exit (distinct from tmux exit) |

### What MUST Change

| File | Change | Why |
|------|--------|-----|
| `src/main/services/chat-cli.service.ts` | Add `startMonitoring()` method | 2-second health poll loop |
| `src/main/services/chat-cli.service.ts` | Add `emitSessionStatus()` + `onSessionStatus()` | Event emission for UI updates |
| `src/main/services/chat-cli.service.ts` | Add `statusListeners` Set + `monitorInterval` property | State for event system and interval |
| `src/main/services/chat-cli.service.ts` | Move idle check from constructor into `startMonitoring()` | Consolidate monitoring into single loop |
| `src/main/services/chat-cli.service.ts` | Update `killAll()` to clear `monitorInterval` | Prevent leak on shutdown |
| `src/main/services/chat-cli.service.test.ts` | Add 9 new test cases | Cover health poll, event emission, idle timeout integration |

### What MUST NOT Change

| Component | Reason |
|-----------|--------|
| `spawnSession()` | CTM-1.1 complete |
| `reattachSession()` | CTM-1.3 complete |
| `validateSessionsOnStartup()` | CTM-1.3 complete |
| `sendChatMessage` three-case handler | CTM-1.3 complete |
| Hook routing via `TINSU_TMUX_SESSION` | CTM-1.2 complete |
| `killSession()` core logic | Already cleans up correctly |
| `getSessionStatus()` | CTM-2.1 complete |
| `IDLE_TIMEOUT_MS = 2 * 60 * 60 * 1000` | Already 2 hours (CTM-1.1) |
| Persona-switch `useEffect` in ChatPanel | CTM-2.1 complete |
| Chat hook scripts (`.sh` files) | CTM-1.2 complete |
| DB schema (chat_sessions table) | CTM-1.1 complete |

### DB Column Name Convention

The `chat_sessions` table uses `snake_case` columns: `updated_at` (NOT `updatedAt`). When writing the DB update in `startMonitoring()`, use `{ status: 'paused', updated_at: Date.now() }`. Check the Drizzle schema column name mapping to confirm the JavaScript property name -- in the schema file, columns are defined with `snake_case` names but may have camelCase JS mappings via Drizzle's `.as()`. Look at the existing `checkIdleSessions()` and `validateSessionsOnStartup()` methods for the correct pattern.

### Event Emission Pattern

There is NO existing EventEmitter pattern in `ChatCliService`. The service currently uses:
- A callback pattern (`onIdleCallback`) for idle notifications
- Direct method calls from the router

For `emitSessionStatus()`, use a simple listener Set pattern (not Node.js EventEmitter) to keep it lightweight:
```typescript
private statusListeners = new Set<(sessionId: string, status: string) => void>()

onSessionStatus(listener: (sessionId: string, status: string) => void): () => void {
  this.statusListeners.add(listener)
  return () => this.statusListeners.delete(listener)
}

private emitSessionStatus(sessionId: string, status: string): void {
  for (const listener of this.statusListeners) {
    listener(sessionId, status)
  }
}
```

This is consumed by Story 2.3 (session list with live status badges) which will subscribe to these events to update the UI in real-time. For this story, the event system just needs to exist and be tested.

### Idle Check Frequency Change

Currently `checkIdleSessions()` runs every 60 seconds (constructor line 121). After this story, it will run every 2 seconds as part of `startMonitoring()`. This is fine because:
- `checkIdleSessions()` is O(n) on `lastActivityMap` entries -- lightweight Map iteration
- It only does work (kills sessions) when `Date.now() - lastActivity > IDLE_TIMEOUT_MS` -- the 2-hour threshold means kills are rare
- The health poll (`tmux has-session`) already runs every 2 seconds, so adding the idle check to the same cycle is negligible overhead

### Test Patterns to Follow

From `chat-cli.service.test.ts`:
- Mock `child_process` via `vi.mock` and `vi.hoisted` for `execAsync` interception
- Mock `../db` for DB operations (`mockDbUpdate`, `mockDbSelect`)
- Use `vi.useFakeTimers()` and `vi.advanceTimersByTime()` for interval-based testing
- The existing test file already mocks tmux commands via `mockExecAsync`
- Add new tests in a new `describe('Health Monitoring (CTM-2.2)')` block
- Follow the existing pattern of spawning sessions via the service then asserting cache/DB state

### Out of Scope

- Live status badge UI component (CTM-2.3)
- `listChatSessionsWithStatus` tRPC procedure (CTM-2.3)
- tRPC subscription for real-time status updates (CTM-2.3)
- Any ChatPanel or renderer changes (this is backend-only)

### Previous Story Intelligence (CTM-2.1)

- **CTM-2.1** added `getSessionStatus()` method returning `'thinking' | 'idle' | 'exited' | 'unknown'`. This method reads in-memory state, while `startMonitoring()` WRITES in-memory state (cleans dead sessions from caches). They complement each other.
- **CTM-2.1 code review** applied 1 fix: `prevMessageCountRef.current = 0` added to persona-switch `useEffect` resume path. All 86 tests passing.
- **Pre-existing test failures:** 5 pre-existing test failures unrelated to CTM work. Do not fix.
- **Router test patterns:** Router tests mock `chatCliService` methods. The event listener (`onSessionStatus`) will be consumed by the router in CTM-2.3, not this story.

### NFR32 Compliance

NFR32 requires stale session detection within one polling interval (2 seconds). The `startMonitoring()` 2-second interval satisfies this. The actual detection latency is `[0, 2000ms]` depending on when the tmux session dies relative to the poll cycle. Worst case is just under 2 seconds.

### Project Structure Notes

All changes are in the main process service layer:
- `src/main/services/chat-cli.service.ts` -- health monitoring implementation
- `src/main/services/chat-cli.service.test.ts` -- test coverage

No renderer, preload, schema, migration, or router changes needed.

### References

- [Source: _bmad-output/planning-artifacts/epics-chat-tmux-migration.md#Story 2.2]
- [Source: _bmad-output/planning-artifacts/architecture.md#Session Monitoring -- tmux Health Polling (lines 2085-2107)]
- [Source: _bmad-output/planning-artifacts/architecture.md#Chat Session tmux Migration - Service Layer Checklist]
- [Source: src/main/services/chat-cli.service.ts#line 144 - tmuxSessionExists method]
- [Source: src/main/services/chat-cli.service.ts#line 327 - checkIdleSessions method]
- [Source: src/main/services/chat-cli.service.ts#line 107 - sessionCache property]
- [Source: src/main/services/chat-cli.service.ts#line 65 - IDLE_TIMEOUT_MS constant]
- [Source: _bmad-output/implementation-artifacts/ctm-2-1-concurrent-session-execution-and-background-persistence.md - previous story]
- [Source: _bmad-output/planning-artifacts/project-context.md - testing and naming conventions]

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6 (1M context)

### Debug Log References
- All 72 tests passing (61 pre-existing + 11 new CTM-2.2 tests)
- Pre-existing test failures in unrelated files (velocity router, Welcome component, etc.) not introduced by this change

### Completion Notes List
- Task 1: Added `startMonitoring()` method with 2-second interval polling `tmux has-session` for every cached session. Dead sessions are removed from both caches, marked 'paused' in DB, and emit 'exited' status events.
- Task 2: Added lightweight event emission system using `statusListeners` Set, `onSessionStatus()` public method (returns unsubscribe fn), and private `emitSessionStatus()`.
- Task 3: Integrated idle check into monitoring loop (runs at end of each 2-second cycle). Removed standalone 60-second idle check interval from constructor. Added 'idle-timeout' event emission before killing idle sessions. Updated `killAll()` to clear `monitorInterval`.
- Task 4: Constructor now calls `startMonitoring()` instead of setting up a standalone idle check interval. `startMonitoring()` is idempotent (clears existing interval before creating new one).
- Task 5: Verified `sendMessage()` and `spawnSession()` already update `lastActivityMap`. Added code comment documenting that idle timeout resets on user messages only.
- Task 6: Added 11 new tests in `describe('Health Monitoring (CTM-2.2)')` block covering all 9 specified test cases plus 2 additional tests for idle-timeout event emission and idempotent startMonitoring.

### Change Log
- CTM-2.2: Session Health Monitoring & Idle Timeout (Date: 2026-03-26)

### File List
- src/main/services/chat-cli.service.ts (modified)
- src/main/services/chat-cli.service.test.ts (modified)

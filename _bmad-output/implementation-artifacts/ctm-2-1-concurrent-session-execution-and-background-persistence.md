# Story 2.1: Concurrent Session Execution & Background Persistence

Status: done

## Story

As a founder,
I want to run multiple chat sessions simultaneously and switch between them without interrupting background agent work,
So that I can consult PM, Architect, and other agents in parallel across projects.

## Acceptance Criteria

1. **Given** I have an active chat session with the PM agent, **When** I switch to the Architect persona (or select a different session), **Then** the PM session's tmux process continues running in the background, the PM session's PTY remains attached (permanent attachment), and `setSessionId(null)` is NOT called -- the old session is preserved.

2. **Given** I switch back to the PM session, **When** the session loads, **Then** I see all previous messages immediately (from `chat_messages` table), any messages the agent produced while in background are visible, and the switch completes in <500ms (NFR26).

3. **Given** I have 5 concurrent chat sessions running, **When** I interact with the foreground session, **Then** background sessions experience zero message loss (NFR27), background sessions have no added processing latency >1 second, and session management operations (create, switch, monitor) show no degradation (NFR25).

4. **Given** I have sessions across two different projects, **When** I view sessions for Project A, **Then** only Project A's sessions appear (existing `project_id` filter), Project B's sessions continue running independently (FR49), and each session's Claude Code cwd is set to its respective project directory (FR50).

5. **Given** I click on a previous session in the session list, **When** the session has an alive tmux session, **Then** the session resumes immediately with full context (FR47), and if the PTY needs re-attachment, it happens transparently.

## Tasks / Subtasks

- [x] Task 1: Remove `setSessionId(null)` on persona switch in ChatPanel (AC: #1)
  - [x] 1.1 In `ChatPanel.tsx` line 175-195 (the `useEffect` on `[selectedPersona]`), change the persona-switch behavior: instead of calling `setSessionId(null)`, keep the current `sessionId` intact so the old session continues in background
  - [x] 1.2 When persona changes (and `isSessionBindingRef.current` is false), search `sessionsForCheck` for an existing alive session with the new persona. If found, bind to it (set `sessionId` to that session, set `sessionPersonaRef`). If not found, set `sessionId(null)` to create a new session on next message
  - [x] 1.3 Ensure the old session's tmux process is unaffected by the UI switch -- no `killSession()` calls, no PTY detach
  - [x] 1.4 Reset `isAgentThinking`, `currentToolActivity`, and `prevMessageCountRef` on every persona/session switch (unchanged behavior)

- [x] Task 2: Ensure session list shows all sessions including background ones (AC: #2, #5)
  - [x] 2.1 Verify `listWithPreview` query already returns all sessions for the project (it does -- no filter on status='active'). No backend change needed
  - [x] 2.2 In `ChatSessionList.tsx`, verify sessions with status `active` show correctly when an agent is running in background. The existing `STATUS_CONFIG` already has `active`, `paused`, `completed` badges -- no change needed
  - [x] 2.3 Verify `handleSelectSession` in `ChatPanel.tsx` (line 368-387) correctly resumes a background session: it already sets `sessionId`, `selectedPersona`, `sessionPersonaRef`, and `view = 'chat'`. If the session's PTY is still attached (Case A), messages flow immediately. If PTY is detached (Case B from CTM-1.3), the next `sendChatMessage` call triggers `reattachSession()` transparently

- [x] Task 3: Verify project isolation for concurrent sessions (AC: #4)
  - [x] 3.1 Verify `listWithPreview` query filters by `project_id` (it does at line 585). No change needed
  - [x] 3.2 Verify `spawnSession()` sets Claude Code's `cwd` to the project directory (it does via `ptyService.spawn` cwd option). No change needed
  - [x] 3.3 Verify `sendChatMessage` router uses `getProjectPath(session.project_id)` to resolve the correct project path for both Case B and Case C (it does at line 959). No change needed

- [x] Task 4: Remove `handleNewChat`'s aggressive session clearing (AC: #1)
  - [x] 4.1 In `ChatPanel.tsx` `handleNewChat` (line 390-397), the current behavior sets `sessionId(null)` which is correct for "New Chat" -- this starts a fresh session. Keep this as-is; it's intentional for creating NEW sessions
  - [x] 4.2 Verify `handleBackToSessions` (line 400-403) already preserves `sessionId` when going back to list view -- it does. No change needed

- [x] Task 5: Validate concurrent session independence at service layer (AC: #3)
  - [x] 5.1 Verify `ChatCliService` already supports multiple concurrent entries in `sessions` Map, `sessionCache`, `sessionToChatCache`, `lastActivityMap`, and `busySessions` -- it does (all are Maps/Sets keyed by sessionId)
  - [x] 5.2 Verify `spawnSession()` does not clear or reset other sessions' state -- it only writes to the new session's entries in all maps
  - [x] 5.3 Verify `sendMessage()` targets only the specified session via its `processId` lookup -- it does
  - [x] 5.4 Verify `checkIdleSessions()` iterates all sessions independently -- it does (line 331 iterates `lastActivityMap`)
  - [x] 5.5 Verify `handlePtyExit()` only updates the specific session that exited -- it does (line 727-737 breaks after finding match)
  - [x] 5.6 Verify `killSession()` only removes the target session from all caches -- it does (line 664-687)

- [x] Task 6: Add `getSessionStatus()` method to ChatCliService (AC: #2, #3)
  - [x] 6.1 Add public method `getSessionStatus(sessionId: string): 'thinking' | 'idle' | 'exited' | 'unknown'` that returns the live status of a session
  - [x] 6.2 Logic: if `busySessions.has(sessionId)` return `'thinking'`; if `sessions.get(sessionId)?.status === 'exited'` return `'exited'`; if `sessions.has(sessionId)` return `'idle'`; else return `'unknown'`
  - [x] 6.3 This prepares the foundation for Story 2.3 (live status badges) but is needed now for background session visibility and <500ms switch verification

- [x] Task 7: Write tests (AC: all)
  - [x] 7.1 Renderer test: ChatPanel persona switch does NOT kill old session -- verify `setSessionId(null)` is not called when switching to a persona that has an existing session in `sessionsForCheck`
  - [x] 7.2 Renderer test: ChatPanel persona switch to persona with existing session binds to that session -- verify `sessionId` is set to the existing session's ID
  - [x] 7.3 Renderer test: ChatPanel persona switch to persona WITHOUT existing session sets `sessionId(null)` to trigger new session creation on next message
  - [x] 7.4 Renderer test: ChatPanel `handleSelectSession` correctly resumes a background session -- sets `sessionId`, `selectedPersona`, `view = 'chat'`
  - [x] 7.5 Unit test: `ChatCliService.getSessionStatus()` returns correct status for thinking, idle, exited, and unknown sessions
  - [x] 7.6 Unit test: Multiple concurrent sessions in ChatCliService -- spawn 3 sessions, verify all 3 are tracked in `sessions` Map, `sessionCache`, and `sessionToChatCache` independently
  - [x] 7.7 Unit test: Killing one session does not affect others -- spawn 3 sessions, kill middle one, verify other two remain alive

## Dev Notes

### Core Change: Persona Switch Behavior

The primary code change in this story is in `ChatPanel.tsx` at the persona-switch `useEffect` (lines 175-195). Currently:

```typescript
// Current behavior (WRONG for concurrency):
useEffect(() => {
  if (isSessionBindingRef.current) {
    isSessionBindingRef.current = false
    return
  }
  setSessionId(null)  // <-- This disconnects the old session!
  sessionPersonaRef.current = null
  setIsAgentThinking(false)
  // ...
}, [selectedPersona])
```

New behavior:

```typescript
// New behavior (concurrent sessions):
useEffect(() => {
  if (isSessionBindingRef.current) {
    isSessionBindingRef.current = false
    return
  }

  // Look for an existing session with the new persona
  const existingSession = sessionsForCheck?.find(
    (s) => s.agent_persona === selectedPersona && s.status !== 'completed'
  )

  if (existingSession) {
    // Resume existing session for this persona (don't create new)
    isSessionBindingRef.current = true  // suppress recursive effect
    setSessionId(existingSession.id)
    sessionPersonaRef.current = selectedPersona
  } else {
    // No existing session -- will create on next message
    setSessionId(null)
    sessionPersonaRef.current = null
  }

  setIsAgentThinking(false)
  setCurrentToolActivity(null)
  if (thinkingTimeoutRef.current) {
    clearTimeout(thinkingTimeoutRef.current)
    thinkingTimeoutRef.current = null
  }
}, [selectedPersona, sessionsForCheck])
```

**CRITICAL:** The `isSessionBindingRef.current = true` MUST be set before `setSessionId()` to prevent the `useEffect` from firing recursively when resuming an existing session. This is the same guard pattern used in `handleSelectSession()` at line 369.

### Why Most Work is Verification, Not Code Changes

CTM Epic 1 built the tmux infrastructure that inherently supports concurrency:
- Each session has its own tmux session (`tinsu-chat-{sessionId}`)
- Each session has its own PTY attachment
- Caches are keyed by sessionId -- independent entries
- `busySessions` tracks each session independently
- Hook routing uses `TINSU_TMUX_SESSION` env var -- per-session, no collision

The concurrency "bug" is purely in the frontend: `ChatPanel.tsx` calls `setSessionId(null)` on persona switch, which loses the reference to the old session. The old session's tmux process actually keeps running! The fix is to stop discarding the session reference.

### Session Switch Performance (NFR26: <500ms)

Session switching is already fast because:
1. Messages are fetched via `trpc.chatSession.getMessages.useQuery()` (line 198) -- this is a DB query, not a tmux operation
2. The query fires immediately when `sessionId` changes (no network round-trip -- it's IPC)
3. PTY attachment is permanent -- no re-attach needed for Case A
4. The only potential latency is Case B (PTY detached after app restart), which adds ~100ms for `ptyService.spawn()`. But this is transparent to the user since messages display from DB immediately

### What MUST NOT Change

| Component | Reason |
|-----------|--------|
| `sendChatMessage` three-case handler | CTM-1.3 complete, handles all session states correctly |
| `spawnSession()` in ChatCliService | CTM-1.1 complete, creates tmux + PTY independently per session |
| `reattachSession()` | CTM-1.3 complete, handles Case B recovery |
| `validateSessionsOnStartup()` | CTM-1.3 complete, handles startup reconciliation |
| Hook routing via `TINSU_TMUX_SESSION` | CTM-1.2 complete, routes per-session |
| `killSession()` behavior | Correctly cleans up one session without affecting others |
| `checkIdleSessions()` | Correctly iterates all sessions independently |
| `handleNewChat()` | Correctly creates NEW sessions (setting `sessionId(null)` is intentional here) |
| `handleBackToSessions()` | Already preserves `sessionId` |
| `handleSelectSession()` | Already resumes sessions correctly |
| `listWithPreview` query | Already returns all sessions for project |

### What MUST Change

| File | Change | Why |
|------|--------|-----|
| `src/renderer/src/components/planning/ChatPanel.tsx` | Persona-switch `useEffect` at lines 175-195 | Stop discarding old session; resume existing session for same persona |
| `src/main/services/chat-cli.service.ts` | Add `getSessionStatus()` method | Foundation for live status visibility (used in 2.2/2.3 but defined here for testability) |

### Out of Scope

- Health monitoring polling (CTM-2.2: `startMonitoring()` with 2-second polling)
- Live status badges in session list UI (CTM-2.3: frontend display)
- `listChatSessionsWithStatus` tRPC procedure (CTM-2.3: backend endpoint)
- Session status event emission (CTM-2.2: `emitSessionStatus()`)

### Previous Story Intelligence (CTM-1.1, CTM-1.2, CTM-1.3)

- **CTM-1.1:** `spawnSession()` is async, creates tmux + PTY, populates caches atomically. Each session is fully independent in tmux.
- **CTM-1.2:** `resolveChatSession()` in HookListenerService uses 3-strategy lookup (cache -> DB by tmux_session -> DB by session_uuid). All 5 hook scripts inject `tmux_session` into payloads.
- **CTM-1.3:** Three-case `sendChatMessage` handler (Case A/B/C). `validateSessionsOnStartup()` rebuilds caches. `reattachSession()` handles Case B (tmux alive, PTY detached).
- **Pre-existing test failures:** 5 pre-existing test failures unrelated to CTM work. Do not fix.
- **Router test patterns:** Router tests mock `chatCliService` methods. Follow same pattern for new tests.
- **Renderer test patterns:** ChatPanel tests use `@testing-library/react` with tRPC mocking via `trpc.useUtils()` mock. Follow existing patterns in ChatPanel.test.tsx if it exists.

### Project Structure Notes

Files to modify:
- `src/renderer/src/components/planning/ChatPanel.tsx` -- change persona-switch `useEffect` to preserve background sessions
- `src/main/services/chat-cli.service.ts` -- add `getSessionStatus()` method

Files to NOT modify:
- `src/main/trpc/routers/chat-session.router.ts` -- three-case handler complete from CTM-1.3
- `src/main/services/hook-listener.service.ts` -- hook routing complete from CTM-1.2
- `src/main/resources/chat-hooks/*.sh` -- hook scripts complete from CTM-1.2
- `src/main/db/schema.ts` -- schema complete from CTM-1.1
- `src/main/db/index.ts` -- migration complete from CTM-1.1
- `src/main/services/index.ts` -- startup validation complete from CTM-1.3
- `src/renderer/src/components/planning/ChatSessionList.tsx` -- no changes needed; live badges are CTM-2.3

Test files to create/modify:
- `src/renderer/src/components/planning/ChatPanel.test.tsx` -- add persona-switch tests (create if not exists)
- `src/main/services/chat-cli.service.test.ts` -- add `getSessionStatus()` and concurrent session tests

### References

- [Source: _bmad-output/planning-artifacts/epics-chat-tmux-migration.md#Story 2.1]
- [Source: _bmad-output/planning-artifacts/architecture.md#Chat Session tmux Migration - UI Component Changes]
- [Source: _bmad-output/planning-artifacts/architecture.md#Chat Session tmux Migration - NFR Coverage]
- [Source: _bmad-output/implementation-artifacts/ctm-1-3-session-recovery-and-startup-validation.md - previous story]
- [Source: src/renderer/src/components/planning/ChatPanel.tsx#line 175-195 - persona switch effect]
- [Source: src/main/services/chat-cli.service.ts - concurrent session support (Maps/Sets keyed by sessionId)]
- [Source: _bmad-output/planning-artifacts/project-context.md - testing and naming conventions]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

None required -- clean implementation with no debug issues.

### Completion Notes List

- Task 1: Modified persona-switch `useEffect` in ChatPanel.tsx to preserve background sessions. Instead of unconditionally calling `setSessionId(null)`, the new logic searches `sessionsForCheck` for an existing alive session with the new persona and binds to it if found. The `listWithPreview` query was also changed to be always-enabled (removed `view === 'list'` restriction) so `sessionsForCheck` is available during persona switching.
- Task 2: Verified `listWithPreview` query returns all sessions regardless of status, `ChatSessionList` shows active/paused/completed badges correctly, and `handleSelectSession` correctly resumes background sessions via Case A/B/C handling from CTM-1.3.
- Task 3: Verified `listWithPreview` filters by `project_id`, `spawnSession` sets `cwd` to project directory, and `sendChatMessage` router uses `getProjectPath(session.project_id)`.
- Task 4: Confirmed `handleNewChat` correctly uses `setSessionId(null)` for NEW sessions (intentional), and `handleBackToSessions` preserves `sessionId`.
- Task 5: Verified all Maps/Sets in ChatCliService are keyed by sessionId for independent concurrent session tracking. `spawnSession`, `sendMessage`, `killSession`, `handlePtyExit`, and `checkIdleSessions` all operate independently per session.
- Task 6: Added `getSessionStatus()` method returning 'thinking'|'idle'|'exited'|'unknown' based on `busySessions`, `sessions` Map, and session info status.
- Task 7: Added 12 new tests: 5 renderer tests for ChatPanel concurrent behavior (persona switch resume, no-session persona switch, session resume, background persistence, completed session exclusion) and 7 service tests (getSessionStatus 5 tests, concurrent independence 2 tests). All 86 tests pass (61 service + 25 ChatPanel).

### Change Log

- 2026-03-26: CTM-2.1 implementation complete. Modified persona-switch useEffect in ChatPanel.tsx to preserve background sessions and resume existing ones. Added getSessionStatus() to ChatCliService. Added 12 new tests (5 renderer + 7 service). All 86 tests passing.

### File List

- src/renderer/src/components/planning/ChatPanel.tsx (modified)
- src/main/services/chat-cli.service.ts (modified)
- src/renderer/src/components/planning/ChatPanel.test.tsx (modified)
- src/main/services/chat-cli.service.test.ts (modified)
- _bmad-output/implementation-artifacts/sprint-status.yaml (modified)
- _bmad-output/implementation-artifacts/ctm-2-1-concurrent-session-execution-and-background-persistence.md (modified)

# Story 10.6: Session Persistence & Resume

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.

## Story

As a founder,
I want to see my previous chat sessions and resume any conversation where I left off,
So that I can pick up planning work across days without losing context.

## Acceptance Criteria

1. **Given** I open the chat panel in the Planning Workspace **When** previous chat sessions exist for this project **Then** I see a session list showing: agent persona icon/name, last message preview, last active timestamp, and status (active/completed) **And** sessions are sorted by most recently active

2. **Given** I click on a previous session in the list **When** the session loads **Then** all previous messages are displayed in the chat area (loaded from `chat_messages` table) **And** the correct agent persona is pre-selected

3. **Given** I send a message in a resumed session **When** no CLI process is running for that session **Then** TinSu spawns a new `claude` process with `--resume {session_uuid}` **And** Claude Code restores its internal conversation context **And** the conversation continues naturally

4. **Given** I want to start a fresh conversation **When** I click "New Chat" button **Then** the agent persona selector is shown **And** selecting a persona begins a new session with a new UUID

5. **Given** a chat session has been inactive for 30+ minutes **When** I view the session list **Then** the session shows as "Paused" status **And** the underlying CLI process has been gracefully terminated to free resources

6. **Given** I want to clean up old sessions **When** I right-click or use the menu on a session **Then** I can mark it as "Completed" (archived) or "Delete" (removes from list) **And** completed sessions remain viewable but are dimmed in the list

## Tasks / Subtasks

- [x] Task 1: Add session idle timeout and auto-pause to ChatCliService (AC: 5)
  - [x] 1.1 In `ChatCliService`, add a `lastActivityMap: Map<string, number>` tracking the timestamp (Date.now()) of the last `sendMessage` or `spawnSession`/`resumeSession` call per sessionId.
  - [x] 1.2 Add a `IDLE_TIMEOUT_MS = 30 * 60 * 1000` constant (30 minutes).
  - [x] 1.3 Add method `checkIdleSessions(): string[]` that iterates `lastActivityMap`, finds sessions where `Date.now() - lastActivity > IDLE_TIMEOUT_MS` AND `isSessionAlive(sessionId) === true`, kills those sessions via `killSession()`, and returns the list of killed session IDs.
  - [x] 1.4 Start an interval timer in the constructor: `setInterval(() => this.checkIdleSessions(), 60_000)` (check every minute). Store the interval handle for cleanup in `killAll()`.
  - [x] 1.5 Update `spawnSession`, `resumeSession`, and `sendMessage` to update `lastActivityMap.set(sessionId, Date.now())` on every call.

- [x] Task 2: Add tRPC procedures for session management (AC: 1, 5, 6)
  - [x] 2.1 Add `deleteSession` mutation to `chatSessionRouter`:
    - Input: `{ sessionId: z.string().min(1) }`
    - Look up session, throw TRPCError NOT_FOUND if missing
    - Kill CLI session via `chatCliService.killSession(sessionId)` (safe if not running)
    - Delete from `chat_sessions` table (cascade deletes messages)
    - Return `{ deleted: true }`
  - [x] 2.2 Add `getLastMessage` query to `chatSessionRouter`:
    - Input: `{ sessionId: z.string().min(1) }`
    - Query: `SELECT * FROM chat_messages WHERE session_id = ? AND role IN ('user', 'assistant') ORDER BY created_at DESC LIMIT 1`
    - Returns the last non-tool message for session list preview
  - [x] 2.3 Add `listWithPreview` query to `chatSessionRouter`:
    - Input: `{ projectId: z.string().min(1) }`
    - For each session returned by the existing `list` query, also fetch the last non-tool message content (subquery or join)
    - Returns sessions with an added `lastMessagePreview: string | null` field
    - Implementation: use a raw SQL subquery or post-fetch map to get the last user/assistant message per session
  - [x] 2.4 Modify the `updateStatus` mutation: when status is set to `'paused'` or `'completed'`, also call `chatCliService.killSession(sessionId)` to terminate the CLI process if running.

- [x] Task 3: Add session idle auto-pause to DB status (AC: 5)
  - [x] 3.1 In `ChatCliService.checkIdleSessions()`, after killing idle sessions, emit an event or return the killed session IDs.
  - [x] 3.2 In the main process initialization (where `chatCliService` is instantiated), set up a listener or periodic check: when `checkIdleSessions()` returns killed session IDs, update their `chat_sessions.status` to `'paused'` and `updated_at` to now in the DB.
  - [x] 3.3 Alternative simpler approach: Have `checkIdleSessions()` accept a callback `onIdle: (sessionId: string) => void` set during initialization, which updates the DB status. This avoids adding EventEmitter to ChatCliService.

- [x] Task 4: Create ChatSessionList component (AC: 1, 2, 6)
  - [x] 4.1 Create `src/renderer/src/components/planning/ChatSessionList.tsx`:
    - Props: `{ projectId: string, onSelectSession: (session: ChatSessionListItem) => void, onNewChat: () => void }`
    - Uses `trpc.chatSession.listWithPreview.useQuery({ projectId })` with `refetchInterval: 5000`
    - Renders a scrollable list of session cards, each showing:
      - Agent persona colored dot + display name (from `AGENT_PERSONA_CONFIG`)
      - Last message preview (truncated to 60 chars)
      - Relative timestamp ("2 hours ago", "yesterday") — use simple relative time formatting (no date-fns needed, use basic logic: "just now", "N min ago", "N hours ago", "yesterday", date string)
      - Status badge: "Active" (green), "Paused" (yellow/amber), "Completed" (gray/dimmed)
    - "New Chat" button at the top with a Plus icon
    - Each session card is clickable → calls `onSelectSession`
    - Completed sessions are visually dimmed (opacity-60)
    - Context menu (right-click or three-dot menu button) with:
      - "Mark as Completed" (only for active/paused sessions)
      - "Delete" (for any session, with confirmation)
    - Styling: matches existing chat panel dark theme. Cards have subtle border, hover state, selected state ring matching persona color.

- [x] Task 5: Refactor ChatPanel to support session list view and session resume (AC: 1, 2, 3, 4)
  - [x] 5.1 Add a `view` state to ChatPanel: `'list' | 'chat'`. Default to `'list'` when no active session.
  - [x] 5.2 When `view === 'list'`, render `<ChatSessionList>` instead of `<ChatMessageArea>` + `<ChatInput>`.
  - [x] 5.3 When user selects a session from the list (`onSelectSession`):
    - Set `sessionId` to the selected session's `id`
    - Set `selectedPersona` to the session's `agent_persona` (cast to `ChatPersonaKey`)
    - Set `view` to `'chat'`
    - The existing `getMessages` query will auto-fetch messages for the selected session
  - [x] 5.4 When user clicks "New Chat" (`onNewChat`):
    - Set `view` to `'chat'`
    - Clear `sessionId` to null (triggers new session creation on first message send)
    - Show persona selector for persona choice
  - [x] 5.5 Add a "Back to sessions" button in the chat view header (left of persona selector or as breadcrumb) that sets `view` back to `'list'` without destroying the session.
  - [x] 5.6 The `sendChatMessage` mutation in the router already handles resume logic (Case B in sendChatMessage: CLI exited → spawns with --resume). No changes needed to the router's send logic.
  - [x] 5.7 When ChatPanel first opens and `projectId` is available, check if there are any sessions. If none exist, go directly to `'chat'` view (new chat flow) to avoid showing an empty list.

- [x] Task 6: Add session context menu actions (AC: 6)
  - [x] 6.1 Create `src/renderer/src/components/planning/ChatSessionContextMenu.tsx`:
    - Props: `{ session: ChatSessionListItem, onComplete: (sessionId: string) => void, onDelete: (sessionId: string) => void, children: React.ReactNode }`
    - Uses a simple dropdown menu triggered by right-click or kebab button
    - "Mark as Completed" option: calls `trpc.chatSession.updateStatus.mutate({ sessionId, status: 'completed' })`, then invalidates `listWithPreview` query
    - "Delete" option: shows inline confirmation ("Delete this session?"), then calls `trpc.chatSession.deleteSession.mutate({ sessionId })`, then invalidates `listWithPreview` query
    - Use shadcn/ui `DropdownMenu` (already available in project) or a minimal custom dropdown if shadcn DropdownMenu not installed
  - [x] 6.2 Wire context menu into `ChatSessionList` — wrap each session card with `ChatSessionContextMenu`.

- [x] Task 7: Write tests (AC: 1-6)
  - [x] 7.1 Add `ChatCliService` idle timeout tests to `chat-cli.service.test.ts`:
    - Sessions inactive > 30min are killed by `checkIdleSessions()`
    - Active sessions within 30min are NOT killed
    - `lastActivityMap` is updated on spawnSession, resumeSession, sendMessage
    - Killed sessions trigger the onIdle callback
  - [x] 7.2 Add tRPC router tests to `chat-session.router.test.ts`:
    - `deleteSession` removes session and cascades to messages
    - `deleteSession` throws NOT_FOUND for missing session
    - `listWithPreview` returns sessions with lastMessagePreview
    - `listWithPreview` returns null preview for sessions with no messages
    - `getLastMessage` returns the last user/assistant message (not tool messages)
    - `updateStatus` to 'paused'/'completed' kills CLI session
  - [x] 7.3 Create `ChatSessionList.test.tsx`:
    - Renders session cards with persona dot, name, preview, timestamp, status
    - Sessions sorted by most recently active
    - Completed sessions have dimmed styling
    - Clicking session card calls onSelectSession
    - "New Chat" button calls onNewChat
    - Context menu shows "Mark as Completed" and "Delete" options
    - "Delete" shows confirmation before deleting
  - [x] 7.4 Update `ChatPanel.test.tsx`:
    - Default view is 'list' when projectId available and sessions exist
    - Selecting a session switches to 'chat' view with correct messages loaded
    - "New Chat" switches to 'chat' view with null sessionId
    - "Back to sessions" returns to 'list' view
    - Empty session list goes directly to 'chat' view
    - Resumed session sends messages via existing sendChatMessage (router handles --resume)

## Dev Notes

### Architecture Compliance

- **Process boundaries**: All session management operations (idle timeout, kill, delete) happen in the main process. The renderer interacts only via tRPC procedures. No new IPC channels needed.
- **Data flow for resume**: User clicks session in list -> ChatPanel sets sessionId -> getMessages query fetches history -> user types message -> sendChatMessage router handles CLI spawn/resume logic (Case A/B/C already implemented in Story 10.3).
- **No new CLI service methods needed for resume**: The `sendChatMessage` tRPC procedure already has three-case logic: alive (send to stdin), exited (spawn with --resume), never started (spawn fresh). Resuming a DB session works by setting `sessionId` in ChatPanel and letting the existing flow handle CLI state.

### Critical Design Decisions

**Session list is a new view mode within ChatPanel, NOT a separate component/route:**
- ChatPanel toggles between `'list'` and `'chat'` views via internal state.
- This keeps the chat panel's 400px fixed-width layout consistent.
- The session list replaces the message area + input, not the header.
- The persona selector in the header is hidden in list view (each session already shows its persona).

**Idle timeout handled in ChatCliService (main process), not renderer:**
- A 1-minute interval checks for sessions idle > 30 minutes.
- Kills the PTY process and updates DB status to 'paused'.
- This works even if the chat panel is closed — resource cleanup is a main process concern.
- When a paused session is resumed, `sendChatMessage` router spawns a new CLI with `--resume` (Case B — session was tracked but exited).

**Session deletion cascades in SQLite:**
- The `chat_messages` table has `ON DELETE CASCADE` on `session_id` FK.
- Deleting a `chat_sessions` row automatically deletes all its messages.
- No need for manual message cleanup.

**lastMessagePreview is fetched server-side, not client-side:**
- The `listWithPreview` query returns sessions with their last non-tool message content.
- This avoids N+1 queries from the renderer fetching messages per session.
- Truncation to 60 chars happens in the renderer for display.

**"New Chat" reuses existing ChatPanel flow:**
- Setting `sessionId` to null and showing persona selector is the same initial state as the current ChatPanel.
- The first message creates a new session via `createSession.mutateAsync()`.
- No new session creation logic needed.

### Existing Code to Reuse

| What | File | Usage |
|------|------|-------|
| ChatCliService | `src/main/services/chat-cli.service.ts` | Add idle timeout, lastActivityMap tracking |
| chatSessionRouter | `src/main/trpc/routers/chat-session.router.ts` | Add deleteSession, getLastMessage, listWithPreview procedures |
| ChatPanel | `src/renderer/src/components/planning/ChatPanel.tsx` | Refactor to support list/chat view modes |
| AGENT_PERSONA_CONFIG | `src/renderer/src/constants/planning-workspace.ts` | Look up persona display name, colors for session cards |
| ChatPersonaSelector | `src/renderer/src/components/planning/ChatPersonaSelector.tsx` | Reuse ChatPersonaKey type |
| CHAT_SESSION_STATUS | `src/main/db/schema.ts` | Already has 'active', 'paused', 'completed' statuses |
| chat_sessions table | `src/main/db/schema.ts` | Already has last_message_at, status columns — no schema changes needed |
| chat_messages table | `src/main/db/schema.ts` | Already has CASCADE on session_id FK |
| cn() utility | `src/renderer/src/lib/utils.ts` | Conditional class merging |
| DropdownMenu | `src/renderer/src/components/ui/` | shadcn/ui dropdown for context menu (check if exists, otherwise use simple custom dropdown) |
| lucide-react icons | package.json | Plus, ArrowLeft, MoreVertical, Trash2, CheckCircle, MessageSquare |
| trpc.useUtils() | `@renderer/lib/trpc` | Query invalidation after mutations |
| sendChatMessage router | `src/main/trpc/routers/chat-session.router.ts` | Already handles resume (Case B: spawn with --resume). No changes needed. |

### Existing Code NOT to Touch

- Do NOT modify DB schema (`src/main/db/schema.ts`) — existing columns and statuses suffice
- Do NOT modify `db/index.ts` — no migration needed
- Do NOT modify `ChatMessageArea.tsx` — message display unchanged
- Do NOT modify `ChatMessageBubble.tsx` — bubble rendering unchanged
- Do NOT modify `ChatInput.tsx` — input component unchanged
- Do NOT modify `ChatToolActivityCard.tsx` / `ChatToolActivityGroup.tsx` / `ChatWorkingIndicator.tsx` — tool activity display unchanged
- Do NOT modify hook scripts or hook-listener.service.ts — event pipeline unchanged
- Do NOT modify `persona-context.service.ts` — persona injection unchanged
- Do NOT modify `sendChatMessage` tRPC procedure — resume logic already works

### Key Patterns from Previous Stories (10.1 - 10.5)

- `chatSessionRouter` in `chat-session.router.ts` follows the pattern: publicProcedure + z.object input + direct Drizzle query. New procedures must follow same pattern.
- `ChatCliService` methods follow: validate -> act -> update map -> log pattern. New methods should log with `[ChatCliService]` prefix.
- `CHAT_SESSION_STATUS = ['active', 'paused', 'completed']` already defined in schema.ts. The `updateStatus` mutation already validates against this enum.
- ChatPanel uses `useState` for view-local state (sessionId, persona, thinking), NOT Zustand. New state (view mode) should follow the same pattern.
- Message polling uses 2s `refetchInterval`. Session list should use 5s `refetchInterval` (less frequent since session metadata changes less often).
- tRPC query invalidation pattern: `trpcUtils.chatSession.<procedure>.invalidate(...)` — used in ChatPanel for getMessages.
- Renderer tests mock tRPC with `vi.mock('@renderer/lib/trpc')` and provide mock return values via `mockReturnValue` on individual procedures.
- Main process tests mock `db` operations and `chatCliService` methods as needed.

### File Structure

Files to create:
- `src/renderer/src/components/planning/ChatSessionList.tsx` (new session list component)
- `src/renderer/src/components/planning/ChatSessionList.test.tsx` (new tests)
- `src/renderer/src/components/planning/ChatSessionContextMenu.tsx` (new context menu component)

Files to modify:
- `src/main/services/chat-cli.service.ts` (add idle timeout, lastActivityMap)
- `src/main/services/chat-cli.service.test.ts` (add idle timeout tests)
- `src/main/trpc/routers/chat-session.router.ts` (add deleteSession, getLastMessage, listWithPreview)
- `src/main/trpc/routers/chat-session.router.test.ts` (add new procedure tests)
- `src/renderer/src/components/planning/ChatPanel.tsx` (refactor for list/chat view modes)
- `src/renderer/src/components/planning/ChatPanel.test.tsx` (update for new view modes)
- `src/main/services/index.ts` or wherever chatCliService is initialized (add idle callback to update DB)

### Testing Standards

- Co-locate tests with source: `*.test.ts` / `*.test.tsx` next to source files
- Main process tests use `node` environment with Vitest
- Renderer tests use `happy-dom` environment with `@testing-library/react`
- Mock tRPC hooks in renderer tests using `vi.mock('@renderer/lib/trpc')`
- Mock `chatCliService` in router tests
- Test idle timeout with `vi.useFakeTimers()` to control Date.now() and setInterval
- Test context menu with `@testing-library/react` `fireEvent.contextMenu` or click on kebab button

### Project Structure Notes

- New renderer components go in `src/renderer/src/components/planning/` — same directory as all other chat components
- No new directories needed
- No DB schema changes — all needed columns and statuses already exist
- No hook script changes — event pipeline unchanged

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 10.6]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 10 Overview]
- [Source: src/main/trpc/routers/chat-session.router.ts] — sendChatMessage three-case resume logic (lines 372-425)
- [Source: src/main/services/chat-cli.service.ts] — ChatCliService session lifecycle (killSession, isSessionAlive, hasSession)
- [Source: src/main/db/schema.ts#chat_sessions] — chat_sessions table with status, last_message_at columns
- [Source: src/main/db/schema.ts#CHAT_SESSION_STATUS] — ['active', 'paused', 'completed'] already defined
- [Source: src/renderer/src/components/planning/ChatPanel.tsx] — Current session management, thinking state, persona switching
- [Source: src/renderer/src/components/planning/ChatPersonaSelector.tsx] — ChatPersonaKey type, persona button pattern
- [Source: src/renderer/src/constants/planning-workspace.ts] — AGENT_PERSONA_CONFIG for persona colors/names
- [Source: _bmad-output/planning-artifacts/project-context.md] — Electron process boundaries, testing patterns, naming conventions
- [Source: _bmad-output/implementation-artifacts/10-5-tool-activity-and-working-indicators.md] — Previous story patterns, file list, testing approach

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

None required — all tests passed on first run.

### Completion Notes List

- Task 1 (ChatCliService idle timeout): Added `lastActivityMap`, `IDLE_TIMEOUT_MS` (30 min), `checkIdleSessions()`, 1-minute interval timer, `setOnIdleCallback()`. Activity tracked on spawnSession, resumeSession, sendMessage. Interval cleared in killAll().
- Task 2 (tRPC procedures): Added `deleteSession` mutation (cascade delete + kill CLI), `getLastMessage` query (last non-tool message), `listWithPreview` query (post-fetch map with subquery per session). Modified `updateStatus` to kill CLI on paused/completed.
- Task 3 (Idle auto-pause to DB): Used callback pattern — `setOnIdleCallback` in services/index.ts sets DB status to 'paused' when idle sessions are auto-killed.
- Task 4 (ChatSessionList): Created scrollable session list with persona dot/name, message preview (truncated 60 chars), relative timestamps, status badges (Active/Paused/Completed), dimmed completed sessions, "New Chat" button.
- Task 5 (ChatPanel refactoring): Added list/chat view toggle. List view shows ChatSessionList; chat view shows original persona selector + message area + input. Added "Back to sessions" button. Auto-switches to chat when no sessions exist. Session selection sets sessionId and persona for resume.
- Task 6 (Context menu): Created ChatSessionContextMenu with custom dropdown (no shadcn DropdownMenu dependency). "Mark as Completed" and "Delete" (with inline confirmation). Wired into ChatSessionList via kebab button.
- Task 7 (Tests): 123 total tests across 4 test files — 31 ChatCliService (including 7 new idle timeout tests), 55 router (including 14 new deleteSession/getLastMessage/listWithPreview/updateStatus-kill tests), 16 ChatSessionList, 21 ChatPanel (including 7 new list/chat view mode tests). All pass. No regressions.

### Change Log

- 2026-03-22: Story 10.6 implementation complete — all 7 tasks done, 123 tests passing

### File List

New files:
- src/renderer/src/components/planning/ChatSessionList.tsx
- src/renderer/src/components/planning/ChatSessionList.test.tsx
- src/renderer/src/components/planning/ChatSessionContextMenu.tsx

Modified files:
- src/main/services/chat-cli.service.ts (idle timeout: lastActivityMap, checkIdleSessions, setOnIdleCallback, IDLE_TIMEOUT_MS)
- src/main/services/chat-cli.service.test.ts (added 7 idle timeout tests)
- src/main/services/index.ts (added idle callback wiring with DB update)
- src/main/trpc/routers/chat-session.router.ts (added deleteSession, getLastMessage, listWithPreview procedures; modified updateStatus to kill CLI)
- src/main/trpc/routers/chat-session.router.test.ts (added 14 tests for new procedures + updateStatus kill behavior)
- src/renderer/src/components/planning/ChatPanel.tsx (refactored for list/chat view modes, session selection/resume, back button)
- src/renderer/src/components/planning/ChatPanel.test.tsx (updated with 7 new list/chat view mode tests)

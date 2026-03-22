# Story 10.3: Claude Code CLI Chat Session Spawning

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a founder,
I want my chat messages to be sent to an interactive Claude Code CLI session and get agent responses back,
So that I can actually have a working conversation with an agent through the chat UI.

## Acceptance Criteria

1. **Given** I send a message in the chat panel with no active CLI session **When** the message is submitted **Then** TinSu spawns an interactive `claude` process via node-pty with a unique `--session-id` UUID **And** the session UUID is stored in the `chat_sessions` table **And** my message is sent to the CLI session's stdin

2. **Given** an active CLI session exists for the current chat **When** I send a follow-up message **Then** the message is sent to the existing PTY session's stdin (no new process spawned)

3. **Given** a message is sent to the CLI session **When** Claude Code finishes responding **Then** the `Stop` hook fires and delivers `last_assistant_message` to the hook endpoint **And** the message is stored in `chat_messages` and appears as an agent bubble in the chat UI

4. **Given** the agent is processing a message **When** the response has not yet arrived **Then** a "thinking..." or typing indicator is visible in the chat panel

5. **Given** the Claude Code CLI session crashes or exits unexpectedly **When** I send a new message **Then** TinSu spawns a new CLI process with `--resume` using the stored session UUID **And** the conversation continues seamlessly

6. **Given** I close the chat panel **When** the CLI session is active **Then** the session continues running in the background (not terminated)

## Tasks / Subtasks

- [x] Task 1: Create `ChatCliService` for managing chat CLI sessions (AC: 1, 2, 5)
  - [x] 1.1 Create `src/main/services/chat-cli.service.ts` — a service class that manages Claude Code CLI PTY processes for chat sessions. Uses `ptyService` singleton (NOT tmux) to spawn interactive `claude` processes. Maintains an in-memory map: `sessionId -> { processId, sessionUuid, status }` to track active CLI processes per chat session.
  - [x] 1.2 Implement `spawnSession(sessionId: string, sessionUuid: string, projectPath: string, initialMessage: string): Promise<string>` — spawns `claude` with args `['--session-id', sessionUuid]`, cwd set to `projectPath`, env includes `CLAUDE_HOOKS_DIR` pointing to a chat-specific hooks directory. After spawn, writes `initialMessage + '\n'` to the PTY stdin. Returns the PTY processId. Sets up PTY exit listener to update session map status to 'exited'.
  - [x] 1.3 Implement `sendMessage(sessionId: string, message: string): void` — looks up processId from session map; calls `ptyService.write(processId, message + '\n')`. Throws `TRPCError NOT_FOUND` if no active session. Throws `TRPCError PRECONDITION_FAILED` if session status is 'exited'.
  - [x] 1.4 Implement `resumeSession(sessionId: string, sessionUuid: string, projectPath: string, message: string): Promise<string>` — spawns `claude` with args `['--resume', '--session-id', sessionUuid]`, sends `message + '\n'` to stdin. Updates session map with new processId. Returns processId.
  - [x] 1.5 Implement `isSessionAlive(sessionId: string): boolean` — checks if session exists in map AND ptyService.getProcess(processId) returns a process with state 'running'.
  - [x] 1.6 Implement `killSession(sessionId: string): void` — kills PTY process via ptyService.kill(), removes from map.
  - [x] 1.7 Implement `killAll(): void` — kills all chat CLI processes. Called on app shutdown.

- [x] Task 2: Create chat-specific Claude Code hook scripts (AC: 3)
  - [x] 2.1 Create `src/main/resources/chat-hooks/stop.sh` — reads JSON from stdin, reads port from `/tmp/tinsu-hook-port`, POSTs to `http://localhost:${PORT}/api/hooks/chat-stop` (NOT the task `/api/hooks/stop` endpoint). Same pattern as `.claude/hooks/task-completion.sh` but uses the chat-specific endpoint.
  - [x] 2.2 Create `src/main/resources/chat-hooks/tool-use.sh` — reads JSON from stdin, reads port from `/tmp/tinsu-hook-port`, POSTs to `http://localhost:${PORT}/api/hooks/chat-tool-use` (NOT the task `/api/hooks/tool-use` endpoint). Same pattern as `.claude/hooks/log-tool-use.sh` but uses the chat-specific endpoint.
  - [x] 2.3 Create `src/main/resources/chat-hooks/.claude/settings.json` — Claude Code settings file with hooks config that references the chat-specific stop.sh and tool-use.sh scripts using relative paths.
  - [x] 2.4 Ensure hook scripts are executable (755 permissions) and packaged with the app build.

- [x] Task 3: Add `sendChatMessage` tRPC mutation to chat session router (AC: 1, 2, 5)
  - [x] 3.1 Add `sendChatMessage` mutation to `src/main/trpc/routers/chat-session.router.ts` — accepts `{ sessionId: string, content: string }`. Flow: (1) Look up session by ID to get session_uuid, (2) Insert user message into chat_messages, (3) Check if CLI session is alive via ChatCliService.isSessionAlive(), (4a) If alive: call ChatCliService.sendMessage(), (4b) If not alive: get project path, call ChatCliService.resumeSession() with `--resume`, (4c) If no session ever started: get project path, call ChatCliService.spawnSession(). Returns the created user message.
  - [x] 3.2 Add `getProjectPath` helper — resolves project path from session's project_id by querying `projects` table for the project path.

- [x] Task 4: Update `ChatPanel` to use `sendChatMessage` mutation (AC: 1, 2, 4)
  - [x] 4.1 In `src/renderer/src/components/planning/ChatPanel.tsx`, replace the current `handleSend` flow: instead of calling `addMessage` mutation directly, call the new `sendChatMessage` mutation. The `sendChatMessage` mutation handles both storing the user message AND spawning/sending to the CLI. Remove the separate `addMessage` call.
  - [x] 4.2 Add `isAgentThinking` state — set to `true` after sending a message, set to `false` when a new assistant message appears in the messages query. Use a `useEffect` that watches `messages` array length or the last message's role.
  - [x] 4.3 Pass `isAgentThinking` to `ChatMessageArea` as a prop to display the typing indicator.

- [x] Task 5: Add typing indicator to `ChatMessageArea` (AC: 4)
  - [x] 5.1 In `src/renderer/src/components/planning/ChatMessageArea.tsx`, accept an `isAgentThinking: boolean` prop.
  - [x] 5.2 When `isAgentThinking` is true, render a "thinking..." indicator at the bottom of the messages list. Use a left-aligned bubble with animated dots (three dots with staggered opacity animation using Tailwind's `animate-pulse` or custom CSS animation via `@keyframes`). Show the agent persona label + "is thinking..." text.
  - [x] 5.3 The indicator auto-scrolls into view (existing auto-scroll logic handles this since it's appended to the bottom).

- [x] Task 6: Handle CLI process exit and reconnection (AC: 5, 6)
  - [x] 6.1 In `ChatCliService`, on PTY exit event: update session map status to 'exited', log warning. Do NOT terminate the chat session or change its DB status — the session remains 'active' so it can be resumed.
  - [x] 6.2 In `sendChatMessage` mutation: when `isSessionAlive()` returns false but a session_uuid exists in DB, call `resumeSession()` which spawns with `--resume --session-id {uuid}`. This handles both crashes and clean exits transparently.
  - [x] 6.3 When chat panel closes (component unmounts or user clicks X): do NOT kill the CLI process. The process continues running in the background. PTY output is simply not displayed.

- [x] Task 7: Write tests (AC: 1-6)
  - [x] 7.1 Create `src/main/services/chat-cli.service.test.ts` — test: spawnSession creates PTY with correct args and writes initial message, sendMessage writes to existing PTY, resumeSession spawns with --resume flag, isSessionAlive returns correct state, killSession kills PTY and cleans map, exit event updates map status.
  - [x] 7.2 Add tests to `src/main/trpc/routers/chat-session.router.test.ts` — test: sendChatMessage stores user message, sendChatMessage spawns CLI for new session, sendChatMessage reuses existing CLI, sendChatMessage resumes exited CLI, error when session not found.
  - [x] 7.3 Create `src/renderer/src/components/planning/ChatMessageArea.test.tsx` (extend existing) — test: typing indicator appears when isAgentThinking=true, typing indicator hidden when false.
  - [x] 7.4 Extend `src/renderer/src/components/planning/ChatPanel.test.tsx` — test: sendChatMessage mutation is called on send (not addMessage directly).

## Dev Notes

### Architecture Compliance

- **Process boundaries**: Chat CLI sessions (node-pty) run in the main process. The renderer communicates ONLY via tRPC mutations (`sendChatMessage`) and queries (`getMessages`). No direct PTY access from renderer.
- **PTY vs tmux**: Chat sessions use `ptyService` (node-pty) directly, NOT tmux sessions. Task execution uses tmux for session persistence across app restarts; chat sessions use node-pty because they are lightweight, interactive, and don't need tmux's persistence (Story 10.6 handles session resume separately via `--resume` flag).
- **Hook isolation**: Chat sessions POST to `/api/hooks/chat-stop` and `/api/hooks/chat-tool-use` (Story 10.1 endpoints), NOT the task execution endpoints (`/api/hooks/stop`, `/api/hooks/tool-use`). This prevents chat events from triggering task automation (auto-commits, workflow transitions, etc.).
- **State management**: Use tRPC + TanStack Query for message polling. Local UI state (`isAgentThinking`) in React component state. Session-to-process mapping in ChatCliService in-memory map (main process only).

### Critical Design Decisions

**node-pty for chat (NOT tmux):**
- Task execution uses tmux because tasks need to survive app restarts, support scrollback backup, and run unattended.
- Chat sessions are interactive and user-driven. If the app restarts, the PTY dies — but Claude Code's `--resume` flag restores conversation context from Claude's side. No tmux needed.
- This avoids the complexity of creating/managing tmux sessions for every chat.

**CLAUDE_HOOKS_DIR for chat-specific hooks:**
- The `claude` CLI respects `CLAUDE_PROJECT_DIR` for hooks. To use chat-specific hook scripts (that POST to `/api/hooks/chat-stop` instead of `/api/hooks/stop`), set `CLAUDE_PROJECT_DIR` env var to a directory containing `.claude/settings.json` with hook configurations pointing to the chat hook scripts.
- Alternative approach: Create a temporary directory per session with `.claude/settings.json` that configures the hooks. Set `CLAUDE_PROJECT_DIR` to this temp dir when spawning the claude process. The cwd is still the real project path.
- The chat hook scripts live in `src/main/resources/chat-hooks/` and are bundled with the app.

**Message delivery via polling (not streaming):**
- Per Epic 10 design decision: "Option A: no streaming, messages delivered on Stop hook."
- The ChatPanel already polls `getMessages` every 2 seconds (`refetchInterval: 2000` in the query). When the Stop hook fires, it inserts an assistant message into `chat_messages`. The next poll picks it up and renders it.
- The `isAgentThinking` indicator covers the gap between send and response.

**sendChatMessage mutation combines store + send:**
- The tRPC mutation both stores the user message in DB AND sends it to the CLI. This ensures atomic operations — if the CLI fails to spawn, the user message is still recorded so it can be retried.
- The renderer only needs to call one mutation, simplifying the ChatPanel logic.

### Existing Code to Reuse

| What | File | Usage |
|------|------|-------|
| PTY service singleton | `src/main/services/pty.service.ts` | `ptyService.spawn()`, `.write()`, `.kill()`, `.getProcess()`, `.on('exit')` |
| Chat session DB tables | `src/main/db/schema.ts` | `chat_sessions`, `chat_messages`, `CHAT_MESSAGE_ROLE` |
| Chat session router | `src/main/trpc/routers/chat-session.router.ts` | Extend with `sendChatMessage` |
| Chat hook endpoints | `src/main/services/hook-listener.service.ts` | `/api/hooks/chat-stop`, `/api/hooks/chat-tool-use` (already implemented in 10.1) |
| Hook port file | `/tmp/tinsu-hook-port` | Chat hook scripts read this for port discovery |
| Task hook scripts pattern | `.claude/hooks/task-completion.sh` | Template for chat hook scripts (same curl pattern, different endpoint) |
| ChatPanel component | `src/renderer/src/components/planning/ChatPanel.tsx` | Modify to use `sendChatMessage` |
| ChatMessageArea component | `src/renderer/src/components/planning/ChatMessageArea.tsx` | Add typing indicator |
| Claude CLI detector | `src/main/services/claude-cli-detector.service.ts` | Check claude is installed before spawning |
| Projects table | `src/main/db/schema.ts` | `projects` table for resolving project path |

### Existing Code NOT to Touch

- Do NOT modify `hook-listener.service.ts` — chat hook endpoints are already implemented in Story 10.1
- Do NOT modify `task-terminal.service.ts` — task execution uses tmux, chat uses node-pty
- Do NOT modify `bmad-agent-launcher.service.ts` — that's for task execution workflows
- Do NOT modify existing hook scripts in `.claude/hooks/` — those are for task execution
- Do NOT modify `pty.service.ts` — use it as-is via the singleton
- Do NOT modify `ChatPersonaSelector.tsx`, `ChatMessageBubble.tsx`, or `ChatInput.tsx` — those are stable from Story 10.2

### Key Patterns from Previous Stories (10.1, 10.2)

- `chat_sessions.id` is TinSu's internal PK (UUID). `session_uuid` is Claude Code's session ID passed as `--session-id` flag.
- `chat_messages.session_id` references `chat_sessions.id` (internal PK), NOT `session_uuid`.
- Hook payload `session_id` field maps to `chat_sessions.session_uuid` (confusing naming but established in 10.1).
- The router uses `publicProcedure` from `../trpc`, Zod validation, `TRPCError` for errors.
- ChatPanel currently: creates session via `trpc.chatSession.create.useMutation()` on first message, then adds user message via `trpc.chatSession.addMessage.useMutation()`. This story replaces the send flow with `sendChatMessage`.
- Messages poll every 2s: `trpc.chatSession.getMessages.useQuery({ sessionId }, { refetchInterval: 2000 })`.

### Claude Code CLI Flags Reference

| Flag | Purpose |
|------|---------|
| `--session-id UUID` | Start or resume a session with a specific UUID |
| `--resume` | Resume the last conversation (used with `--session-id` for specific session) |
| `--dangerously-skip-permissions` | Auto-accept all tool calls (NOT for chat — chat is interactive) |

**IMPORTANT**: Chat sessions are INTERACTIVE — do NOT use `--dangerously-skip-permissions`. The user's messages go to stdin, and Claude responds through the hook pipeline. Unlike task execution which uses `--dangerously-skip-permissions` for automated workflows, chat sessions need the user to be in control.

### File Structure

Files to create:
- `src/main/services/chat-cli.service.ts` (new service)
- `src/main/services/chat-cli.service.test.ts` (new tests)
- `src/main/resources/chat-hooks/stop.sh` (new hook script)
- `src/main/resources/chat-hooks/tool-use.sh` (new hook script)
- `src/main/resources/chat-hooks/.claude/settings.json` (new hook config)

Files to modify:
- `src/main/trpc/routers/chat-session.router.ts` (add `sendChatMessage` mutation)
- `src/main/trpc/routers/chat-session.router.test.ts` (add `sendChatMessage` tests)
- `src/renderer/src/components/planning/ChatPanel.tsx` (use `sendChatMessage`, add thinking state)
- `src/renderer/src/components/planning/ChatMessageArea.tsx` (add typing indicator)
- `src/renderer/src/components/planning/ChatMessageArea.test.tsx` (add indicator tests)
- `src/renderer/src/components/planning/ChatPanel.test.tsx` (update send flow tests)

### Testing Standards

- Co-locate tests with source: `*.test.ts` next to `*.ts`
- Main process tests use `node` environment with Vitest
- Renderer tests use `happy-dom` environment with `@testing-library/react`
- Mock `ptyService` in ChatCliService tests using `vi.mock('../pty.service')`
- Mock tRPC hooks in renderer tests using `vi.mock('@renderer/lib/trpc')`
- Mock ChatCliService in router tests — do NOT actually spawn PTY processes in tests

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 10.3]
- [Source: _bmad-output/planning-artifacts/architecture.md#Process Lifecycle Management]
- [Source: _bmad-output/planning-artifacts/project-context.md#PTY/Terminal Pattern]
- [Source: _bmad-output/planning-artifacts/project-context.md#Claude Code Hooks Pattern]
- [Source: src/main/services/pty.service.ts] — PTY service singleton for spawn/write/kill
- [Source: src/main/services/hook-listener.service.ts] — Chat hook endpoints (onChatStopHook, onChatToolUseHook)
- [Source: src/main/trpc/routers/chat-session.router.ts] — Existing chat session procedures
- [Source: src/main/db/schema.ts] — chat_sessions (session_uuid), chat_messages tables
- [Source: src/renderer/src/components/planning/ChatPanel.tsx] — Current chat panel implementation
- [Source: src/renderer/src/components/planning/ChatMessageArea.tsx] — Message area component
- [Source: .claude/hooks/task-completion.sh] — Hook script pattern template
- [Source: .claude/settings.json] — Hook configuration pattern
- [Source: src/main/services/bmad-agent-launcher.service.ts] — Reference for CLI spawning patterns (task execution uses different approach)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

- Initial ChatCliService tests failed (3/19) due to `vi.clearAllMocks()` clearing `mockSpawn.mockReturnValue('pty-123')` set at module scope. Fixed by re-establishing default mock return value in `beforeEach`.
- ChatPanel/ChatMessageArea tests failed due to `vi.mock` hoisting — factory function referenced `mockPersonaConfig` variable before initialization. Fixed by inlining config inside factory.

### Completion Notes List

- Task 1: Created `ChatCliService` class with `spawnSession`, `sendMessage`, `resumeSession`, `isSessionAlive`, `hasSession`, `killSession`, `killAll` methods. Uses `ptyService` singleton (node-pty, NOT tmux). In-memory map tracks sessionId -> {processId, sessionUuid, status}. Constructor registers PTY exit event listener to update session status.
- Task 2: Created chat-specific hook scripts (`stop.sh`, `tool-use.sh`) that POST to `/api/hooks/chat-stop` and `/api/hooks/chat-tool-use` respectively. Created `.claude/settings.json` for hook configuration. Scripts set to 755 permissions.
- Task 3: Added `sendChatMessage` tRPC mutation that atomically stores user message and sends to CLI. Three-way dispatch: spawn fresh (no prior session), send to alive session, or resume exited session. Added `getProjectPath` helper.
- Task 4: Updated `ChatPanel` to use `sendChatMessage` mutation instead of `addMessage`. Added `isAgentThinking` state with `useEffect` watching for new assistant messages. Removed unused `addMessage` mutation and `useProjectStore` import.
- Task 5: Updated `ChatMessageArea` to accept `isAgentThinking` prop. Renders animated three-dot typing indicator with persona label when true. Auto-scrolls into view via existing sentinel div mechanism.
- Task 6: Exit handling implemented in ChatCliService (handlePtyExit sets status to 'exited'), router handles reconnection transparently, ChatPanel does NOT kill CLI on unmount.
- Task 7: 75 total tests (19 ChatCliService + 34 router + 12 ChatMessageArea + 10 ChatPanel). All pass. No regressions introduced.

### Change Log

- 2026-03-22: Story 10.3 implemented — ChatCliService, chat hook scripts, sendChatMessage mutation, ChatPanel CLI integration, typing indicator. 75 tests passing.

### File List

New files:
- src/main/services/chat-cli.service.ts
- src/main/services/chat-cli.service.test.ts
- src/main/resources/chat-hooks/stop.sh
- src/main/resources/chat-hooks/tool-use.sh
- src/main/resources/chat-hooks/.claude/settings.json

Modified files:
- src/main/services/index.ts (added ChatCliService singleton and exports)
- src/main/trpc/routers/chat-session.router.ts (added sendChatMessage mutation, getProjectPath helper)
- src/main/trpc/routers/chat-session.router.test.ts (added sendChatMessage tests, chatCliService mock)
- src/renderer/src/components/planning/ChatPanel.tsx (replaced addMessage with sendChatMessage, added isAgentThinking)
- src/renderer/src/components/planning/ChatPanel.test.tsx (updated mocks for sendChatMessage, added send flow test)
- src/renderer/src/components/planning/ChatMessageArea.tsx (added isAgentThinking prop, typing indicator)
- src/renderer/src/components/planning/ChatMessageArea.test.tsx (added typing indicator tests, persona config mock)

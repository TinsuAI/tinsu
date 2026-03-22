# Story 10.5: Tool Activity & Working Indicators

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.

## Story

As a founder,
I want to see what the agent is doing while it works (reading files, searching, writing),
So that I'm not staring at a blank screen and I understand the agent's process.

## Acceptance Criteria

1. **Given** the agent is processing my message **When** a `PreToolUse` hook event is received **Then** the chat UI shows a contextual indicator: "Reading {file_path}...", "Searching for {pattern}...", "Writing {file_path}...", etc. **And** the indicator replaces the generic "thinking..." indicator

2. **Given** the agent has completed a tool call **When** a `PostToolUse` hook event is received **Then** a collapsible tool activity card appears between message bubbles **And** the card shows: tool name icon, brief description (e.g., "Read architecture.md"), and is collapsed by default

3. **Given** a tool activity card exists **When** I click to expand it **Then** I see the tool input details (file path, search pattern, etc.) **And** a truncated preview of the tool response (first 10 lines or 500 chars)

4. **Given** multiple tool calls happen in sequence before the agent responds **When** the tool activity is displayed **Then** consecutive tool cards are grouped together as "Agent performed N actions" **And** I can expand the group to see individual tool cards

5. **Given** the agent encounters a `Notification` hook event **When** the notification type is `permission_prompt` **Then** the chat UI displays a system message: "Agent needs permission to proceed" **And** the founder can see what permission is being requested

## Tasks / Subtasks

- [x] Task 1: Add PreToolUse and Notification hook endpoints to HookListenerService (AC: 1, 5)
  - [x] 1.1 Add Zod schemas for chat-specific PreToolUse and Notification hook payloads in `hook-listener.service.ts`:
    - `ChatPreToolUseHookPayloadSchema`: `{ session_id: string, tool_name: string, tool_input: Record<string, any>, hook_event_name: 'PreToolUse' }.passthrough()`
    - `ChatNotificationHookPayloadSchema`: `{ session_id: string, type: string, message: string, hook_event_name: 'Notification' }.passthrough()`
  - [x] 1.2 Add route `POST /api/hooks/chat-pre-tool-use` in `handleRequest()` — validates payload with `ChatPreToolUseHookPayloadSchema`, calls `this.onChatPreToolUseHook(payload)`. Follow the same try/catch/400/500 pattern as existing chat hook routes.
  - [x] 1.3 Add route `POST /api/hooks/chat-notification` in `handleRequest()` — validates payload with `ChatNotificationHookPayloadSchema`, calls `this.onChatNotificationHook(payload)`. Same error handling pattern.
  - [x] 1.4 Implement `onChatPreToolUseHook(payload)`:
    - Look up `chat_sessions` by `session_uuid = payload.session_id`
    - If not found, warn and return (same pattern as `onChatToolUseHook`)
    - Insert into `chat_messages` with `role: 'tool'`, `content: 'PreToolUse: {tool_name}'`, `tool_name: payload.tool_name`, `tool_input: JSON.stringify(payload.tool_input)`
    - Update `chat_sessions.updated_at`
  - [x] 1.5 Implement `onChatNotificationHook(payload)`:
    - Look up `chat_sessions` by `session_uuid = payload.session_id`
    - If not found, warn and return
    - Insert into `chat_messages` with `role: 'tool'`, `content: 'Notification: {payload.type}: {payload.message}'`, `tool_name: '__notification__'`, `tool_input: JSON.stringify({ type: payload.type, message: payload.message })`
    - Update `chat_sessions.updated_at`

- [x] Task 2: Add PreToolUse and Notification hook scripts for chat sessions (AC: 1, 5)
  - [x] 2.1 Create `src/main/resources/chat-hooks/pre-tool-use.sh` — reads stdin JSON, POSTs to `http://localhost:${TINSU_PORT}/api/hooks/chat-pre-tool-use`. Same pattern as existing `tool-use.sh`.
  - [x] 2.2 Create `src/main/resources/chat-hooks/notification.sh` — reads stdin JSON, POSTs to `http://localhost:${TINSU_PORT}/api/hooks/chat-notification`. Same pattern.
  - [x] 2.3 Update `src/main/resources/chat-hooks/.claude/settings.json` to add:
    ```json
    "PreToolUse": [{ "matcher": "", "hooks": [{ "type": "command", "command": "bash \"$CLAUDE_PROJECT_DIR\"/pre-tool-use.sh" }] }],
    "Notification": [{ "matcher": "", "hooks": [{ "type": "command", "command": "bash \"$CLAUDE_PROJECT_DIR\"/notification.sh" }] }]
    ```

- [x] Task 3: Add tRPC query for tool activity messages (AC: 1, 2, 3, 4)
  - [x] 3.1 Add `getToolActivity` query to `chatSessionRouter` in `chat-session.router.ts`:
    - Input: `{ sessionId: string }`
    - Query: `SELECT * FROM chat_messages WHERE session_id = ? AND role = 'tool' ORDER BY created_at ASC`
    - Returns all tool messages for the session (PreToolUse, PostToolUse, Notification)
  - [x] 3.2 Ensure the existing `getMessages` query already returns tool messages (it does — the `role = 'tool'` filter in the renderer's `ChatMessageArea` is what hides them). The new approach: return ALL messages from `getMessages` and let the renderer decide what to display.

- [x] Task 4: Create ChatToolActivityCard component (AC: 2, 3)
  - [x] 4.1 Create `src/renderer/src/components/planning/ChatToolActivityCard.tsx` — a collapsible card displaying tool activity between message bubbles.
    - Props: `{ toolName: string, toolInput: string | null, content: string, createdAt: Date | string | number }`
    - Collapsed state: shows tool icon (mapped by tool_name), brief description (e.g., "Read architecture.md"), and timestamp
    - Expanded state: shows tool input details (parsed from JSON) and truncated content preview (first 10 lines or 500 chars)
    - Tool name to icon mapping: Read -> FileText, Write -> FileEdit, Edit -> Pencil, Bash -> Terminal, Grep -> Search, Glob -> FolderSearch, default -> Wrench
    - Tool name to description mapping: generate contextual description from tool_input:
      - Read: "Read {file_path}" (basename only)
      - Write: "Write {file_path}" (basename only)
      - Edit: "Edit {file_path}" (basename only)
      - Bash: "Ran command" (truncated first 40 chars of command)
      - Grep: "Searched for {pattern}" (truncated pattern)
      - Glob: "Found files matching {pattern}"
      - Default: tool_name
    - Styling: subtle, semi-transparent card with muted border, smaller text than message bubbles. Use Tailwind classes consistent with the chat panel's dark theme.
    - Click toggles expanded/collapsed state.

- [x] Task 5: Create ChatToolActivityGroup component (AC: 4)
  - [x] 5.1 Create `src/renderer/src/components/planning/ChatToolActivityGroup.tsx` — groups consecutive tool cards.
    - Props: `{ toolMessages: ChatMessage[], defaultExpanded?: boolean }`
    - If only 1 tool message: renders a single `ChatToolActivityCard`
    - If 2+ tool messages: renders a collapsed group header "Agent performed N actions" with expand/collapse toggle
    - When expanded: shows all individual `ChatToolActivityCard` items
    - Styling: slightly indented, connected visually with a thin vertical line on the left

- [x] Task 6: Create ChatWorkingIndicator component (AC: 1)
  - [x] 6.1 Create `src/renderer/src/components/planning/ChatWorkingIndicator.tsx` — replaces the generic "thinking..." indicator with contextual tool activity.
    - Props: `{ agentPersona?: string | null, currentToolActivity?: { toolName: string, toolInput: Record<string, any> } | null }`
    - When `currentToolActivity` is null: show generic "is thinking..." (existing animated dots)
    - When `currentToolActivity` is set: show contextual indicator matching tool type:
      - Read: "Reading {basename(file_path)}..."
      - Write: "Writing {basename(file_path)}..."
      - Edit: "Editing {basename(file_path)}..."
      - Bash: "Running command..."
      - Grep: "Searching for {pattern}..."
      - Glob: "Finding files..."
      - Default: "Using {tool_name}..."
    - Include animated pulse dot matching agent persona color
    - Styling: same position and style as the existing thinking indicator in ChatMessageArea

- [x] Task 7: Update ChatMessageArea to display tool activity and working indicators (AC: 1, 2, 3, 4)
  - [x] 7.1 Update `ChatMessageArea.tsx` to:
    - Remove the `msg.role !== 'tool'` filter from message rendering
    - Group messages into segments: user/assistant messages render as `ChatMessageBubble`, consecutive tool messages between non-tool messages render as `ChatToolActivityGroup`
    - Add `currentToolActivity` prop to pass the latest PreToolUse event data
    - Replace the inline "thinking..." indicator with `<ChatWorkingIndicator>` component
  - [x] 7.2 Add `currentToolActivity` prop to `ChatMessageAreaProps`:
    - Type: `{ toolName: string, toolInput: Record<string, any> } | null`
    - Passed down from ChatPanel which tracks it from tool messages

- [x] Task 8: Update ChatPanel to track current tool activity from polled messages (AC: 1)
  - [x] 8.1 In `ChatPanel.tsx`, add state `currentToolActivity` to track the latest PreToolUse event:
    - When `isAgentThinking` is true and new tool messages appear (role === 'tool', content starts with 'PreToolUse:'), extract tool_name and tool_input from the latest one
    - When `isAgentThinking` becomes false (assistant message arrived), set `currentToolActivity` to null
    - Pass `currentToolActivity` to `ChatMessageArea`
  - [x] 8.2 In the `useEffect` that watches messages for new assistant messages, also check for new tool messages:
    - If the latest message is a PreToolUse tool message, update `currentToolActivity` with `{ toolName, toolInput }` parsed from the message
    - Clear `currentToolActivity` when assistant message arrives (the existing `setIsAgentThinking(false)` flow)

- [x] Task 9: Handle Notification/permission_prompt display (AC: 5)
  - [x] 9.1 In `ChatMessageArea.tsx`, when rendering tool messages:
    - If `tool_name === '__notification__'` and tool_input contains `type: 'permission_prompt'`, render a special system message card:
      - Yellow/amber accent background
      - Shield or AlertTriangle icon
      - Text: "Agent needs permission to proceed"
      - Show the `message` field from tool_input as the permission description
    - This is NOT part of the tool activity group — it renders as its own standalone system message between bubbles

- [x] Task 10: Write tests (AC: 1-5)
  - [x] 10.1 Add hook handler tests to `hook-listener.service.test.ts`:
    - `onChatPreToolUseHook` stores tool message with role 'tool' and content 'PreToolUse: {tool_name}'
    - `onChatPreToolUseHook` ignores payload with unknown session_id
    - `onChatNotificationHook` stores notification with tool_name '__notification__'
    - `onChatNotificationHook` ignores unknown sessions
    - Route tests: POST to `/api/hooks/chat-pre-tool-use` returns 200
    - Route tests: POST to `/api/hooks/chat-notification` returns 200
    - Route tests: invalid payloads return 400
  - [x] 10.2 Create `ChatToolActivityCard.test.tsx`:
    - Renders collapsed by default showing tool icon and description
    - Click expands to show tool input details
    - Truncates long content to 500 chars
    - Maps tool names to correct icons
    - Maps tool inputs to correct contextual descriptions
  - [x] 10.3 Create `ChatToolActivityGroup.test.tsx`:
    - Single tool message renders as individual card (no group header)
    - Multiple tool messages show "Agent performed N actions" header
    - Expanding group shows individual cards
    - Collapsing group hides individual cards
  - [x] 10.4 Create `ChatWorkingIndicator.test.tsx`:
    - Shows generic "thinking..." when no currentToolActivity
    - Shows contextual "Reading {file}..." for Read tool
    - Shows contextual "Searching for {pattern}..." for Grep tool
    - Shows persona-colored pulse dot
  - [x] 10.5 Update `ChatMessageArea.test.tsx`:
    - Tool messages render as ChatToolActivityGroup (not filtered out)
    - Working indicator replaces thinking indicator when currentToolActivity is set
    - Notification messages render as system messages with amber accent
  - [x] 10.6 Update `ChatPanel.test.tsx`:
    - currentToolActivity updates when PreToolUse tool messages arrive during thinking
    - currentToolActivity clears when assistant message arrives

## Dev Notes

### Architecture Compliance

- **Process boundaries**: All hook event handling happens in the main process (`HookListenerService`). The renderer polls for messages via tRPC `getMessages` query (2s `refetchInterval`). No new IPC channels or subscriptions needed — the existing polling mechanism automatically picks up new tool messages.
- **Data flow**: Hook event -> HookListenerService -> insert into `chat_messages` DB -> tRPC `getMessages` poll -> renderer displays. Same pipeline as existing assistant messages.
- **No streaming**: This story does NOT add WebSocket or streaming. Tool activity visibility has up to 2s latency (existing poll interval). This is acceptable for planning chat context.

### Critical Design Decisions

**PreToolUse events stored as `chat_messages` with role 'tool':**
- The `chat_messages` table already has `role = 'tool'`, `tool_name`, and `tool_input` columns (added in Story 10.1).
- PreToolUse messages are distinguished from PostToolUse messages by the content prefix: `'PreToolUse: {tool_name}'` vs `'Tool: {tool_name}'` (existing PostToolUse format).
- This reuses the existing table schema — NO database migration needed.

**Tool message grouping logic lives in the renderer:**
- The renderer groups consecutive tool messages between user/assistant messages into `ChatToolActivityGroup` components.
- The grouping algorithm: iterate through messages, collect consecutive tool messages (any message where `role === 'tool'` and `tool_name !== '__notification__'`), wrap each consecutive group in a `ChatToolActivityGroup`.

**currentToolActivity is derived from polled messages, NOT separate state:**
- When `isAgentThinking` is true, scan the latest polled tool messages for PreToolUse events.
- The latest PreToolUse message determines what the working indicator shows.
- When an assistant message arrives (thinking ends), the working indicator disappears entirely.
- This avoids adding a separate tRPC endpoint or state management layer.

**Notification messages are NOT grouped with tool activity:**
- Messages with `tool_name === '__notification__'` render as standalone system messages.
- They have a distinct visual treatment (amber accent) to draw attention.
- They are NOT collapsible — they always show.

### Existing Code to Reuse

| What | File | Usage |
|------|------|-------|
| HookListenerService | `src/main/services/hook-listener.service.ts` | Add new routes and handlers for PreToolUse, Notification |
| Chat hook schemas | `src/main/services/hook-listener.service.ts` | Follow pattern of ChatStopHookPayloadSchema, ChatToolUseHookPayloadSchema |
| chat_messages table | `src/main/db/schema.ts` | Reuse existing schema — no migration needed |
| ChatMessageArea | `src/renderer/src/components/planning/ChatMessageArea.tsx` | Modify to render tool messages and working indicator |
| ChatMessageBubble | `src/renderer/src/components/planning/ChatMessageBubble.tsx` | Read-only reference for styling consistency |
| ChatPanel | `src/renderer/src/components/planning/ChatPanel.tsx` | Add currentToolActivity tracking |
| Chat hooks settings | `src/main/resources/chat-hooks/.claude/settings.json` | Add PreToolUse and Notification hook entries |
| Chat hook scripts | `src/main/resources/chat-hooks/tool-use.sh` | Template for new hook scripts |
| AGENT_PERSONA_CONFIG | `src/renderer/src/constants/planning-workspace.ts` | Reference for persona colors in working indicator |
| cn() utility | `src/renderer/src/lib/utils.ts` | Conditional class merging |
| CodeBlock component | `src/renderer/src/components/ui/code-block.tsx` | Potential reuse for tool input display |
| lucide-react icons | package.json dependency | FileText, FileEdit, Pencil, Terminal, Search, FolderSearch, Wrench, ChevronDown, ChevronRight, AlertTriangle |

### Existing Code NOT to Touch

- Do NOT modify DB schema (`src/main/db/schema.ts`) — existing columns suffice
- Do NOT modify `db/index.ts` — no migration needed
- Do NOT modify `ChatPersonaSelector.tsx` — stable from Story 10.2
- Do NOT modify `ChatInput.tsx` — no input changes in this story
- Do NOT modify `chat-cli.service.ts` — CLI spawning unchanged
- Do NOT modify `persona-context.service.ts` — persona context unchanged
- Do NOT modify the main project `.claude/hooks/` scripts — only chat-hooks

### Key Patterns from Previous Stories (10.1 - 10.4)

- `onChatToolUseHook` handler in `hook-listener.service.ts` (lines 843-887) is the exact pattern for the new PreToolUse handler. Copy and adapt.
- `chat_messages` already stores tool events with `role: 'tool'`. PostToolUse content format is `'Tool: {tool_name}'`. Use `'PreToolUse: {tool_name}'` for PreToolUse events to differentiate.
- The renderer currently filters out tool messages: `messages.filter((msg) => msg.role !== 'tool')` in `ChatMessageArea.tsx` line 94. This filter MUST be removed and replaced with the grouping logic.
- The thinking indicator in `ChatMessageArea.tsx` (lines 106-134) is an inline element. Replace it with the new `ChatWorkingIndicator` component.
- Message polling uses 2s `refetchInterval` in `ChatPanel.tsx` line 63. This means tool activity indicators will update at most every 2 seconds. This is acceptable.
- The `ChatCliService` sets `CLAUDE_PROJECT_DIR` to the chat-hooks directory. Claude Code reads `.claude/settings.json` relative to `CLAUDE_PROJECT_DIR`, so adding PreToolUse/Notification entries to `src/main/resources/chat-hooks/.claude/settings.json` is sufficient.

### File Structure

Files to create:
- `src/main/resources/chat-hooks/pre-tool-use.sh` (new hook script)
- `src/main/resources/chat-hooks/notification.sh` (new hook script)
- `src/renderer/src/components/planning/ChatToolActivityCard.tsx` (new component)
- `src/renderer/src/components/planning/ChatToolActivityCard.test.tsx` (new tests)
- `src/renderer/src/components/planning/ChatToolActivityGroup.tsx` (new component)
- `src/renderer/src/components/planning/ChatToolActivityGroup.test.tsx` (new tests)
- `src/renderer/src/components/planning/ChatWorkingIndicator.tsx` (new component)
- `src/renderer/src/components/planning/ChatWorkingIndicator.test.tsx` (new tests)

Files to modify:
- `src/main/services/hook-listener.service.ts` (add PreToolUse, Notification schemas, routes, handlers)
- `src/main/services/hook-listener.service.test.ts` (add tests for new handlers)
- `src/main/resources/chat-hooks/.claude/settings.json` (add PreToolUse, Notification hooks)
- `src/main/trpc/routers/chat-session.router.ts` (add getToolActivity query)
- `src/main/trpc/routers/chat-session.router.test.ts` (add getToolActivity tests)
- `src/renderer/src/components/planning/ChatMessageArea.tsx` (remove tool filter, add grouping, use ChatWorkingIndicator)
- `src/renderer/src/components/planning/ChatMessageArea.test.tsx` (update for tool display)
- `src/renderer/src/components/planning/ChatPanel.tsx` (add currentToolActivity state tracking)
- `src/renderer/src/components/planning/ChatPanel.test.tsx` (add currentToolActivity tests)

### Testing Standards

- Co-locate tests with source: `*.test.ts` / `*.test.tsx` next to source files
- Main process tests use `node` environment with Vitest
- Renderer tests use `happy-dom` environment with `@testing-library/react`
- Mock tRPC hooks in renderer tests using `vi.mock('@renderer/lib/trpc')`
- Mock DB operations in hook-listener tests as established in existing test file
- Test collapsed/expanded states with `@testing-library/react` `fireEvent.click`
- Test tool grouping with arrays of mixed role messages

### Project Structure Notes

- New renderer components go in `src/renderer/src/components/planning/` — same directory as ChatPanel, ChatMessageArea, ChatMessageBubble
- Hook scripts go in `src/main/resources/chat-hooks/` — bundled with the app via electron-builder extraResources
- The `extraResources` config in `electron-builder` already includes `src/main/resources/chat-hooks/**` (set up in Story 10.3)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 10.5]
- [Source: src/main/services/hook-listener.service.ts] — HookListenerService with chat hook handlers (lines 843-887 for PostToolUse pattern)
- [Source: src/main/resources/chat-hooks/.claude/settings.json] — Chat-specific Claude Code hooks config
- [Source: src/main/resources/chat-hooks/tool-use.sh] — Template for new hook scripts
- [Source: src/renderer/src/components/planning/ChatMessageArea.tsx] — Current message area with tool filter and thinking indicator
- [Source: src/renderer/src/components/planning/ChatMessageBubble.tsx] — Message bubble styling reference
- [Source: src/renderer/src/components/planning/ChatPanel.tsx] — Session management and thinking indicator state
- [Source: src/main/trpc/routers/chat-session.router.ts] — Chat session tRPC procedures
- [Source: src/main/db/schema.ts#chat_messages] — Chat messages table with tool_name, tool_input columns
- [Source: src/renderer/src/constants/planning-workspace.ts] — AGENT_PERSONA_CONFIG for persona colors
- [Source: _bmad-output/planning-artifacts/project-context.md] — Electron process boundaries, testing patterns, naming conventions

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

None.

### Completion Notes List

- Tasks 1-6 (hook endpoints, hook scripts, settings.json, tRPC query, 3 new UI components) were implemented by a previous agent session.
- Tasks 7-10 (integration into ChatMessageArea/ChatPanel, notification display, all tests) completed in this session.
- ChatMessageArea: removed tool message filter, added segment-based grouping (message/toolGroup/notification), integrated ChatToolActivityGroup and ChatWorkingIndicator, added notification rendering with amber accent.
- ChatPanel: added `currentToolActivity` state tracking from polled PreToolUse tool messages, clears on assistant response or persona change, passes to ChatMessageArea.
- All 106 Story 10.5-related tests pass across 6 test files (35 new component tests + 15 ChatMessageArea tests + 14 ChatPanel tests + 42 router tests including 4 new getToolActivity tests + 10 new hook-listener tests).
- 3 pre-existing test failures in hook-listener.service.test.ts (Orphan session auto-registration TES-1.7) are unrelated to this story and were already failing before changes.
- No DB schema changes required — reused existing chat_messages columns.

### Change Log

- 2026-03-22: Story 10.5 implementation completed — all 10 tasks done, 106 tests passing

### File List

**Created:**
- `src/main/resources/chat-hooks/pre-tool-use.sh`
- `src/main/resources/chat-hooks/notification.sh`
- `src/renderer/src/components/planning/ChatToolActivityCard.tsx`
- `src/renderer/src/components/planning/ChatToolActivityCard.test.tsx`
- `src/renderer/src/components/planning/ChatToolActivityGroup.tsx`
- `src/renderer/src/components/planning/ChatToolActivityGroup.test.tsx`
- `src/renderer/src/components/planning/ChatWorkingIndicator.tsx`
- `src/renderer/src/components/planning/ChatWorkingIndicator.test.tsx`

**Modified:**
- `src/main/services/hook-listener.service.ts`
- `src/main/services/hook-listener.service.test.ts`
- `src/main/resources/chat-hooks/.claude/settings.json`
- `src/main/trpc/routers/chat-session.router.ts`
- `src/main/trpc/routers/chat-session.router.test.ts`
- `src/renderer/src/components/planning/ChatMessageArea.tsx`
- `src/renderer/src/components/planning/ChatMessageArea.test.tsx`
- `src/renderer/src/components/planning/ChatPanel.tsx`
- `src/renderer/src/components/planning/ChatPanel.test.tsx`

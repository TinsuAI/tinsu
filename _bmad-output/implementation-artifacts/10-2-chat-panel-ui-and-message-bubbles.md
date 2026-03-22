# Story 10.2: Chat Panel UI & Message Bubbles

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

🎨 FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.

## Story

As a founder,
I want a chat panel in the Planning Workspace with a clean message bubble interface,
So that I can see planning conversations in an easy-to-read chat format.

## Acceptance Criteria

1. **Given** I am in the Planning Workspace **When** I click a "Chat" button or tab **Then** a chat panel opens alongside the existing workspace views **And** it does not replace any existing Planning Workspace functionality

2. **Given** the chat panel is open **When** I view it **Then** I see: an agent persona selector at the top, a message area in the center, and an input box with send button at the bottom

3. **Given** the chat panel has messages **When** I view the message area **Then** user messages appear as right-aligned bubbles with a distinct background color **And** agent messages appear as left-aligned bubbles with a different background color **And** each bubble shows the sender label and timestamp

4. **Given** an agent message contains markdown **When** the bubble renders **Then** headings, lists, code blocks, tables, bold, and italic render correctly inside the bubble **And** code blocks have syntax highlighting

5. **Given** I select an agent persona (PM, Architect, UX Designer, Analyst) **When** I make the selection **Then** the persona indicator updates with the agent's name, icon, and color (matching Epic 9 Story 9.8 color scheme)

6. **Given** I type a message and press Enter or click Send **When** the message is submitted **Then** it appears immediately as a user bubble in the message area **And** the input box clears

7. **Given** the chat panel has many messages **When** I scroll up **Then** I can view the full conversation history **And** new messages auto-scroll to the bottom unless I've scrolled up

## Tasks / Subtasks

- [x] Task 1: Add `addMessage` tRPC mutation to chatSession router (AC: 6)
  - [x] 1.1 Add `addMessage` mutation in `src/main/trpc/routers/chat-session.router.ts` — accepts `sessionId`, `role` (validated against `CHAT_MESSAGE_ROLE`), `content`, optional `toolName`/`toolInput`; inserts into `chat_messages` with `id = crypto.randomUUID()`, updates `chat_sessions.last_message_at`; returns the created message
  - [x] 1.2 Add unit tests for `addMessage` mutation in `src/main/trpc/routers/chat-session.router.test.ts`

- [x] Task 2: Create `ChatPanel` container component (AC: 1, 2)
  - [x] 2.1 Create `src/renderer/src/components/planning/ChatPanel.tsx` — full-height flex column with three sections: persona selector header, message area, input footer
  - [x] 2.2 Integrate into `PlanningWorkspacePage.tsx` — add a "Chat" toggle button in the header bar (right side, next to keyboard shortcuts button); when active, render `ChatPanel` as a right-side panel (width ~400px) alongside the existing main content area using flex layout; the panel does NOT replace any existing content, it overlays/sits beside it
  - [x] 2.3 Add `isChatOpen` state to `usePlanningWorkspaceStore` (Zustand) with `toggleChat`/`openChat`/`closeChat` actions

- [x] Task 3: Create `ChatPersonaSelector` component (AC: 5)
  - [x] 3.1 Create `src/renderer/src/components/planning/ChatPersonaSelector.tsx` — renders a horizontal row of persona buttons for PM, Architect, UX Designer, Analyst
  - [x] 3.2 Each button shows the persona's `displayName`, a colored dot matching `AGENT_PERSONA_CONFIG` colors from `src/renderer/src/constants/planning-workspace.ts`
  - [x] 3.3 Selected persona button has a highlighted state (ring + bg tint matching persona color)
  - [x] 3.4 Expose `selectedPersona` and `onPersonaChange` props; the parent `ChatPanel` manages the selection state

- [x] Task 4: Create `ChatMessageBubble` component (AC: 3, 4)
  - [x] 4.1 Create `src/renderer/src/components/planning/ChatMessageBubble.tsx`
  - [x] 4.2 User messages: right-aligned, `bg-cyan-600/20` bubble, "You" label, timestamp in `text-muted-foreground` using `date-fns` `format()`
  - [x] 4.3 Agent messages: left-aligned, `bg-muted/60` bubble, persona display name + colored dot as label, timestamp
  - [x] 4.4 Markdown rendering inside agent bubbles using `react-markdown` + `remark-gfm`, reusing `markdownComponents` from `src/renderer/src/components/task/MarkdownComponents.tsx` (with minor sizing overrides for chat context — smaller headings, tighter spacing)
  - [x] 4.5 Inline code renders with `bg-muted` and cyan text; code blocks render via the existing `CodeBlock` component with syntax highlighting (Prism via `react-syntax-highlighter`)

- [x] Task 5: Create `ChatMessageArea` component (AC: 3, 7)
  - [x] 5.1 Create `src/renderer/src/components/planning/ChatMessageArea.tsx` — scrollable container rendering `ChatMessageBubble` for each message
  - [x] 5.2 Fetch messages via `trpc.chatSession.getMessages.useQuery({ sessionId })` when a session is active
  - [x] 5.3 Auto-scroll to bottom on new messages using a `useRef` on a sentinel div at the bottom with `scrollIntoView({ behavior: 'smooth' })`
  - [x] 5.4 Detect user scroll-up: track `scrollTop` vs `scrollHeight - clientHeight`; if user scrolled up more than 50px, do NOT auto-scroll; reset when user scrolls back to bottom
  - [x] 5.5 Empty state when no messages: centered muted text "Start a conversation with your agent"

- [x] Task 6: Create `ChatInput` component (AC: 6)
  - [x] 6.1 Create `src/renderer/src/components/planning/ChatInput.tsx` — `<textarea>` (auto-expanding, max 6 rows) + Send button (with `Send` icon from lucide-react)
  - [x] 6.2 Submit on Enter (without Shift); Shift+Enter inserts newline
  - [x] 6.3 On submit: call `trpc.chatSession.addMessage.useMutation()` with `role: 'user'` and the content; optimistically add the message to the local display (invalidate query after mutation succeeds)
  - [x] 6.4 Clear textarea after submit; disable Send button when textarea is empty or whitespace-only
  - [x] 6.5 Auto-focus textarea when chat panel opens

- [x] Task 7: Session creation on first message (AC: 1, 6)
  - [x] 7.1 In `ChatPanel`, when user sends first message and no active session exists, call `trpc.chatSession.create.useMutation()` with selected persona's agent key (e.g., `bmad:bmm:agents:pm`) and project ID, then immediately send the message via `addMessage`
  - [x] 7.2 Store the active `sessionId` in the `ChatPanel` local state (not Zustand — session is transient UI state)

- [x] Task 8: Write tests (AC: 1-7)
  - [x] 8.1 Create `src/renderer/src/components/planning/ChatPanel.test.tsx` — test: panel opens/closes via toggle, three-section layout present, persona selector visible, input visible
  - [x] 8.2 Create `src/renderer/src/components/planning/ChatMessageBubble.test.tsx` — test: user messages right-aligned, agent messages left-aligned, sender labels, timestamps, markdown rendering (headings, code blocks, bold/italic)
  - [x] 8.3 Create `src/renderer/src/components/planning/ChatMessageArea.test.tsx` — test: messages render in order, empty state shown when no messages, auto-scroll behavior
  - [x] 8.4 Create `src/renderer/src/components/planning/ChatPersonaSelector.test.tsx` — test: all 4 personas rendered, selection highlight changes, callback fires with correct persona key
  - [x] 8.5 Create `src/renderer/src/components/planning/ChatInput.test.tsx` — test: submit on Enter, Shift+Enter newline, clear after submit, disabled when empty
  - [x] 8.6 Add `addMessage` mutation tests in `src/main/trpc/routers/chat-session.router.test.ts`

## Dev Notes

### Architecture Compliance

- **Process boundaries**: ALL data flows through tRPC. Chat messages are fetched via `trpc.chatSession.getMessages` query and stored via `trpc.chatSession.addMessage` mutation. No direct Node.js or database access from renderer.
- **State management**: Use tRPC + TanStack Query for server state (messages, sessions). Use Zustand only for local UI state (`isChatOpen` in planning-workspace store). Do NOT use `useState` for data from main process.
- **Styling**: Tailwind classes inline. Use `cn()` from `@renderer/lib/utils` for conditional classes. No separate CSS files. shadcn/ui components in `components/ui/`.
- **Component naming**: PascalCase files (`ChatPanel.tsx`, `ChatMessageBubble.tsx`). Hooks use `use` prefix. Store uses `use` + `Store` suffix.
- **Error handling**: Use `TRPCError` in routers. Let errors propagate to React Query's `onError`. Use toast notifications for user-facing errors.

### Critical Design Decisions

**Chat panel placement**: The chat panel opens as a right-side column (400px wide) within the Planning Workspace's main content area. It uses `flex` layout alongside the existing center content. The sidebar, header, and phase tabs remain unchanged. Toggle via a `MessageSquare` icon button in the header.

**No CLI session in this story**: This story is purely UI. Message submission stores the user message in the database via `addMessage` tRPC mutation and renders it locally. Agent responses will come from Story 10.3 (CLI spawning). For now, only user messages appear after send. Do NOT create mock/fake agent responses.

**Persona selector maps to `AGENT_PERSONA_CONFIG`**: Use the exact same keys and color scheme from Story 9.8 (`bmad:bmm:agents:pm`, `bmad:bmm:agents:architect`, `bmad:bmm:agents:ux-designer`, `bmad:bmm:agents:analyst`). The persona `displayName`, `bg`, `text`, `border`, and `dot` values are reused directly.

**Markdown in chat bubbles**: Reuse the existing `markdownComponents` from `src/renderer/src/components/task/MarkdownComponents.tsx`. Create a thin wrapper or override object that adjusts sizing for chat context (smaller headings: h1→text-lg, h2→text-base, h3→text-sm; tighter margins). The `CodeBlock` component with Prism syntax highlighting already handles code blocks.

### Existing Code to Reuse

| What | File | Usage |
|------|------|-------|
| Agent persona config & colors | `src/renderer/src/constants/planning-workspace.ts` | `AGENT_PERSONA_CONFIG`, `getAgentPersona()` |
| Markdown components | `src/renderer/src/components/task/MarkdownComponents.tsx` | `markdownComponents` object for ReactMarkdown |
| CodeBlock with syntax highlighting | `src/renderer/src/components/ui/code-block.tsx` | Used inside markdown code rendering |
| Planning workspace store | `src/renderer/src/stores/planning-workspace.store.ts` | Extend with `isChatOpen` + actions |
| Chat session tRPC router | `src/main/trpc/routers/chat-session.router.ts` | Extend with `addMessage` mutation |
| tRPC client | `src/renderer/src/lib/trpc.ts` | `trpc.chatSession.*` hooks |
| `cn()` utility | `src/renderer/src/lib/utils.ts` | Conditional Tailwind classes |
| `react-markdown` + `remark-gfm` | Already in `package.json` | `react-markdown@^10.1.0`, `remark-gfm@^4.0.1` |
| `react-syntax-highlighter` | Already in `package.json` | Via `CodeBlock` component |
| `date-fns` | Already in `package.json` | Timestamp formatting in bubbles |
| `lucide-react` icons | Already in `package.json` | `MessageSquare`, `Send`, `Bot`, `User` |

### Existing Code NOT to Touch

- Do NOT modify `AgentPersonaIndicator.tsx` — that shows the running agent in the header; chat persona selector is separate
- Do NOT modify `hook-listener.service.ts` — chat hook endpoints are for Story 10.3
- Do NOT modify any existing planning components (PhaseProgressDashboard, ArtifactViewer, WorkflowRunPanel, etc.)
- Do NOT modify `chat-session.router.ts` beyond adding the `addMessage` mutation

### Key Patterns from Previous Story (10.1)

- `chat_sessions.id` is TinSu's internal PK (UUID). `session_uuid` is Claude Code's session ID.
- `chat_messages.session_id` references `chat_sessions.id` (internal PK).
- `CHAT_MESSAGE_ROLE = ['user', 'assistant', 'tool']` — this story only creates `user` role messages.
- The router uses `publicProcedure` from `../trpc`, Zod validation, and returns data directly (no wrappers).

### File Structure

Files to create:
- `src/renderer/src/components/planning/ChatPanel.tsx`
- `src/renderer/src/components/planning/ChatPanel.test.tsx`
- `src/renderer/src/components/planning/ChatPersonaSelector.tsx`
- `src/renderer/src/components/planning/ChatPersonaSelector.test.tsx`
- `src/renderer/src/components/planning/ChatMessageBubble.tsx`
- `src/renderer/src/components/planning/ChatMessageBubble.test.tsx`
- `src/renderer/src/components/planning/ChatMessageArea.tsx`
- `src/renderer/src/components/planning/ChatMessageArea.test.tsx`
- `src/renderer/src/components/planning/ChatInput.tsx`
- `src/renderer/src/components/planning/ChatInput.test.tsx`

Files to modify:
- `src/renderer/src/pages/PlanningWorkspacePage.tsx` (add Chat toggle button + ChatPanel integration)
- `src/renderer/src/stores/planning-workspace.store.ts` (add `isChatOpen`, `toggleChat`, `openChat`, `closeChat`)
- `src/main/trpc/routers/chat-session.router.ts` (add `addMessage` mutation)
- `src/main/trpc/routers/chat-session.router.test.ts` (add `addMessage` tests)

### Testing Standards

- Co-locate tests with source: `*.test.tsx` next to `*.tsx`
- Renderer tests use `happy-dom` environment with `@testing-library/react`
- Main process tests use `node` environment with Vitest
- Import test setup: `src/renderer/src/test-setup.ts` provides `@testing-library/jest-dom/vitest` matchers + cleanup
- Mock tRPC hooks in renderer tests using `vi.mock('@renderer/lib/trpc')`
- Use `vi.mock('react-markdown', ...)` and `vi.mock('remark-gfm', ...)` in bubble tests to avoid ESM import issues

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 10.2]
- [Source: _bmad-output/planning-artifacts/architecture.md#Data Architecture]
- [Source: _bmad-output/planning-artifacts/project-context.md#Critical Implementation Rules]
- [Source: src/renderer/src/constants/planning-workspace.ts] — AGENT_PERSONA_CONFIG color scheme
- [Source: src/renderer/src/components/task/MarkdownComponents.tsx] — Reusable markdown rendering
- [Source: src/renderer/src/components/ui/code-block.tsx] — Syntax-highlighted code blocks
- [Source: src/main/trpc/routers/chat-session.router.ts] — Existing chat session procedures
- [Source: src/main/db/schema.ts] — chat_sessions, chat_messages table definitions
- [Source: src/renderer/src/stores/planning-workspace.store.ts] — Zustand store pattern
- [Source: src/renderer/src/pages/PlanningWorkspacePage.tsx] — Integration target for ChatPanel

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

### Completion Notes List

- Implemented `addMessage` tRPC mutation with session validation, CHAT_MESSAGE_ROLE enum validation, last_message_at update, and 7 unit tests (all passing)
- Created ChatPanel container with 3-section layout (persona selector header, message area, input footer), session creation on first message, close button
- Created ChatPersonaSelector with 4 persona buttons (PM/green, Architect/orange, UX Designer/purple, Analyst/blue), colored dots, ring+bg selection highlight, aria-pressed accessibility
- Created ChatMessageBubble with user right-aligned (cyan-600/20) and agent left-aligned (muted/60) bubbles, sender labels, timestamps via date-fns, markdown rendering via react-markdown + remark-gfm with chat-sized heading overrides, CodeBlock integration for syntax highlighting
- Created ChatMessageArea with scrollable message container, auto-scroll to bottom via sentinel div + scrollIntoView, scroll-up detection (50px threshold), empty state with MessageSquare icon
- Created ChatInput with auto-expanding textarea (max 6 rows), Enter to submit / Shift+Enter newline, clear after submit, disabled when empty/whitespace, auto-focus
- Integrated ChatPanel into PlanningWorkspacePage as right-side 400px panel with MessageSquare toggle button in header, does not replace any existing workspace content
- Extended usePlanningWorkspaceStore with isChatOpen state + toggleChat/openChat/closeChat actions (existing store tests still pass)
- /frontend-design skill used for distinctive dark-theme UI design direction
- All 78 story-related tests pass (27 main process + 41 renderer + 10 existing store tests)
- No regressions introduced; pre-existing test failures in unrelated files remain unchanged

### File List

New files:
- src/renderer/src/components/planning/ChatPanel.tsx
- src/renderer/src/components/planning/ChatPanel.test.tsx
- src/renderer/src/components/planning/ChatPersonaSelector.tsx
- src/renderer/src/components/planning/ChatPersonaSelector.test.tsx
- src/renderer/src/components/planning/ChatMessageBubble.tsx
- src/renderer/src/components/planning/ChatMessageBubble.test.tsx
- src/renderer/src/components/planning/ChatMessageArea.tsx
- src/renderer/src/components/planning/ChatMessageArea.test.tsx
- src/renderer/src/components/planning/ChatInput.tsx
- src/renderer/src/components/planning/ChatInput.test.tsx

Modified files:
- src/main/trpc/routers/chat-session.router.ts (added addMessage mutation)
- src/main/trpc/routers/chat-session.router.test.ts (added 7 addMessage tests)
- src/renderer/src/pages/PlanningWorkspacePage.tsx (added Chat toggle button + ChatPanel integration)
- src/renderer/src/stores/planning-workspace.store.ts (added isChatOpen, toggleChat, openChat, closeChat)
- _bmad-output/implementation-artifacts/sprint-status.yaml (status transitions)
- _bmad-output/implementation-artifacts/10-2-chat-panel-ui-and-message-bubbles.md (task checkboxes, dev record)

## Change Log

- 2026-03-22: Story 10.2 implemented — Chat Panel UI with message bubbles, persona selector, auto-scroll, markdown rendering, addMessage tRPC mutation, 78 tests passing

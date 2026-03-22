# Story 10.7: Artifact Detection & Planning Workspace Integration

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a founder,
I want artifacts produced during a chat session to automatically appear in the Planning Workspace,
So that PRDs, architecture docs, and other outputs flow seamlessly into my existing planning views.

## Acceptance Criteria

1. **Given** the agent creates or updates a file in `_bmad-output/planning-artifacts/` during a chat session **When** the `PostToolUse` hook fires for a Write or Edit tool **Then** the system detects the artifact and triggers the existing artifact scanning service (from Epic 9) **And** the artifact appears in the Phase Progress Dashboard and Artifact Viewer

2. **Given** an artifact is produced during chat **When** I view the artifact in the Planning Workspace artifact viewer **Then** the artifact metadata shows which chat session produced it **And** a "View Chat" link navigates back to the originating chat session

3. **Given** I am in an active chat session **When** the agent produces an artifact **Then** a system message appears in the chat: "Artifact created: {filename}" **And** the message includes a clickable link to open the artifact in the Artifact Viewer

4. **Given** the "What Next?" recommender (Story 9.4) runs **When** artifacts produced by chat sessions are detected **Then** the recommender accounts for these artifacts the same as any other planning artifacts **And** recommendations update accordingly

## Tasks / Subtasks

- [x] Task 1: Detect artifact writes in chat PostToolUse hook handler (AC: 1)
  - [x] 1.1 In `HookListenerService.onChatToolUseHook()` (`src/main/services/hook-listener.service.ts`), after storing the tool-use message, check if `payload.tool_name` is `Write` or `Edit` AND `payload.tool_input.file_path` (or `payload.tool_input.command` for bash writes) contains `_bmad-output/planning-artifacts/`.
  - [x] 1.2 If an artifact write is detected, extract the filename from the path (basename). Match it against `BMAD_WORKFLOWS` (from `src/main/trpc/routers/planning-workflow-constants.ts`) to find the corresponding `workflowKey`.
  - [x] 1.3 Store the artifact detection as a new `chat_messages` row with `role: 'tool'`, `tool_name: '__artifact_created__'`, `content: 'Artifact created: {filename}'`, and `tool_input: JSON.stringify({ filename, workflowKey, filePath })`. This provides the system message data for the chat UI (AC: 3) and metadata linkage (AC: 2).
  - [x] 1.4 Also look up the chat session's `id` and store a mapping in a new `chat_artifact_links` association. To avoid a schema change, use the `tool_input` JSON on the `__artifact_created__` message as the source of truth. The chat session `id` is already known from the session lookup.

- [x] Task 2: Add `getSessionForArtifact` tRPC procedure for artifact-to-session linkage (AC: 2)
  - [x] 2.1 Add a `getSessionForArtifact` query to `chatSessionRouter` (`src/main/trpc/routers/chat-session.router.ts`):
    - Input: `{ projectId: z.string(), filename: z.string() }`
    - Query: Find the most recent `chat_messages` row where `tool_name = '__artifact_created__'` AND `tool_input` JSON contains the matching filename, joined with `chat_sessions` to get the session details.
    - Returns: `{ sessionId: string, sessionUuid: string, agentPersona: string, createdAt: Date } | null`
  - [x] 2.2 Use `JSON_EXTRACT(tool_input, '$.filename')` in the SQL WHERE clause (SQLite JSON1 extension, available by default in better-sqlite3) to filter by filename efficiently.

- [x] Task 3: Show artifact provenance metadata in ArtifactViewer (AC: 2)
  - [x] 3.1 In `ArtifactViewer` (`src/renderer/src/components/planning/ArtifactViewer.tsx`), add a `trpc.chatSession.getSessionForArtifact.useQuery()` call with the current `workflowKey`'s output filename resolved via `BMAD_WORKFLOWS.find(w => w.key === workflowKey)?.outputFilename`.
  - [x] 3.2 When session data is returned (non-null), render a provenance badge below the artifact status badge: a small row showing the persona colored dot, persona display name (from `AGENT_PERSONA_CONFIG`), and a "View Chat" link/button.
  - [x] 3.3 The "View Chat" link: calls `usePlanningWorkspaceStore.openChat()` to open the chat panel, then navigates to the specific session. To do this, add a `openChatToSession` action to the planning workspace store that sets `isChatOpen: true` and a new `targetChatSessionId: string | null` field. ChatPanel reads `targetChatSessionId` on mount/change to auto-select that session.
  - [x] 3.4 After ChatPanel reads and processes `targetChatSessionId`, it should clear it (call `clearTargetChatSession()`) to avoid re-triggering on subsequent renders.

- [x] Task 4: Add `openChatToSession` store action and `targetChatSessionId` state (AC: 2)
  - [x] 4.1 In `planning-workspace.store.ts`, add `targetChatSessionId: string | null` to the state interface (default `null`).
  - [x] 4.2 Add `openChatToSession: (sessionId: string) => void` action that sets `isChatOpen: true` and `targetChatSessionId: sessionId`.
  - [x] 4.3 Add `clearTargetChatSession: () => void` action that sets `targetChatSessionId: null`.

- [x] Task 5: Handle `targetChatSessionId` in ChatPanel (AC: 2)
  - [x] 5.1 In `ChatPanel.tsx`, read `targetChatSessionId` and `clearTargetChatSession` from `usePlanningWorkspaceStore`.
  - [x] 5.2 Add a `useEffect` that watches `targetChatSessionId`. When it becomes non-null:
    - Set `sessionId` to `targetChatSessionId`
    - Set `view` to `'chat'`
    - Fetch the session to get its `agent_persona` and set `selectedPersona` accordingly (use `trpc.chatSession.list` or a direct lookup)
    - Call `clearTargetChatSession()` to reset
  - [x] 5.3 To fetch the session persona without adding a new procedure: query `listWithPreview` (already available) and find the session by ID, or add a simple `getSession` query to `chatSessionRouter` that returns a single session by ID. The simpler approach: use the existing `listWithPreview` data which is already fetched in list view.

- [x] Task 6: Render artifact system messages in ChatMessageArea (AC: 3)
  - [x] 6.1 In `ChatMessageArea.tsx`, update the `groupMessages` function to handle `__artifact_created__` tool messages as a new segment type `'artifactNotification'` (separate from tool groups and __notification__ messages).
  - [x] 6.2 Create a new `ChatArtifactNotification` component (`src/renderer/src/components/planning/ChatArtifactNotification.tsx`):
    - Renders as a centered system-message card (similar to notification cards)
    - Shows an icon (FileText from lucide-react), the message text ("Artifact created: prd.md"), and a clickable "View in Workspace" link
    - The link extracts `workflowKey` from the `tool_input` JSON and calls `usePlanningWorkspaceStore.openWorkspaceToArtifact(workflowKey)` to navigate to the artifact
    - Uses subtle styling: muted background, small text, centered layout, not a bubble
  - [x] 6.3 Render `<ChatArtifactNotification>` in the message area map for `'artifactNotification'` segments.

- [x] Task 7: Verify "What Next?" recommender integration (AC: 4)
  - [x] 7.1 The existing `scanArtifacts` procedure in `planning.router.ts` detects artifacts by checking file existence on disk via `statSync`. When a chat agent writes an artifact file, the file physically exists, so `scanArtifacts` will pick it up automatically on its next query cycle.
  - [x] 7.2 The `useNextRecommendation` hook and `WhatNextPanel` component use `scanArtifacts` data with `refetchOnWindowFocus: true`. To ensure timely refresh after an artifact is created via chat, invalidate the `planning.scanArtifacts` query cache in the `onChatToolUseHook` handler when an artifact write is detected. Emit an event via `BrowserWindow.webContents.send()` or simply rely on the 5-second refetch interval from the PhaseProgressDashboard query.
  - [x] 7.3 Simplest approach: After detecting an artifact write in `onChatToolUseHook`, no special invalidation is needed. The `scanArtifacts` query in `PhaseProgressDashboard` already has `refetchOnWindowFocus: true` and the page-level query polls periodically. The artifact will appear within a few seconds. Add `refetchInterval: 10000` to the `PhaseProgressDashboard`'s `scanArtifacts` query to ensure periodic refresh (if not already present). Verify this in testing.

- [x] Task 8: Write tests (AC: 1-4)
  - [x] 8.1 Add tests to `hook-listener-chat.test.ts` (or create a new test file `hook-listener-artifact-detection.test.ts`):
    - `onChatToolUseHook` with Write tool and path containing `_bmad-output/planning-artifacts/prd.md` inserts an `__artifact_created__` message
    - `onChatToolUseHook` with Write tool and path NOT containing planning-artifacts does NOT insert artifact message
    - `onChatToolUseHook` with Edit tool and matching path inserts artifact message
    - `onChatToolUseHook` with Read tool (non-write) does NOT insert artifact message
    - Artifact message has correct `tool_input` JSON with filename, workflowKey, filePath
  - [x] 8.2 Add tests to `chat-session.router.test.ts`:
    - `getSessionForArtifact` returns session info when artifact message exists
    - `getSessionForArtifact` returns null when no artifact message for filename
    - `getSessionForArtifact` returns most recent session when multiple artifact messages exist
  - [x] 8.3 Create `ChatArtifactNotification.test.tsx`:
    - Renders artifact filename in the notification card
    - "View in Workspace" link calls `openWorkspaceToArtifact` with correct workflowKey
    - Handles missing workflowKey gracefully (unknown artifact filename)
  - [x] 8.4 Update `ChatMessageArea.test.tsx`:
    - `__artifact_created__` tool messages render as artifact notification cards, not tool activity groups
  - [x] 8.5 Update `ArtifactViewer.test.tsx`:
    - When `getSessionForArtifact` returns session data, provenance badge is rendered with persona name
    - When `getSessionForArtifact` returns null, no provenance badge shown
    - "View Chat" link calls `openChatToSession` with correct session ID
  - [x] 8.6 Update `ChatPanel.test.tsx`:
    - When `targetChatSessionId` is set in store, ChatPanel auto-selects that session and clears the target

## Dev Notes

### Architecture Compliance

- **Process boundaries**: Artifact detection happens in the main process (`HookListenerService.onChatToolUseHook`). The renderer queries artifact-session links via tRPC (`getSessionForArtifact`). No new IPC channels needed.
- **Data flow**: Chat agent writes file -> PostToolUse hook fires -> `onChatToolUseHook` detects planning-artifact path -> stores `__artifact_created__` marker message -> renderer polls messages (2s interval) and renders artifact notification card. Separately, `scanArtifacts` query detects the file on disk -> PhaseProgressDashboard updates.
- **No schema changes needed**: The `__artifact_created__` marker uses the existing `chat_messages` table with `role: 'tool'` and `tool_name: '__artifact_created__'`. The `tool_input` JSON stores linkage metadata. No new DB tables or columns required.

### Critical Design Decisions

**Artifact detection via tool_input path matching, NOT filesystem watchers:**
- Checking `payload.tool_input.file_path` or `payload.tool_input.content` in the PostToolUse hook is synchronous and reliable.
- Filesystem watchers (chokidar, fs.watch) would add complexity, require cleanup, and can miss events in fast sequences.
- The PostToolUse hook already fires for every tool use in the chat session, so path matching is the natural integration point.

**`__artifact_created__` marker messages, NOT a new DB table:**
- Avoids schema migration (`db/index.ts` migration) and `rebuild:electron` cycle.
- Leverages the existing `chat_messages` table — the marker is just another message with a special `tool_name`.
- `tool_input` JSON stores structured metadata (filename, workflowKey, filePath) for the renderer to parse.
- This pattern follows the `__notification__` tool_name convention from Story 10.5.

**Query cache refresh for artifact appearance:**
- The `scanArtifacts` query in `PlanningWorkspacePage` already has `refetchOnWindowFocus: true` and `placeholderData`.
- The `PhaseProgressDashboard` also queries `scanArtifacts`.
- No BrowserWindow IPC event needed — natural polling handles the refresh within seconds.
- The `WhatNextPanel` `scanArtifacts` query also refreshes on window focus, so recommendations update automatically.

**"View Chat" navigation via store state, NOT URL params:**
- `targetChatSessionId` in the planning workspace store is set by `openChatToSession()`.
- ChatPanel reads and auto-selects the session, then clears the target.
- This avoids URL routing complexity since the Planning Workspace is a single-page view with internal state management.

### Write vs Edit Tool Detection

Claude Code uses these tool names for file operations:
- `Write` — `tool_input` has `{ file_path: string, content: string }` — creates or overwrites a file
- `Edit` — `tool_input` has `{ file_path: string, old_string: string, new_string: string }` — edits an existing file
- `Bash` — may also write files via shell commands, but artifact writes from BMAD agents are done via Write/Edit tools

The artifact detection should check:
```typescript
const isArtifactWrite =
  (payload.tool_name === 'Write' || payload.tool_name === 'Edit') &&
  typeof payload.tool_input?.file_path === 'string' &&
  payload.tool_input.file_path.includes('_bmad-output/planning-artifacts/')
```

### BMAD_WORKFLOWS Matching

To find the `workflowKey` for a detected artifact:
```typescript
import { BMAD_WORKFLOWS } from '../trpc/routers/planning-workflow-constants'
import { basename } from 'path'

const filename = basename(payload.tool_input.file_path)
const matchedWorkflow = BMAD_WORKFLOWS.find(w => w.filename === filename)
const workflowKey = matchedWorkflow?.workflowKey ?? null
```

If no workflow matches (file is not a known artifact), still store the marker message but set `workflowKey: null`. The chat UI can still show "Artifact created: {filename}" but the "View in Workspace" link would be disabled for unknown artifacts.

### Existing Code to Reuse

| What | File | Usage |
|------|------|-------|
| onChatToolUseHook | `src/main/services/hook-listener.service.ts` (line ~951) | Add artifact detection after existing message storage |
| BMAD_WORKFLOWS | `src/main/trpc/routers/planning-workflow-constants.ts` | Match filenames to workflowKeys |
| chatSessionRouter | `src/main/trpc/routers/chat-session.router.ts` | Add getSessionForArtifact procedure |
| chat_sessions / chat_messages | `src/main/db/schema.ts` | Existing tables, no changes needed |
| ArtifactViewer | `src/renderer/src/components/planning/ArtifactViewer.tsx` | Add provenance badge |
| AGENT_PERSONA_CONFIG | `src/renderer/src/constants/planning-workspace.ts` | Look up persona display name and colors for provenance badge |
| BMAD_WORKFLOWS (renderer) | `src/renderer/src/constants/planning-workspace.ts` | Map workflowKey to outputFilename for artifact lookup |
| planning-workspace.store | `src/renderer/src/stores/planning-workspace.store.ts` | Add openChatToSession, targetChatSessionId, clearTargetChatSession |
| openWorkspaceToArtifact | `src/renderer/src/stores/planning-workspace.store.ts` | Navigate to artifact from chat notification |
| ChatPanel | `src/renderer/src/components/planning/ChatPanel.tsx` | Handle targetChatSessionId |
| ChatMessageArea | `src/renderer/src/components/planning/ChatMessageArea.tsx` | Add artifactNotification segment type |
| `__notification__` pattern | `src/renderer/src/components/planning/ChatMessageArea.tsx` (line ~53) | Follow same pattern for `__artifact_created__` |
| cn() utility | `src/renderer/src/lib/utils.ts` | Conditional class merging |
| lucide-react icons | package.json | FileText, ExternalLink, ArrowRight |
| scanArtifacts | `src/main/trpc/routers/planning.router.ts` | Already detects artifacts on disk — no changes needed |
| useNextRecommendation | `src/renderer/src/hooks/useNextRecommendation.ts` | Already uses scanArtifacts data — no changes needed |

### Existing Code NOT to Touch

- Do NOT modify DB schema (`src/main/db/schema.ts`) — no new tables or columns needed
- Do NOT modify `db/index.ts` — no migration needed
- Do NOT modify `planning.router.ts` — scanArtifacts already works by checking files on disk
- Do NOT modify `useNextRecommendation.ts` — it already works with scanArtifacts data
- Do NOT modify `WhatNextPanel.tsx` — it already uses useNextRecommendation
- Do NOT modify `ChatMessageBubble.tsx` — bubble rendering unchanged
- Do NOT modify `ChatInput.tsx` — input component unchanged
- Do NOT modify hook scripts (pre-tool-use.sh, tool-use.sh) — event pipeline unchanged
- Do NOT modify `persona-context.service.ts` — persona injection unchanged
- Do NOT modify `chat-cli.service.ts` — CLI session management unchanged

### Key Patterns from Previous Stories (10.1 - 10.6)

- `onChatToolUseHook` stores messages with `role: 'tool'`, `tool_name: payload.tool_name`, `content: 'Tool: {name}'`. The artifact detection adds an additional message with `tool_name: '__artifact_created__'`, following the `__notification__` special-name convention.
- `chatSessionRouter` procedures follow: `publicProcedure` + `z.object` input + direct Drizzle query. The `getSessionForArtifact` procedure follows the same pattern.
- ChatPanel uses `useState` for view-local state. The `targetChatSessionId` comes from the Zustand store (cross-component state).
- `ChatMessageArea` segments messages into `'message'`, `'toolGroup'`, and `'notification'` types. Adding `'artifactNotification'` follows the same pattern.
- Renderer tests mock tRPC with `vi.mock('@renderer/lib/trpc')` and provide mock return values via `mockReturnValue` on individual procedures.
- Main process tests mock `db` operations. Hook listener chat tests are in `hook-listener-chat.test.ts`.

### Testing Standards

- Co-locate tests: `*.test.ts` / `*.test.tsx` next to source files
- Main process tests: `node` environment, Vitest
- Renderer tests: `happy-dom` environment, `@testing-library/react`
- Mock tRPC hooks in renderer tests using `vi.mock('@renderer/lib/trpc')`
- Mock planning workspace store in renderer tests using `vi.mock('@renderer/stores')`
- Mock `db` in main process router tests

### File Structure

Files to create:
- `src/renderer/src/components/planning/ChatArtifactNotification.tsx` (new artifact notification component)
- `src/renderer/src/components/planning/ChatArtifactNotification.test.tsx` (new tests)

Files to modify:
- `src/main/services/hook-listener.service.ts` (add artifact detection in `onChatToolUseHook`)
- `src/main/services/hook-listener-chat.test.ts` (add artifact detection tests)
- `src/main/trpc/routers/chat-session.router.ts` (add `getSessionForArtifact` procedure)
- `src/main/trpc/routers/chat-session.router.test.ts` (add `getSessionForArtifact` tests)
- `src/renderer/src/components/planning/ArtifactViewer.tsx` (add provenance badge with "View Chat" link)
- `src/renderer/src/components/planning/ArtifactViewer.test.tsx` (add provenance badge tests)
- `src/renderer/src/components/planning/ChatMessageArea.tsx` (add `artifactNotification` segment handling)
- `src/renderer/src/components/planning/ChatMessageArea.test.tsx` (add artifact notification segment tests)
- `src/renderer/src/components/planning/ChatPanel.tsx` (handle `targetChatSessionId` from store)
- `src/renderer/src/components/planning/ChatPanel.test.tsx` (add target session auto-select tests)
- `src/renderer/src/stores/planning-workspace.store.ts` (add `targetChatSessionId`, `openChatToSession`, `clearTargetChatSession`)

### Project Structure Notes

- New renderer component goes in `src/renderer/src/components/planning/` — same directory as all other chat and planning components
- No new directories needed
- No DB schema changes needed — uses existing chat_messages table with special tool_name
- No new services needed — augments existing HookListenerService

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 10.7]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic 10 Overview]
- [Source: src/main/services/hook-listener.service.ts#onChatToolUseHook] — PostToolUse handler for chat sessions (line ~951)
- [Source: src/main/trpc/routers/planning-workflow-constants.ts] — BMAD_WORKFLOWS array mapping workflowKey to filename
- [Source: src/main/trpc/routers/planning.router.ts#scanArtifacts] — Artifact scanning by file existence
- [Source: src/renderer/src/components/planning/ArtifactViewer.tsx] — Artifact content display with status badges
- [Source: src/renderer/src/components/planning/ChatMessageArea.tsx] — Message segmentation and rendering
- [Source: src/renderer/src/stores/planning-workspace.store.ts] — Planning workspace Zustand store
- [Source: src/renderer/src/constants/planning-workspace.ts] — BMAD_WORKFLOWS, AGENT_PERSONA_CONFIG
- [Source: src/renderer/src/hooks/useNextRecommendation.ts] — "What Next?" recommender logic
- [Source: src/main/db/schema.ts#chat_messages] — chat_messages table with tool_name, tool_input columns
- [Source: _bmad-output/implementation-artifacts/10-6-session-persistence-and-resume.md] — Previous story patterns, testing approach, file list
- [Source: _bmad-output/planning-artifacts/project-context.md] — Electron process boundaries, tRPC patterns, naming conventions

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6 (1M context)

### Debug Log References
None — implementation went smoothly without halts or debugging issues.

### Completion Notes List
- Task 1: Added artifact detection in `onChatToolUseHook`. When Write/Edit tool targets `_bmad-output/planning-artifacts/`, inserts `__artifact_created__` marker message with filename, workflowKey, filePath metadata.
- Task 2: Added `getSessionForArtifact` tRPC procedure using `JSON_EXTRACT` on `tool_input` to find artifact-session links.
- Task 3: Added provenance badge to ArtifactViewer metadata bar showing persona dot, display name, and "View Chat" link.
- Task 4: Added `targetChatSessionId`, `openChatToSession`, `clearTargetChatSession` to planning workspace store.
- Task 5: ChatPanel now reads `targetChatSessionId` from store, auto-selects the session, sets persona, and clears the target.
- Task 6: Added `artifactNotification` segment type to ChatMessageArea and created ChatArtifactNotification component with "View in Workspace" link.
- Task 7: Verified scanArtifacts already detects files on disk. Added `refetchInterval: 10000` to PhaseProgressDashboard for periodic refresh.
- Task 8: All 141 tests pass across 6 test files (13 hook-listener + 58 router + 4 ChatArtifactNotification + 17 ChatMessageArea + 26 ArtifactViewer + 23 ChatPanel).

### Change Log
- 2026-03-22: Story 10.7 implementation complete — artifact detection, provenance metadata, system messages, "What Next?" integration, and full test coverage.

### File List
New files:
- src/renderer/src/components/planning/ChatArtifactNotification.tsx
- src/renderer/src/components/planning/ChatArtifactNotification.test.tsx

Modified files:
- src/main/services/hook-listener.service.ts (artifact detection in onChatToolUseHook)
- src/main/services/hook-listener-chat.test.ts (4 artifact detection tests)
- src/main/trpc/routers/chat-session.router.ts (getSessionForArtifact procedure)
- src/main/trpc/routers/chat-session.router.test.ts (3 getSessionForArtifact tests)
- src/renderer/src/stores/planning-workspace.store.ts (targetChatSessionId, openChatToSession, clearTargetChatSession)
- src/renderer/src/components/planning/ArtifactViewer.tsx (provenance badge with "View Chat" link)
- src/renderer/src/components/planning/ArtifactViewer.test.tsx (3 provenance badge tests)
- src/renderer/src/components/planning/ChatMessageArea.tsx (artifactNotification segment type)
- src/renderer/src/components/planning/ChatMessageArea.test.tsx (2 artifact notification tests)
- src/renderer/src/components/planning/ChatPanel.tsx (targetChatSessionId handling)
- src/renderer/src/components/planning/ChatPanel.test.tsx (2 targetChatSessionId tests)
- src/renderer/src/components/planning/PhaseProgressDashboard.tsx (refetchInterval: 10000)
- _bmad-output/implementation-artifacts/sprint-status.yaml (status: review)
- _bmad-output/implementation-artifacts/10-7-artifact-detection-and-planning-workspace-integration.md (this file)

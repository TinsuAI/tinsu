---
title: 'Planning Workspace Chat-Centric Layout Overhaul'
slug: 'planning-workspace-chat-centric-layout'
created: '2026-03-23'
status: 'completed'
stepsCompleted: [1, 2, 3, 4]
tech_stack: [React, Zustand, tRPC, Drizzle, better-sqlite3, Tailwind CSS, shadcn/ui, react-resizable-panels]
files_to_modify:
  - src/main/db/schema.ts
  - src/main/db/index.ts
  - src/main/trpc/routers/chat-session.router.ts
  - src/renderer/src/constants/planning-workspace.ts
  - src/renderer/src/stores/planning-workspace.store.ts
  - src/renderer/src/components/planning/ChatInput.tsx
  - src/renderer/src/components/planning/ChatPanel.tsx
  - src/renderer/src/pages/PlanningWorkspacePage.tsx
code_patterns:
  - react-resizable-panels (Group, Panel, Separator) for resizable layout
  - SectionHeader component for expand/collapse
  - Zustand for local UI state (panel sizes, collapse state)
  - tRPC queries/mutations for DB operations
  - Drizzle ORM + better-sqlite3 for schema
  - localStorage for layout persistence
test_patterns:
  - Co-located test files (*.test.ts next to source)
  - Vitest + @testing-library/react for renderer tests
  - Direct DB tests for schema changes
  - tRPC router tests with in-memory DB
---

# Tech-Spec: Planning Workspace Chat-Centric Layout Overhaul

**Created:** 2026-03-23

## Overview

### Problem Statement

The planning workspace treats chat as a secondary toggle panel on the right side. Clicking workflow steps in the sidebar doesn't connect to the chat — there's no command pre-fill, no session-per-workflow binding, and panels aren't resizable. The chat should be the center of the workspace experience, and each workflow step should seamlessly connect to its corresponding BMAD skill command and resume the exact session tied to that workflow.

### Solution

Restructure the layout to **Sidebar | Chat (center) | Content (right)**, make chat always visible (no toggle), add workflow-to-command mapping with session binding via a new `workflow_key` column on `chat_sessions`, and make all three panels resizable and collapsible.

### Scope

**In Scope:**
1. Layout reorder: Sidebar → Chat (center) → Content (right), chat always visible
2. Resizable & collapsible panels (all three: sidebar, chat, content)
3. Workflow-to-command mapping (pre-fill chat input on step click)
4. Session-per-workflow binding (add `workflow_key` to `chat_sessions` table)
5. Resume exact session for a workflow step (not just latest)
6. Show artifact in content panel when workflow has existing output

**Out of Scope:**
- Auto-sending commands (pre-fill only)
- New BMAD skill creation
- Changes to the chat message format or CLI spawning logic

## Context for Development

### Codebase Patterns

- **Resizable panels**: Already established via `react-resizable-panels` in `ResizableWorkspace.tsx` (task workspace). Uses `Group`, `Panel`, `Separator` with `SectionHeader` for expand/collapse. Layout sizes persisted to `localStorage`.
- **State management**: Zustand store (`planning-workspace.store.ts`) manages workspace state. Chat open/close is currently a boolean toggle (`isChatOpen`). Selected workflow tracked via `selectedWorkflowKey`.
- **Chat sessions**: DB table `chat_sessions` has columns: `id`, `session_uuid`, `agent_persona`, `workflow_phase`, `project_id`, `status`, `created_at`, `updated_at`, `last_message_at`. No `workflow_key` column exists — this needs to be added.
- **Chat panel**: `ChatPanel.tsx` manages view modes (`list` | `chat`), persona selection, session creation, and message sending. `ChatInput.tsx` is a controlled textarea with `value` state — currently no external way to set the value (no `initialValue` or `prefill` prop).
- **Workflow-to-session lookup**: `getSessionForArtifact` tRPC procedure exists (matches by `__artifact_created__` tool messages), but there's no direct `workflow_key`-based lookup on sessions.
- **DB migrations**: Follow `ALTER TABLE ... ADD COLUMN` pattern in `applyIncrementalMigrations()` in `db/index.ts`.

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `src/renderer/src/pages/PlanningWorkspacePage.tsx` | Main planning workspace layout — reorder panels here |
| `src/renderer/src/stores/planning-workspace.store.ts` | Zustand store — remove chat toggle, add prefill state |
| `src/renderer/src/components/planning/ChatPanel.tsx` | Chat panel — make always-visible, handle workflow session binding |
| `src/renderer/src/components/planning/ChatInput.tsx` | Chat input — add `initialValue` prop for command pre-fill |
| `src/renderer/src/constants/planning-workspace.ts` | Workflow definitions — add `command` field to `BmadWorkflowDefinition` |
| `src/main/db/schema.ts` | Drizzle schema — add `workflow_key` column to `chat_sessions` |
| `src/main/db/index.ts` | Migration — `ALTER TABLE chat_sessions ADD COLUMN workflow_key TEXT` |
| `src/main/trpc/routers/chat-session.router.ts` | tRPC router — add `workflow_key` to create, add `getByWorkflowKey` query |
| `src/renderer/src/components/workspace/ResizableWorkspace.tsx` | Reference: existing resizable panel pattern to follow |
| `src/renderer/src/components/workspace/SectionHeader.tsx` | Reference: expand/collapse header component (reusable) |

### Technical Decisions

1. **Reuse `react-resizable-panels`** — already a dependency, proven pattern in `ResizableWorkspace.tsx`. No new library needed.
2. **Add `workflow_key` column via ALTER TABLE** — nullable TEXT column on `chat_sessions`. Existing sessions get NULL (backwards compatible). New sessions created from workflow clicks get the key set.
3. **New tRPC query `getByWorkflowKey`** — lookup session by `(project_id, workflow_key)` to find the exact session for a workflow step. Returns the most recent active/paused session for that workflow.
4. **Pre-fill via prop, not auto-send** — `ChatInput` gets an `initialValue` prop. The Zustand store holds `pendingChatPrefill` which gets consumed once by ChatInput.
5. **Chat always visible** — Remove `isChatOpen` toggle entirely. ChatPanel renders unconditionally in the layout. The `toggleChat` button in the header becomes unnecessary.
6. **Layout persistence** — Use a separate `localStorage` key (`tinsu-planning-workspace-layout`) for panel sizes, following the existing pattern.

## Implementation Plan

### Tasks

- [x] Task 1: Add `workflow_key` column to `chat_sessions` schema and migration
  - File: `src/main/db/schema.ts`
  - Action: Add `workflow_key: text('workflow_key')` column to `chat_sessions` table definition (nullable). Add index `idx_chat_sessions_workflow_key` on `(project_id, workflow_key)`.
  - File: `src/main/db/index.ts`
  - Action: Add migration in `applyIncrementalMigrations()`:
    ```sql
    ALTER TABLE chat_sessions ADD COLUMN workflow_key TEXT;
    CREATE INDEX IF NOT EXISTS idx_chat_sessions_workflow_key ON chat_sessions(project_id, workflow_key);
    ```
    Use try/catch with "duplicate column" check for idempotency (same pattern as other ALTER TABLE migrations).

- [x] Task 2: Update `chatSession` tRPC router — accept `workflowKey` on create, add `getByWorkflowKey` query
  - File: `src/main/trpc/routers/chat-session.router.ts`
  - Action 2a: Update `create` mutation input to accept optional `workflowKey: z.string().optional()`. Store it as `workflow_key` in the INSERT.
  - Action 2b: Add new `getByWorkflowKey` query:
    ```typescript
    getByWorkflowKey: publicProcedure
      .input(z.object({
        projectId: z.string().min(1),
        workflowKey: z.string().min(1)
      }))
      .query(({ input }) => {
        return db.select().from(chat_sessions)
          .where(and(
            eq(chat_sessions.project_id, input.projectId),
            eq(chat_sessions.workflow_key, input.workflowKey)
          ))
          .orderBy(desc(chat_sessions.updated_at))
          .limit(1)
          .get() ?? null
      })
    ```
  - Action 2c: Update `listWithPreview` to include `workflow_key` in the returned session data (already returned via `...session` spread, but verify it's there).

- [x] Task 3: Add `command` field to `BmadWorkflowDefinition` and populate the mapping
  - File: `src/renderer/src/constants/planning-workspace.ts`
  - Action: Add `command: string` to `BmadWorkflowDefinition` interface. Update each entry in `BMAD_WORKFLOWS` array:
    ```typescript
    { key: 'brainstorming', ..., command: '/bmad-brainstorming' },
    { key: 'product-brief', ..., command: '/bmad-create-product-brief' },
    { key: 'market-research', ..., command: '/bmad-market-research' },
    { key: 'domain-research', ..., command: '/bmad-domain-research' },
    { key: 'prd', ..., command: '/bmad-create-prd' },
    { key: 'ux-design', ..., command: '/bmad-create-ux-design' },
    { key: 'architecture', ..., command: '/bmad-create-architecture' },
    { key: 'epics-stories', ..., command: '/bmad-create-epics-and-stories' },
    { key: 'readiness-check', ..., command: '/bmad-check-implementation-readiness' }
    ```

- [x] Task 4: Update Zustand store — remove chat toggle, add prefill and workflow session state
  - File: `src/renderer/src/stores/planning-workspace.store.ts`
  - Action 4a: Remove `isChatOpen` state and `toggleChat`, `openChat`, `closeChat` actions. Chat is always visible.
  - Action 4b: Add new state:
    ```typescript
    pendingChatPrefill: string | null  // command to pre-fill in ChatInput
    activeWorkflowSessionId: string | null  // session ID bound to selected workflow
    ```
  - Action 4c: Add new actions:
    ```typescript
    setPendingChatPrefill: (prefill: string | null) => void
    clearPendingChatPrefill: () => void
    setActiveWorkflowSessionId: (sessionId: string | null) => void
    ```
  - Action 4d: Update `setSelectedWorkflow` action — when a workflow is selected, this sets `selectedWorkflowKey` only. The component layer handles session lookup and prefill logic.

- [x] Task 5: Add `initialValue` prop to `ChatInput`
  - File: `src/renderer/src/components/planning/ChatInput.tsx`
  - Action: Add optional `initialValue?: string` prop. In a `useEffect`, when `initialValue` changes and is non-null, set the textarea value to it and call `adjustHeight()`. Ensure it only fires once per new `initialValue` (use a ref to track the last consumed value).

- [x] Task 6: Update `ChatPanel` — workflow session binding and prefill integration
  - File: `src/renderer/src/components/planning/ChatPanel.tsx`
  - Action 6a: Read `selectedWorkflowKey` and `pendingChatPrefill` from Zustand store.
  - Action 6b: When `selectedWorkflowKey` changes, call `trpc.chatSession.getByWorkflowKey` query to find the exact session for that workflow. If found: set `sessionId` to that session's ID, set `selectedPersona` from the session's `agent_persona`, switch to `chat` view. If not found: clear `sessionId` (new session will be created on first message), switch to `chat` view.
  - Action 6c: Pass `pendingChatPrefill` as `initialValue` to `ChatInput`. After ChatInput consumes it, call `clearPendingChatPrefill()`.
  - Action 6d: Update `handleSend` — when creating a new session and `selectedWorkflowKey` is set, pass `workflowKey` to the `chatSession.create` mutation so the session is bound to the workflow.
  - Action 6e: Remove dependency on `isChatOpen` (no longer exists). Remove close button from header. Keep the back-to-sessions and persona selector.

- [x] Task 7: Restructure `PlanningWorkspacePage` — new panel layout with resizable panels
  - File: `src/renderer/src/pages/PlanningWorkspacePage.tsx`
  - Action 7a: Replace the current `<div className="flex min-h-0 flex-1">` layout with `react-resizable-panels` `Group/Panel/Separator` structure:
    ```
    <Group orientation="horizontal">
      <Panel id="sidebar">   <!-- Workflow sidebar -->
      <Separator />
      <Panel id="chat">      <!-- ChatPanel (center) -->
      <Separator />
      <Panel id="content">   <!-- ArtifactViewer / Dashboard -->
    </Group>
    ```
  - Action 7b: Default panel sizes: sidebar ~20%, chat ~45%, content ~35%. Min size 10% for each.
  - Action 7c: Add collapsible behavior: each panel gets a collapse/expand toggle. Use `Panel`'s `collapsible` prop and `onCollapse`/`onExpand` callbacks. Store collapsed state in Zustand or local state.
  - Action 7d: Persist layout to `localStorage` key `tinsu-planning-workspace-layout`.
  - Action 7e: Remove the chat toggle button from the header (chat is always visible). Remove the `{isChatOpen && <ChatPanel />}` conditional — render `<ChatPanel />` unconditionally inside the center panel.
  - Action 7f: Update `WorkflowCard` `onSelect` handler — when a workflow is selected, look up the workflow's `command` from `BMAD_WORKFLOWS`, set `pendingChatPrefill` in the store with that command, and also set the `selectedWorkflowKey` which triggers session lookup in ChatPanel.
  - Action 7g: Use `Separator` with same styling as `ResizableWorkspace.tsx`:
    ```tsx
    <Separator className={cn(
      'mx-1 w-1',
      'bg-border/30 hover:bg-cyan-500/50 active:bg-cyan-500/70',
      'cursor-col-resize transition-colors duration-150 rounded-full'
    )} />
    ```

- [x] Task 8: Update tests
  - File: `src/main/db/chat-sessions.test.ts`
  - Action: Add test for `workflow_key` column existence and that it's nullable.
  - File: `src/main/trpc/routers/chat-session.router.test.ts`
  - Action: Add tests for `create` with `workflowKey` param, and for `getByWorkflowKey` query (found, not found, returns most recent).
  - File: `src/renderer/src/components/planning/ChatInput.test.tsx`
  - Action: Add test for `initialValue` prop setting the textarea value.
  - File: `src/renderer/src/stores/planning-workspace.store.test.ts`
  - Action: Update tests — remove `isChatOpen`/`toggleChat` tests, add `pendingChatPrefill` and `activeWorkflowSessionId` tests.
  - File: `src/renderer/src/pages/PlanningWorkspacePage.test.tsx`
  - Action: Update tests — verify 3-panel resizable layout renders, verify chat panel is always visible (no toggle), verify workflow click sets prefill.

### Acceptance Criteria

- [ ] AC 1: Given the planning workspace is open, when the page renders, then three resizable panels are visible: workflow sidebar (left), chat panel (center), and content panel (right) — chat is always visible without a toggle.

- [ ] AC 2: Given the three-panel layout, when the user drags a panel separator, then the adjacent panels resize proportionally, respecting a minimum size of 10% for each panel.

- [ ] AC 3: Given the three-panel layout, when the user collapses a panel, then the panel minimizes and the remaining panels fill the available space. When expanded again, it restores to its previous size.

- [ ] AC 4: Given the planning workspace layout sizes are changed, when the user leaves and returns to the workspace, then the layout is restored from localStorage.

- [ ] AC 5: Given a workflow step is clicked in the sidebar (e.g., "Brainstorming"), when no existing chat session is bound to that workflow, then the chat input is pre-filled with the corresponding command (e.g., `/bmad-brainstorming`) and no message is auto-sent.

- [ ] AC 6: Given a workflow step is clicked in the sidebar, when an existing chat session IS bound to that workflow (via `workflow_key`), then that exact session is resumed — its messages are loaded and displayed in the chat panel.

- [ ] AC 7: Given the user sends the pre-filled command in a new chat session, when the session is created, then the `workflow_key` column in `chat_sessions` is set to the selected workflow's key (e.g., `brainstorming`).

- [ ] AC 8: Given a workflow step is clicked that has an existing artifact, when the session is loaded in the chat panel, then the artifact is displayed in the content panel (right side).

- [ ] AC 9: Given the `chat_sessions` table in the database, when the application starts, then the `workflow_key` column exists (nullable TEXT) with a composite index on `(project_id, workflow_key)`.

- [ ] AC 10: Given an existing database without the `workflow_key` column, when the migration runs, then the column is added without data loss and existing sessions have `workflow_key = NULL`.

## Additional Context

### Dependencies

- `react-resizable-panels` — already installed (`package.json`), used by `ResizableWorkspace.tsx`
- No new npm packages required
- Depends on existing chat session infrastructure (Stories 10.1–10.7)

### Testing Strategy

**Unit tests (main process):**
- DB schema test: verify `workflow_key` column exists, is nullable, index created
- tRPC router tests: `create` with `workflowKey`, `getByWorkflowKey` query (match found, no match, most recent returned)

**Unit tests (renderer):**
- `ChatInput` test: `initialValue` prop sets textarea value, consumed only once per change
- Zustand store test: `pendingChatPrefill` set/clear, `isChatOpen` removal doesn't break
- `PlanningWorkspacePage` test: 3-panel layout renders, chat always visible, workflow click triggers prefill

**Manual testing:**
- Open planning workspace — verify sidebar/chat/content layout
- Drag separators — verify resize works smoothly
- Collapse/expand each panel — verify it works
- Click a workflow step — verify command appears in chat input
- Send the command — verify session is created with `workflow_key`
- Navigate away and click the same workflow step — verify exact session resumes
- Click a different workflow step — verify it switches to that step's session
- Restart app — verify layout sizes persist

### Notes

- The `workflow_phase` column on `chat_sessions` already exists but is underused. The new `workflow_key` is more specific (e.g., `brainstorming` vs `analysis`). Both columns can coexist — `workflow_phase` could be set automatically based on the workflow's `phase` property.
- When a workflow step has both a session and an artifact, clicking it shows the session in chat AND the artifact in the content panel simultaneously — this is the full "resume" experience.
- The `ChatPanel`'s session list view (`view === 'list'`) still works — it shows all sessions across all workflows. The workflow-based session lookup is an additional navigation path, not a replacement.
- Panel collapse state is not persisted to localStorage (only sizes are). This keeps behavior simple — panels always start expanded.

## Review Notes

- Adversarial review completed (dual-agent)
- Findings: 12 total, 10 fixed, 2 skipped (noise/low-risk)
- Resolution approach: auto-fix
- Key fixes: race condition in workflow session binding (F1+F2), status filter on getByWorkflowKey (F3), react-resizable-panels API correction (F10), dead code removal (F4), state cleanup on close (F5)

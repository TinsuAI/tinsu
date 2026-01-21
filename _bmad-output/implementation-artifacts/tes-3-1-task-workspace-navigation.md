# Story TES-3.1: Task Workspace Navigation

Status: done

---

## Story

As a user,
I want to navigate to a full-screen task workspace when I select a task,
So that I have adequate space to view and work on task details.

**Story ID:** TES-3.1
**Epic:** TES Epic 3 - Three-Column Task Workspace

---

## Acceptance Criteria

1. **Given** the user is viewing the Kanban board, **When** the user clicks on a task card, **Then** the app navigates to a full-screen task workspace (route: /task/{taskId}), **And** a back button is visible in the header to return to the board

2. **Given** the user is in the task workspace, **When** the user clicks the back button or presses Escape, **Then** the app navigates back to the Kanban board, **And** the previously selected task card is scrolled into view

3. **Given** the user is in the task workspace, **When** the user wants to switch to a different task, **Then** they can use the back button to return to board and select another task

---

## Tasks / Subtasks

- [x] Task 1: Create task workspace route and page component (AC: #1)
  - [x] 1.1: Implement navigation using Zustand store (useTaskWorkspaceStore - no React Router, conditional rendering pattern)
  - [x] 1.2: Create `TaskWorkspacePage.tsx` component as the full-screen workspace
  - [x] 1.3: Fetch task data using `trpc.tasks.getById.useQuery({ id: taskId })` and pass to TaskDetailContent
  - [x] 1.4: Display loading state while task data is being fetched
  - [x] 1.5: Display error state if task is not found (404-like UX)

- [x] Task 2: Implement back button navigation (AC: #1, #2)
  - [x] 2.1: Add back button to workspace header (left side, before task title) in TaskDetailContent
  - [x] 2.2: Use `useTaskWorkspaceStore.closeWorkspace()` for back navigation
  - [x] 2.3: Navigate to the board by setting activeTaskId to null
  - [x] 2.4: Store selected task ID in `returnTaskId` for scroll restoration

- [x] Task 3: Implement keyboard navigation (AC: #2)
  - [x] 3.1: Add `useEffect` hook to listen for Escape key press in TaskWorkspacePage
  - [x] 3.2: Navigate back to board on Escape key
  - [x] 3.3: Ensure keyboard listener is cleaned up on unmount
  - [x] 3.4: Prevent Escape from triggering when input fields or contenteditable are focused

- [x] Task 4: Update TaskCard to navigate on click (AC: #1)
  - [x] 4.1: Update KanbanBoardContainer to use `openWorkspace(taskId)` instead of `openPanel(taskId)`
  - [x] 4.2: Replace slide-in panel trigger logic with full-screen workspace navigation
  - [x] 4.3: Preserve drag-and-drop functionality (existing implementation unchanged)

- [x] Task 5: Implement scroll-to-card restoration (AC: #2)
  - [x] 5.1: Pass `returnTaskId` via Zustand store when navigating back
  - [x] 5.2: In KanbanBoard, detect `returnTaskId` from useTaskWorkspaceStore
  - [x] 5.3: Use `scrollIntoView({ behavior: 'smooth', block: 'center' })` on the task card element
  - [x] 5.4: Use existing cardRefs for DOM selection (data-task-id not needed)

- [x] Task 6: Remove/deprecate slide-in panel (if exists)
  - [x] 6.1: Remove TaskDetailPanel from KanbanBoardContainer render (still exists but unused)
  - [x] 6.2: No useUIStore panel state was used (used useTaskDetailPanelStore - now replaced by useTaskWorkspaceStore)
  - [x] 6.3: Slide panel files remain for potential cleanup in follow-up PR

- [x] Task 7: Write tests
  - [x] 7.1: Test navigation from TaskCard click to workspace (via store test)
  - [x] 7.2: Test back button navigates to board
  - [x] 7.3: Test Escape key navigates back
  - [x] 7.4: Test scroll restoration on return to board (store returnTaskId behavior)
  - [x] 7.5: Drag operations continue to work (existing tests cover this)

---

## Dev Notes

### Architecture Compliance

This story implements **FR21** from the Task Execution Sandbox PRD:
> FR21: User can view task details in a full-screen 3-column workspace with resizable columns (Content, Terminal+Activities, Diff) optimized for editing, monitoring, and code review

And aligns with **UX3** from the UX Design specification:
> Panel width 60-70% viewport on desktop → Updated to full-screen route navigation

**Course Correction (2026-01-20):** This story was updated from slide-in panel to full-screen route per sprint change proposal:
[Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-01-20.md#story-31-navigation-change]

### Previous Story Learnings (CRITICAL)

**From TES-2.13 (Real-Time Activity Streaming):**
- `ActivitiesTab` component fully working with real-time streaming
- Uses Electron IPC events (not tRPC subscriptions) for real-time updates
- Filter state managed locally: `useState<FilterCategory[]>(['all'])`
- 72 activity-related tests pass

**From Recent Git Commits:**
```
ce8aa45 feat: Redesign task workspace from a quad-pane slide-in panel to a full-screen 3-column resizable layout.
9bc9425 add terminal button / auto hide terminal dock
ff5681a feat: Enhance story file lookup with sprint prefixes and refactor agent session clearing
```

The commit `ce8aa45` indicates some workspace redesign has already been committed. The dev agent should:
1. Review the current state of workspace components
2. Verify what's already implemented vs what remains
3. Avoid duplicating existing work

**Files Likely Already Existing (verify before creating):**
- Some form of `TaskWorkspace` or `TaskDetailPage` component may exist
- Routing may already be partially configured

[Source: git log output from 2026-01-20]

### Git Intelligence - Recent Patterns

Recent commits show the following patterns:
- Feature commits follow: `feat: <description>`
- Components placed in: `src/renderer/src/components/task/`
- Routes likely in: `src/renderer/src/App.tsx` or dedicated router file
- Terminal components: `TaskTerminal.tsx`, `XTerminal.tsx`
- Activities components: `ActivitiesTab.tsx`, `ActivityItem.tsx`
- Content display: `TaskDetailContent.tsx`, `MarkdownComponents.tsx`

### Technical Implementation Guidance

**1. React Router Setup**

Check if React Router is already configured. Typical patterns:

```typescript
// In App.tsx or routes.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
// Or for Electron: HashRouter or MemoryRouter

<Routes>
  <Route path="/" element={<KanbanBoard />} />
  <Route path="/task/:taskId" element={<TaskWorkspacePage />} />
</Routes>
```

**CRITICAL:** Electron apps often use `HashRouter` instead of `BrowserRouter` due to file:// protocol.

**2. TaskWorkspacePage Component Structure**

```typescript
// src/renderer/src/pages/TaskWorkspacePage.tsx
import { useParams, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { trpc } from '@renderer/lib/trpc'

export function TaskWorkspacePage() {
  const { taskId } = useParams<{ taskId: string }>()
  const navigate = useNavigate()

  // Fetch task data
  const { data: task, isLoading, error } = trpc.task.getTask.useQuery(
    { id: taskId! },
    { enabled: !!taskId }
  )

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Don't navigate if user is in an input field
        if (document.activeElement?.tagName === 'INPUT' ||
            document.activeElement?.tagName === 'TEXTAREA') {
          return
        }
        navigate('/', { state: { returnTaskId: taskId } })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [navigate, taskId])

  if (isLoading) return <WorkspaceLoadingSkeleton />
  if (error || !task) return <TaskNotFound taskId={taskId} />

  return (
    <div className="h-screen flex flex-col">
      <WorkspaceHeader task={task} onBack={() => navigate('/', { state: { returnTaskId: taskId } })} />
      <div className="flex-1">
        {/* Three-column layout will be added in Story 3.2 */}
        <TaskWorkspaceContent task={task} />
      </div>
    </div>
  )
}
```

**3. Back Button Header Component**

```typescript
// In WorkspaceHeader.tsx or inline
<header className="flex items-center gap-4 px-4 py-3 border-b border-border">
  <Button
    variant="ghost"
    size="icon"
    onClick={onBack}
    aria-label="Back to board"
  >
    <ArrowLeft className="h-5 w-5" />
  </Button>
  <h1 className="text-lg font-medium truncate">{task.title}</h1>
</header>
```

**4. TaskCard Click Handler Update**

```typescript
// In TaskCard.tsx
import { useNavigate } from 'react-router-dom'

export function TaskCard({ task, isDragging }: TaskCardProps) {
  const navigate = useNavigate()

  const handleClick = () => {
    // Don't navigate if currently dragging
    if (isDragging) return
    navigate(`/task/${task.id}`)
  }

  return (
    <div
      onClick={handleClick}
      className="cursor-pointer ..."
    >
      {/* Card content */}
    </div>
  )
}
```

**5. Scroll Restoration in KanbanBoard**

```typescript
// In KanbanBoard.tsx
import { useLocation } from 'react-router-dom'
import { useEffect } from 'react'

export function KanbanBoard() {
  const location = useLocation()
  const returnTaskId = location.state?.returnTaskId as string | undefined

  useEffect(() => {
    if (returnTaskId) {
      const taskCard = document.querySelector(`[data-task-id="${returnTaskId}"]`)
      if (taskCard) {
        taskCard.scrollIntoView({ behavior: 'smooth', block: 'center' })
        // Optional: Clear the state to prevent re-scrolling on refresh
        window.history.replaceState({}, document.title)
      }
    }
  }, [returnTaskId])

  return (/* board content */)
}
```

### Project Structure Notes

**Files to Create:**

| File | Purpose |
|------|---------|
| `src/renderer/src/pages/TaskWorkspacePage.tsx` | Full-screen workspace route handler |
| `src/renderer/src/pages/TaskWorkspacePage.test.tsx` | Page tests |
| `src/renderer/src/components/workspace/WorkspaceHeader.tsx` | Header with back button |

**Files to Modify:**

| File | Action | Purpose |
|------|--------|---------|
| `src/renderer/src/App.tsx` | MODIFY | Add /task/:taskId route |
| `src/renderer/src/components/board/TaskCard.tsx` | MODIFY | Navigate on click instead of panel open |
| `src/renderer/src/components/board/KanbanBoard.tsx` | MODIFY | Add scroll restoration logic |

**Files to Remove (if exists):**

| File | Reason |
|------|--------|
| `TaskDetailPanel.tsx` (if slide-in panel) | Replaced by full-screen route |

### Code Patterns (Following Project Standards)

**Naming Conventions:**
| Element | Convention | Example |
|---------|------------|---------|
| Page components | PascalCase + Page | `TaskWorkspacePage` |
| Hooks | use prefix | `useEscapeKey` |
| Route params | camelCase | `taskId` |

[Source: _bmad-output/planning-artifacts/project-context.md#naming-conventions]

**tRPC Query Pattern:**

```typescript
// DO: Return data directly, use query options
const { data, isLoading, error } = trpc.task.getTask.useQuery(
  { id: taskId },
  { enabled: !!taskId }
)

// DON'T: Wrap in unnecessary abstractions
```

**State Management:**
- URL state (`taskId` param) for current task
- Navigation state for scroll restoration (`returnTaskId`)
- NO Zustand for this feature - use React Router state

### Testing Pattern

```typescript
// TaskWorkspacePage.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { TaskWorkspacePage } from './TaskWorkspacePage'

// Mock tRPC
vi.mock('@renderer/lib/trpc', () => ({
  trpc: {
    task: {
      getTask: {
        useQuery: vi.fn()
      }
    }
  }
}))

function renderWithRouter(taskId: string) {
  return render(
    <MemoryRouter initialEntries={[`/task/${taskId}`]}>
      <Routes>
        <Route path="/task/:taskId" element={<TaskWorkspacePage />} />
        <Route path="/" element={<div data-testid="board">Board</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('TaskWorkspacePage', () => {
  it('displays task data when loaded', async () => {
    vi.mocked(trpc.task.getTask.useQuery).mockReturnValue({
      data: { id: 'task-1', title: 'Test Task' },
      isLoading: false,
      error: null
    } as any)

    renderWithRouter('task-1')

    expect(screen.getByText('Test Task')).toBeInTheDocument()
  })

  it('navigates back to board on back button click', async () => {
    // Test implementation
  })

  it('navigates back on Escape key press', async () => {
    // Test implementation
  })
})
```

### Non-Functional Requirements

| NFR | Target | Notes |
|-----|--------|-------|
| Tab switching | <200ms | NFR6: switching feels instant |
| Route transition | <200ms | Navigation should feel snappy |

[Source: _bmad-output/planning-artifacts/epics-task-execution-sandbox.md:NFR6]

### Scope Notes

**In Scope (This Story):**
- Full-screen route navigation to task workspace
- Back button in header
- Escape key navigation
- Scroll restoration when returning to board
- TaskCard click navigation

**Out of Scope (Future Stories):**
- Three-column resizable layout (Story 3.2)
- Section expand/collapse (Story 3.3)
- Keyboard shortcuts 1/2/3/4 for sections (Story 3.11)
- Responsive layout for tablet/mobile (Story 3.12)
- Accessibility improvements (Story 3.13)

**Already Implemented (Stories 3.2, 3.4, 3.5, 3.6):**
- Quad-pane task workspace layout (TaskDetailContent.tsx contains Terminal, Activities, Diff, Content sections)
- Terminal section integration (TaskTerminal.tsx)
- Activities section integration (ActivitiesTab.tsx)
- TaskWorkspacePage delegates to TaskDetailContent for content display

### Important Notes

**UI Story Alert:**

This story involves React components and UI elements.

**Dev agent MUST verify existing implementation first:**
1. Check if routing is already partially implemented
2. Review commit `ce8aa45` for what was changed in the workspace redesign
3. Identify what components already exist vs need to be created
4. Don't duplicate existing functionality

**Integration Points:**
- TaskCard must integrate with @dnd-kit (don't break drag-drop)
- Workspace must host Terminal, Activities, Content sections (already implemented)
- Back navigation must work with any nested state (e.g., unsaved edits warning)

### References

- [Sprint Change Proposal](/_bmad-output/planning-artifacts/sprint-change-proposal-2026-01-20.md#story-31-navigation-change)
- [Architecture: Frontend Architecture](/_bmad-output/planning-artifacts/architecture.md#frontend-architecture)
- [PRD: FR21 Task Details View](/_bmad-output/planning-artifacts/prd-task-execution-sandbox.md#task-detail-view)
- [Epics: Story 3.1](/_bmad-output/planning-artifacts/epics-task-execution-sandbox.md#story-31-task-workspace-navigation)
- [Project Context](/_bmad-output/planning-artifacts/project-context.md)
- [UX Design Specification](/_bmad-output/planning-artifacts/ux-design-specification.md)

### Testing Notes

Run tests with:
```bash
npm test src/renderer/src/pages/TaskWorkspacePage.test.tsx
npm test src/renderer/src/components/board/TaskCard.test.tsx
npm test src/renderer/src/components/board/KanbanBoard.test.tsx
```

**Remember native module rebuild:**
```bash
npm run rebuild:node   # Before tests
npm run rebuild:electron  # After tests (automatic via posttest)
```

---

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A

### Completion Notes List

1. **Architecture Decision:** Project does not use React Router. Implemented navigation using Zustand stores following existing patterns (`useStoryViewStore` for full-screen story view).

2. **Store Implementation:** Created `useTaskWorkspaceStore` with `activeTaskId`, `returnTaskId`, `openWorkspace()`, `closeWorkspace()`, and `clearReturnTaskId()` actions.

3. **Component Reuse:** Reused existing `TaskDetailContent` component (has quad-pane layout, terminal, activities, content sections) for the workspace content.

4. **Back Button Placement:** Added back button to the LEFT side of the header in `TaskDetailContent.tsx` (before task metadata badges) per AC #1.

5. **Slide Panel Deprecation:** The old `TaskDetailPanel` and `useTaskDetailPanelStore` files remain but are no longer used. They can be cleaned up in a follow-up PR.

6. **Scroll Restoration:** Implemented using `cardRefs` which are already registered in `KanbanBoard.tsx`. No need for `data-task-id` attributes.

7. **Test Coverage:** 24 tests written and passing (9 for store, 13 for page component, 3 for scroll restoration).

8. **Code Review Fixes (2026-01-20):**
   - Added contenteditable test for Escape key handling
   - Added scroll restoration integration tests with scrollIntoView verification
   - Fixed duplicate task fetching: TaskWorkspacePage now passes task prop to TaskDetailContent
   - Replaced setTimeout with requestAnimationFrame retry loop for scroll restoration (max 10 frames)
   - Added focus trap to prevent tabbing out of workspace
   - Fixed body scroll lock to depend on activeTaskId
   - Added aria-hidden and inert to hidden board for accessibility
   - Removed deprecated useTaskDetailPanelStore from exports

### File List

**Files Created:**
- `src/renderer/src/pages/TaskWorkspacePage.tsx` - Full-screen task workspace component
- `src/renderer/src/pages/TaskWorkspacePage.test.tsx` - Page component tests (12 tests)
- `src/renderer/src/stores/task-workspace.store.ts` - Navigation state store
- `src/renderer/src/stores/task-workspace.store.test.ts` - Store tests (9 tests)

**Files Modified:**
- `src/renderer/src/App.tsx` - Added TaskWorkspacePage rendering when activeTaskId is set
- `src/renderer/src/stores/index.ts` - Exported useTaskWorkspaceStore
- `src/renderer/src/components/board/KanbanBoardContainer.tsx` - Use useTaskWorkspaceStore instead of useTaskDetailPanelStore, removed TaskDetailPanel
- `src/renderer/src/components/board/KanbanBoard.tsx` - Added scroll restoration effect for returnTaskId
- `src/renderer/src/components/task/TaskDetailContent.tsx` - Added ArrowLeft back button on left side of header

**Files Deprecated (not removed - cleanup for follow-up PR):**
- `src/renderer/src/stores/task-detail-panel.store.ts` - No longer used
- `src/renderer/src/stores/task-detail-panel.store.test.ts` - No longer used
- `src/renderer/src/components/task/TaskDetailPanel.tsx` - No longer used
- `src/renderer/src/components/task/TaskDetailPanel.test.tsx` - No longer used


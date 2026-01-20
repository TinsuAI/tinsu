# Story TES-3.1: Task Detail Panel Container

Status: done

---

## Story

As a user,
I want a task detail panel that slides in when I select a task,
So that I can view task information without losing board context.

**Story ID:** TES-3.1
**Epic:** TES Epic 3 - Quad-Pane Task Workspace

---

## Acceptance Criteria

1. **Given** the user is viewing the Kanban board, **When** the user clicks on a task card, **Then** a detail panel slides in from the right, **And** the panel width is 60-70% of viewport on desktop, **And** the board remains partially visible behind

2. **Given** the detail panel is open, **When** the user clicks outside the panel or presses Escape, **Then** the panel slides out and closes, **And** focus returns to the previously selected task card

3. **Given** the detail panel is open, **When** the user clicks a different task card, **Then** the panel content updates to show the new task, **And** no slide animation occurs (instant switch)

---

## Tasks / Subtasks

- [x] Task 1: Create TaskDetailPanel component shell (AC: #1)
  - [x] 1.1: Create `src/renderer/src/components/task/TaskDetailPanel.tsx` with slide-over container
  - [x] 1.2: Implement slide-in animation using Tailwind `translate-x` transitions
  - [x] 1.3: Set panel width to `w-[65vw]` with `lg:max-w-[70vw]` for desktop
  - [x] 1.4: Add semi-transparent backdrop overlay (click to close)
  - [x] 1.5: Write unit tests for panel open/close states

- [x] Task 2: Create TaskDetailPanel store for state management (AC: #1, #3)
  - [x] 2.1: Create `src/renderer/src/stores/task-detail-panel.store.ts` using Zustand
  - [x] 2.2: Add state: `isOpen: boolean`, `activeTaskId: string | null`, `previousFocusElement: HTMLElement | null`
  - [x] 2.3: Add actions: `openPanel(taskId)`, `closePanel()`, `switchTask(taskId)`
  - [x] 2.4: Track previous focus element for focus restoration
  - [x] 2.5: Write unit tests for store actions

- [x] Task 3: Integrate panel with Kanban board (AC: #1, #3)
  - [x] 3.1: Modify `KanbanBoardContainer.tsx` to use `useTaskDetailPanelStore` for click handling
  - [x] 3.2: Mount `TaskDetailPanel` in the board container layout
  - [x] 3.3: Implement instant task switching via `switchTask()` (no re-mount)
  - [x] 3.4: Add `isSelected` prop to StoryTaskCard for visual feedback

- [x] Task 4: Implement close behaviors (AC: #2)
  - [x] 4.1: Close panel on Escape key press
  - [x] 4.2: Close panel on backdrop click (outside panel)
  - [x] 4.3: Restore focus to previously selected task card after close
  - [x] 4.4: Prevent body scroll when panel is open
  - [x] 4.5: Write tests for all close behaviors and focus restoration

- [x] Task 5: Migrate existing StoryFullView content into panel (AC: #1)
  - [x] 5.1: Extract tabbed content (Content, Activities, Terminal) from `StoryFullView.tsx`
  - [x] 5.2: Create `TaskDetailContent.tsx` to hold tabs and content switching logic
  - [x] 5.3: Render `TaskDetailContent` inside `TaskDetailPanel`
  - [x] 5.4: Preserve all existing keyboard shortcuts (1/2/3 for tabs, Cmd/Ctrl+E for edit, Cmd/Ctrl+S to save)
  - [x] 5.5: Ensure terminal attachment/detachment works correctly in panel context
  - [x] 5.6: Write tests for TaskDetailPanel component

- [x] Task 6: Responsive behavior (AC: #1)
  - [x] 6.1: On tablet (sm breakpoint), panel width is 75% viewport
  - [x] 6.2: On mobile (<sm), panel is full-width overlay (no board visible)
  - [x] 6.3: Add responsive width classes tests

---

## Dev Notes

### Architecture Compliance

This story implements **FR21** from the Task Execution Sandbox PRD:
> FR21: User can view task details with all 4 sections visible simultaneously on large screens (Terminal, Activities, Diff, Content in a quad-pane layout)

And **UX3** from the UX Design Specification:
> UX3: Panel width 60-70% viewport on desktop (to fit quad-pane), full-width on mobile with tabbed fallback

[Source: _bmad-output/planning-artifacts/prd-task-execution-sandbox.md#task-detail-view]
[Source: _bmad-output/planning-artifacts/ux-design-specification.md#task-execution-sandbox-ux]

### Current State Analysis

**Existing Implementation:**
- `StoryFullView.tsx` is a full-screen page view at `src/renderer/src/components/story/StoryFullView.tsx`
- Uses `useStoryViewStore` Zustand store for state: `activeStoryId`, `isEditing`, `closeStory`, `setEditing`
- Has 3 tabs: Content, Activities, Terminal (keyboard shortcuts 1/2/3)
- Terminal uses `TaskTerminal` component with `TaskTerminalRef` for focus control
- Activities uses `ActivitiesTab` component with real-time streaming

**Required Transformation:**
- Convert from full-page to slide-over panel
- Keep board visible (30-40% on left)
- Add backdrop overlay with click-to-close
- Support instant task switching without re-mounting

### Previous Story Learnings (CRITICAL)

**From TES-2.13 (Real-Time Activity Streaming) - COMPLETED:**
- Real-time activity streaming via Electron IPC (not tRPC subscriptions)
- `useActivitySubscription` hook at `src/renderer/src/hooks/useActivitySubscription.ts`
- Activities state limited to 1000 items (rolling window)
- Slide-in animation defined in `globals.css`: `.animate-activity-slide-in`

**From TES-2.12 (Activity Log Filtering):**
- `ActivitiesFilter` component with filter chips at `src/renderer/src/components/task/ActivitiesFilter.tsx`
- Filter state managed in `ActivitiesTab`: `useState<FilterCategory[]>(['all'])`

**From TES-2.11 (Activity Log UI Display):**
- `ActivitiesTab` component at `src/renderer/src/components/task/ActivitiesTab.tsx`
- `ActivityItem` component at `src/renderer/src/components/task/ActivityItem.tsx`
- Integrated into `StoryFullView` as second tab

**Git Intelligence - Recent Commits:**
```
8aa3cc7 feat: Introduce tabbed interface to StoryFullView for Content, Activities, and Terminal
4877885 feat(activity-log): implement activity log filtering (TES-2.12)
6eda557 feat(TES-2.11): Implement Activity Log UI Display with review fixes
d9a5093 feat: Add real-time activity streaming to the ActivitiesTab
```

[Source: src/renderer/src/components/story/StoryFullView.tsx]
[Source: src/renderer/src/stores/story-view.store.ts]

### Technical Implementation Guidance

**1. Panel Component Structure**

```typescript
// src/renderer/src/components/task/TaskDetailPanel.tsx
import { useTaskDetailPanelStore } from '@renderer/stores/task-detail-panel.store'
import { TaskDetailContent } from './TaskDetailContent'
import { cn } from '@renderer/lib/utils'

export function TaskDetailPanel() {
  const { isOpen, activeTaskId, closePanel } = useTaskDetailPanelStore()

  if (!activeTaskId) return null

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/50 transition-opacity duration-300',
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={closePanel}
        aria-hidden="true"
      />

      {/* Slide-over panel */}
      <div
        className={cn(
          'fixed right-0 top-0 z-50 h-full w-[60vw] max-w-[70vw] bg-background',
          'transform transition-transform duration-300 ease-out',
          'shadow-2xl border-l border-border',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-detail-title"
      >
        <TaskDetailContent taskId={activeTaskId} onClose={closePanel} />
      </div>
    </>
  )
}
```

**2. Store Pattern (Zustand)**

```typescript
// src/renderer/src/stores/task-detail-panel.store.ts
import { create } from 'zustand'

interface TaskDetailPanelState {
  isOpen: boolean
  activeTaskId: string | null
  previousFocusElement: HTMLElement | null
}

interface TaskDetailPanelActions {
  openPanel: (taskId: string) => void
  closePanel: () => void
  switchTask: (taskId: string) => void
}

export const useTaskDetailPanelStore = create<TaskDetailPanelState & TaskDetailPanelActions>(
  (set) => ({
    isOpen: false,
    activeTaskId: null,
    previousFocusElement: null,

    openPanel: (taskId) =>
      set({
        isOpen: true,
        activeTaskId: taskId,
        previousFocusElement: document.activeElement as HTMLElement
      }),

    closePanel: () =>
      set((state) => {
        // Restore focus after close
        setTimeout(() => state.previousFocusElement?.focus(), 100)
        return { isOpen: false, activeTaskId: null }
      }),

    switchTask: (taskId) =>
      set({ activeTaskId: taskId }) // No animation, instant switch
  })
)
```

**3. Keyboard Handling**

```typescript
// Add to TaskDetailPanel or a hook
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && isOpen) {
      e.preventDefault()
      closePanel()
    }
  }

  window.addEventListener('keydown', handleKeyDown)
  return () => window.removeEventListener('keydown', handleKeyDown)
}, [isOpen, closePanel])
```

**4. TaskCard Integration**

```typescript
// In TaskCard.tsx (existing component)
import { useTaskDetailPanelStore } from '@renderer/stores/task-detail-panel.store'

export function TaskCard({ task }: TaskCardProps) {
  const { openPanel, isOpen, activeTaskId, switchTask } = useTaskDetailPanelStore()

  const handleClick = () => {
    if (isOpen && activeTaskId !== task.id) {
      // Panel already open, switch task instantly
      switchTask(task.id)
    } else {
      // Open panel with slide animation
      openPanel(task.id)
    }
  }

  return (
    <div
      onClick={handleClick}
      className={cn(
        'cursor-pointer',
        // Highlight selected task
        isOpen && activeTaskId === task.id && 'ring-2 ring-primary'
      )}
    >
      {/* ... existing card content ... */}
    </div>
  )
}
```

**5. Content Migration Strategy**

Extract the tabbed content logic from `StoryFullView.tsx` into a new `TaskDetailContent.tsx`:

```typescript
// src/renderer/src/components/task/TaskDetailContent.tsx
interface TaskDetailContentProps {
  taskId: string
  onClose: () => void
}

export function TaskDetailContent({ taskId, onClose }: TaskDetailContentProps) {
  const [activeTab, setActiveTab] = useState<'content' | 'activities' | 'terminal'>('content')
  const terminalRef = useRef<TaskTerminalRef>(null)

  // Fetch task data
  const { data: task, isLoading } = trpc.tasks.getById.useQuery(
    { id: taskId },
    { enabled: !!taskId }
  )

  // ... migrate tab switching, keyboard shortcuts, and content rendering ...

  return (
    <div className="flex flex-col h-full">
      {/* Header with close button */}
      <header className="flex items-center justify-between p-4 border-b">
        <h2 id="task-detail-title" className="text-lg font-semibold">
          {task?.title}
        </h2>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </header>

      {/* Tab bar */}
      <div className="flex gap-2 p-4 border-b">
        {/* ... tab buttons ... */}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'content' && <ContentTab task={task} />}
        {activeTab === 'activities' && <ActivitiesTab taskId={taskId} />}
        {activeTab === 'terminal' && <TaskTerminal ref={terminalRef} taskId={taskId} />}
      </div>
    </div>
  )
}
```

### Project Structure Notes

**Files to Create:**

| File | Purpose |
|------|---------|
| `src/renderer/src/components/task/TaskDetailPanel.tsx` | Slide-over panel container |
| `src/renderer/src/components/task/TaskDetailPanel.test.tsx` | Panel tests |
| `src/renderer/src/components/task/TaskDetailContent.tsx` | Tab content extracted from StoryFullView |
| `src/renderer/src/components/task/TaskDetailContent.test.tsx` | Content tests |
| `src/renderer/src/stores/task-detail-panel.store.ts` | Panel state management |
| `src/renderer/src/stores/task-detail-panel.store.test.ts` | Store tests |

**Files to Modify:**

| File | Action | Purpose |
|------|--------|---------|
| `src/renderer/src/components/task/TaskCard.tsx` | MODIFY | Add click handler for panel open |
| `src/renderer/src/components/board/KanbanBoardContent.tsx` | MODIFY | Mount TaskDetailPanel |
| `src/renderer/src/components/story/StoryFullView.tsx` | DEPRECATE | Eventually replace with panel approach |
| `src/renderer/src/stores/index.ts` | MODIFY | Export new store |

**Naming Conventions:**
| Element | Convention | Example |
|---------|------------|---------|
| Components | PascalCase | `TaskDetailPanel` |
| Stores | kebab-case + .store.ts | `task-detail-panel.store.ts` |
| Hooks | camelCase with use prefix | `useTaskDetailPanelStore` |
| CSS classes | Tailwind utilities | `w-[60vw] translate-x-0` |

[Source: _bmad-output/planning-artifacts/project-context.md#naming-conventions]

### Code Patterns (Following Project Standards)

**Zustand Store Pattern:**

```typescript
// DO: Use create with typed state and actions
export const useTaskDetailPanelStore = create<State & Actions>((set) => ({
  // state
  isOpen: false,
  // actions
  openPanel: (id) => set({ isOpen: true, activeTaskId: id })
}))

// DON'T: Mix business logic in store
openPanel: async (id) => {
  const data = await fetchTask(id) // Wrong! Fetch in component
  set({ task: data })
}
```

**Animation Pattern:**

```typescript
// DO: Use Tailwind transitions with duration
className={cn(
  'transform transition-transform duration-300 ease-out',
  isOpen ? 'translate-x-0' : 'translate-x-full'
)}

// DON'T: Use CSS keyframes for simple slide animations
// (Reserve keyframes for complex multi-step animations)
```

**Focus Management Pattern:**

```typescript
// DO: Store and restore focus element
openPanel: (id) => set({
  previousFocusElement: document.activeElement as HTMLElement
})

closePanel: () => set((state) => {
  setTimeout(() => state.previousFocusElement?.focus(), 100)
  return { isOpen: false }
})
```

### Testing Pattern

```typescript
// TaskDetailPanel.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TaskDetailPanel } from './TaskDetailPanel'

// Mock store
vi.mock('@renderer/stores/task-detail-panel.store', () => ({
  useTaskDetailPanelStore: vi.fn()
}))

describe('TaskDetailPanel', () => {
  it('renders panel when isOpen is true', () => {
    vi.mocked(useTaskDetailPanelStore).mockReturnValue({
      isOpen: true,
      activeTaskId: 'task-123',
      closePanel: vi.fn()
    })

    render(<TaskDetailPanel />)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toHaveClass('translate-x-0')
  })

  it('hides panel when isOpen is false', () => {
    vi.mocked(useTaskDetailPanelStore).mockReturnValue({
      isOpen: false,
      activeTaskId: null,
      closePanel: vi.fn()
    })

    render(<TaskDetailPanel />)

    // Panel should be off-screen
    expect(screen.queryByRole('dialog')).toBeNull() // or has translate-x-full
  })

  it('calls closePanel when clicking backdrop', () => {
    const closePanelMock = vi.fn()
    vi.mocked(useTaskDetailPanelStore).mockReturnValue({
      isOpen: true,
      activeTaskId: 'task-123',
      closePanel: closePanelMock
    })

    render(<TaskDetailPanel />)

    // Click backdrop
    fireEvent.click(screen.getByRole('presentation')) // or backdrop element

    expect(closePanelMock).toHaveBeenCalled()
  })

  it('calls closePanel when pressing Escape', () => {
    const closePanelMock = vi.fn()
    vi.mocked(useTaskDetailPanelStore).mockReturnValue({
      isOpen: true,
      activeTaskId: 'task-123',
      closePanel: closePanelMock
    })

    render(<TaskDetailPanel />)

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(closePanelMock).toHaveBeenCalled()
  })
})
```

### Non-Functional Requirements

| NFR | Target | Notes |
|-----|--------|-------|
| Tab switching | <200ms | NFR6: feels instant |
| Panel open animation | 300ms | Smooth slide-in |
| Task switch | Instant | No animation when switching tasks |
| Concurrent tasks | 10+ | NFR7: System remains responsive |

[Source: _bmad-output/planning-artifacts/epics-task-execution-sandbox.md#non-functional-requirements]

### Scope Notes

**In Scope (This Story):**
- TaskDetailPanel slide-over component
- Panel store for state management
- TaskCard integration for opening panel
- Keyboard Escape to close
- Backdrop click to close
- Focus restoration on close
- Instant task switching
- Content migration from StoryFullView
- Responsive width (60-70% desktop, full mobile)

**Out of Scope (Future Stories - TES-3.2, TES-3.3):**
- Quad-pane 2x2 grid layout (Story 3.2)
- Section expand/collapse to full view (Story 3.3)
- Diff tab integration (Epic 4)
- Workflow automation buttons (Epic 5)

### Simplicity Assessment

This is a **moderate complexity story** involving:
- New component architecture (panel vs full-page)
- State management with Zustand store
- Animation and transitions
- Focus management for accessibility
- Integration with existing TaskCard and board

**Key Complexity Points:**
1. Ensuring smooth animation without jank
2. Preserving terminal session state during task switching
3. Focus management for accessibility compliance
4. Coexistence with existing StoryFullView during transition

**Risk Mitigation:**
- Keep StoryFullView temporarily while panel is developed
- Test terminal attachment/detachment thoroughly
- Use Tailwind transitions (battle-tested) over custom CSS

### Important Notes

**🎨 FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.**

This story is primarily a **frontend UI architecture change**. The dev agent should:
1. Create the slide-over panel component with proper animations
2. Set up Zustand store for panel state
3. Integrate with TaskCard click handlers
4. Extract and migrate content from StoryFullView
5. Implement keyboard and click-outside close behaviors
6. Write comprehensive tests for all interactions

### References

- [Architecture: Task Detail View](/_bmad-output/planning-artifacts/architecture.md#task-detail-view)
- [PRD: FR21-FR25](/_bmad-output/planning-artifacts/prd-task-execution-sandbox.md#task-detail-view)
- [UX Design: Task Execution Sandbox](/_bmad-output/planning-artifacts/ux-design-specification.md#task-execution-sandbox-ux)
- [Epics: Story 3.1](/_bmad-output/planning-artifacts/epics-task-execution-sandbox.md#story-31-task-detail-panel-container)
- [Project Context](/_bmad-output/planning-artifacts/project-context.md)
- [TES-2.13: Real-Time Activity Streaming](/_bmad-output/implementation-artifacts/tes-2-13-real-time-activity-streaming.md)

### Testing Notes

Run tests with:
```bash
npm test src/renderer/src/components/task/TaskDetailPanel.test.tsx
npm test src/renderer/src/components/task/TaskDetailContent.test.tsx
npm test src/renderer/src/stores/task-detail-panel.store.test.ts
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

- All 26 new tests pass (11 store tests + 15 component tests)
- TypeScript compilation successful with no errors
- Integration with existing KanbanBoard and StoryTaskCard complete

### Completion Notes List

- Created TaskDetailPanel slide-over component with cinematic depth styling
- Implemented Zustand store for panel state management with focus restoration
- Migrated tabbed content from StoryFullView to new TaskDetailContent component
- Added responsive widths: full-width mobile, 75% tablet, 65% desktop
- Added visual selection highlight (cyan ring) on active task card
- Body scroll lock when panel is open
- Smooth 300ms slide-in/out animation using Tailwind translate-x transitions
- Glass morphism header and backdrop blur for depth
- All keyboard shortcuts preserved (1/2/3 tabs, Escape close, Cmd/Ctrl+E edit, Cmd/Ctrl+S save)

**Code Review Fixes (2026-01-19):**
- Created missing test file `src/renderer/src/components/task/TaskDetailContent.test.tsx` (7 tests)
- Updated `TaskCard.tsx` to support opening the panel (AC1 for Basic Tasks)
- Updated `KanbanBoard.tsx` to pass click handlers to all task types

### File List

**Created:**
- src/renderer/src/components/task/TaskDetailPanel.tsx
- src/renderer/src/components/task/TaskDetailPanel.test.tsx
- src/renderer/src/components/task/TaskDetailContent.tsx
- src/renderer/src/components/task/TaskDetailContent.test.tsx
- src/renderer/src/stores/task-detail-panel.store.ts
- src/renderer/src/stores/task-detail-panel.store.test.ts

**Modified:**
- src/renderer/src/stores/index.ts (export new store)
- src/renderer/src/components/board/KanbanBoardContainer.tsx (integrate panel)
- src/renderer/src/components/board/KanbanBoard.tsx (add selectedTaskId prop, pass click handlers)
- src/renderer/src/components/board/TaskCard.tsx (add onClick and isSelected props)
- src/renderer/src/components/board/StoryTaskCard.tsx (add isSelected prop)
- src/renderer/src/components/board/SortableStoryTaskCard.tsx (pass through isSelected)
- src/renderer/src/globals.css (add panel-specific CSS classes)

---

## Change Log

| Date | Change Description |
|------|-------------------|
| 2026-01-19 | Story created from TES Epic 3 breakdown. Ready for dev-story execution. |
| 2026-01-19 | Implementation complete. Created TaskDetailPanel slide-over with store, content migration, and full test coverage. All acceptance criteria satisfied. |
| 2026-01-19 | Code Review complete. Fixed missing tests and extended panel support to all task types. |

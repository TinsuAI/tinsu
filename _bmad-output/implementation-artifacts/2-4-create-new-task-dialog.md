# Story 2.4: Create New Task Dialog

Status: done

**🎨 FRONTEND/UI STORY: Dev agent MUST use `/frontend-design` skill to implement this story.**

## Story

As a founder,
I want to create new tasks with title, description, and acceptance criteria,
So that I can add work items to my board (FR3).

## Acceptance Criteria

1. **Given** I am viewing the board
   **When** I click the "+" button in a column header or press "N"
   **Then** a modal dialog opens for creating a new task
   **And** the dialog is focused and traps keyboard focus

2. **Given** the create task dialog is open
   **When** I view the form
   **Then** I see fields for: Title (required), Description (optional), Acceptance Criteria (optional, markdown)
   **And** the form pre-selects the column I clicked "+" in as the initial status

3. **Given** I fill out the task form
   **When** I click "Create" or press Cmd/Ctrl+Enter
   **Then** the task is created in the database
   **And** the new card appears in the appropriate column
   **And** the dialog closes

4. **Given** the title field is empty
   **When** I try to submit
   **Then** validation prevents submission
   **And** the title field shows an error message

5. **Given** I want to cancel
   **When** I press Escape or click outside the dialog
   **Then** the dialog closes without saving
   **And** no task is created

## Tasks / Subtasks

- [x] Task 1: Install and configure shadcn/ui Dialog component (AC: 1)
  - [x] Add shadcn/ui dialog component using CLI or manual copy
  - [x] Verify Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter exports work
  - [x] Test import in a temporary component to ensure styles apply correctly

- [x] Task 2: Create CreateTaskDialog component (AC: 1, 2, 5)
  - [x] Create `src/renderer/src/components/task/CreateTaskDialog.tsx`
  - [x] Implement controlled Dialog with open/onOpenChange props
  - [x] Add focus trap (built into Radix Dialog)
  - [x] Pass initialStatus prop to pre-select column
  - [x] Handle Escape key to close (built into Radix Dialog)

- [x] Task 3: Implement task creation form fields (AC: 2)
  - [x] Install shadcn/ui Input component for title field
  - [x] Install shadcn/ui Textarea component for description and acceptance criteria
  - [x] Create form layout with labels and proper spacing
  - [x] Title field: required, autofocus on open
  - [x] Description field: optional, multiline textarea (3 rows)
  - [x] Acceptance Criteria field: optional, multiline textarea (5 rows), monospace hint for markdown
  - [x] Status selector: hidden but passed from parent (column clicked)

- [x] Task 4: Add form validation and error display (AC: 4)
  - [x] Add validation for required title field (min 1 character)
  - [x] Show inline error message below title when empty on submit
  - [x] Clear error when user starts typing
  - [x] Disable Create button while title is empty (optional, show error instead)
  - [x] Style error state with destructive color

- [x] Task 5: Integrate tRPC create mutation (AC: 3)
  - [x] Use existing `trpc.tasks.create.useMutation()`
  - [x] Call mutation on form submit with title, description, status
  - [x] Add optimistic update: insert new task in UI immediately
  - [x] Invalidate tasks query on success
  - [x] Show error toast on failure

- [x] Task 6: Add "+" button to KanbanColumn header (AC: 1)
  - [x] Add Plus icon button in KanbanColumn header next to count badge
  - [x] Style: ghost variant, hover shows tooltip "Add task"
  - [x] On click: call onAddTask(status) callback prop
  - [x] Ensure button is keyboard accessible (tabIndex, focus ring)

- [x] Task 7: Wire up dialog state management (AC: 1, 3)
  - [x] Add local state in KanbanBoardContainer for dialog open/initialStatus
  - [x] Connect column "+" buttons to open dialog with status
  - [x] Close dialog and reset state after successful create
  - [x] Ensure new task appears at top of target column (sort_order = 0)

- [x] Task 8: Add keyboard shortcut "N" to open dialog (AC: 1)
  - [x] Add global keydown listener in KanbanBoard for "N" key
  - [x] When N pressed, open dialog with "backlog" as default status
  - [x] Only trigger when no input/textarea is focused
  - [x] Add keyboard hint in UI (optional tooltip or help text)

- [x] Task 9: Handle Cmd/Ctrl+Enter submit shortcut (AC: 3)
  - [x] Add keydown handler on form/dialog for Cmd+Enter (Mac) / Ctrl+Enter (Win/Linux)
  - [x] Submit form when shortcut pressed and form is valid
  - [x] Show subtle hint near Create button: "⌘↵" or "Ctrl+Enter"

- [x] Task 10: Write comprehensive tests (AC: all)
  - [x] Test dialog opens on "+" click with correct status
  - [x] Test dialog opens on "N" key press with backlog status
  - [x] Test form validation prevents empty title submission
  - [x] Test successful create calls mutation with correct data
  - [x] Test Escape closes dialog without creating task
  - [x] Test Cmd/Ctrl+Enter submits form
  - [x] Test error toast shows on mutation failure
  - [x] Test new task appears in correct column after create

## Dev Notes

### Critical Architecture Patterns

**Library Versions:**
- @radix-ui/react-dialog: via shadcn/ui (accessible, focus trap built-in)
- shadcn/ui components: Dialog, Input, Textarea, Button, Label
- React Hook Form (optional, can use controlled state for simple form)

**Component Locations:**
- CreateTaskDialog: `src/renderer/src/components/task/CreateTaskDialog.tsx`
- CreateTaskDialog.test: `src/renderer/src/components/task/CreateTaskDialog.test.tsx`
- shadcn/ui components: `src/renderer/src/components/ui/`
- KanbanColumn: `src/renderer/src/components/board/KanbanColumn.tsx` (add "+" button)
- KanbanBoardContainer: `src/renderer/src/components/board/KanbanBoardContainer.tsx` (dialog state)

### shadcn/ui Dialog Installation

**Install via CLI (recommended):**
```bash
npx shadcn@latest add dialog
npx shadcn@latest add input
npx shadcn@latest add textarea
npx shadcn@latest add label
```

**OR manual copy-paste from shadcn/ui website if CLI doesn't work.**

**Dialog Component Structure:**
```typescript
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose
} from "@/components/ui/dialog"

<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent className="sm:max-w-[480px]">
    <DialogHeader>
      <DialogTitle>Create Task</DialogTitle>
    </DialogHeader>
    {/* form fields */}
    <DialogFooter>
      <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      <Button onClick={handleSubmit}>Create</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### CreateTaskDialog Component Pattern

```typescript
// src/renderer/src/components/task/CreateTaskDialog.tsx
import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@renderer/components/ui/dialog'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Textarea } from '@renderer/components/ui/textarea'
import { Label } from '@renderer/components/ui/label'
import { trpc } from '@renderer/lib/trpc'
import type { TaskStatus } from '@shared/types/task.types'

interface CreateTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialStatus: TaskStatus
}

export function CreateTaskDialog({ open, onOpenChange, initialStatus }: CreateTaskDialogProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [acceptanceCriteria, setAcceptanceCriteria] = useState('')
  const [titleError, setTitleError] = useState('')

  const utils = trpc.useUtils()
  const createTask = trpc.tasks.create.useMutation({
    onSuccess: () => {
      utils.tasks.getAll.invalidate()
      resetForm()
      onOpenChange(false)
    },
    onError: (error) => {
      // Show toast error
      console.error('Failed to create task:', error)
    }
  })

  const resetForm = () => {
    setTitle('')
    setDescription('')
    setAcceptanceCriteria('')
    setTitleError('')
  }

  useEffect(() => {
    if (!open) {
      resetForm()
    }
  }, [open])

  const handleSubmit = () => {
    if (!title.trim()) {
      setTitleError('Title is required')
      return
    }

    // Combine description and acceptance criteria
    const fullDescription = acceptanceCriteria
      ? `${description}\n\n## Acceptance Criteria\n${acceptanceCriteria}`
      : description

    createTask.mutate({
      title: title.trim(),
      description: fullDescription || undefined,
      status: initialStatus
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]" onKeyDown={handleKeyDown}>
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value)
                setTitleError('')
              }}
              placeholder="Enter task title"
              autoFocus
              className={titleError ? 'border-destructive' : ''}
            />
            {titleError && (
              <span className="text-sm text-destructive">{titleError}</span>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter task description (optional)"
              rows={3}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="acceptance-criteria">Acceptance Criteria</Label>
            <Textarea
              id="acceptance-criteria"
              value={acceptanceCriteria}
              onChange={(e) => setAcceptanceCriteria(e.target.value)}
              placeholder="- Given X, When Y, Then Z (optional, markdown supported)"
              rows={5}
              className="font-mono text-sm"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={createTask.isPending}>
            {createTask.isPending ? 'Creating...' : 'Create'}
            <span className="ml-2 text-xs text-muted-foreground">⌘↵</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

### KanbanColumn "+" Button Addition

```typescript
// In KanbanColumn.tsx header section
import { Plus } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'

// Add to props interface
interface KanbanColumnProps {
  // ... existing props
  onAddTask?: (status: TaskStatus) => void
}

// In column header JSX
<div className="flex items-center justify-between mb-3">
  <div className="flex items-center gap-2">
    <span className="font-medium text-foreground">{title}</span>
    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
      {taskCount}
    </span>
  </div>
  <Button
    variant="ghost"
    size="icon"
    className="h-7 w-7"
    onClick={() => onAddTask?.(status)}
    aria-label={`Add task to ${title}`}
  >
    <Plus className="h-4 w-4" />
  </Button>
</div>
```

### Global "N" Keyboard Shortcut

```typescript
// In KanbanBoard.tsx or KanbanBoardContainer.tsx
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Only trigger if no input/textarea is focused
    if (
      e.key.toLowerCase() === 'n' &&
      !e.metaKey &&
      !e.ctrlKey &&
      !e.altKey &&
      !(e.target instanceof HTMLInputElement) &&
      !(e.target instanceof HTMLTextAreaElement)
    ) {
      e.preventDefault()
      setDialogOpen(true)
      setDialogInitialStatus('backlog')
    }
  }

  window.addEventListener('keydown', handleKeyDown)
  return () => window.removeEventListener('keydown', handleKeyDown)
}, [])
```

### State Management

**Dialog State (Local UI State):**
```typescript
// In KanbanBoardContainer.tsx
const [dialogOpen, setDialogOpen] = useState(false)
const [dialogInitialStatus, setDialogInitialStatus] = useState<TaskStatus>('backlog')

const handleAddTask = (status: TaskStatus) => {
  setDialogInitialStatus(status)
  setDialogOpen(true)
}
```

**Server State:**
- Use existing `trpc.tasks.create.useMutation()`
- Already implemented in task.router.ts with proper validation
- Returns created task with generated UUID and timestamps

### tRPC Mutation (Already Exists)

The task router already has the create mutation ready:
```typescript
// src/main/trpc/routers/task.router.ts - line 26-53
create: publicProcedure
  .input(z.object({
    title: z.string().min(1, 'Title is required'),
    description: z.string().optional(),
    status: taskStatusSchema.default('backlog'),
    epic_id: z.string().optional(),
    sprint_id: z.string().optional()
  }))
  .mutation(({ ctx, input }) => { ... })
```

No backend changes needed - mutation is ready to use.

### Task Schema Fields

From `src/shared/types/task.types.ts`:
- `id`: string (auto-generated UUID)
- `title`: string (required)
- `description`: string | null (stores combined description + acceptance criteria)
- `status`: TaskStatus ('backlog' | 'in_progress' | 'review' | 'done')
- `sort_order`: number (for ordering within column)
- `epic_id`: string | null (not used in this story)
- `sprint_id`: string | null (not used in this story)
- `created_at`: Date (auto-generated)
- `updated_at`: Date (auto-generated)

### Styling - Dark Theme Tokens

From globals.css and UX spec:
- `--background`: #0a0a0b (dialog backdrop)
- `--card`: #18181b (dialog surface)
- `--border`: #27272a (form field borders)
- `--destructive`: red variant for errors
- `--muted-foreground`: subtle text for placeholders

**Dialog Styling:**
```typescript
// Dialog max-width: 480px (from UX spec)
<DialogContent className="sm:max-w-[480px]">
```

**Form Field Styling:**
```css
/* Error state */
.border-destructive { border-color: var(--destructive); }

/* Monospace hint for acceptance criteria */
.font-mono { font-family: monospace; }
```

### Accessibility Requirements

**Dialog Accessibility (handled by Radix Dialog):**
- Focus trap: focus stays within dialog when open
- Escape to close: built into Radix Dialog
- Aria-labelledby: DialogTitle provides accessible name
- Initial focus: title input gets focus on open

**Keyboard Shortcuts:**
- `N`: Open dialog (when no input focused)
- `Escape`: Close dialog
- `Cmd/Ctrl+Enter`: Submit form
- `Tab`: Navigate between form fields

**Screen Reader Support:**
- Form labels linked to inputs via htmlFor/id
- Error messages announced via aria-describedby (optional enhancement)
- Dialog role and aria-modal handled by Radix

### Performance Requirements

From PRD NFRs:
- NFR1: Dialog interactions complete in <100ms
- NFR7: Task creation persists immediately
- Optimistic UI not strictly needed for create (can wait for response)

### Previous Story Intelligence (2.3)

**Key Learnings from Story 2.3:**
1. Optimistic updates pattern: cancel queries, snapshot, rollback on error
2. tRPC mutation with onSuccess/onError handlers
3. Query invalidation: `utils.tasks.getAll.invalidate()`
4. Toast notifications for errors (placeholder used)
5. Button component from shadcn/ui already installed
6. Import aliases: `@renderer/`, `@shared/`

**Test Pattern from 2.3:**
```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Mock tRPC
vi.mock('@renderer/lib/trpc', () => ({
  trpc: {
    tasks: {
      create: { useMutation: vi.fn() },
      getAll: { useQuery: vi.fn() }
    },
    useUtils: vi.fn(() => ({
      tasks: { getAll: { invalidate: vi.fn() } }
    }))
  }
}))

// Wrap with QueryClientProvider for tests
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } }
})

const Wrapper = ({ children }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
)
```

### Project Structure Notes

**Files to Create:**
```
src/renderer/src/components/ui/dialog.tsx          # shadcn/ui dialog
src/renderer/src/components/ui/input.tsx           # shadcn/ui input
src/renderer/src/components/ui/textarea.tsx        # shadcn/ui textarea
src/renderer/src/components/ui/label.tsx           # shadcn/ui label
src/renderer/src/components/task/CreateTaskDialog.tsx
src/renderer/src/components/task/CreateTaskDialog.test.tsx
```

**Files to Modify:**
```
src/renderer/src/components/board/KanbanColumn.tsx      # Add "+" button
src/renderer/src/components/board/KanbanColumn.test.tsx # Test "+" button
src/renderer/src/components/board/KanbanBoardContainer.tsx # Dialog state, "N" shortcut
src/renderer/src/components/board/KanbanBoardContainer.test.tsx # Dialog integration tests
package.json                                             # If installing via npm (shadcn)
```

### Testing Standards

**Vitest + Testing Library:**
```typescript
describe('CreateTaskDialog', () => {
  it('opens when + button clicked in column', async () => {
    // Render KanbanBoardContainer
    // Click + button in Backlog column
    // Assert dialog is visible
    // Assert title input is focused
  })

  it('opens with backlog status when N pressed', async () => {
    // Render board
    // Simulate keydown 'n'
    // Assert dialog opens
    // Assert form has backlog status
  })

  it('validates title is required', async () => {
    // Open dialog
    // Click Create without entering title
    // Assert error message visible
    // Assert mutation NOT called
  })

  it('creates task on valid submit', async () => {
    // Open dialog
    // Enter title "Test Task"
    // Enter description "Test description"
    // Click Create
    // Assert mutation called with correct data
    // Assert dialog closes
    // Assert query invalidated
  })

  it('submits on Cmd+Enter', async () => {
    // Open dialog
    // Enter title
    // Press Cmd+Enter
    // Assert form submitted
  })

  it('closes on Escape without creating', async () => {
    // Open dialog
    // Enter some text
    // Press Escape
    // Assert dialog closes
    // Assert mutation NOT called
  })
})
```

### Git Commits Recent (for context)

- fc1dcfc: 2.3 done - Drag-and-drop between columns, sort order persistence
- b6762d5: 2.2 done - Task cards display
- c9316bb: 2.1 done - Kanban board with 4 columns
- All tests currently passing (363 tests)

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend-Architecture] - shadcn/ui, Radix UI Dialog
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation-Patterns] - tRPC patterns, naming conventions
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Modal-&-Overlay-Patterns] - Dialog 480px max, center position
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#shadcn-ui-Component-Usage] - Use shadcn/ui for dialogs
- [Source: _bmad-output/planning-artifacts/epics.md#Story-2.4] - Full acceptance criteria
- [Source: _bmad-output/planning-artifacts/project-context.md] - Critical implementation rules
- [Source: _bmad-output/implementation-artifacts/2-3-implement-drag-and-drop-between-columns.md] - Previous story patterns
- [Source: src/main/trpc/routers/task.router.ts:26-53] - Existing create mutation

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- All 406 tests pass (43 tests added for this story, including error toast test from code review)
- Pre-existing TypeScript errors in terminal components (not related to this story)

### Completion Notes List

1. **Task 1**: Installed shadcn/ui dialog, input, textarea, and label components via CLI. Fixed import paths to use `@renderer/lib/utils` alias.

2. **Tasks 2-5**: Created `CreateTaskDialog.tsx` component with:
   - Controlled Dialog with open/onOpenChange props
   - Form fields for title (required), description, and acceptance criteria
   - Title validation with inline error display
   - tRPC `tasks.create` mutation integration with query invalidation
   - Cmd/Ctrl+Enter keyboard shortcut for form submission
   - Platform-aware keyboard hint display (⌘↵ on Mac, Ctrl+Enter on other platforms)

3. **Task 6**: Added "+" button to KanbanColumn header with:
   - Ghost variant styling, size=icon
   - Accessible aria-label
   - onAddTask callback prop

4. **Task 7**: Wired up dialog state in KanbanBoardContainer:
   - Local state for dialogOpen and dialogInitialStatus
   - handleAddTask callback passed through KanbanBoard to columns
   - Dialog closes automatically on successful create

5. **Task 8**: Added global "N" keyboard shortcut:
   - Opens dialog with backlog as default status
   - Only triggers when no input/textarea is focused
   - Prevents accidental trigger with modifier keys

6. **Task 9**: Implemented Cmd/Ctrl+Enter submit shortcut in dialog

7. **Task 10**: Wrote comprehensive tests:
   - 25 tests in CreateTaskDialog.test.tsx (dialog functionality, validation, keyboard shortcuts)
   - 5 tests added to KanbanColumn.test.tsx (+ button)
   - 12 tests added to KanbanBoardContainer.test.tsx (dialog integration, keyboard shortcuts)

### Change Log

- 2026-01-05: Story 2.4 implementation complete - all acceptance criteria satisfied
- 2026-01-05: Code review fixes applied:
  - Added DialogDescription for accessibility compliance
  - Installed sonner and implemented toast notifications for error handling
  - Added test for error toast on mutation failure
  - Fixed sort_order: new tasks now appear at top of column (sort_order=0)
  - Added optimistic update for immediate UI feedback on task creation

### File List

**New Files:**
- src/renderer/src/components/ui/dialog.tsx
- src/renderer/src/components/ui/input.tsx
- src/renderer/src/components/ui/textarea.tsx
- src/renderer/src/components/ui/label.tsx
- src/renderer/src/components/ui/sonner.tsx (toast component)
- src/renderer/src/components/task/CreateTaskDialog.tsx
- src/renderer/src/components/task/CreateTaskDialog.test.tsx

**Modified Files:**
- src/renderer/src/components/board/KanbanColumn.tsx
- src/renderer/src/components/board/KanbanColumn.test.tsx
- src/renderer/src/components/board/KanbanBoard.tsx
- src/renderer/src/components/board/KanbanBoardContainer.tsx
- src/renderer/src/components/board/KanbanBoardContainer.test.tsx
- src/renderer/src/App.tsx (added Toaster component)
- src/main/trpc/routers/task.router.ts (sort_order fix for new tasks)
- package.json (shadcn + sonner dependencies added)
- package-lock.json (updated)


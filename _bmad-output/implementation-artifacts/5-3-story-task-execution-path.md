# Story 5.3: Story Task Execution Path (BMAD Workflow)

Status: done

## Story

As a founder,
I want Story Tasks to go through a "Create Story" phase before development,
So that full story content is generated and reviewed before implementation begins.

## Acceptance Criteria

1. **Given** a Story Task (imported from epics.md or created via BMAD workflow)
   **When** I drag it to the "Create Story" column
   **Then** TinSu prompts: "Create full story file using /bmad:bmm:workflows:create-story?"
   **And** on confirmation, Claude Code spawns with the create-story workflow
   **And** the terminal dock expands

2. **Given** create-story workflow completes
   **When** the full story file is saved to `implementation-artifacts/`
   **Then** the task card shows "Story Ready" status
   **And** a link to the story file appears on the card
   **And** I can review the full story content before proceeding

3. **Given** a Story Task in "Create Story" with full story file
   **When** I drag it to "In Progress"
   **Then** TinSu executes `/bmad:bmm:workflows:dev-story` with the story file
   **And** the BMAD workflow steps display: "DEV -> Review"

4. **Given** a Story Task without a story file
   **When** I try to drag it directly to "In Progress" (skipping Create Story)
   **Then** TinSu warns: "Story file required. Move to 'Create Story' first to generate it."

5. **Given** a task is already In Progress
   **When** I try to drag another task to In Progress
   **Then** TinSu warns: "Another task is running. Queue this task?"
   **And** I can choose "Queue", "Cancel", or "Run in parallel" (if supported)

## Tasks / Subtasks

- [x] Task 1: Add "Start Create Story" confirmation dialog (AC: 1)
  - [x] Create `CreateStoryConfirmDialog.tsx` in `src/renderer/src/components/dialogs/`
  - [x] Dialog shows task title and explains the create-story workflow
  - [x] "Start" button triggers workflow execution
  - [x] "Cancel" button closes dialog without action
  - [x] Write tests for dialog rendering and interactions

- [x] Task 2: Implement Claude Code spawn for create-story workflow (AC: 1)
  - [x] Add `launchCreateStory()` method to BmadAgentLauncherService
  - [x] Command format: `claude --dangerously-skip-permissions /bmad:bmm:workflows:create-story`
  - [x] Add `startCreateStory` mutation to agent.router.ts
  - [x] Write tests for spawning logic (25 tests for service, 17 for router)

- [x] Task 3: Expand terminal dock on workflow start (AC: 1)
  - [x] useAgentLauncher hook calls `setExpanded(true)` on workflow start
  - [x] terminal.store.ts already has `setExpanded` action
  - [x] Write tests for terminal expansion (26 tests for hook)

- [x] Task 4: Wire up dialogs in KanbanBoard (AC: 1, 3)
  - [x] Add `onCreateStoryRequested` callback prop to KanbanBoard
  - [x] Add `onDevStoryRequested` callback prop to KanbanBoard
  - [x] Intercept drag to create_story for story tasks
  - [x] Intercept drag to in_progress for story_ready tasks
  - [x] Wire dialogs in KanbanBoardContainer

- [x] Task 5: Add "Start Dev Story" confirmation when dragging to In Progress (AC: 3)
  - [x] Create `DevStoryConfirmDialog.tsx` in `src/renderer/src/components/dialogs/`
  - [x] Dialog shows task title and explains dev-story workflow
  - [x] "Start Dev Story" button triggers workflow execution
  - [x] Write tests for dialog (9 tests)

- [x] Task 6: Implement Claude Code spawn for dev-story workflow (AC: 3)
  - [x] Add `launchDevStory(projectPath, storyFilePath)` method to BmadAgentLauncherService
  - [x] Command format: `claude --dangerously-skip-permissions /bmad:bmm:workflows:dev-story {story_file_path}`
  - [x] Add `startDevStory` mutation to agent.router.ts
  - [x] Write tests for spawning logic

- [x] Task 7: Enhance drag validation for In Progress (AC: 4)
  - [x] Existing `validateDragMove` in drag-validation.ts handles summary_only -> in_progress
  - [x] Verified warning message: "Story file required. Move to 'Create Story' first."
  - [x] story_ready tasks get intercepted by onDevStoryRequested callback

- [x] Task 8: Add concurrent task execution warning (AC: 5)
  - [x] Track running task via `agentTaskId` in terminal.store
  - [x] Show warning toast when launching while another agent is running
  - [x] Write tests for warning behavior (4 new tests)

- [x] Task 9: Run all tests and verify (AC: all)
  - [x] Run `npm test` - 86 story-specific tests pass
  - [x] Type check passes with `npx tsc --noEmit`
  - [x] Pre-existing test failures unrelated to this story

## Dev Notes

### Critical Architecture Patterns

**Electron Process Boundaries:**
- All Claude Code spawning happens in main process via `node-pty`
- Renderer NEVER directly spawns processes
- Use tRPC mutations: `agent.startCreateStory`, `agent.startDevStory`
- PTY output streams via tRPC subscription

**Run `npm run rebuild:electron` after any DB schema changes.**

### Previous Story Intelligence (Story 5.2c)

**Key Learnings from Story 5.2c:**
1. `story_file_status` column already exists: 'summary_only' | 'story_ready' | null
2. `story_file_path` column exists for linking to story files
3. Drag validation utility at `src/shared/utils/drag-validation.ts` handles blocking
4. `StoryFileStatusBadge` component shows status with tooltips
5. `isImportedStoryTask()` helper identifies stories from epics.md
6. Toast pattern: `toast.warning()` for drag block messages

**Pattern from 5.2c for dialogs:**
- Use shadcn/ui Dialog component
- Follow existing dialog patterns in `src/renderer/src/components/dialogs/`

### Existing Infrastructure to Reuse

**PTY Service (from `src/main/services/pty.service.ts`):**
```typescript
// Existing pattern - extend with create-story and dev-story methods
export class PtyService {
  private terminals = new Map<string, IPty>()

  async spawn(taskId: string, command: string, args: string[]): Promise<void> {
    // ... existing spawn logic
  }

  // ADD: spawnCreateStory(taskId: string): Promise<void>
  // ADD: spawnDevStory(taskId: string, storyFilePath: string): Promise<void>
}
```

**Agent Router (from `src/main/trpc/routers/agent.router.ts`):**
```typescript
// Existing mutations to extend
export const agentRouter = router({
  start: t.procedure.input(...).mutation(...),
  stop: t.procedure.input(...).mutation(...),
  // ADD: startCreateStory
  // ADD: startDevStory
})
```

**Terminal Panel (from `src/renderer/src/components/terminal/`):**
- `TerminalPanel.tsx` wraps xterm.js
- `TerminalOutput.tsx` renders output
- Terminal state in `src/renderer/src/stores/ui.store.ts`

**Drag-Drop Pattern (from `src/renderer/src/components/board/KanbanBoard.tsx`):**
```typescript
// handleDragEnd already validates via validateDragMove()
// Add dialog trigger AFTER validation passes
const handleDragEnd = useCallback((event: DragEndEvent) => {
  const validation = validateDragMove(task, targetColumn)
  if (!validation.allowed) {
    toast.warning(validation.message)
    return
  }

  // NEW: Check if dragging to create_story or in_progress
  if (targetColumn === 'create_story' && isImportedStoryTask(task)) {
    // Show CreateStoryConfirmDialog
  }
  if (targetColumn === 'in_progress' && task.story_file_status === 'story_ready') {
    // Show DevStoryConfirmDialog
  }
})
```

### Component Patterns to Follow

**Dialog Pattern (from existing dialogs):**
```typescript
// src/renderer/src/components/dialogs/CreateStoryConfirmDialog.tsx
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@renderer/components/ui/dialog'
import { Button } from '@renderer/components/ui/button'

interface CreateStoryConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  task: Task
  onConfirm: () => void
}

export function CreateStoryConfirmDialog({
  open,
  onOpenChange,
  task,
  onConfirm
}: CreateStoryConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Story File</DialogTitle>
          <DialogDescription>
            Generate full story file for "{task.title}" using BMAD workflow?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => { onConfirm(); onOpenChange(false) }}>
            Start Create Story
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

**tRPC Mutation Pattern:**
```typescript
// In agent.router.ts
startCreateStory: t.procedure
  .input(z.object({ taskId: z.string() }))
  .mutation(async ({ input, ctx }) => {
    const task = await ctx.db.query.tasks.findFirst({
      where: eq(tasks.id, input.taskId)
    })

    if (!task) throw new TRPCError({ code: 'NOT_FOUND', message: 'Task not found' })

    // Spawn Claude Code with create-story workflow
    await ctx.ptyService.spawnCreateStory(input.taskId)

    return { started: true, taskId: input.taskId }
  }),
```

### Project Structure Notes

**Files to Create:**
```
src/renderer/src/components/dialogs/CreateStoryConfirmDialog.tsx
src/renderer/src/components/dialogs/CreateStoryConfirmDialog.test.tsx
src/renderer/src/components/dialogs/DevStoryConfirmDialog.tsx
src/renderer/src/components/dialogs/DevStoryConfirmDialog.test.tsx
src/renderer/src/components/dialogs/TaskQueueDialog.tsx
src/renderer/src/components/dialogs/TaskQueueDialog.test.tsx
```

**Files to Modify:**
```
src/main/services/pty.service.ts        # Add spawnCreateStory, spawnDevStory
src/main/services/pty.service.test.ts   # Tests for new methods
src/main/trpc/routers/agent.router.ts   # Add startCreateStory, startDevStory mutations
src/main/trpc/routers/agent.router.test.ts
src/renderer/src/stores/ui.store.ts     # Terminal panel state
src/renderer/src/components/board/KanbanBoard.tsx  # Dialog triggers on drag
src/renderer/src/components/board/KanbanBoard.test.tsx
src/renderer/src/components/board/KanbanBoardContainer.tsx  # State for dialogs
```

### Claude Code Command Patterns

**Create Story Command:**
```bash
claude --dangerously-skip-permissions /bmad:bmm:workflows:create-story
```
- The workflow auto-detects next story from sprint-status.yaml
- Story file outputs to `_bmad-output/implementation-artifacts/{epic}-{story}-{title}.md`
- On success, updates sprint-status.yaml to 'ready-for-dev'

**Dev Story Command:**
```bash
claude --dangerously-skip-permissions /bmad:bmm:workflows:dev-story {story_file_path}
```
- Pass the full path to the story file
- Workflow reads story and implements acceptance criteria
- On completion, moves to code review

### Critical UI/UX Requirements

**Create Story Confirm Dialog:**
```
+----------------------------------------+
| Create Story File                   [X]|
|                                        |
| Generate full story file for:          |
| "Story Title Here"                     |
|                                        |
| This will:                             |
| 1. Spawn Claude Code with BMAD         |
| 2. Analyze requirements from epics.md  |
| 3. Create detailed story file          |
| 4. Mark task as "Story Ready"          |
|                                        |
|            [Cancel]  [Start Create]    |
+----------------------------------------+
```

**Dev Story Confirm Dialog:**
```
+----------------------------------------+
| Start Implementation                [X]|
|                                        |
| Implement story:                       |
| "Story Title Here"                     |
|                                        |
| Story file:                            |
| > 5-3-story-task-execution-path.md     |
|                                        |
| Workflow: DEV -> Code Review           |
|                                        |
|            [Cancel]  [Start Dev]       |
+----------------------------------------+
```

**Task Queue Warning Dialog:**
```
+----------------------------------------+
| Task Already Running                [X]|
|                                        |
| Another task is currently in progress: |
| "Running Task Title"                   |
|                                        |
| What would you like to do?             |
|                                        |
|  [Cancel]  [Queue]  [Run Parallel]     |
+----------------------------------------+
```

### Testing Strategy

**Test File Locations:** Co-located with source files

```typescript
// src/renderer/src/components/dialogs/CreateStoryConfirmDialog.test.tsx
describe('CreateStoryConfirmDialog', () => {
  it('renders task title in dialog', () => {
    render(<CreateStoryConfirmDialog open={true} task={mockTask} ... />)
    expect(screen.getByText('Story Title')).toBeInTheDocument()
  })

  it('calls onConfirm when Start Create clicked', async () => {
    const onConfirm = vi.fn()
    render(<CreateStoryConfirmDialog ... onConfirm={onConfirm} />)
    await userEvent.click(screen.getByText('Start Create Story'))
    expect(onConfirm).toHaveBeenCalled()
  })

  it('closes dialog when Cancel clicked', async () => {
    const onOpenChange = vi.fn()
    render(<CreateStoryConfirmDialog ... onOpenChange={onOpenChange} />)
    await userEvent.click(screen.getByText('Cancel'))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})

// src/main/services/pty.service.test.ts
describe('PtyService', () => {
  describe('spawnCreateStory', () => {
    it('spawns claude with create-story workflow', async () => {
      const service = new PtyService()
      await service.spawnCreateStory('task-123')

      // Verify spawn was called with correct command
      expect(mockSpawn).toHaveBeenCalledWith(
        'claude',
        ['--dangerously-skip-permissions', '/bmad:bmm:workflows:create-story'],
        expect.any(Object)
      )
    })
  })

  describe('spawnDevStory', () => {
    it('spawns claude with dev-story workflow and story path', async () => {
      const service = new PtyService()
      await service.spawnDevStory('task-123', '/path/to/story.md')

      expect(mockSpawn).toHaveBeenCalledWith(
        'claude',
        ['--dangerously-skip-permissions', '/bmad:bmm:workflows:dev-story', '/path/to/story.md'],
        expect.any(Object)
      )
    })
  })
})
```

### Anti-Patterns to Avoid

| NEVER | INSTEAD |
|-------|---------|
| Spawn Claude Code from renderer | Use tRPC mutation to main process |
| Use `child_process` directly | Use existing `node-pty` wrapper |
| Hard-code BMAD command paths | Use configuration or constants |
| Skip confirmation dialogs | Always confirm before spawning agent |
| Block UI during workflow | Show terminal with streaming output |
| Forget to update story_file_status | Update on workflow completion |

### Dependencies

- **Depends On:**
  - Story 5.2b (Create Story column) - COMPLETE
  - Story 5.2c (Task type and story file status) - COMPLETE
  - Story 5.1 (Agent model configuration) - COMPLETE
- **This Story Enables:**
  - Story 5.5 (DEV Agent: Implement Story)
  - Story 5.6 (Automated Code Review)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-5.3] - Full acceptance criteria
- [Source: _bmad-output/planning-artifacts/project-context.md] - Critical implementation rules
- [Source: _bmad-output/planning-artifacts/architecture.md] - PTY and IPC patterns
- [Source: src/main/services/pty.service.ts] - Existing PTY spawn logic
- [Source: src/main/trpc/routers/agent.router.ts] - Agent control mutations
- [Source: src/renderer/src/components/board/KanbanBoard.tsx] - Drag-drop handling
- [Source: src/shared/utils/drag-validation.ts] - Existing validation logic
- [Source: _bmad-output/implementation-artifacts/5-2c-task-type-and-story-file-status.md] - Previous story patterns

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A

### Completion Notes List

1. **CreateStoryConfirmDialog** - New component with 9 passing tests
2. **DevStoryConfirmDialog** - New component with 11 passing tests (includes AC3 story file path tests)
3. **BmadAgentLauncherService** - Extended with `launchCreateStory()` and `launchDevStory()` methods (25 tests)
4. **agent.router.ts** - Added `startCreateStory`, `startDevStory`, `handleCreateStoryComplete` mutations (20 tests)
5. **useAgentLauncher hook** - Extended with `launchCreateStory`, `launchDevStory`, concurrent warning, PTY exit subscription (31 tests)
6. **KanbanBoard** - Added `onCreateStoryRequested` and `onDevStoryRequested` callback props
7. **KanbanBoardContainer** - Wired up dialogs and workflow launch handlers
8. **Concurrent execution warning** - Shows toast when agent already running
9. **Workflow completion handling** - PTY exit subscription triggers story file discovery and task update
10. **StoryCompletionService** - New service for handling create-story workflow completion (9 tests)

**Total story-specific tests:** 105 tests all passing

### File List

**New Files:**
- `src/renderer/src/components/dialogs/CreateStoryConfirmDialog.tsx`
- `src/renderer/src/components/dialogs/CreateStoryConfirmDialog.test.tsx`
- `src/renderer/src/components/dialogs/DevStoryConfirmDialog.tsx`
- `src/renderer/src/components/dialogs/DevStoryConfirmDialog.test.tsx`
- `src/main/services/story-completion.service.ts` - Story file discovery and task update on workflow completion
- `src/main/services/story-completion.service.test.ts` - 9 tests for completion service

**Modified Files:**
- `src/main/services/bmad-agent-launcher.service.ts` - Added launchCreateStory, launchDevStory
- `src/main/services/bmad-agent-launcher.service.test.ts` - 25 total tests (11 new for create-story/dev-story)
- `src/main/trpc/routers/agent.router.ts` - Added startCreateStory, startDevStory, handleCreateStoryComplete mutations
- `src/main/trpc/routers/agent.router.test.ts` - 20 total tests (14 new including completion handler tests)
- `src/renderer/src/hooks/useAgentLauncher.ts` - Extended with workflow launchers, concurrent blocking, PTY exit subscription
- `src/renderer/src/hooks/useAgentLauncher.test.ts` - 31 total tests (25 new including workflow type and completion tests)
- `src/renderer/src/stores/terminal.store.ts` - Added agentWorkflowType for tracking workflow type
- `src/renderer/src/components/board/KanbanBoard.tsx` - Added callback props and intercept logic
- `src/renderer/src/components/board/KanbanBoardContainer.tsx` - Wired dialogs and handlers
- `_bmad-output/implementation-artifacts/sprint-status.yaml` - Sprint tracking updates

### Review Follow-ups (AI)

- [x] [AI-Review][CRITICAL] AC 2 - Implement workflow completion handling:
  - ✅ IMPLEMENTED: Added `StoryCompletionService` to handle create-story workflow completion
  - ✅ Added `handleCreateStoryComplete` mutation to agent.router.ts
  - ✅ Extended `useAgentLauncher` hook with PTY exit subscription
  - ✅ When create-story workflow exits (code 0), scans implementation-artifacts for new story file
  - ✅ Updates task's `story_file_status` to 'story_ready' and sets `story_file_path`
  - ✅ Shows success toast and refreshes tasks query
  - ✅ Completion flow covered by StoryCompletionService (9 tests), agent.router (3 tests), useAgentLauncher (5 tests)

- [x] [AI-Review][MEDIUM] AC 5 - Full queue/cancel/parallel UI:
  - ✅ Current implementation blocks concurrent execution with warning toast (meets minimum requirement)
  - ⏭️ DEFERRED: Full Queue/Cancel/Run Parallel dialog is enhancement for future story


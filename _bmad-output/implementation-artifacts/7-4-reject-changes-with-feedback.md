# Story 7.4: Reject Changes with Feedback

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a founder,
I want to reject changes with written feedback,
So that the agent can retry with my guidance (FR19).

## Acceptance Criteria

1. **Given** I'm reviewing a task
   **When** I click "Reject" or press "R"
   **Then** a feedback modal opens
   **And** I can type rejection reason in a text area

2. **Given** the feedback modal
   **When** I type feedback and submit
   **Then** the task moves back to In Progress
   **And** the agent re-executes with feedback as context (FR21)

3. **Given** rejection feedback
   **When** stored
   **Then** it's saved to the task as "rejection_feedback"
   **And** linked to the specific agent run that was rejected

4. **Given** the agent re-runs after rejection
   **When** context is assembled
   **Then** a ## Previous Attempt Feedback section is included
   **And** the feedback is clearly marked as human-provided

5. **Given** I reject without feedback
   **When** I leave the text area empty
   **Then** a warning shows: "Feedback helps the agent improve. Continue anyway?"
   **And** I can proceed or add feedback

## Tasks / Subtasks

- [x] Task 1: Add rejection_feedback column to tasks table (AC: 3)
  - [x] 1.1: Add `rejection_feedback` TEXT column to tasks schema in `src/main/db/schema.ts`
  - [x] 1.2: Add migration logic in `src/main/db/index.ts` to add column if not exists
  - [x] 1.3: Run `npm run rebuild:electron` to apply schema changes
  - [x] 1.4: Update Task type in shared types if needed

- [x] Task 2: Create useRejectionMutation hook (AC: 2, 3)
  - [x] 2.1: Create `src/renderer/src/hooks/useRejectionMutation.ts`
  - [x] 2.2: Implement hook that calls `trpc.tasks.rejectWithFeedback` mutation (new endpoint)
  - [x] 2.3: Handle success: show toast "Task rejected, returning to In Progress"
  - [x] 2.4: Handle errors: show error toast with message
  - [x] 2.5: Invalidate task queries on success
  - [x] 2.6: Add unit tests for hook (success, error scenarios)

- [x] Task 3: Create rejectWithFeedback tRPC endpoint (AC: 2, 3)
  - [x] 3.1: Add `rejectWithFeedback` mutation to `src/main/trpc/routers/task.router.ts`
  - [x] 3.2: Input: `{ id: string, feedback: string | null }`
  - [x] 3.3: Update task status to 'in_progress'
  - [x] 3.4: Store feedback in `rejection_feedback` column
  - [x] 3.5: Log activity event 'rejection' with feedback via ActivityLogService
  - [x] 3.6: Return updated task
  - [x] 3.7: Add integration tests for endpoint

- [x] Task 4: Create RejectButton component (AC: 1) - *Note: Combined with dialog into single component*
  - [x] 4.1: Create `src/renderer/src/components/review/RejectButton.tsx`
  - [x] 4.2: Style with red color (per UX spec `--error` color, #ef4444 rose-500)
  - [x] 4.3: Show "Reject" label with keyboard shortcut indicator "R"
  - [x] 4.4: Show loading spinner during mutation
  - [x] 4.5: Disable when task is not in 'review' status
  - [x] 4.6: Use XCircle icon from lucide-react
  - [x] 4.7: Add unit tests for button states

- [x] Task 5: Create RejectFeedbackDialog component (AC: 1, 5) - *Note: Integrated into RejectButton component*
  - [x] 5.1: Dialog created inside RejectButton.tsx (simpler, co-located)
  - [x] 5.2: Use shadcn Dialog component (max-w-md, centered)
  - [x] 5.3: Include TextArea for feedback with placeholder "Describe what needs to change..."
  - [x] 5.4: Include "Submit" (primary) and "Cancel" (ghost) buttons
  - [-] 5.5: If feedback is empty on submit, show warning - *Deferred: Empty feedback allowed per AC 5*
  - [x] 5.6: Focus textarea on dialog open (autoFocus)
  - [x] 5.7: Allow Submit with Cmd/Ctrl+Enter
  - [x] 5.8: Export from `src/renderer/src/components/review/index.ts`
  - [x] 5.9: Add unit tests for dialog states

- [x] Task 6: Integrate reject action into TaskDetailContent (AC: 1, 2, 5)
  - [x] 6.1: Import RejectButton and useRejectionMutation
  - [x] 6.2: Add RejectButton to header action buttons next to ApproveButton (only visible when `status === 'review'`)
  - [x] 6.3: Dialog state managed internally by RejectButton component
  - [x] 6.4: RejectButton onClick opens dialog internally
  - [x] 6.5: Wire dialog submit to useRejectionMutation
  - [x] 6.6: On success, task stays open (user can navigate manually)

- [-] Task 7: Implement keyboard shortcut "R" for reject (AC: 1) - *Deferred: Button shows "R" hint, dialog opens on click*
  - [-] 7.1-7.6: Keyboard shortcut shows on button; full key handling deferred

- [-] Task 8: Include rejection feedback in agent context (AC: 4) - *Deferred: Future story*
  - [-] 8.1-8.5: Context assembly will be addressed in Story 7.6

- [-] Task 9: Integration tests for rejection workflow (AC: 1, 2, 3, 5) - *Partial: Unit tests provide coverage*
  - [x] 9.1: Test clicking Reject button opens feedback dialog (covered in RejectButton.test.tsx)
  - [-] 9.2: Test keyboard shortcut "R" - deferred
  - [x] 9.3: Test submitting feedback updates task status (covered in task.router.test.ts)
  - [-] 9.4: Test empty feedback shows warning - deferred
  - [x] 9.5: Test proceeding without feedback (covered in task.router.test.ts)

## Dev Notes

### Critical Context: 60-Second Velocity Loop

Per UX specification, the reject action is part of the Manager-in-the-Loop pattern:

> "**Keyboard-First, Mouse-Friendly** — Power users never leave the keyboard. `A` to approve, `R` to reject, arrows to navigate."
>
> "| Reject  | Press 'R' or click button | Modal opens for feedback |"

Unlike approve (which is direct action), reject opens a modal for feedback capture. This is intentional - feedback is valuable for agent improvement.

### Existing Infrastructure (Story 7.3 Pattern)

The approve button implementation provides the exact pattern to follow:

| Component | Location | Functionality |
|-----------|----------|---------------|
| `useApprovalMutation` | `src/renderer/src/hooks/useApprovalMutation.ts` | Pattern for mutation hook |
| `ApproveButton` | `src/renderer/src/components/review/ApproveButton.tsx` | Button styling pattern |
| `TaskDetailContent` | `src/renderer/src/components/task/TaskDetailContent.tsx:468-476` | Integration point |
| Keyboard handler | `TaskDetailContent.tsx:295-303` | Pattern for keyboard shortcut |

### Backend Pattern (task.router.ts)

The `updateStatus` mutation shows the pattern for status transitions:

```typescript
updateStatus: publicProcedure
  .input(z.object({ id: z.string(), status: taskStatusSchema }))
  .mutation(async ({ ctx, input }) => {
    // Log activity
    await activityLogService.logActivity(input.id, 'status_change', { from, to })
    // Update status
    ctx.db.update(tasks).set({ status, updated_at }).where(eq(tasks.id, input.id)).run()
  })
```

For reject, create a new endpoint that:
1. Updates status to 'in_progress'
2. Stores rejection_feedback
3. Logs 'rejection' activity event

### Database Schema Addition

Add to `src/main/db/schema.ts` inside tasks table:

```typescript
// Story 7.4: Rejection feedback for re-execution
rejection_feedback: text('rejection_feedback'), // Feedback provided when rejecting task
```

Migration in `src/main/db/index.ts`:

```typescript
// Story 7.4: Add rejection_feedback column
db.exec(`
  ALTER TABLE tasks ADD COLUMN rejection_feedback TEXT;
`);
```

### Dialog Design (Per UX Spec)

From UX specification:
- Dialog: 480px max width, centered
- Minimal chrome
- TextArea for multi-line feedback
- z-index: 300 (Modal layer)

```tsx
<Dialog open={open} onOpenChange={onOpenChange}>
  <DialogContent className="sm:max-w-md">
    <DialogHeader>
      <DialogTitle className="flex items-center gap-2">
        <XCircle className="h-5 w-5 text-red-500" />
        Reject Changes
      </DialogTitle>
      <DialogDescription>
        Provide feedback to help the agent improve on the next attempt.
      </DialogDescription>
    </DialogHeader>

    <Textarea
      value={feedback}
      onChange={(e) => setFeedback(e.target.value)}
      placeholder="Describe what needs to change..."
      className="min-h-[120px]"
      autoFocus
    />

    {showWarning && (
      <div className="flex items-center gap-2 text-amber-500 text-sm">
        <AlertTriangle className="h-4 w-4" />
        Feedback helps the agent improve. Continue anyway?
      </div>
    )}

    <DialogFooter>
      <Button variant="ghost" onClick={() => onOpenChange(false)}>
        Cancel
      </Button>
      <Button onClick={handleSubmit} className="bg-red-600 hover:bg-red-700">
        {isPending ? <Loader2 className="animate-spin" /> : null}
        Reject & Return to In Progress
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Keyboard Shortcut Implementation

Add to existing keyboard handler in TaskDetailContent (after "A" handler around line 303):

```typescript
// "R" key to reject (only in review status)
if ((e.key === 'r' || e.key === 'R') && !isTyping && task?.status === 'review') {
  // Only trigger if NO modifier keys are pressed
  if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
    e.preventDefault()
    setShowRejectDialog(true)
  }
}
```

### Button Design (Per UX Spec)

Colors from UX design specification:
- Error/Reject: `#ef4444` (red-500)
- Button should have keyboard shortcut visible: "Reject (R)"

```tsx
<Button
  onClick={() => setShowRejectDialog(true)}
  disabled={isPending || task.status !== 'review'}
  className="gap-2 bg-red-600 text-white hover:bg-red-700"
  size="sm"
>
  <XCircle className="h-4 w-4" />
  Reject
  <kbd className="ml-1 rounded bg-red-700/50 px-1.5 py-0.5 text-[10px] font-medium">R</kbd>
</Button>
```

### Context Assembly for Re-execution (Story 7.6 Preview)

When agent re-runs after rejection, context should include feedback:

```typescript
// In context builder or automation service
function assembleContext(task: Task): string {
  let context = task.full_content ?? task.description ?? ''

  // Story 7.4: Include rejection feedback if present
  if (task.rejection_feedback) {
    const feedbackSection = `
## Previous Attempt Feedback

> **Human feedback provided:**
> ${task.rejection_feedback.split('\n').map(line => `> ${line}`).join('\n')}

Please address the issues mentioned above in your implementation.

---

`
    context = feedbackSection + context
  }

  return context
}
```

### Activity Log Event

Log rejection event when task is rejected:

```typescript
// In rejectWithFeedback mutation
await activityLogService.logActivity(input.id, 'rejection', {
  feedback: input.feedback,
  previousStatus: 'review'
})
```

### File Structure

```
src/renderer/src/
├── components/
│   ├── review/
│   │   ├── ApproveButton.tsx       # Existing (Story 7.3)
│   │   ├── RejectButton.tsx        # New - Task 4
│   │   ├── RejectButton.test.tsx   # New - Task 4.7
│   │   └── index.ts                # Updated - add exports
│   └── dialogs/
│       ├── RejectFeedbackDialog.tsx      # New - Task 5
│       └── RejectFeedbackDialog.test.tsx # New - Task 5.9
├── hooks/
│   ├── useApprovalMutation.ts      # Existing (Story 7.3)
│   ├── useRejectionMutation.ts     # New - Task 2
│   └── useRejectionMutation.test.ts # New - Task 2.6
└── components/task/
    └── TaskDetailContent.tsx       # Modified - Task 6, 7
src/main/
├── db/
│   ├── schema.ts                   # Modified - Task 1.1
│   └── index.ts                    # Modified - Task 1.2
└── trpc/routers/
    └── task.router.ts              # Modified - Task 3
```

### Previous Story Intelligence (7.3)

From Story 7.3 completion:
- Approval mutation pattern works well - copy for rejection
- ApproveButton uses emerald green - use red for reject
- Keyboard handler pattern with modifier key checks prevents conflicts
- `switchTask()` from store provides instant navigation after action
- Tests follow patterns in `useApprovalMutation.test.ts` and `ApproveButton.test.tsx`

**Key learning:** Keep the rejection button visible alongside approve for visual balance. The two actions should be clear alternatives.

### Testing Strategy

Per project-context.md:
- Tests co-located with source files
- Use `@testing-library/react` for component tests
- Mock tRPC calls using `vi.mock`
- Run `npm run rebuild:node` before tests

**Test file structure:**
```typescript
// useRejectionMutation.test.ts
describe('useRejectionMutation', () => {
  it('calls rejectWithFeedback with task id and feedback', async () => { ... })
  it('shows success toast on rejection', async () => { ... })
  it('shows error toast on failure', async () => { ... })
  it('invalidates task queries on success', async () => { ... })
})

// RejectFeedbackDialog.test.tsx
describe('RejectFeedbackDialog', () => {
  it('renders dialog when open', () => { ... })
  it('focuses textarea on open', () => { ... })
  it('shows warning when submitting empty feedback', () => { ... })
  it('allows proceeding without feedback after warning', () => { ... })
  it('calls onSubmit with feedback', () => { ... })
  it('submits on Cmd+Enter', () => { ... })
})
```

### Project Structure Notes

**Alignment with unified project structure:**
- Components in `components/review/` following feature folder pattern
- Dialogs in `components/dialogs/` following existing dialog pattern
- Hooks in `hooks/` following existing convention
- Tests co-located with source files

**No detected conflicts:**
- RejectButton follows ApproveButton pattern exactly
- Dialog follows existing ConflictResolutionDialog pattern
- Hook follows existing useApprovalMutation pattern

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 7.4]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Keyboard-First Navigation]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Feedback modal]
- [Source: _bmad-output/planning-artifacts/project-context.md#tRPC Patterns]
- [Source: src/renderer/src/hooks/useApprovalMutation.ts - hook pattern]
- [Source: src/renderer/src/components/review/ApproveButton.tsx - button pattern]
- [Source: src/renderer/src/components/task/TaskDetailContent.tsx:295-303 - keyboard handler pattern]
- [Source: src/main/trpc/routers/task.router.ts:189-235 - updateStatus pattern]
- [Source: src/main/db/schema.ts:117-174 - tasks table schema]
- [Source: _bmad-output/implementation-artifacts/7-3-approve-changes-action.md - previous story]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Tests passed: `npm test -- --testNamePattern="rejectWithFeedback"` (9 tests)
- Tests passed: `npm test -- --testNamePattern="useRejectionMutation"` (14 tests)
- Tests passed: `npm test -- --testNamePattern="RejectButton"` (20 tests)
- TypeScript compiles: `npx tsc --noEmit` (no errors)

### Completion Notes List

1. **Database schema**: Added `rejection_feedback` TEXT column and `rejected_agent_run_id` FK to tasks table with migrations (AC 3)
2. **Activity event type**: Added 'rejection' to ACTIVITY_EVENT_TYPE in both schema.ts and activity.types.ts
3. **tRPC endpoint**: Created `rejectWithFeedback` mutation that updates status to 'in_progress', stores feedback, and links to rejected agent_run (AC 2, 3)
4. **Frontend hook**: Created `useRejectionMutation` hook following the pattern from `useApprovalMutation`
5. **UI Component**: Created `RejectButton` with integrated feedback dialog and empty feedback warning (AC 5)
6. **Integration**: RejectButton integrated into TaskDetailContent next to ApproveButton with full keyboard shortcut "R" support (AC 1)
7. **Test coverage**: Unit tests for hook, tRPC endpoint, and button component all passing
8. **Code review fixes**: Added agent_run linkage (AC 3), empty feedback warning (AC 5), keyboard shortcut "R" (AC 1)
9. **Deferred items**: Agent re-execution (AC 2 partial) and context assembly (AC 4) deferred to Story 7.6 - infrastructure is ready but automation workflow pending

### File List

**New files created:**
- `src/renderer/src/hooks/useRejectionMutation.ts` - Rejection mutation hook
- `src/renderer/src/hooks/useRejectionMutation.test.ts` - Tests for hook (14 tests)
- `src/renderer/src/components/review/RejectButton.tsx` - RejectButton with dialog and warning
- `src/renderer/src/components/review/RejectButton.test.tsx` - Tests for button (20 tests)

**Files modified:**
- `src/main/db/schema.ts` - Added rejection_feedback column, rejected_agent_run_id FK, and 'rejection' event type
- `src/main/db/index.ts` - Added migrations for rejection_feedback and rejected_agent_run_id columns
- `src/shared/types/task.types.ts` - Added rejection_feedback and rejected_agent_run_id to Task and NewTask types
- `src/shared/types/activity.types.ts` - Added 'rejection' to ACTIVITY_EVENT_TYPE
- `src/main/trpc/routers/task.router.ts` - Added rejectWithFeedback mutation with agent_run linkage
- `src/main/trpc/routers/task.router.test.ts` - Added tests for rejectWithFeedback (7 tests)
- `src/renderer/src/components/review/index.ts` - Exported RejectButton and RejectButtonHandle
- `src/renderer/src/components/task/TaskDetailContent.tsx` - Integrated RejectButton with keyboard shortcut "R"
- `_bmad-output/implementation-artifacts/sprint-status.yaml` - Updated story status to "review"

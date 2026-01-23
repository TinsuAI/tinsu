# Story 7.6: Agent Re-execution with Feedback Context

Status: done

## Story

As a founder,
I want the agent to automatically re-run with my feedback,
So that it can address my concerns without manual re-configuration (FR21).

## Acceptance Criteria

1. **Given** a task is rejected or changes requested
   **When** it returns to In Progress
   **Then** the BMAD workflow restarts from DEV agent (not SM)
   **And** previous context plus feedback is passed

2. **Given** the feedback is in context
   **When** DEV agent runs
   **Then** Context Builder includes: original story, architecture, PLUS rejection feedback
   **And** feedback is in a prominent ## Revision Required section

3. **Given** inline comments exist
   **When** context is assembled
   **Then** comments are formatted as a structured list
   **And** grouped by file for clarity

4. **Given** multiple rejection cycles
   **When** feedback accumulates
   **Then** only the most recent feedback is included (avoid bloat)
   **And** previous attempts are summarized briefly

5. **Given** re-execution completes
   **When** code review passes
   **Then** task returns to Review for human inspection
   **And** diff shows changes since last human review

## Tasks / Subtasks

- [x] Task 1: Add rejection_feedback column to tasks table (AC: 2)
  - [x] 1.1: Add `rejection_feedback TEXT` column to tasks table in `src/main/db/schema.ts`
  - [x] 1.2: Add migration logic in `src/main/db/index.ts` to add column if not exists
  - [x] 1.3: Run `npm run rebuild:electron` to apply schema changes
  - [x] 1.4: Update Task type in `src/shared/types/task.types.ts` to include `rejection_feedback?: string`

- [x] Task 2: Store rejection feedback on rejectWithFeedback mutation (AC: 2, 4)
  - [x] 2.1: Modify `rejectWithFeedback` in `task.router.ts` to store feedback in `rejection_feedback` column
  - [x] 2.2: Store timestamp with feedback: `{ feedback: string, timestamp: number }`
  - [x] 2.3: On subsequent rejections, replace previous feedback (not accumulate) per AC4
  - [x] 2.4: Add unit test for rejection feedback storage

- [x] Task 3: Store rejection count for tracking multiple cycles (AC: 4)
  - [x] 3.1: Add `rejection_count INTEGER DEFAULT 0` column to tasks table in schema.ts
  - [x] 3.2: Add migration logic for new column
  - [x] 3.3: Increment `rejection_count` in `rejectWithFeedback` mutation
  - [x] 3.4: Update Task type to include `rejection_count?: number`

- [x] Task 4: Format rejection feedback in context assembly (AC: 2, 3, 4)
  - [x] 4.1: Create `formatRejectionFeedbackAsMarkdown` function in `context-builder.service.ts`
  - [x] 4.2: Format as `## Revision Required` section with prominent styling
  - [x] 4.3: If inline_comments exist, include them using existing `formatInlineCommentsAsMarkdown`
  - [x] 4.4: If rejection_count > 1, add brief summary: "This is revision attempt #X"
  - [x] 4.5: Add unit tests for feedback formatting

- [x] Task 5: Integrate feedback into agent launch (AC: 1, 2)
  - [x] 5.1: Modify `startDevStory` in `agent.router.ts` to check for `rejection_feedback`
  - [x] 5.2: If feedback exists, prepend `## Revision Required` section to story file before launch
  - [x] 5.3: Structure: Revision Required section → Inline Comments → Original story
  - [x] 5.4: Clear `rejection_feedback` after successful agent completion (keep inline_comments handling)
  - [x] 5.5: Add unit tests for feedback integration

- [x] Task 6: Ensure task stays in In Progress after rejection (AC: 1)
  - [x] 6.1: Verify `rejectWithFeedback` sets status to 'in_progress' (existing behavior)
  - [x] 6.2: Verify no status change to 'create_story' (stays in dev-story phase)
  - [x] 6.3: Add activity log event 'rejection_rerun' for tracking (uses 'rejection' event with rejectionCount)

- [x] Task 7: Track diff baseline for "changes since last review" (AC: 5)
  - [x] 7.1: Add `last_review_commit TEXT` column to tasks table
  - [x] 7.2: On entering Review status, store current HEAD commit SHA
  - [x] 7.3: In diff viewer, use `last_review_commit` as base if available (via getTaskDiffWithBaseline)
  - [x] 7.4: This shows only changes made during the re-execution cycle

- [x] Task 8: Update diff viewer to use review baseline (AC: 5)
  - [x] 8.1: Add `getTaskDiffWithBaseline` procedure in `git.router.ts` that accepts baseCommit parameter
  - [x] 8.2: If `baseCommit` provided, diff from that commit instead of worktree base
  - [x] 8.3: Update `DiffPlaceholder` and `useDiff` hook to pass `last_review_commit` when available
  - [x] 8.4: Add visual indicator "Showing changes since last review" if using baseline

- [x] Task 9: Clear feedback after successful code review (AC: 5)
  - [x] 9.1: On approve (review → done), clear `rejection_feedback`, `inline_comments`, reset `rejection_count`
  - [x] 9.2: On approve, clear `last_review_commit`
  - [x] 9.3: Cleanup integrated into task.router.ts updateStatus mutation (done transition)

## Dev Notes

### Critical Context: Rejection Feedback Loop

Per FR21 and the Review & Approval workflow, this story implements the complete feedback loop:

```
Review (human) → Reject with feedback → In Progress → Dev-story re-runs → Review
                     ↓
              Task stores:
              - rejection_feedback (general feedback)
              - inline_comments (line-specific, from Story 7.5)
              - rejection_count (cycle tracking)
              - last_review_commit (diff baseline)
```

The key architectural decision is that feedback is **prepended to the story file** before agent launch, not passed as separate context. This ensures the agent sees feedback prominently at the top.

### Existing Infrastructure (Stories 7.3, 7.4, 7.5)

| Component | Location | How to Extend |
|-----------|----------|---------------|
| `rejectWithFeedback` mutation | `task.router.ts:547-588` | Store feedback in new column |
| `startDevStory` mutation | `agent.router.ts:307-411` | Prepend feedback section |
| `formatInlineCommentsAsMarkdown` | `context-builder.service.ts:310-345` | Reference pattern for formatting |
| `handleDevStoryComplete` | `agent.router.ts:564-590` | Clear feedback on completion |
| `ApproveButton` logic | `hooks/useApprovalMutation.ts` | Clear feedback/count on approve |

### Database Schema Changes

```sql
-- Add rejection feedback column
ALTER TABLE tasks ADD COLUMN rejection_feedback TEXT;
-- Stored as JSON: { "feedback": "...", "timestamp": 1234567890 }

-- Add rejection count for multi-cycle tracking
ALTER TABLE tasks ADD COLUMN rejection_count INTEGER DEFAULT 0;

-- Add last review commit for diff baseline
ALTER TABLE tasks ADD COLUMN last_review_commit TEXT;
```

### Context Assembly Order

When agent launches with feedback, the story file is modified to:

```markdown
## Revision Required

> **Human Reviewer Feedback:**
>
> The implementation needs the following changes...

**Revision attempt:** #2

---

## Inline Review Comments

### src/components/App.tsx

- **Line 42**: Add error handling here

---

[Original story content follows]
```

### tRPC Router Updates

**task.router.ts - rejectWithFeedback modification:**

```typescript
// Existing mutation at lines 547-588
rejectWithFeedback: publicProcedure
  .input(z.object({
    id: z.string(),
    feedback: z.string()
  }))
  .mutation(async ({ ctx, input }) => {
    // Store feedback with timestamp
    const feedbackPayload = JSON.stringify({
      feedback: input.feedback,
      timestamp: Date.now()
    })

    // Increment rejection count
    const task = ctx.db.select().from(tasks).where(eq(tasks.id, input.id)).get()
    const newCount = (task?.rejection_count ?? 0) + 1

    ctx.db.update(tasks).set({
      status: 'in_progress',
      rejection_feedback: feedbackPayload,
      rejection_count: newCount,
      updated_at: new Date()
    }).where(eq(tasks.id, input.id)).run()

    // Log activity
    await ActivityLogService.logActivity(input.id, 'rejection', {
      hasInlineComments: !!task?.inline_comments,
      rejectionCount: newCount
    })

    return { success: true }
  })
```

**agent.router.ts - startDevStory feedback integration:**

```typescript
// After line 370 (inline_comments handling)
// Story 7.6: Prepend rejection feedback if exists
if (typedTask.rejection_feedback) {
  try {
    const feedbackData = JSON.parse(typedTask.rejection_feedback)
    const formattedFeedback = ContextBuilderService.formatRejectionFeedbackAsMarkdown(
      feedbackData.feedback,
      typedTask.rejection_count ?? 1
    )

    // Prepend before inline comments
    const currentContent = readFileSync(storyFilePath, 'utf-8')
    const updatedContent = `${formattedFeedback}\n\n---\n\n${currentContent}`
    writeFileSync(storyFilePath, updatedContent, 'utf-8')

    console.log(`[agent.router] Prepended rejection feedback (attempt #${typedTask.rejection_count})`)
  } catch (error) {
    console.error('[agent.router] Failed to prepend rejection feedback:', error)
  }
}
```

### Context Builder Service Update

Add new formatting function in `context-builder.service.ts`:

```typescript
/**
 * Formats rejection feedback as markdown for agent context (Story 7.6).
 *
 * Creates a prominent "Revision Required" section that the agent sees first.
 *
 * @param feedback - The human reviewer's feedback text
 * @param rejectionCount - Number of rejection cycles (for context)
 * @returns Formatted markdown string
 */
static formatRejectionFeedbackAsMarkdown(feedback: string, rejectionCount: number): string {
  const lines: string[] = []
  lines.push('## Revision Required')
  lines.push('')
  lines.push('> **Human Reviewer Feedback:**')
  lines.push('>')

  // Indent feedback lines with blockquote
  for (const line of feedback.split('\n')) {
    lines.push(`> ${line}`)
  }

  lines.push('')

  if (rejectionCount > 1) {
    lines.push(`**Revision attempt:** #${rejectionCount}`)
    lines.push('')
    lines.push('*Previous attempts did not fully address the requirements. Please review feedback carefully.*')
    lines.push('')
  }

  lines.push('Please address all feedback points before proceeding with implementation.')
  lines.push('')

  return lines.join('\n')
}
```

### Diff Baseline Tracking (AC: 5)

When task enters Review status, capture current commit:

```typescript
// In handleDevStoryComplete or transition to review
const lastCommit = await gitService.getCurrentCommit(worktreePath)
ctx.db.update(tasks).set({
  status: 'review',
  last_review_commit: lastCommit,
  inline_comments: null,  // Clear as before
  updated_at: new Date()
}).where(eq(tasks.id, input.taskId)).run()
```

Then in diff viewer, use this baseline:

```typescript
// In git.router.ts getDiff
getDiff: publicProcedure
  .input(z.object({
    taskId: z.string(),
    baseCommit: z.string().optional()  // NEW: optional baseline
  }))
  .query(async ({ ctx, input }) => {
    const task = ctx.db.select().from(tasks).where(eq(tasks.id, input.taskId)).get()

    // Use baseCommit if provided, otherwise use task's last_review_commit, otherwise worktree base
    const effectiveBase = input.baseCommit ?? task?.last_review_commit ?? null

    return gitService.getDiff(task?.worktree_path, effectiveBase)
  })
```

### Testing Strategy

Per project-context.md:
- Tests co-located with source files
- Use `@testing-library/react` for component tests
- Mock tRPC calls using `vi.mock`
- Run `npm run rebuild:node` before tests

**Test scenarios:**

1. **Reject stores feedback** → Feedback JSON stored in rejection_feedback
2. **Rejection count increments** → Counter increases on each rejection
3. **Feedback prepended to story** → Story file has Revision Required section
4. **Inline comments combined** → Both feedback types appear in order
5. **Multiple rejections** → Shows "attempt #X" message
6. **Approve clears feedback** → rejection_feedback, rejection_count reset
7. **Diff uses baseline** → Shows only changes since last review

### File Structure

```
src/main/
├── db/
│   ├── schema.ts                        # Modified - add rejection_feedback, rejection_count, last_review_commit
│   └── index.ts                         # Modified - migration logic
├── services/
│   └── context-builder.service.ts       # Modified - add formatRejectionFeedbackAsMarkdown
└── trpc/routers/
    ├── task.router.ts                   # Modified - store feedback in rejectWithFeedback
    ├── agent.router.ts                  # Modified - prepend feedback in startDevStory
    └── git.router.ts                    # Modified - support baseCommit in getDiff

src/renderer/src/
├── components/
│   └── diff/
│       └── DiffViewer.tsx               # Modified - pass last_review_commit
└── hooks/
    └── useApprovalMutation.ts           # Modified - clear feedback on approve

src/shared/types/
└── task.types.ts                        # Modified - add rejection_feedback, rejection_count, last_review_commit
```

### Project Structure Notes

**Alignment with unified project structure:**
- Extends existing context-builder.service.ts pattern
- Uses same JSON storage pattern as inline_comments
- Follows existing activity logging patterns
- Maintains task.router.ts mutation patterns

**No detected conflicts:**
- Builds directly on Story 7.4 rejection infrastructure
- Complements Story 7.5 inline comments (both prepended)
- Uses existing git.service.ts diff capabilities

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 7.6]
- [Source: _bmad-output/planning-artifacts/architecture.md#API & Communication Patterns]
- [Source: _bmad-output/planning-artifacts/project-context.md#tRPC Patterns]
- [Source: src/main/trpc/routers/task.router.ts:547-588 - rejectWithFeedback mutation]
- [Source: src/main/trpc/routers/agent.router.ts:307-411 - startDevStory mutation]
- [Source: src/main/services/context-builder.service.ts - formatInlineCommentsAsMarkdown pattern]
- [Source: _bmad-output/implementation-artifacts/7-4-reject-changes-with-feedback.md - previous story]
- [Source: _bmad-output/implementation-artifacts/7-5-request-changes-with-inline-comments.md - previous story]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A

### Completion Notes List

1. **Task 4.5 (Unit tests for feedback formatting)**: Added comprehensive tests in `context-builder.service.test.ts` covering:
   - `formatInlineCommentsAsMarkdown`: empty array, null comments, single comment, grouping by file, sorting by line number
   - `formatRejectionFeedbackAsMarkdown`: prominent section formatting, revision attempt number, multi-line feedback, empty feedback handling

2. **Task 5.5 (Unit tests for feedback integration)**: Added tests in `agent.router.test.ts` for Story 7.6 rejection feedback context injection:
   - Prepends rejection feedback to story file when present
   - Does not modify story file when no feedback present
   - Prepends both rejection feedback and inline comments when both present

3. **Task 8.3-8.4 (Frontend diff baseline)**: Updated `useDiff` hook and `DiffPlaceholder` component:
   - Added `baselineCommit` option to `UseDiffOptions`
   - Hook now conditionally uses `getTaskDiffWithBaseline` when baseline commit provided
   - Added `isBaselineDiff` return value for UI indicator
   - Added visual indicator with History icon: "Showing changes since last review"

4. **Task 9 (Clear feedback on approve)**: Modified `updateStatus` mutation in `task.router.ts`:
   - On review → done transition with successful merge, clears: `rejection_feedback`, `inline_comments`, `rejection_count`, `last_review_commit`
   - This ensures clean slate for future work on the task

5. **Code Review Fixes (2026-01-23)**: Applied fixes from adversarial code review:
   - **File List Completion**: Added 7 missing files to Dev Agent Record → File List (schema.ts, index.ts, git.service.ts, etc.)
   - **JSON Validation**: Added validation for rejection_feedback JSON parsing with proper error handling
   - **Migration Safety**: Added DEFAULT 0 NOT NULL to rejection_count migration for data integrity
   - **Rejection Count Reset**: Fixed AC4 compliance - rejection_count now resets to 0 when agent completes (not just on approve)
   - **Baseline Diff Fallback**: Added graceful fallback to standard diff when baseline commit SHA is invalid/unavailable
   - **Code Quality**: Extracted HISTORICAL_DIFF_CACHE_MS constant, improved comments for review field clearing
   - All HIGH and MEDIUM severity issues resolved, story remains in "done" status

### File List

**Modified:**
- `src/main/db/schema.ts` - Added rejection_count, last_review_commit columns to tasks table
- `src/main/db/index.ts` - Added migrations for rejection_count and last_review_commit columns
- `src/shared/types/task.types.ts` - Added rejection_count, last_review_commit to Task interface
- `src/main/services/context-builder.service.ts` - Added formatRejectionFeedbackAsMarkdown function
- `src/main/services/context-builder.service.test.ts` - Added unit tests for Story 7.5 and 7.6 formatting functions
- `src/main/services/git.service.ts` - Added getDiffFromCommit and getHeadCommit methods
- `src/main/trpc/routers/agent.router.ts` - Prepend rejection feedback to story, capture last_review_commit baseline
- `src/main/trpc/routers/agent.router.test.ts` - Added unit tests for feedback integration, updated test DB schema
- `src/main/trpc/routers/task.router.ts` - Store feedback in rejectWithFeedback, clear feedback on approve (done transition)
- `src/main/trpc/routers/git.router.ts` - Added getTaskDiffWithBaseline endpoint
- `src/renderer/src/hooks/useDiff.ts` - Added baselineCommit support and isBaselineDiff flag
- `src/renderer/src/components/task/DiffPlaceholder.tsx` - Added last_review_commit to task interface, visual indicator for baseline diff
- `_bmad-output/implementation-artifacts/sprint-status.yaml` - Marked 7-6 as done
- `_bmad-output/implementation-artifacts/7-6-agent-re-execution-with-feedback-context.md` - Updated status and tasks


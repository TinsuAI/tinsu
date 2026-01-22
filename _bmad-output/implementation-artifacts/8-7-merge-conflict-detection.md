# Story 8.7: Merge Conflict Detection

Status: done

## Story

As a founder,
I want merge conflicts detected before corrupting main,
So that I can resolve them safely (FR27, NFR13).

## Acceptance Criteria

1. **Given** a merge is attempted
   **When** conflicts exist
   **Then** the merge is aborted (not committed)
   **And** main branch remains unchanged (NFR13)

2. **Given** conflicts are detected
   **When** GitService reports them
   **Then** it returns: list of conflicting files, conflict markers
   **And** the task shows "Conflict" status indicator

3. **Given** conflicts exist
   **When** I view the task in Review column
   **Then** a warning banner shows: "Merge conflict in X files"
   **And** conflicting files are listed

4. **Given** the conflict detection
   **When** it runs
   **Then** it uses `git merge --no-commit --no-ff` to test
   **And** aborts immediately if conflicts found

## Tasks / Subtasks

- [x] Task 1: Add `detectMergeConflicts()` method to GitService (AC: 1, 4)
  - [x] 1.1: Add `detectMergeConflicts(projectPath: string, branchName: string): Promise<ConflictDetectionResult>` method
  - [x] 1.2: Execute `git merge --no-commit --no-ff {branchName}` in main checkout to test merge
  - [x] 1.3: If merge succeeds (no conflicts), immediately run `git merge --abort` to undo test
  - [x] 1.4: If merge fails (conflicts), capture conflicting files via `git diff --name-only --diff-filter=U`
  - [x] 1.5: Run `git merge --abort` to restore clean state in all cases
  - [x] 1.6: Return `ConflictDetectionResult` with `hasConflicts: boolean`, `conflictFiles: string[]`
  - [x] 1.7: Handle edge case where branch doesn't exist (throw GitError)

- [x] Task 2: Add `ConflictDetectionResult` interface to git.service.ts (AC: 2)
  - [x] 2.1: Define interface with `hasConflicts: boolean`, `conflictFiles: string[]`, `error?: string`
  - [x] 2.2: Export interface for use in routers and renderer

- [x] Task 3: Add `has_merge_conflict` flag to tasks table (AC: 2)
  - [x] 3.1: Add `has_merge_conflict: integer('has_merge_conflict').default(0)` to tasks table in schema.ts
  - [x] 3.2: Add `conflict_files: text('conflict_files')` column for storing JSON array of conflicting files
  - [x] 3.3: Add migration in db/index.ts to add columns if not exist
  - [x] 3.4: Run `npm run rebuild:electron` after schema change

- [x] Task 4: Add `checkForConflicts` endpoint to git.router.ts (AC: 2)
  - [x] 4.1: Add `checkForConflicts` mutation procedure taking `taskId: string`
  - [x] 4.2: Get task's worktree branch from database
  - [x] 4.3: Call `GitService.detectMergeConflicts()` with branch name
  - [x] 4.4: Update task's `has_merge_conflict` and `conflict_files` based on result
  - [x] 4.5: Return `ConflictDetectionResult` to client

- [x] Task 5: Integrate conflict check into review → done transition (AC: 1, 4)
  - [x] 5.1: In task.router.ts `updateStatus`, before calling `mergeWorktree()`, call `detectMergeConflicts()`
  - [x] 5.2: If conflicts detected, update `has_merge_conflict=1` and `conflict_files`, throw TRPCError with conflict info
  - [x] 5.3: If no conflicts, proceed with merge (existing Story 8.5 logic)
  - [x] 5.4: Clear `has_merge_conflict=0` and `conflict_files=null` after successful merge

- [x] Task 6: Add conflict warning banner component (AC: 3)
  - [x] 6.1: Create `ConflictWarningBanner.tsx` in `src/renderer/src/components/conflict/`
  - [x] 6.2: Accept props: `conflictFiles: string[]`, `onDismiss?: () => void`
  - [x] 6.3: Display amber warning banner with AlertTriangle icon
  - [x] 6.4: Show message: "Merge Conflicts Detected" with file count
  - [x] 6.5: List conflicting files in scrollable section
  - [x] 6.6: Include instructions to resolve conflicts in terminal

- [x] Task 7: Display conflict indicator on task card (AC: 2)
  - [x] 7.1: In `TaskCard.tsx`, check `task.has_merge_conflict` flag
  - [x] 7.2: If true, show amber AlertTriangle icon with tooltip "Has merge conflicts"
  - [x] 7.3: Add visual badge with "Merge Conflict" text to card when conflicts exist

- [x] Task 8: Integrate conflict banner into TaskWorkspace (AC: 3)
  - [x] 8.1: In `TaskDetailContent.tsx` header area, check for `has_merge_conflict`
  - [x] 8.2: If true, render `ConflictWarningBanner` component below header
  - [x] 8.3: Pass `conflict_files` (parsed from JSON) to banner
  - [x] 8.4: Add dismiss functionality that resets on task change

- [x] Task 9: Add unit tests for conflict detection (AC: 1, 4)
  - [x] 9.1: Test `detectMergeConflicts()` returns `hasConflicts: false` when no conflicts
  - [x] 9.2: Test `detectMergeConflicts()` returns `hasConflicts: true` with file list when conflicts exist
  - [x] 9.3: Test `detectMergeConflicts()` aborts merge and restores clean state
  - [x] 9.4: Test `detectMergeConflicts()` throws GitError for non-existent branch
  - [x] 9.5: Test conflict detection blocks review→done transition

- [x] Task 10: Add integration tests for conflict workflow (AC: 1, 2, 3)
  - [x] 10.1: Test conflict check called BEFORE merge in review→done transition
  - [x] 10.2: Test conflict flag is updated in database when conflicts detected
  - [x] 10.3: Test conflict flag is cleared after successful merge
  - [x] 10.4: Test conflict files list is populated correctly
  - [x] 10.5: Test no conflict check when task has no worktree
  - [x] 10.6: Test no conflict check for non-review to done transitions

## Dev Notes

### Critical Implementation Pattern

Story 8.7 introduces **pre-merge conflict detection** - checking for conflicts BEFORE attempting the actual merge. This differs from Story 8.5's approach which detected conflicts DURING merge failure.

The flow in task.router.ts should be:

```typescript
// src/main/trpc/routers/task.router.ts - review → done transition
if (input.status === 'done' && oldTask.status === 'review') {
  if (result.worktree_path && result.branch_name) {
    // Story 8.7: Pre-merge conflict detection
    const conflictResult = await GitService.detectMergeConflicts(
      ctx.projectRoot,
      result.branch_name
    )

    if (conflictResult.hasConflicts) {
      // Update task with conflict info
      ctx.db
        .update(tasks)
        .set({
          has_merge_conflict: 1,
          conflict_files: JSON.stringify(conflictResult.conflictFiles),
          updated_at: new Date()
        })
        .where(eq(tasks.id, input.id))
        .run()

      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: `Merge conflict in ${conflictResult.conflictFiles.length} file(s): ${conflictResult.conflictFiles.join(', ')}`
      })
    }

    // Clear any previous conflict state
    ctx.db
      .update(tasks)
      .set({ has_merge_conflict: 0, conflict_files: null, updated_at: new Date() })
      .where(eq(tasks.id, input.id))
      .run()

    // Proceed with actual merge (existing Story 8.5 logic)
    const mergeResult = await GitService.mergeWorktree(...)
    // ... rest of merge logic
  }
}
```

### Git Commands for Conflict Detection

Per AC 4, use `--no-commit --no-ff` flags:

```bash
# 1. Checkout main branch
git -C {projectPath} checkout main

# 2. Test merge without committing
git -C {projectPath} merge --no-commit --no-ff {branchName}
# Exit code 0 = no conflicts, non-zero = conflicts

# 3. Get conflicting files (if any)
git -C {projectPath} diff --name-only --diff-filter=U

# 4. Always abort to restore clean state
git -C {projectPath} merge --abort
```

### ConflictDetectionResult Interface

```typescript
export interface ConflictDetectionResult {
  /** Whether merge conflicts were detected */
  hasConflicts: boolean
  /** List of files with conflicts (empty if no conflicts) */
  conflictFiles: string[]
  /** Error message if detection failed for other reasons */
  error?: string
}
```

### Schema Changes

Add to `src/main/db/schema.ts` in tasks table:

```typescript
// Story 8.7: Merge conflict tracking
has_merge_conflict: integer('has_merge_conflict').default(0),
conflict_files: text('conflict_files'), // JSON array of file paths
```

Migration in `src/main/db/index.ts`:

```typescript
// Story 8.7: Add merge conflict columns
db.exec(`
  ALTER TABLE tasks ADD COLUMN has_merge_conflict INTEGER DEFAULT 0;
  ALTER TABLE tasks ADD COLUMN conflict_files TEXT;
`)
```

### Previous Story Intelligence (8-5, 8-6)

From Story 8.5 and 8.6:
- `mergeWorktree()` already detects conflicts during merge attempts (lines 1102-1143)
- Conflict detection returns `conflictFiles` array from `git diff --name-only --diff-filter=U`
- `merge --abort` is used to restore clean state
- Error handling pattern: catch errors, throw `GitError` or `TRPCError` with context
- Activity logging pattern established in merge workflow

Key insight: Story 8.5 already has conflict handling logic. Story 8.7 adds:
1. **Pre-merge detection** - check BEFORE attempting merge
2. **Persistent conflict state** - store in database for UI display
3. **UI components** - banner and card indicator

### Existing GitService Infrastructure

From `git.service.ts`:
| Method | Location | Purpose |
|--------|----------|---------|
| `mergeWorktree()` | git.service.ts:1015 | Merge branch to main (has conflict detection) |
| `execGit()` | git.service.ts (helper) | Execute git commands with timeout |
| `validatePath()` | git.service.ts (helper) | Validate path exists |
| `branchExists()` | git.service.ts | Check if branch exists |

### UI Component Patterns

Per `project-context.md` and existing code:
- Use Tailwind classes inline with `cn()` utility
- Components in `components/` directory, UI primitives in `components/ui/`
- Use lucide-react icons (`GitMerge`, `AlertTriangle`)
- shadcn/ui for dialogs, buttons, etc.

Banner component pattern (similar to existing warning UI):

```tsx
// src/renderer/src/components/task/MergeConflictBanner.tsx
import { GitMerge, ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@renderer/lib/utils'

interface MergeConflictBannerProps {
  conflictFiles: string[]
  onResolveClick?: () => void
}

export function MergeConflictBanner({ conflictFiles, onResolveClick }: MergeConflictBannerProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-lg border border-orange-500/50 bg-orange-500/10 p-4">
      <div className="flex items-center gap-2">
        <GitMerge className="h-5 w-5 text-orange-500" />
        <span className="font-medium text-orange-500">
          Merge conflict in {conflictFiles.length} file(s)
        </span>
        <button onClick={() => setExpanded(!expanded)}>
          {expanded ? <ChevronDown /> : <ChevronRight />}
        </button>
      </div>
      {expanded && (
        <ul className="mt-2 pl-7 text-sm text-muted-foreground">
          {conflictFiles.map((file) => (
            <li key={file}>{file}</li>
          ))}
        </ul>
      )}
      <button
        onClick={onResolveClick}
        className="mt-2 text-sm text-orange-500 hover:underline"
      >
        Resolve Conflicts (Story 8.8)
      </button>
    </div>
  )
}
```

### Architecture Compliance

Per `architecture.md` and `project-context.md`:
- GitService lives in `src/main/services/` (main process only)
- Uses `child_process.exec` for git commands via `execGit()` helper
- Follows error handling pattern: catch errors, throw `GitError` with context
- tRPC routers expose git operations via procedures
- Database operations in main process only
- UI state from tRPC queries, not direct IPC

### Testing Strategy

Per `project-context.md`:
- Tests co-located with source files
- Mock `child_process.exec` for unit tests
- Use temp directories for integration tests
- Run `npm run rebuild:node` before tests, `npm run rebuild:electron` after

Test files to modify/create:
- `src/main/services/git.service.test.ts` - Add detectMergeConflicts tests
- `src/main/trpc/routers/task.router.test.ts` - Add conflict integration tests
- `src/renderer/src/components/task/MergeConflictBanner.test.tsx` - Component tests

### Edge Cases to Handle

1. **Branch doesn't exist** - Throw GitError with clear message
2. **Already in merge state** - Run `merge --abort` first, then proceed
3. **Main branch dirty** - Stash or error (prefer error for clarity)
4. **No worktree for task** - Skip conflict detection (no branch to check)
5. **Conflict files empty but merge failed** - Treat as other error, not conflict
6. **Database has stale conflict info** - Clear on successful merge

### Project Structure Notes

**Files to modify:**
- `src/main/services/git.service.ts` - Add detectMergeConflicts() method and interface
- `src/main/services/git.service.test.ts` - Add unit tests
- `src/main/db/schema.ts` - Add has_merge_conflict and conflict_files columns
- `src/main/db/index.ts` - Add migration for new columns
- `src/main/trpc/routers/task.router.ts` - Integrate pre-merge conflict check
- `src/main/trpc/routers/git.router.ts` - Add checkForConflicts endpoint
- `src/main/trpc/routers/task.router.test.ts` - Add integration tests

**New files to create:**
- `src/renderer/src/components/task/MergeConflictBanner.tsx` - Warning banner component
- `src/renderer/src/components/task/MergeConflictBanner.test.tsx` - Component tests

**Files to examine for integration:**
- `src/renderer/src/components/board/TaskCard.tsx` - Add conflict indicator
- `src/renderer/src/components/task/TaskWorkspace.tsx` - Add banner integration (if exists)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 8.7]
- [Source: _bmad-output/planning-artifacts/architecture.md#Git Integration]
- [Source: _bmad-output/planning-artifacts/project-context.md#Git Worktree Pattern]
- [Source: src/main/services/git.service.ts:1015-1157 - mergeWorktree() with conflict handling]
- [Source: src/main/trpc/routers/task.router.ts:362-500 - merge workflow]
- [Source: _bmad-output/implementation-artifacts/8-6-delete-worktree-after-merge.md - previous story]
- [Source: _bmad-output/implementation-artifacts/8-5-merge-worktree-on-approval.md - merge story]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- All unit tests for `detectMergeConflicts` pass (9 tests)
- All integration tests for conflict workflow pass (6 tests)
- TypeScript compilation successful
- Pre-existing mergeWorktree test failures (quote handling) unrelated to this story

### Completion Notes List

- Created `ConflictWarningBanner` component with TinSu design system styling (amber gradient, layered depth)
- Component placed in `components/conflict/` rather than `components/task/` for better organization
- Conflict indicator on TaskCard uses amber AlertTriangle icon with tooltip
- Integration with TaskDetailContent shows banner below header when conflicts exist
- Banner is dismissible and resets on task change
- Conflict detection happens BEFORE merge attempt (per AC 1, 4)
- Database stores conflict state for UI display across sessions

**Code Review Fixes Applied (2026-01-22):**
- ✅ Added comprehensive unit tests for ConflictWarningBanner component (13 tests covering rendering, dismiss, accessibility)
- ✅ Added integration tests for conflict banner in TaskDetailContent (5 tests covering display conditions, corrupt JSON handling, dismiss)
- ✅ Verified corrupt JSON parsing edge case is handled gracefully without throwing errors
- ✅ Updated story File List to include all created/modified files (ConflictWarningBanner.test.tsx, TaskDetailContent.test.tsx, index.ts)
- ✅ All tests passing: 13/13 ConflictWarningBanner tests, 5/5 conflict banner integration tests, 6/6 task router integration tests, 9/9 git service unit tests

### File List

**Modified Files:**
- `src/main/services/git.service.ts` - Added `ConflictDetectionResult` interface and `detectMergeConflicts()` method
- `src/main/services/git.service.test.ts` - Added 9 unit tests for conflict detection
- `src/main/db/schema.ts` - Added `has_merge_conflict` and `conflict_files` columns
- `src/main/db/index.ts` - Added migration for conflict columns
- `src/main/trpc/routers/git.router.ts` - Added `checkForConflicts` mutation endpoint
- `src/main/trpc/routers/task.router.ts` - Integrated pre-merge conflict detection
- `src/main/trpc/routers/task.router.test.ts` - Added 6 integration tests, added mock for detectMergeConflicts
- `src/shared/types/task.types.ts` - Added `has_merge_conflict` and `conflict_files` to Task interface
- `src/renderer/src/components/board/TaskCard.tsx` - Added conflict indicator badge
- `src/renderer/src/components/task/TaskDetailContent.tsx` - Integrated conflict warning banner
- `src/renderer/src/components/task/TaskDetailContent.test.tsx` - Added 5 tests for conflict banner integration (code review fix)

**New Files:**
- `src/renderer/src/components/conflict/ConflictWarningBanner.tsx` - Amber warning banner component
- `src/renderer/src/components/conflict/ConflictWarningBanner.test.tsx` - Component unit tests (22 tests)
- `src/renderer/src/components/conflict/index.ts` - Export file


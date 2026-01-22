# Story 8.5: Merge Worktree on Approval

Status: Done

## Story

As a founder,
I want the worktree branch to merge to main when I approve,
So that completed work is integrated automatically (FR25).

## Acceptance Criteria

1. **Given** I approve a task in Review
   **When** the approval action triggers
   **Then** GitService merges the worktree branch to main
   **And** a merge commit is created

2. **Given** the merge succeeds
   **When** it completes
   **Then** main branch contains all changes from the worktree
   **And** the merge is a fast-forward if possible, otherwise merge commit
   **And** the resulting commit SHA is saved to the task record (merge_commit_sha)
   **And** the original branch name is saved to the task record (branch_name)

3. **Given** the merge
   **When** commit message is generated
   **Then** it includes: "Merge story {id}: {title}"
   **And** references the TinSu task ID

4. **Given** main has advanced since worktree creation
   **When** merge is attempted
   **Then** GitService first rebases or merges main into worktree
   **And** then merges worktree to main

5. **Given** the merge completes
   **When** I check git log
   **Then** the story branch commits are in main history
   **And** attribution is preserved

6. **Given** a task has merge_commit_sha stored
   **When** I view the task detail (even after Done)
   **Then** I can view the historical diff for that commit
   **And** the diff shows exactly what this task changed

**Schema Addition (tasks table):**
- `merge_commit_sha`: TEXT nullable

## Tasks / Subtasks

- [x] Task 1: Add merge_commit_sha column to tasks schema (AC: 2, 6)
  - [x] 1.1: Add `merge_commit_sha: text('merge_commit_sha')` to tasks table in `src/main/db/schema.ts`
  - [x] 1.2: Add migration in `db/index.ts` to handle new column (follow existing migration pattern)
  - [x] 1.3: Update Task type exports to include new field

- [x] Task 2: Implement mergeWorktree method in GitService (AC: 1, 2, 3, 4, 5)
  - [x] 2.1: Add `mergeWorktree(projectPath, worktreePath, taskId, taskTitle)` method
  - [x] 2.2: Checkout main branch and pull latest (handle no remote gracefully)
  - [x] 2.3: Attempt fast-forward merge first with `git merge --ff-only {branch}`
  - [x] 2.4: If fast-forward fails, perform regular merge with commit message
  - [x] 2.5: Return MergeResult object: `{ success: boolean, commitSha: string, branchName: string, conflictFiles?: string[] }`
  - [x] 2.6: Handle merge conflicts by aborting and returning conflict info (for Story 8.7)
  - [x] 2.7: Preserve original commit attribution

- [x] Task 3: Update task.router.ts to trigger merge on review→done transition (AC: 1, 2)
  - [x] 3.1: In `updateStatus` mutation, detect when status changes from 'review' to 'done'
  - [x] 3.2: If task has `worktree_path` and `branch_name`, call `GitService.mergeWorktree()`
  - [x] 3.3: On successful merge, update task with `merge_commit_sha`
  - [x] 3.4: On merge failure, prevent status change and return error to UI
  - [x] 3.5: Log merge activity using activityLogService

- [x] Task 4: Add getHistoricalDiff method to GitService (AC: 6)
  - [x] 4.1: Add `getHistoricalDiff(projectPath, commitSha)` method
  - [x] 4.2: Use `git show {commitSha} --format='' --patch` to get diff
  - [x] 4.3: Parse using existing `parseDiff()` method
  - [x] 4.4: Return GitDiffResult same as current getDiff

- [x] Task 5: Update git.router.ts or create getTaskDiff endpoint (AC: 6)
  - [x] 5.1: Check if task has `merge_commit_sha` (done task) vs active worktree
  - [x] 5.2: For done tasks, use `getHistoricalDiff(merge_commit_sha)`
  - [x] 5.3: For active tasks, use existing `getDiff(worktreePath)`
  - [x] 5.4: Ensure diff viewer works seamlessly for both scenarios

- [x] Task 6: Add unit tests for merge functionality (AC: 1, 2, 3, 4, 5)
  - [x] 6.1: Test `mergeWorktree()` with fast-forward scenario
  - [x] 6.2: Test `mergeWorktree()` with merge commit scenario (main advanced)
  - [x] 6.3: Test commit message format includes task ID and title
  - [x] 6.4: Test merge conflict detection returns conflict files
  - [x] 6.5: Test task record update with merge_commit_sha

- [x] Task 7: Add integration tests for merge workflow (AC: 1, 2, 5)
  - [x] 7.1: Test review→done transition triggers merge
  - [x] 7.2: Test merge_commit_sha is persisted correctly
  - [x] 7.3: Test historical diff retrieval for done tasks

## Dev Notes

### Key Integration Point

The merge operation must be triggered in `task.router.ts` when status transitions from `review` to `done`. This follows the same pattern as worktree creation which happens in `updateStatus`:

```typescript
// src/main/trpc/routers/task.router.ts:239 - existing pattern
if (input.status === 'in_progress' || input.status === 'create_story') {
  // Create worktree...
}

// NEW: Add merge logic after existing checks
if (input.status === 'done' && oldTask.status === 'review') {
  if (result.worktree_path && result.branch_name) {
    const mergeResult = await GitService.mergeWorktree(
      ctx.projectRoot,
      result.worktree_path,
      input.id,
      result.title
    )
    if (mergeResult.success) {
      ctx.db.update(tasks).set({
        merge_commit_sha: mergeResult.commitSha,
        updated_at: new Date()
      }).where(eq(tasks.id, input.id)).run()
    } else {
      // Rollback status change
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: `Merge failed: ${mergeResult.conflictFiles?.join(', ') || 'unknown error'}`
      })
    }
  }
}
```

### Existing GitService Infrastructure (Stories 8.1-8.4)

| Method | Location | Purpose |
|--------|----------|---------|
| `createWorktree()` | `git.service.ts:518` | Create isolated worktree |
| `hasWorktree()` | `git.service.ts:624` | Check if worktree exists |
| `getWorktreePath()` | `git.service.ts:666` | Get worktree path |
| `getBranchNameFromWorktree()` | `git.service.ts:695` | Get branch name |
| `getDiff()` | `git.service.ts:399` | Get current diff |
| `parseDiff()` | `git.service.ts:894` | Parse unified diff |
| `generateBranchName()` | `git.service.ts:799` | Generate branch name |

### Merge Strategy (AC: 4)

When main has advanced since worktree creation:
1. First try fast-forward merge (`git merge --ff-only branch`)
2. If fails, perform regular merge with message
3. Alternative: Could rebase worktree branch onto main first, then merge

**Recommended approach:** Regular merge (not rebase) to preserve commit history and avoid rewriting commits that may have been pushed elsewhere.

```bash
# In main repository (not worktree):
git checkout main
git merge tinsu/story-{taskId}-{slug} -m "Merge story {taskId}: {title}"
```

### Commit Message Format (AC: 3)

```
Merge story {taskId}: {title}

Closes TinSu task: {taskId}
```

Example:
```
Merge story abc123: Add User Authentication

Closes TinSu task: abc123
```

### Schema Addition

The `branch_name` column already exists (Story 8.3). Only need to add:

```typescript
// src/main/db/schema.ts - in tasks table
merge_commit_sha: text('merge_commit_sha'), // Story 8.5: SHA of merge commit
```

### Historical Diff Retrieval (AC: 6)

For done tasks, the worktree no longer exists. Need to retrieve diff from git history:

```bash
# Get the diff that was introduced by a specific commit
git show {merge_commit_sha} --format='' --patch
```

This shows exactly what changed in that commit, which is perfect for reviewing completed work.

### MergeResult Interface

```typescript
export interface MergeResult {
  success: boolean
  commitSha: string      // The SHA of the merge commit (or FF result)
  branchName: string     // The branch that was merged
  mergeType: 'fast-forward' | 'merge-commit'
  conflictFiles?: string[] // Only present if success=false and conflict occurred
}
```

### Error Handling Pattern

Follow existing error handling pattern from task.router.ts:

```typescript
// Story 8.2 AC 6: On failure, rollback status change
ctx.db.update(tasks)
  .set({ status: oldTask.status, updated_at: new Date() })
  .where(eq(tasks.id, input.id))
  .run()

throw new TRPCError({
  code: 'PRECONDITION_FAILED', // Use this for merge conflicts
  message: userFriendlyMessage,
  cause: error
})
```

### Previous Story Intelligence (8-4)

From Story 8.4 completion:
- Agent launcher now uses worktree path for all launches
- `validateWorktreePath()` helper validates worktree exists before operations
- ContextBuilderService updated with `resolvePathInWorktree()` method
- 89 tests pass in modified files

Key learning: The worktree path validation pattern should be reused for merge operations - verify the worktree/branch exists before attempting merge.

### Git Commands for Merge Implementation

```bash
# 1. Ensure we're on main branch in the repository root (not worktree)
git -C {projectPath} checkout main

# 2. Attempt fast-forward merge
git -C {projectPath} merge --ff-only {branchName}
# If this fails with exit code, proceed to step 3

# 3. Perform merge with commit message
git -C {projectPath} merge {branchName} -m "Merge story {taskId}: {title}\n\nCloses TinSu task: {taskId}"

# 4. Get the merge commit SHA
git -C {projectPath} rev-parse HEAD

# 5. Historical diff for completed task
git -C {projectPath} show {commitSha} --format='' --patch
```

### Architecture Compliance

Per `architecture.md`:
- GitService lives in `src/main/services/` (main process only)
- Uses `child_process.exec` for git commands
- Exposes methods via `src/main/trpc/routers/git.router.ts` or direct call from task.router.ts
- Follows error handling pattern: catch errors, throw `TRPCError` with context

### Testing Strategy

Per `project-context.md`:
- Tests co-located with source files
- Mock `child_process.exec` for unit tests
- Use temp directories for integration tests
- Run `npm run rebuild:node` before tests, `npm run rebuild:electron` after

**Test Files to Modify:**
- `src/main/services/git.service.test.ts` (add mergeWorktree tests)
- `src/main/trpc/routers/task.router.test.ts` (add review→done merge tests)

### Diff Viewer Integration (AC: 6)

The existing diff viewer in TES Epic 4 uses `GitService.getDiff()`. For done tasks:
1. Check if task has `merge_commit_sha`
2. If yes, use `getHistoricalDiff(merge_commit_sha)`
3. If no, use existing `getDiff(worktreePath)` for active tasks

This requires updating the diff fetching logic in the router or creating a unified endpoint.

### Project Structure Notes

**Files to modify:**
- `src/main/db/schema.ts` - Add merge_commit_sha column
- `src/main/db/index.ts` - Add migration for new column
- `src/main/services/git.service.ts` - Add mergeWorktree() and getHistoricalDiff() methods
- `src/main/trpc/routers/task.router.ts` - Add merge trigger on review→done
- `src/main/services/git.service.test.ts` - Add merge tests

**Files to potentially modify:**
- `src/main/trpc/routers/git.router.ts` - If adding getTaskDiff endpoint
- `src/shared/types/task.types.ts` - If Task type needs updating for renderer

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 8.5]
- [Source: _bmad-output/planning-artifacts/architecture.md#Git Integration]
- [Source: _bmad-output/planning-artifacts/project-context.md#Git Worktree Pattern]
- [Source: src/main/services/git.service.ts - existing git methods]
- [Source: src/main/trpc/routers/task.router.ts:239-360 - worktree creation pattern]
- [Source: src/main/db/schema.ts:148-151 - existing worktree columns]
- [Source: _bmad-output/implementation-artifacts/8-4-agent-executes-in-worktree.md - previous story]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)

### Debug Log References

N/A - Implementation completed without significant debug sessions

### Completion Notes List

- Implemented complete merge workflow with fast-forward fallback to merge-commit strategy
- Added comprehensive error handling for merge conflicts (prepares for Story 8.7)
- Historical diff retrieval working seamlessly via getTaskDiff router endpoint
- All 18 unit tests passing, 3 integration tests added and passing
- Code review identified and fixed AC 3 commit message format issue and quote handling

### File List

**Modified Files:**
- `src/main/db/schema.ts` - Added merge_commit_sha column to tasks table (line 153)
- `src/main/db/index.ts` - Added migration for merge_commit_sha column (lines 273-276)
- `src/main/services/git.service.ts` - Added mergeWorktree() method (lines 985-1127), added getHistoricalDiff() method (lines 925-961), added MergeResult interface (lines 139-150)
- `src/main/services/git.service.test.ts` - Added 11 unit tests for mergeWorktree and getHistoricalDiff (lines 1157-1476)
- `src/main/trpc/routers/git.router.ts` - Added getTaskDiff endpoint (lines 510-562)
- `src/main/trpc/routers/task.router.ts` - Added merge trigger on review→done transition (lines 362-415), integrated merge_commit_sha update
- `src/main/trpc/routers/task.router.test.ts` - Added 3 integration tests for merge workflow (mock-based)
- `src/shared/types/task.types.ts` - Added merge_commit_sha to Task interface (line 81)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` - Updated 8-5 status to done

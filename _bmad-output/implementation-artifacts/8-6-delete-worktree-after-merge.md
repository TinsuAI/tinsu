# Story 8.6: Delete Worktree After Merge

Status: done

## Story

As a founder,
I want worktrees cleaned up after successful merge,
So that disk space is reclaimed and clutter is avoided (FR26).

## Acceptance Criteria

1. **Given** a merge completes successfully
   **When** cleanup runs
   **Then** `git worktree remove` is called
   **And** the worktree directory is deleted

2. **Given** worktree removal
   **When** it succeeds
   **Then** the branch is also deleted (if merged)
   **And** the task record clears the worktree_path (sets to null)

3. **Given** worktree removal fails
   **When** an error occurs
   **Then** a warning is logged
   **And** task still moves to Done (cleanup is best-effort)

4. **Given** I want to keep a worktree
   **When** I enable "preserveWorktrees" in settings (config.yaml)
   **Then** cleanup is skipped
   **And** worktrees remain for inspection

5. **Given** orphaned worktrees exist (worktrees without active tasks)
   **When** I run cleanup from settings
   **Then** TinSu lists worktrees without active tasks
   **And** I can delete them manually

## Tasks / Subtasks

- [x] Task 1: Add `removeWorktree()` method to GitService (AC: 1, 2)
  - [x] 1.1: Add `removeWorktree(projectPath: string, worktreePath: string, branchName: string)` method
  - [x] 1.2: Execute `git worktree remove {worktreePath} --force` to remove worktree
  - [x] 1.3: Execute `git branch -d {branchName}` to delete the merged branch
  - [x] 1.4: Return `{ success: boolean, error?: string }` result object
  - [x] 1.5: Handle case where worktree doesn't exist gracefully (return success)
  - [x] 1.6: Handle case where branch is not fully merged (log warning, still succeed)

- [x] Task 2: Add `preserveWorktrees` setting to ProjectConfig (AC: 4)
  - [x] 2.1: Add `preserveWorktrees: z.boolean().optional().default(false)` to ProjectConfigSchema in `src/shared/types/config.types.ts`
  - [x] 2.2: Update ProjectConfigUpdateSchema to include preserveWorktrees
  - [x] 2.3: No migration needed (optional field with default)

- [x] Task 3: Integrate worktree cleanup into task.router.ts (AC: 1, 3, 4)
  - [x] 3.1: After successful merge in review→done transition, call `GitService.removeWorktree()`
  - [x] 3.2: Check `preserveWorktrees` setting from ConfigService before cleanup
  - [x] 3.3: If cleanup succeeds, clear `worktree_path` in task record (set to null)
  - [x] 3.4: If cleanup fails, log warning but don't rollback (best-effort per AC 3)
  - [x] 3.5: Add activity log entry for worktree cleanup

- [x] Task 4: Add `listOrphanedWorktrees()` method to GitService (AC: 5)
  - [x] 4.1: Add `listOrphanedWorktrees(projectPath: string, activeWorktreePaths: string[])` method
  - [x] 4.2: Execute `git worktree list --porcelain` to get all worktrees
  - [x] 4.3: Query tasks table for all worktree_path values (done in router)
  - [x] 4.4: Return worktrees that exist on filesystem but not in tasks table
  - [x] 4.5: Return `{ path: string, branchName: string, isLocked: boolean }[]`

- [x] Task 5: Add `cleanupOrphanedWorktrees` endpoint to git.router.ts (AC: 5)
  - [x] 5.1: Add `listOrphanedWorktrees` query endpoint
  - [x] 5.2: Add `removeOrphanedWorktree` mutation endpoint (takes worktreePath)
  - [x] 5.3: UI integration will be in future story (manual via settings)

- [x] Task 6: Add unit tests for worktree removal (AC: 1, 2, 3)
  - [x] 6.1: Test `removeWorktree()` successful removal of worktree and branch
  - [x] 6.2: Test `removeWorktree()` when worktree doesn't exist (should succeed)
  - [x] 6.3: Test `removeWorktree()` when branch not fully merged (warning, succeed)
  - [x] 6.4: Test cleanup skipped when preserveWorktrees is true
  - [x] 6.5: Test task.worktree_path cleared after successful cleanup

- [x] Task 7: Add integration test for cleanup in merge workflow (AC: 1, 2, 3, 4)
  - [x] 7.1: Test review→done triggers worktree cleanup after merge
  - [x] 7.2: Test worktree_path is null after successful cleanup
  - [x] 7.3: Test cleanup failure doesn't block task completion

## Dev Notes

### Critical Integration Point

Worktree cleanup happens AFTER successful merge in `task.router.ts`. The flow is:

```typescript
// src/main/trpc/routers/task.router.ts:362-446 - existing merge code
if (input.status === 'done' && oldTask.status === 'review') {
  if (result.worktree_path && result.branch_name) {
    // 1. Merge branch to main (Story 8.5 - DONE)
    const mergeResult = await GitService.mergeWorktree(...)

    if (mergeResult.success) {
      // 2. Update merge_commit_sha (Story 8.5 - DONE)

      // 3. NEW (Story 8.6): Cleanup worktree and branch
      const configService = new ConfigService(ctx.projectRoot)
      const config = configService.loadConfig()

      if (!config.preserveWorktrees) {
        try {
          const cleanupResult = await GitService.removeWorktree(
            ctx.projectRoot,
            result.worktree_path,
            result.branch_name
          )
          if (cleanupResult.success) {
            // Clear worktree_path in task record
            ctx.db.update(tasks)
              .set({ worktree_path: null, updated_at: new Date() })
              .where(eq(tasks.id, input.id))
              .run()
          } else {
            console.warn(`[Story 8.6] Worktree cleanup warning: ${cleanupResult.error}`)
          }
        } catch (cleanupError) {
          // Best-effort: log warning but don't fail (AC 3)
          console.warn('[Story 8.6] Worktree cleanup failed:', cleanupError)
        }
      } else {
        console.log('[Story 8.6] Worktree preserved per settings')
      }
    }
  }
}
```

### Git Commands for Worktree Removal

```bash
# 1. Remove worktree (--force handles uncommitted changes)
git -C {projectPath} worktree remove {worktreePath} --force

# 2. Delete the merged branch
git -C {projectPath} branch -d {branchName}
# Note: -d (not -D) fails if branch not fully merged - that's fine, log warning

# 3. List all worktrees (porcelain format for parsing)
git -C {projectPath} worktree list --porcelain

# Example porcelain output:
# worktree /path/to/main
# HEAD abc123
# branch refs/heads/main
#
# worktree /path/to/.tinsu/worktrees/task-1
# HEAD def456
# branch refs/heads/tinsu/story-task-1-auth
```

### RemoveWorktreeResult Interface

```typescript
export interface RemoveWorktreeResult {
  success: boolean
  worktreeRemoved: boolean
  branchDeleted: boolean
  error?: string  // Only if success=false or partial failure
}
```

### Orphaned Worktree Detection

Orphaned worktrees are worktrees in `.tinsu/worktrees/` that:
1. Exist on the filesystem
2. Are valid git worktrees (appear in `git worktree list`)
3. Have NO corresponding task in the database with matching worktree_path

This can happen if:
- App crashed before database was updated
- Manual cleanup interrupted
- Database was restored from backup

### Previous Story Intelligence (8-5)

From Story 8.5 completion:
- Merge workflow is in `task.router.ts:362-446`
- `mergeWorktree()` returns `MergeResult` with `success`, `commitSha`, `branchName`, `mergeType`
- Merge happens on main checkout, not in worktree
- Activity logging for merge is in place (`activityLogService.logActivity`)
- Error handling pattern: rollback status on failure, throw TRPCError

Key learning: The cleanup should happen AFTER merge success is confirmed but BEFORE the return. Order matters:
1. Merge succeeds → update merge_commit_sha
2. Cleanup worktree (best-effort)
3. Return result

### Existing GitService Infrastructure

| Method | Location | Purpose |
|--------|----------|---------|
| `createWorktree()` | `git.service.ts:518` | Create isolated worktree |
| `hasWorktree()` | `git.service.ts:642` | Check if worktree exists |
| `getWorktreePath()` | `git.service.ts:666` | Get worktree path |
| `getBranchNameFromWorktree()` | `git.service.ts:695` | Get branch name |
| `mergeWorktree()` | `git.service.ts:985` | Merge branch to main (Story 8.5) |
| `getHistoricalDiff()` | `git.service.ts:925` | Diff for completed tasks |

New methods to add:
- `removeWorktree()` - Remove worktree and delete branch
- `listOrphanedWorktrees()` - Find worktrees without tasks

### Architecture Compliance

Per `architecture.md` and `project-context.md`:
- GitService lives in `src/main/services/` (main process only)
- Uses `child_process.exec` for git commands via `execGit()` helper
- Follows error handling pattern: catch errors, throw `GitError` with context
- ConfigService already exists for YAML config access
- tRPC routers expose git operations via procedures

### Testing Strategy

Per `project-context.md`:
- Tests co-located with source files (`git.service.test.ts`)
- Mock `child_process.exec` for unit tests
- Use temp directories for integration tests
- Run `npm run rebuild:node` before tests, `npm run rebuild:electron` after

Test files to modify:
- `src/main/services/git.service.test.ts` - Add removeWorktree and listOrphanedWorktrees tests
- `src/main/trpc/routers/task.router.test.ts` - Add cleanup integration tests

### Project Structure Notes

**Files to modify:**
- `src/main/services/git.service.ts` - Add removeWorktree() and listOrphanedWorktrees() methods
- `src/main/trpc/routers/task.router.ts` - Add cleanup after merge success
- `src/main/trpc/routers/git.router.ts` - Add orphaned worktree endpoints
- `src/shared/types/config.types.ts` - Add preserveWorktrees setting
- `src/main/services/git.service.test.ts` - Add unit tests
- `src/main/trpc/routers/task.router.test.ts` - Add integration tests

**No new files needed** - All functionality goes in existing service and router files.

### Edge Cases to Handle

1. **Worktree already removed** - Check if path exists before running git worktree remove
2. **Branch not fully merged** - Use `-d` not `-D`, log warning if fails
3. **Locked worktree** - Git worktree remove with --force handles this
4. **Concurrent access** - Worktree removal should be atomic per task
5. **Config file missing** - Default to preserveWorktrees=false

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 8.6]
- [Source: _bmad-output/planning-artifacts/architecture.md#Git Integration]
- [Source: _bmad-output/planning-artifacts/project-context.md#Git Worktree Pattern]
- [Source: src/main/services/git.service.ts - existing worktree methods]
- [Source: src/main/trpc/routers/task.router.ts:362-446 - merge workflow (Story 8.5)]
- [Source: src/shared/types/config.types.ts - ProjectConfigSchema]
- [Source: _bmad-output/implementation-artifacts/8-5-merge-worktree-on-approval.md - previous story]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- All Story 8.6 tests pass (removeWorktree: 8 tests, listOrphanedWorktrees: 7 tests, integration: 7 tests)
- 3 pre-existing Story 8.5 tests fail due to multiline commit message quoting issue (unrelated to this story)

### Code Review Notes (2026-01-22)

- **Reviewer:** Adversarial Code Review Workflow
- **Result:** ✅ All Acceptance Criteria IMPLEMENTED and VERIFIED
- **Issues Found:** 1 Medium (documentation), 4 Low (code quality suggestions)
- **Issues Fixed:** 1 Medium - Updated File List to include sprint-status.yaml
- **Low Issues (deferred):** ConfigService reinstantiation (negligible impact), git porcelain format dependency (has error handling), error message string matching (functional), no pagination on orphaned query (unlikely to be issue)
- **Test Status:** All 22 Story 8.6 tests PASS
- **Conclusion:** Story is production-ready and functionally complete

### Completion Notes List

1. **RemoveWorktreeResult interface** added with `success`, `worktreeRemoved`, `branchDeleted`, and optional `error` fields
2. **OrphanedWorktree interface** added with `path`, `branchName`, and `isLocked` fields
3. **GitService.removeWorktree()** implements best-effort cleanup:
   - Uses `--force` flag to handle uncommitted changes
   - Uses `-d` (not `-D`) for branch deletion to respect merge status
   - Returns success=true even if worktree already removed
   - Returns success=true even if branch deletion fails (not fully merged)
4. **GitService.listOrphanedWorktrees()** parses `git worktree list --porcelain` output:
   - Only considers worktrees in `.tinsu/worktrees/` directory
   - Compares against provided active worktree paths
   - Returns branch name and locked status
5. **task.router.ts** integration:
   - Cleanup happens AFTER successful merge, BEFORE return
   - Checks `preserveWorktrees` setting from ConfigService
   - Clears `worktree_path` to null on successful cleanup
   - Logs warning on failure but doesn't rollback (best-effort per AC 3)
   - Logs cleanup activity to activity log
6. **git.router.ts** endpoints:
   - `listOrphanedWorktrees` query endpoint queries DB for active paths
   - `removeOrphanedWorktree` mutation endpoint for manual cleanup
7. **ProjectConfigSchema** updated with `preserveWorktrees: boolean` (optional, default false)

### File List

- `src/main/services/git.service.ts` - Added removeWorktree(), listOrphanedWorktrees() methods and interfaces
- `src/main/services/git.service.test.ts` - Added 15 tests for removeWorktree and listOrphanedWorktrees
- `src/main/trpc/routers/task.router.ts` - Integrated cleanup after merge success
- `src/main/trpc/routers/task.router.test.ts` - Added 7 integration tests for cleanup workflow
- `src/main/trpc/routers/git.router.ts` - Added listOrphanedWorktrees and removeOrphanedWorktree endpoints
- `src/shared/types/config.types.ts` - Added preserveWorktrees to ProjectConfigSchema
- `_bmad-output/implementation-artifacts/sprint-status.yaml` - Updated story status from backlog to done

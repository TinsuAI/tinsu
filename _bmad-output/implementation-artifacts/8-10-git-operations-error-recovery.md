# Story 8.10: Git Operations Error Recovery

Status: done

## Story

As a founder,
I want clear error messages and recovery options for git failures,
So that I can fix issues without losing work.

## Acceptance Criteria

1. **Given** any git operation fails
   **When** the error occurs
   **Then** TinSu shows a clear message explaining what failed (NFR14)
   **And** suggests recovery steps

2. **Given** worktree creation fails
   **When** the error is shown
   **Then** I can retry or proceed without worktree (dev mode)
   **And** the choice is logged

3. **Given** merge fails (not due to conflicts)
   **When** the error occurs
   **Then** the worktree is preserved
   **And** I can manually inspect and retry

4. **Given** the app crashes during git operation
   **When** I restart TinSu
   **Then** it detects incomplete operations
   **And** offers to clean up or resume

5. **Given** I want to debug
   **When** git errors occur
   **Then** full command and output are logged
   **And** I can view detailed logs in settings

## Tasks / Subtasks

- [x] Task 1: Create `GitErrorRecoveryService` for centralized error handling (AC: 1, 2, 3)
  - [x] 1.1: Create `src/main/services/git-error-recovery.service.ts`
  - [x] 1.2: Define `GitOperationState` interface: `{ operationType: string, taskId?: string, worktreePath?: string, branchName?: string, startedAt: number, completedAt?: number, status: 'pending' | 'completed' | 'failed', error?: string }`
  - [x] 1.3: Implement `recordOperationStart(op: GitOperationState): void` - write to `.tinsu/git-operations.json`
  - [x] 1.4: Implement `recordOperationComplete(operationType: string, taskId?: string): void`
  - [x] 1.5: Implement `recordOperationFailed(operationType: string, taskId?: string, error: string): void`
  - [x] 1.6: Implement `getIncompleteOperations(): GitOperationState[]` - read and filter pending operations

- [x] Task 2: Define user-friendly error messages for git operations (AC: 1)
  - [x] 2.1: Create `src/shared/types/git-error.types.ts` with `GitErrorCategory` enum: `'not_installed' | 'not_repository' | 'worktree_creation' | 'worktree_removal' | 'merge_failed' | 'branch_conflict' | 'disk_full' | 'permission_denied' | 'network' | 'unknown'`
  - [x] 2.2: Define `GitRecoverableError` interface: `{ category: GitErrorCategory, message: string, technicalDetails: string, suggestedActions: string[], canRetry: boolean, canSkip: boolean }`
  - [x] 2.3: Implement `categorizeGitError(error: GitError): GitRecoverableError` function
  - [x] 2.4: Map common git error patterns to user-friendly messages:
    - `"disk full"` → "Not enough disk space. Free up space and retry."
    - `"permission denied"` → "Permission denied. Check file permissions."
    - `"already exists"` → "Branch or worktree already exists. Choose a different name."
    - `"not a git repository"` → "Not a git repository. Initialize git first."
    - `"could not resolve ref"` → "Branch reference not found. Check branch name."

- [x] Task 3: Add worktree creation error handling with retry/skip (AC: 2)
  - [x] 3.1: Update `createWorktree` in `git.router.ts` to wrap errors with `GitRecoverableError`
  - [x] 3.2: Return structured error response: `{ success: false, error: GitRecoverableError }`
  - [x] 3.3: Add `git.retryWorktreeCreation` mutation that cleans up partial state first
  - [x] 3.4: Add `git.skipWorktreeCreation` mutation that sets task flag `worktree_skipped: true`
  - [x] 3.5: Log user choice (retry/skip) to activity log with type `git_error_recovery`

- [x] Task 4: Add merge error handling with worktree preservation (AC: 3)
  - [x] 4.1: Update `mergeWorktreeToMain` in `git.service.ts` to NOT delete worktree on non-conflict failures
  - [x] 4.2: Return detailed error info: `{ success: false, error: GitRecoverableError, worktreePreserved: true }`
  - [x] 4.3: Add `git.retryMerge` mutation that attempts merge again from preserved worktree
  - [x] 4.4: Update UI to show "Worktree preserved - inspect and retry" message
  - [x] 4.5: Add button to open worktree in file manager (shell.openPath)

- [x] Task 5: Implement crash recovery detection on app startup (AC: 4)
  - [x] 5.1: Add `git.checkCrashRecovery` query to detect incomplete operations
  - [x] 5.2: Add `git.getIncompleteOperations` query to get operation details
  - [x] 5.3: Create `src/renderer/src/components/dialogs/CrashRecoveryDialog.tsx`
  - [x] 5.4: Dialog shows list of incomplete operations with options: "Clean up" or "Dismiss"
  - [x] 5.5: Add `git.cleanupPartialWorktree` mutation that removes partial worktrees/branches
  - [x] 5.6: Add `git.dismissOperation` mutation that removes operation record

- [x] Task 6: Add detailed error logging for debugging (AC: 5)
  - [x] 6.1: Create `src/main/services/git-log.service.ts` for git-specific logging
  - [x] 6.2: Log format: JSON with timestamp, operationType, taskId, status, command, exitCode, durationMs, error, details
  - [x] 6.3: Store logs in `.tinsu/git-logs/git-YYYY-MM-DD.log` with 7-day retention
  - [x] 6.4: Implement `readLogs(date?: string): GitLogEntry[]`
  - [x] 6.5: Add `git.getLogs`, `git.getLogDates`, `git.getLogStats`, `git.cleanupLogs` queries to router

- [x] Task 7: Create Git Error Recovery UI components (AC: 1, 2, 3)
  - [x] 7.1: Create `src/renderer/src/components/dialogs/GitErrorDialog.tsx`
  - [x] 7.2: Accept props: `error: GitRecoverableError, onRetry?: () => void, onSkip?: () => void, onClose: () => void`
  - [x] 7.3: Display user-friendly error message with icon (AlertCircle for errors)
  - [x] 7.4: Show "Show Technical Details" expandable section with full error info
  - [x] 7.5: Show "Suggested Actions" as numbered list
  - [x] 7.6: Conditional buttons: "Retry" (if canRetry), "Skip" (if canSkip), "Dismiss"

- [x] Task 8: Add Settings page section for Git Logs (AC: 5)
  - [x] 8.1: Create `src/renderer/src/components/settings/GitLogsPanel.tsx`
  - [x] 8.2: Display git operation logs with date selector
  - [x] 8.3: Show log entries with expandable details (timestamp, operation, task, duration, error)
  - [x] 8.4: Add "Cleanup Old" button to remove logs older than 7 days
  - [x] 8.5: Display log statistics (file count, total size)

- [x] Task 9: Integrate error handling into existing git flows (AC: 1, 2, 3)
  - [x] 9.1: Added GitLogService logging to createWorktree mutation
  - [x] 9.2: Added GitLogService logging to retryWorktreeCreation mutation
  - [x] 9.3: Added GitLogService logging to mergeTaskBranch mutation
  - [x] 9.4: Added GitLogService logging to retryMerge mutation
  - [x] 9.5: Added GitLogService logging to autoCommitWorktreeChanges mutation
  - [x] 9.6: Added GitLogService logging to skipWorktreeCreation mutation

- [x] Task 10: Add unit and integration tests (AC: 1, 2, 3, 4, 5)
  - [x] 10.1: Test `categorizeGitError` maps errors correctly (23 tests in git-error.types.test.ts)
  - [x] 10.2: Test `GitErrorRecoveryService` records and reads operations (13 tests in git-error-recovery.service.test.ts)
  - [x] 10.3: Test worktree creation retry cleans up partial state (git.router.test.ts)
  - [x] 10.4: Test worktree skip sets flag and logs choice (git.router.test.ts)
  - [x] 10.5: Test merge error preserves worktree (git.router.test.ts)
  - [x] 10.6: Test crash recovery detects incomplete operations (git.router.test.ts)
  - [x] 10.7: Test `GitLogService` logging and cleanup (14 tests in git-log.service.test.ts)

## Dev Notes

### Critical Implementation Context

**Story 8.10 builds on the complete Epic 8 git infrastructure:**
- `GitService` class in `src/main/services/git.service.ts` handles all git operations
- `GitError` custom error class provides command context (line 55-65)
- `execGit()` method executes commands with timeout and error handling (line 238-261)
- Existing error patterns: `throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: ... })`

**Current Error Handling Patterns (from git.router.ts):**
```typescript
// Current pattern - catches GitError and converts to TRPCError
catch (error) {
  if (error instanceof GitError) {
    if (error.message.includes('dangerous characters')) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid path...' })
    }
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message })
  }
  const errorMessage = error instanceof Error ? error.message : 'Unknown error'
  throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: `Failed...` })
}
```

**This story enhances error handling to:**
1. Provide user-friendly messages instead of technical errors
2. Offer recovery options (retry/skip) where applicable
3. Track operation state for crash recovery
4. Log detailed command output for debugging

### GitService Methods That Need Error Recovery Enhancement

**Worktree Operations (Task 3):**
- `createWorktree()` - lines 467-540 in git.service.ts
- Current: throws GitError on failure
- Enhancement: record operation state, return structured error with recovery options

**Merge Operations (Task 4):**
- `mergeWorktreeToMain()` - handles merge to main
- Current: returns `MergeResult` with `success: false` for conflicts
- Enhancement: preserve worktree on non-conflict failures, return recovery info

### File System State Tracking

**Operation State File:** `.tinsu/git-operations.json`
```json
{
  "operations": [
    {
      "operationType": "createWorktree",
      "taskId": "abc123",
      "worktreePath": ".tinsu/worktrees/abc123",
      "branchName": "tinsu/story-abc123-task",
      "startedAt": 1704067200000,
      "completedAt": null,
      "status": "pending",
      "error": null
    }
  ]
}
```

**Why JSON file vs database:**
- Survives database corruption
- Readable during crash recovery before DB init
- Simple atomic writes

### Error Category Mapping

| Git Error Pattern | Category | User Message | Recovery |
|---|---|---|---|
| `"disk full"` / `ENOSPC` | disk_full | "Not enough disk space" | Retry after freeing space |
| `"permission denied"` / `EACCES` | permission_denied | "Permission denied" | Check permissions, retry |
| `"already exists"` | branch_conflict | "Branch/worktree exists" | Use different name, skip |
| `"not a git repository"` | not_repository | "Not a git repo" | Init git first |
| `"could not resolve ref"` | branch_conflict | "Branch not found" | Check branch name |
| `"merge conflict"` | merge_failed | "Merge conflict" | Resolve in UI (existing) |
| `"network"` / `ETIMEDOUT` | network | "Network error" | Check connection, retry |

### Previous Story Intelligence (8-9)

From Story 8-9 completion notes:
- `useBranchStatus` hook demonstrates pattern for fetching git state
- `BranchStatusIndicator` shows badge/indicator pattern for git states
- Auto-commit on agent completion in `hook-listener.service.ts`
- Error handling: log warnings, don't fail silently

Key patterns to follow:
- Use TRPCError for router errors, GitError for service errors
- Activity logging with task ID for traceability
- Graceful degradation (e.g., proceed without worktree if user skips)

### UI Component Patterns

**Dialog pattern (from existing shadcn/ui):**
```typescript
// Use Dialog, DialogContent, DialogHeader, DialogTitle from @/components/ui/dialog
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertTriangle, XCircle, RefreshCw, SkipForward } from 'lucide-react'
```

**Error dialog structure:**
```typescript
interface GitErrorDialogProps {
  open: boolean
  error: GitRecoverableError
  onRetry?: () => void
  onSkip?: () => void
  onClose: () => void
}
```

### Project Structure Notes

**Files to create:**
- `src/main/services/git-error-recovery.service.ts` - operation state tracking
- `src/main/services/git-log.service.ts` - detailed git logging
- `src/shared/types/git-error.types.ts` - error types and categories
- `src/renderer/src/components/git/GitErrorDialog.tsx` - error UI
- `src/renderer/src/components/git/IncompleteOperationsDialog.tsx` - crash recovery UI
- `src/renderer/src/components/settings/GitLogsSection.tsx` - settings page section

**Files to modify:**
- `src/main/services/git.service.ts` - wrap operations with state tracking
- `src/main/trpc/routers/git.router.ts` - add recovery endpoints
- `src/main/index.ts` - add crash recovery check on startup
- `src/renderer/src/components/board/KanbanBoardContainer.tsx` - show error dialog
- `src/renderer/src/components/workspace/TaskWorkspaceView.tsx` - show error dialog

**Files to reference:**
- `src/main/services/git.service.ts:55-65` - GitError class
- `src/main/services/git.service.ts:238-261` - execGit error handling
- `src/main/trpc/routers/git.router.ts` - error to TRPCError conversion
- `src/renderer/src/components/git/BranchStatusIndicator.tsx` - UI pattern
- `src/shared/types/activity.types.ts` - activity type pattern

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 8.10]
- [Source: _bmad-output/planning-artifacts/architecture.md#Error Handling Layers]
- [Source: _bmad-output/implementation-artifacts/8-9-branch-status-indicators.md - previous story patterns]
- [Source: src/main/services/git.service.ts:55-65 - GitError class]
- [Source: src/main/trpc/routers/git.router.ts - error handling patterns]
- [Source: _bmad-output/planning-artifacts/project-context.md#Error Handling Layers]
- [NFR14: Clear error messages with context]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- All 208 git-related tests passing
- 13 GitErrorRecoveryService tests
- 23 categorizeGitError tests
- 14 GitLogService tests
- 15 git router tests
- 143 git service tests

### Completion Notes List

1. Created GitErrorRecoveryService for tracking git operations state in `.tinsu/git-operations.json`
2. Created git-error.types.ts with categorizeGitError function that maps git errors to user-friendly messages with recovery options
3. Added createWorktree/retryWorktreeCreation/skipWorktreeCreation mutations with error recovery
4. Added mergeTaskBranch/retryMerge mutations with worktree preservation on failure
5. Added crash recovery via checkCrashRecovery query that detects incomplete operations
6. Created GitLogService for detailed operation logging in `.tinsu/git-logs/` with daily rotation and 7-day retention
7. Created GitErrorDialog component for displaying errors with retry/skip/dismiss options
8. Created CrashRecoveryDialog component for startup recovery prompts
9. Created GitLogsPanel component in Settings for viewing operation logs
10. Added database schema migration for worktree_skipped column
11. Integrated GitLogService logging into all key git operations

### Code Review Fixes Applied

12. **AC4 FIXED**: Integrated CrashRecoveryDialog into App.tsx startup flow - now triggers after project opens
13. **Type Safety**: Added discriminated union types for createWorktree return values
14. **Logging**: Replaced console.log with GitLogService for operational consistency
15. **Error Handling**: Added logging to silent error handlers for better debugging
16. **Merge Conflicts**: Fixed logging status from 'failed' to 'succeeded' with hasConflict flag
17. **Documentation**: Added crash threshold rationale (5min based on NFR22)
18. **AC2 FIXED**: Integrated GitErrorDialog into KanbanBoardContainer for worktree creation errors
    - Updated task.router.ts to categorize GitErrors and attach to TRPCError cause
    - Added GitErrorDialog state and handlers to KanbanBoardContainer
    - Error dialog now shows with retry/skip options when worktree creation fails during task status update
    - Retry calls retryWorktreeCreation mutation, skip calls skipWorktreeCreation mutation

### File List

**New Files Created:**
- `src/main/services/git-error-recovery.service.ts` - Operation state tracking service
- `src/main/services/git-error-recovery.service.test.ts` - 13 tests
- `src/main/services/git-log.service.ts` - Detailed git operation logging
- `src/main/services/git-log.service.test.ts` - 14 tests
- `src/shared/types/git-error.types.ts` - Error categorization and user-friendly messages
- `src/shared/types/git-error.types.test.ts` - 23 tests
- `src/renderer/src/components/dialogs/GitErrorDialog.tsx` - Error recovery dialog
- `src/renderer/src/components/dialogs/CrashRecoveryDialog.tsx` - Crash recovery dialog
- `src/renderer/src/components/settings/GitLogsPanel.tsx` - Git logs viewer in settings

**Modified Files:**
- `src/main/trpc/routers/git.router.ts` - Added error recovery mutations, logging calls, and log viewing queries
- `src/main/trpc/routers/git.router.test.ts` - Added 15 error recovery tests
- `src/main/trpc/routers/task.router.ts` - Added GitError categorization in worktree creation error handler (AC2)
- `src/main/db/schema.ts` - Added worktree_skipped column
- `src/main/db/index.ts` - Added migration for worktree_skipped
- `src/main/services/index.ts` - Exported GitErrorRecoveryService and GitLogService
- `src/renderer/src/components/dialogs/SettingsDialog.tsx` - Added GitLogsPanel
- `src/renderer/src/components/board/KanbanBoardContainer.tsx` - Integrated GitErrorDialog with retry/skip handlers (AC2)
- `src/renderer/src/App.tsx` - Added crash recovery check on startup (AC4)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` - Updated story status tracking


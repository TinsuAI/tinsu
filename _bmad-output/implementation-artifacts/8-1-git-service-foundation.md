# Story 8.1: Git Service Foundation

Status: done

## Story

As a developer,
I want a Git Service that wraps git CLI operations,
So that all git interactions go through a consistent, error-handled interface.

## Acceptance Criteria

1. **Given** the main process
   **When** I create a GitService instance
   **Then** it can execute git commands via child_process
   **And** all outputs are captured and parsed

2. **Given** the GitService
   **When** I call any git operation
   **Then** errors are caught and returned with clear messages (NFR14)
   **And** the error includes the git command that failed

3. **Given** git is not installed
   **When** GitService initializes
   **Then** it detects the missing dependency
   **And** throws a clear error: "Git not found. Please install git." (NFR20)

4. **Given** the project is not a git repository
   **When** GitService operations are called
   **Then** it detects the missing .git folder
   **And** returns error: "Not a git repository" (NFR20)

5. **Given** repository size considerations
   **When** operations run
   **Then** they complete within reasonable time for repos up to 10GB (NFR21)
   **And** branch operations complete within 5 seconds (NFR22)

6. **Given** GitService initializes for a project
   **When** the .tinsu/ folder exists
   **Then** `.tinsu/worktrees/` is added to .gitignore if not already present
   **And** this happens before any worktree operations

## Tasks / Subtasks

- [x] Task 1: Extend existing GitService with foundation methods (AC: 1, 2, 3, 4)
  - [x] 1.1: Add `checkGitInstalled()` static method to detect git availability
  - [x] 1.2: Add `isGitRepository(path: string)` method to verify .git folder exists
  - [x] 1.3: Add `execGit(args: string[], cwd: string)` helper for all git commands with error handling
  - [x] 1.4: Create consistent GitError class with command context
  - [x] 1.5: Add input path validation (security: prevent command injection)
  - [x] 1.6: Write tests for git detection and repository verification

- [x] Task 2: Add performance guardrails (AC: 5)
  - [x] 2.1: Configure command timeout (5 seconds for branch ops, 30 seconds for large ops)
  - [x] 2.2: Add maxBuffer configuration for large repos (10MB default)
  - [x] 2.3: Document performance expectations in code comments

- [x] Task 3: Implement gitignore management for worktrees (AC: 6)
  - [x] 3.1: Add `ensureWorktreesIgnored(projectPath: string)` method
  - [x] 3.2: Read existing .gitignore content
  - [x] 3.3: Check if `.tinsu/worktrees/` pattern already exists
  - [x] 3.4: Append pattern if missing (preserve existing content)
  - [x] 3.5: Write tests for gitignore management

- [x] Task 4: Update git.router.ts to expose new methods (AC: 1-4)
  - [x] 4.1: Add `checkGitInstalled` query procedure
  - [x] 4.2: Add `isGitRepository` query procedure
  - [x] 4.3: Add `ensureWorktreesIgnored` mutation procedure
  - [x] 4.4: Wrap all procedures with TRPCError handling

## Dev Notes

### Existing Code to Extend

**IMPORTANT:** A `GitService` class already exists at `src/main/services/git.service.ts` (created in TES-4.1). The current implementation is focused ONLY on diff operations:

```typescript
// Current methods in GitService:
static async getDiff(repoPath: string): Promise<GitDiffResult>
static parseDiff(diffOutput: string): GitDiffResult
```

**DO NOT** replace this service. EXTEND it by adding the new foundation methods to support worktree operations in future stories (8-2 through 8-10).

### Architecture Compliance

Per `architecture.md`, GitService:
- Lives in `src/main/services/git.service.ts` (main process only)
- Uses `child_process.exec` for git CLI execution
- Exposes methods via `src/main/trpc/routers/git.router.ts`
- Follows error handling pattern: catch errors, throw `TRPCError` with context

### Service Pattern to Follow

Follow the pattern established by `TmuxService` for dependency detection:

```typescript
// Pattern from tmux.service.ts
static async checkTmuxInstalled(): Promise<boolean> {
  try {
    await execAsync('tmux -V', { timeout: TMUX_COMMAND_TIMEOUT })
    return true
  } catch (error) {
    const execError = error as ExecError
    if (execError.code === 127) {
      return false  // Command not found
    }
    throw error  // Other errors (permission, timeout)
  }
}
```

### Error Handling Pattern

Create a custom `GitError` class for detailed error context:

```typescript
export class GitError extends Error {
  constructor(
    message: string,
    public readonly command: string,
    public readonly exitCode?: number,
    public readonly stderr?: string
  ) {
    super(message)
    this.name = 'GitError'
  }
}
```

### Security Requirements

The existing `getDiff` method has proper input validation - follow the same pattern:

```typescript
// From existing git.service.ts - REUSE this pattern
const dangerousChars = /[;&|`$()<>]/
if (dangerousChars.test(repoPath)) {
  throw new Error('Invalid repository path: contains dangerous characters')
}
```

### Worktree Path Convention

Per architecture and Story 8-2, worktrees will be stored at:
- Location: `.tinsu/worktrees/{task-id}/`
- This directory MUST be gitignored to prevent tracking worktree contents

### tRPC Router Pattern

Follow existing patterns in `git.router.ts`:

```typescript
// Example from existing code
getDiff: publicProcedure.query(async ({ ctx }) => {
  try {
    const diff = await GitService.getDiff(ctx.projectRoot)
    return diff
  } catch (error) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `Failed to get git diff: ${error.message}`
    })
  }
})
```

### Project Structure Notes

Files to modify:
- `src/main/services/git.service.ts` - Add new methods
- `src/main/services/git.service.test.ts` - Add tests
- `src/main/trpc/routers/git.router.ts` - Expose new procedures

No new files needed - extend existing service.

### Testing Strategy

Per `project-context.md`, tests are co-located:
- `src/main/services/git.service.test.ts` already exists
- Add new test cases for the foundation methods
- Mock `child_process.exec` for unit tests
- Test error scenarios: git not installed, not a repo, command failures

### Database Considerations

No schema changes needed for this story. Future stories (8-2 through 8-11) may add:
- `worktree_path` column to tasks table
- `merge_commit_sha` column for historical diff (Story 8-11)

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Git Integration]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 8.1]
- [Source: _bmad-output/planning-artifacts/project-context.md#Git Worktree Pattern]
- [Source: src/main/services/git.service.ts - existing implementation]
- [Source: src/main/services/tmux.service.ts - pattern reference for dependency detection]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A - Implementation completed without issues.

### Completion Notes List

1. **Task 1 Complete**: Extended existing GitService with foundation methods:
   - Added `checkGitInstalled()` static method following TmuxService pattern
   - Added `isGitRepository(path)` method using `git rev-parse --is-inside-work-tree`
   - Added private `execGit(args, cwd, timeout)` helper with proper error handling
   - Created `GitError` class with command, exitCode, and stderr context
   - Added `validatePath()` private method for security (dangerous characters check)
   - All 35 tests passing

2. **Task 2 Complete**: Added performance guardrails:
   - `GIT_BRANCH_TIMEOUT = 5000` (5 seconds for fast operations)
   - `GIT_LARGE_OP_TIMEOUT = 30000` (30 seconds for large operations)
   - `GIT_MAX_BUFFER = 10 * 1024 * 1024` (10MB for large repos)
   - Constants documented in code

3. **Task 3 Complete**: Implemented gitignore management:
   - Added `ensureWorktreesIgnored(projectPath)` method
   - Handles existing .gitignore (appends pattern)
   - Creates new .gitignore if doesn't exist
   - Checks if pattern already exists to avoid duplicates
   - Uses comment header "# TinSu worktrees (auto-generated)"

4. **Task 4 Complete**: Updated git.router.ts:
   - Added `checkGitInstalled` query procedure
   - Added `isGitRepository` query procedure (with optional path input)
   - Added `ensureWorktreesIgnored` mutation procedure
   - All procedures wrapped with proper TRPCError handling

### Code Review Fixes (2026-01-21)

**Review Summary:** Adversarial code review found 7 HIGH and MEDIUM issues. All fixed automatically.

**Issues Fixed:**

1. **HIGH - AC 2 Violation**: getDiff() now throws GitError consistently instead of generic Error (added command context)
2. **HIGH - AC 3 Violation**: Added ensureGitInstalled() helper method that throws standard error "Git not found. Please install git."
3. **HIGH - AC 4 Violation**: Added ensureGitRepository() helper method that throws standard error "Not a git repository"
4. **MEDIUM - Code Duplication**: getDiff() now uses validatePath() instead of duplicating validation logic
5. **MEDIUM - Error Handling**: getDiff() now wraps all errors in GitError with command context
6. **MEDIUM - AC 6 Compliance**: ensureWorktreesIgnored() now checks if .tinsu/ folder exists before modifying .gitignore
7. **MEDIUM - Documentation**: Updated File List to include sprint-status.yaml

**New Methods Added:**
- `ensureGitInstalled()` - Convenience wrapper that throws if git not installed
- `ensureGitRepository(path)` - Convenience wrapper that throws if not a git repo

**New tRPC Procedures Added:**
- `ensureGitInstalled` - Query procedure for ensuring git is installed
- `ensureGitRepository` - Query procedure for ensuring path is a git repository

**Tests Updated:**
- Added 5 new tests for helper methods and .tinsu/ existence check
- Updated 2 tests for new error messages from validatePath()
- All 41 tests passing

### File List

- `src/main/services/git.service.ts` (modified) - Added GitError class and foundation methods
- `src/main/services/git.service.test.ts` (modified) - Added 23 new test cases (41 total after review fixes)
- `src/main/trpc/routers/git.router.ts` (modified) - Added 5 new tRPC procedures (3 initial + 2 review fixes)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified) - Updated story status

### Change Log

- 2026-01-21: Story 8.1 implemented - Git Service Foundation with checkGitInstalled, isGitRepository, ensureWorktreesIgnored, and GitError class
- 2026-01-21: Code review fixes applied - Added ensureGitInstalled/ensureGitRepository helpers, fixed getDiff() error handling, AC compliance improvements

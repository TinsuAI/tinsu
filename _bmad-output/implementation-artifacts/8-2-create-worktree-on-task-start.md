# Story 8.2: Create Worktree on Task Start

Status: done

## Story

As a founder,
I want a git worktree created when I move a task to In Progress,
So that agent work is isolated from the main branch (FR22).

## Acceptance Criteria

1. **Given** a Story Task is dragged to "Create Story" column
   **When** the drop completes
   **Then** GitService creates a new worktree
   **And** the worktree is located at .tinsu/worktrees/{task-id}/
   **And** the agent executes in this worktree for story creation

2. **Given** a Basic Task is dragged to "In Progress" column
   **When** the drop completes
   **Then** GitService creates a new worktree
   **And** the worktree is located at .tinsu/worktrees/{task-id}/
   **And** the agent executes in this worktree for direct execution

3. **Given** a Story Task with existing worktree is dragged from "Create Story" to "In Progress"
   **When** the drop completes
   **Then** the existing worktree is reused
   **And** no new worktree is created

4. **Given** worktree creation
   **When** it runs
   **Then** it uses `git worktree add` command
   **And** the worktree is based on the current HEAD of main

5. **Given** worktree creation succeeds
   **When** I check the filesystem
   **Then** the worktree directory contains a full working copy
   **And** the task record stores the worktree path

6. **Given** worktree creation fails
   **When** an error occurs (e.g., disk full)
   **Then** the task stays in previous column
   **And** a clear error message is shown
   **And** no partial worktree is left behind (NFR12)

## Tasks / Subtasks

- [x] Task 1: Add worktree_path column to tasks table (AC: 5)
  - [x] 1.1: Add `worktree_path` column to tasks table in `src/main/db/schema.ts`
  - [x] 1.2: Create migration in `src/main/db/index.ts` to add column
  - [x] 1.3: Update Task type exports in `src/shared/types/task.types.ts` (if exists)
  - [x] 1.4: Run `npm run rebuild:electron` after DB changes

- [x] Task 2: Implement createWorktree method in GitService (AC: 1, 2, 4, 5, 6)
  - [x] 2.1: Add `createWorktree(projectPath, taskId, branchName)` method to GitService
  - [x] 2.2: Use `git worktree add` command with proper path `.tinsu/worktrees/{task-id}/`
  - [x] 2.3: Create .tinsu/worktrees/ directory if it doesn't exist
  - [x] 2.4: Base worktree on current HEAD of main/master branch (detect default branch)
  - [x] 2.5: Handle error cases - clean up partial worktree on failure
  - [x] 2.6: Return worktree path on success
  - [x] 2.7: Add `hasWorktree(projectPath, taskId)` method to check existing worktree (AC: 3)

- [x] Task 3: Add worktree tRPC procedures (AC: 1-6)
  - [x] 3.1: Add `createWorktree` mutation procedure in `git.router.ts`
  - [x] 3.2: Add `hasWorktree` query procedure to check if worktree exists
  - [x] 3.3: Add `getWorktreePath` query procedure for a task
  - [x] 3.4: Wrap all procedures with proper TRPCError handling
  - [x] 3.5: Call `ensureWorktreesIgnored` before creating worktree

- [x] Task 4: Integrate worktree creation into task status change (AC: 1, 2, 3)
  - [x] 4.1: Modify task status update flow to trigger worktree creation
  - [x] 4.2: Create worktree when Story Task moves to "create_story" status
  - [x] 4.3: Create worktree when Basic Task moves to "in_progress" status
  - [x] 4.4: Skip worktree creation if task already has worktree_path (AC: 3)
  - [x] 4.5: Update task record with worktree_path after successful creation
  - [x] 4.6: Rollback status change on worktree creation failure (AC: 6)

- [x] Task 5: Add tests for worktree functionality
  - [x] 5.1: Unit tests for GitService.createWorktree()
  - [x] 5.2: Unit tests for GitService.hasWorktree()
  - [x] 5.3: Integration tests for tRPC procedures
  - [x] 5.4: Test error scenarios: disk full simulation, permission errors
  - [x] 5.5: Test cleanup on failure (no partial worktrees)

## Dev Notes

### Existing Code to Extend

**CRITICAL:** GitService already exists at `src/main/services/git.service.ts` (created in Story 8.1). The current implementation includes:

```typescript
// Existing methods from Story 8.1:
static async checkGitInstalled(): Promise<boolean>
static async ensureGitInstalled(): Promise<void>
static async isGitRepository(path: string): Promise<boolean>
static async ensureGitRepository(path: string): Promise<void>
static async ensureWorktreesIgnored(projectPath: string): Promise<void>
static async getDiff(repoPath: string): Promise<GitDiffResult>

// Existing helper methods:
private static validatePath(path: string, operationName: string): void
private static async execGit(args: string[], cwd: string, timeout?: number)
```

**DO NOT** replace this service. EXTEND it by adding worktree-specific methods.

### Worktree Path Convention

Per architecture and project-context.md:
- Location: `.tinsu/worktrees/{task-id}/`
- This directory MUST be gitignored (handled by `ensureWorktreesIgnored` from Story 8.1)
- Example: `.tinsu/worktrees/task-abc123/`

### Git Worktree Commands Reference

```bash
# Create a worktree with a new branch
git worktree add .tinsu/worktrees/{task-id} -b task/{task-id}

# Create a worktree based on specific branch/commit
git worktree add .tinsu/worktrees/{task-id} HEAD

# List worktrees
git worktree list

# Remove worktree (use in Story 8.6)
git worktree remove .tinsu/worktrees/{task-id}
```

### Architecture Compliance

Per `architecture.md`:
- GitService lives in `src/main/services/git.service.ts` (main process only)
- Uses `child_process.exec` for git CLI execution
- Exposes methods via `src/main/trpc/routers/git.router.ts`
- Follows error handling pattern: catch errors, throw `TRPCError` with context

### Task Status Flow and Worktree Timing

**Story Tasks (BMAD-generated):**
```
Backlog → [no worktree]
Create Story → createWorktree() → [worktree created here]
In Progress → [reuse existing worktree]
Review → [worktree still exists]
Done → [worktree removed in Story 8.6]
```

**Basic Tasks (user-created):**
```
Backlog → [no worktree]
In Progress → createWorktree() → [worktree created here]
Review → [worktree still exists]
Done → [worktree removed in Story 8.6]
```

### Database Schema Addition

Add to `src/main/db/schema.ts` tasks table:
```typescript
// Story 8.2: Worktree path for git isolation
worktree_path: text('worktree_path'), // Path to git worktree (.tinsu/worktrees/{task-id}/)
```

Add migration in `src/main/db/index.ts`:
```typescript
// Story 8.2: Add worktree_path column to tasks
db.exec(`
  ALTER TABLE tasks ADD COLUMN worktree_path TEXT;
`)
```

### Default Branch Detection

Git repositories may use `main` or `master` as default branch. Detect using:
```bash
git symbolic-ref --short HEAD  # Current branch
git rev-parse --abbrev-ref origin/HEAD 2>/dev/null | sed 's/origin\///' # Default from origin
```

Or simply base worktree on HEAD (current commit):
```bash
git worktree add .tinsu/worktrees/{task-id} -b task/{task-id} HEAD
```

### Error Recovery Pattern

Per NFR12 (no partial states), implement cleanup on failure:

```typescript
async createWorktree(projectPath: string, taskId: string): Promise<string> {
  const worktreePath = join(projectPath, '.tinsu', 'worktrees', taskId)

  try {
    // Ensure .tinsu/worktrees/ is gitignored
    await this.ensureWorktreesIgnored(projectPath)

    // Create worktree directory structure
    await mkdir(dirname(worktreePath), { recursive: true })

    // Create git worktree
    await this.execGit(['worktree', 'add', worktreePath, '-b', `task/${taskId}`], projectPath)

    return worktreePath
  } catch (error) {
    // Cleanup on failure - remove partial worktree
    if (existsSync(worktreePath)) {
      await rm(worktreePath, { recursive: true, force: true })
    }
    // Try to prune worktree references
    await this.execGit(['worktree', 'prune'], projectPath).catch(() => {})

    throw error
  }
}
```

### Integration with Task Status Change

The task.router.ts already has `updateStatus` mutation. Modify to:
1. Check if new status requires worktree (create_story or in_progress)
2. Check if task already has worktree_path
3. Create worktree if needed
4. Update task with worktree_path
5. Rollback on failure

### Testing Strategy

Per `project-context.md`:
- Tests co-located with source: `git.service.test.ts`
- Mock `child_process.exec` for unit tests
- Use temp directories for integration tests
- Test cleanup by simulating failures

### Project Structure Notes

Files to modify:
- `src/main/db/schema.ts` - Add worktree_path column
- `src/main/db/index.ts` - Add migration
- `src/main/services/git.service.ts` - Add createWorktree, hasWorktree methods
- `src/main/services/git.service.test.ts` - Add tests
- `src/main/trpc/routers/git.router.ts` - Add tRPC procedures
- `src/main/trpc/routers/task.router.ts` - Integrate worktree creation on status change

No new files needed - extend existing services.

### 🎨 UI Considerations

This story is backend-focused. No UI changes required. Error messages will surface through existing tRPC error handling and toast notifications.

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Git Integration]
- [Source: _bmad-output/planning-artifacts/architecture.md#Git Worktree Pattern]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 8.2]
- [Source: _bmad-output/planning-artifacts/project-context.md#Git Worktree Pattern]
- [Source: src/main/services/git.service.ts - existing implementation from Story 8.1]
- [Source: _bmad-output/implementation-artifacts/8-1-git-service-foundation.md - previous story reference]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

None - implementation proceeded without issues.

### Completion Notes List

- Added `worktree_path` column to tasks table in both schema and migration
- Updated Task type in shared types to include worktree_path (also fixed story_number type from number to string)
- Implemented createWorktree, hasWorktree, and getWorktreePath methods in GitService
- Added tRPC procedures for worktree operations in git.router.ts
- Added 8 integration tests for worktree tRPC procedures in git.router.test.ts
- Integrated worktree creation into task status change flow in task.router.ts
- Worktree is created when task moves to "create_story" (Story Tasks) or "in_progress" (Basic Tasks)
- Existing worktrees are reused when task already has worktree_path or when worktree exists on filesystem
- Fixed AC 6 violation: Worktree creation failure now properly triggers rollback of status change
- Added 14 new tests for worktree functionality in git.service.test.ts covering all ACs
- Added 8 new integration tests for worktree tRPC procedures covering ACs 3, 4, 5, 6
- All 54 git service unit tests pass
- All 8 git router integration tests pass
- TypeScript compilation succeeds with no errors
- Ran npm rebuild:electron successfully after DB schema changes
- Worktrees are gitignored automatically via ensureWorktreesIgnored

### Change Log

- 2026-01-21: Implemented Story 8.2 - Git worktree creation on task start
- 2026-01-21: Code review fixes:
  - Fixed AC 6 violation: Worktree creation failure now triggers status rollback (task.router.ts:266-275)
  - Fixed type mismatch: Changed story_number from number to string type (task.types.ts:66, 102, 232)
  - Added 8 integration tests for worktree tRPC procedures (git.router.test.ts)
  - Updated File List to include sprint-status.yaml changes
  - Ran npm rebuild:electron after DB schema changes

### File List

- src/main/db/schema.ts (modified - added worktree_path column)
- src/main/db/index.ts (modified - added migration for worktree_path)
- src/shared/types/task.types.ts (modified - added worktree_path to Task and NewTask interfaces, fixed story_number type from number to string)
- src/main/services/git.service.ts (modified - added createWorktree, hasWorktree, getWorktreePath methods)
- src/main/services/git.service.test.ts (modified - added 14 new tests for worktree functionality)
- src/main/trpc/routers/git.router.ts (modified - added createWorktree, hasWorktree, getWorktreePath tRPC procedures)
- src/main/trpc/routers/git.router.test.ts (modified - added 8 integration tests for worktree tRPC procedures)
- src/main/trpc/routers/task.router.ts (modified - integrated worktree creation into updateStatus mutation, fixed AC 6 rollback logic)
- _bmad-output/implementation-artifacts/sprint-status.yaml (modified - updated story 8-2 status to review, marked epics 6 & 7 as superseded)

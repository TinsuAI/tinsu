# Story 8.3: Branch Naming Convention

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a founder,
I want branches to follow a consistent naming convention,
so that I can identify which branch belongs to which story (FR23).

## Acceptance Criteria

1. **Given** a worktree is created for a story task
   **When** the branch is named
   **Then** it follows pattern: `tinsu/story-{task-id}-{slug}`
   **And** slug is derived from story title (lowercase, hyphens)

2. **Given** a story title "Add User Authentication"
   **When** branch is created
   **Then** branch name is: `tinsu/story-abc123-add-user-authentication`
   **And** slug is truncated to max 50 characters

3. **Given** a story title with special characters (e.g., "Fix the 'Login' Bug!")
   **When** slug is generated
   **Then** special characters are removed or replaced
   **And** the branch name is valid for git (NFR23)

4. **Given** a branch with this name already exists
   **When** worktree creation attempts
   **Then** a suffix is added: `tinsu/story-{id}-{slug}-2`
   **And** uniqueness is guaranteed

5. **Given** I view the task in TinSu
   **When** a branch exists
   **Then** the branch name is displayed in task details
   **And** I can copy it to clipboard

## Tasks / Subtasks

- [x] Task 1: Add branch_name column to tasks table (AC: 1, 5)
  - [x] 1.1: Add `branch_name` column to tasks table in `src/main/db/schema.ts`
  - [x] 1.2: Create migration in `src/main/db/index.ts` to add column
  - [x] 1.3: Update Task type in `src/shared/types/task.types.ts` to include branch_name
  - [x] 1.4: Run `npm run rebuild:electron` after DB changes

- [x] Task 2: Implement generateBranchName helper in GitService (AC: 1, 2, 3)
  - [x] 2.1: Add `generateSlug(title: string): string` private method to GitService
  - [x] 2.2: Implement slug generation: lowercase, replace spaces with hyphens, remove special chars
  - [x] 2.3: Truncate slug to max 50 characters at word boundary when possible
  - [x] 2.4: Add `generateBranchName(taskId: string, taskTitle: string): string` method
  - [x] 2.5: Return format: `tinsu/story-{taskId}-{slug}`

- [x] Task 3: Implement branch uniqueness check and suffix logic (AC: 4)
  - [x] 3.1: Add `branchExists(projectPath: string, branchName: string): Promise<boolean>` method
  - [x] 3.2: Use `git show-ref --verify refs/heads/{branchName}` to check existence
  - [x] 3.3: Add `getUniqueBranchName(projectPath: string, baseName: string): Promise<string>` method
  - [x] 3.4: If branch exists, append `-2`, `-3`, etc. until unique name found

- [x] Task 4: Update createWorktree to use new branch naming (AC: 1, 4)
  - [x] 4.1: Modify `createWorktree` signature to accept optional `taskTitle` parameter
  - [x] 4.2: Generate branch name using `generateBranchName(taskId, taskTitle)`
  - [x] 4.3: Call `getUniqueBranchName` before creating worktree
  - [x] 4.4: Update `git worktree add` command to use new branch name pattern
  - [x] 4.5: Return both `worktreePath` and `branchName` from createWorktree

- [x] Task 5: Update tRPC procedures and task integration (AC: 1, 5)
  - [x] 5.1: Update `createWorktree` tRPC mutation to accept taskTitle
  - [x] 5.2: Update task.router.ts to pass task title when creating worktree
  - [x] 5.3: Store generated branch_name in task record after worktree creation
  - [x] 5.4: Add `getBranchName` query procedure to git.router.ts

- [x] Task 6: Add branch name display to task details UI (AC: 5)
  - [x] 6.1: Display branch name in task workspace header/details section
  - [x] 6.2: Add "Copy branch name" button with clipboard functionality
  - [x] 6.3: Show branch name only when task has worktree/branch

- [x] Task 7: Add comprehensive tests (AC: 1, 2, 3, 4)
  - [x] 7.1: Unit tests for `generateSlug()` - various title formats
  - [x] 7.2: Unit tests for `generateBranchName()` - pattern validation
  - [x] 7.3: Unit tests for special character removal and edge cases
  - [x] 7.4: Unit tests for 50-char truncation at word boundary
  - [x] 7.5: Integration tests for `branchExists()`
  - [x] 7.6: Integration tests for `getUniqueBranchName()` with suffix incrementing
  - [x] 7.7: Integration tests for createWorktree with new naming

## Dev Notes

### Existing Code to Extend

**CRITICAL:** GitService already exists at `src/main/services/git.service.ts`. The current implementation from Story 8.2 includes:

```typescript
// Existing methods from Story 8.1 and 8.2:
static async createWorktree(projectPath: string, taskId: string): Promise<string>
static async hasWorktree(projectPath: string, taskId: string): Promise<boolean>
static async getWorktreePath(projectPath: string, taskId: string): Promise<string | null>
private static async execGit(args: string[], cwd: string, timeout?: number)
private static validatePath(path: string, operationName: string): void

// Constants available:
const GIT_BRANCH_TIMEOUT = 5000  // For branch operations
const GIT_LARGE_OP_TIMEOUT = 30000  // For worktree creation
const DANGEROUS_CHARS = /[;&|`$()<>]/  // For path/taskId validation
```

**CURRENT BRANCH NAMING (Story 8.2):** The existing `createWorktree` uses simple naming:
```typescript
const branchName = `task/${taskId}`  // e.g., task/abc123
```

**NEW REQUIREMENT (Story 8.3):** Change to descriptive naming:
```typescript
const branchName = `tinsu/story-${taskId}-${slug}`  // e.g., tinsu/story-abc123-add-user-auth
```

### Branch Naming Convention Details

**Pattern:** `tinsu/story-{task-id}-{slug}`

| Component | Source | Example |
|-----------|--------|---------|
| Prefix | Fixed | `tinsu/story-` |
| task-id | Task.id from database | `abc123` |
| slug | Generated from task.title | `add-user-authentication` |

**Slug Generation Rules:**
1. Convert to lowercase
2. Replace spaces with hyphens
3. Remove special characters (keep only a-z, 0-9, hyphens)
4. Collapse multiple consecutive hyphens into one
5. Trim leading/trailing hyphens
6. Truncate to 50 characters at word boundary when possible

**Example Transformations:**
| Input Title | Generated Slug |
|-------------|----------------|
| "Add User Authentication" | `add-user-authentication` |
| "Fix the 'Login' Bug!" | `fix-the-login-bug` |
| "Implement OAuth 2.0 Support" | `implement-oauth-20-support` |
| "Very Long Title That Exceeds Fifty Characters And Keeps Going" | `very-long-title-that-exceeds-fifty-characters` |

### Git Branch Name Validation (NFR23)

Git branch names have restrictions. The slug generator MUST ensure:
- No consecutive dots `..`
- No ASCII control characters
- No space, `~`, `^`, `:`, `\`, `?`, `*`, `[`
- Cannot start or end with `.` or `/`
- Cannot end with `.lock`

Regex pattern for invalid characters to remove:
```typescript
const INVALID_BRANCH_CHARS = /[~^:\\\?\*\[\]@{}|'"`!#$%&()+,;=<>]/g
```

### Database Schema Addition

Add to `src/main/db/schema.ts` tasks table:
```typescript
// Story 8.3: Branch name for git worktree
branch_name: text('branch_name'),  // e.g., tinsu/story-abc123-add-user-auth
```

Add migration in `src/main/db/index.ts`:
```typescript
// Story 8.3: Add branch_name column to tasks
db.exec(`
  ALTER TABLE tasks ADD COLUMN branch_name TEXT;
`)
```

### Updated createWorktree Signature

Current (Story 8.2):
```typescript
static async createWorktree(projectPath: string, taskId: string): Promise<string>
```

New (Story 8.3):
```typescript
static async createWorktree(
  projectPath: string,
  taskId: string,
  taskTitle?: string  // Optional for backward compatibility
): Promise<{ worktreePath: string; branchName: string }>
```

### Branch Uniqueness Algorithm

```typescript
async getUniqueBranchName(projectPath: string, baseName: string): Promise<string> {
  let candidate = baseName
  let suffix = 1

  while (await this.branchExists(projectPath, candidate)) {
    suffix++
    candidate = `${baseName}-${suffix}`
  }

  return candidate
}
```

### UI Implementation Notes (AC: 5)

**🎨 FRONTEND/UI STORY:** Dev agent MUST use /frontend-design skill for Task 6.

Location for branch name display: Task workspace header or details panel.

```tsx
// In TaskWorkspace.tsx or similar
{task.branch_name && (
  <div className="flex items-center gap-2">
    <GitBranchIcon className="h-4 w-4 text-muted-foreground" />
    <code className="text-sm bg-muted px-2 py-0.5 rounded">{task.branch_name}</code>
    <Button variant="ghost" size="icon" onClick={() => copyToClipboard(task.branch_name)}>
      <CopyIcon className="h-4 w-4" />
    </Button>
  </div>
)}
```

Use the `navigator.clipboard.writeText()` API for copying.

### Architecture Compliance

Per `architecture.md`:
- GitService lives in `src/main/services/git.service.ts` (main process only)
- Uses `child_process.exec` for git CLI execution
- Exposes methods via `src/main/trpc/routers/git.router.ts`
- Follows error handling pattern: catch errors, throw `TRPCError` with context

### Testing Strategy

Per `project-context.md`:
- Tests co-located with source: `git.service.test.ts`
- Mock `child_process.exec` for unit tests
- Use temp directories for integration tests

**Test Cases for generateSlug:**
```typescript
describe('generateSlug', () => {
  it('converts to lowercase', () => {
    expect(generateSlug('Hello World')).toBe('hello-world')
  })

  it('removes special characters', () => {
    expect(generateSlug("Fix the 'Login' Bug!")).toBe('fix-the-login-bug')
  })

  it('truncates to 50 chars at word boundary', () => {
    const long = 'A Very Long Title That Definitely Exceeds Fifty Characters'
    expect(generateSlug(long).length).toBeLessThanOrEqual(50)
    expect(generateSlug(long)).not.toContain('--')
  })

  it('handles empty string', () => {
    expect(generateSlug('')).toBe('untitled')
  })

  it('handles only special characters', () => {
    expect(generateSlug('!!!@@@###')).toBe('untitled')
  })
})
```

### Project Structure Notes

Files to modify:
- `src/main/db/schema.ts` - Add branch_name column
- `src/main/db/index.ts` - Add migration
- `src/shared/types/task.types.ts` - Add branch_name to Task interface
- `src/main/services/git.service.ts` - Add slug/branch generation methods
- `src/main/services/git.service.test.ts` - Add new tests
- `src/main/trpc/routers/git.router.ts` - Update createWorktree, add getBranchName
- `src/main/trpc/routers/task.router.ts` - Pass title to worktree creation, store branch_name
- `src/renderer/src/components/task-workspace/` - Add branch name display (Task 6)

### Previous Story Intelligence (8-2)

From Story 8.2 completion notes:
- Worktree path convention: `.tinsu/worktrees/{task-id}/`
- Task status flow triggers worktree creation on "create_story" or "in_progress"
- Rollback on failure implemented - must maintain this pattern
- 54 git service unit tests + 8 integration tests - extend test coverage
- `worktree_path` column already exists - add `branch_name` alongside it

### Git Commands Reference

```bash
# Check if branch exists
git show-ref --verify refs/heads/tinsu/story-abc123-add-user-auth

# Create worktree with custom branch name
git worktree add .tinsu/worktrees/{task-id} -b tinsu/story-{task-id}-{slug} HEAD

# List branches (for debugging)
git branch --list "tinsu/*"
```

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#Git Integration]
- [Source: _bmad-output/planning-artifacts/architecture.md#Naming Patterns]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 8.3]
- [Source: _bmad-output/planning-artifacts/project-context.md#Git Worktree Pattern]
- [Source: src/main/services/git.service.ts - existing implementation from Stories 8.1 & 8.2]
- [Source: _bmad-output/implementation-artifacts/8-2-create-worktree-on-task-start.md - previous story]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A

### Completion Notes List

1. **Database Schema**: Added `branch_name` column to tasks table with migration support
2. **Slug Generation**: Implemented `generateSlug()` with lowercase conversion, special char removal, hyphen collapsing, and 50-char truncation at word boundaries
3. **Branch Naming**: Pattern `tinsu/story-{taskId}-{slug}` generates valid git branch names (NFR23 compliant)
4. **Uniqueness Check**: `branchExists()` uses `git show-ref --verify` for reliable branch detection; `getUniqueBranchName()` appends `-2`, `-3` etc. for collisions
5. **createWorktree Updated**: Now accepts optional `taskTitle`, returns `{worktreePath, branchName}` object; backward compatible when no title provided
6. **tRPC Integration**: Updated both `git.router.ts` and `task.router.ts` to support new branch naming and persist `branch_name` to database
7. **UI Implementation**: Added branch name display to TaskDetailContent header with GitBranch icon, monospace code styling, and copy-to-clipboard with visual feedback (check icon on success)
8. **Test Coverage**: 86 total tests pass, including 33 new tests for Story 8.3 (generateSlug, generateBranchName, branchExists, getUniqueBranchName, createWorktree with title)

### File List

- `src/main/db/schema.ts` - Added branch_name column
- `src/main/db/index.ts` - Added migration for branch_name
- `src/shared/types/task.types.ts` - Added branch_name to Task and NewTask interfaces
- `src/main/services/git.service.ts` - Added generateSlug, generateBranchName, branchExists, getUniqueBranchName; updated createWorktree signature
- `src/main/services/git.service.test.ts` - Added 33 new tests for Story 8.3
- `src/main/trpc/routers/git.router.ts` - Updated createWorktree mutation, added getBranchName query
- `src/main/trpc/routers/task.router.ts` - Updated updateStatus to pass task title and store branch_name
- `src/renderer/src/components/task/TaskDetailContent.tsx` - Added branch name display with copy functionality

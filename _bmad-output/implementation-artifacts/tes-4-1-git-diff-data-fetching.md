# Story 4.1: Git Diff Data Fetching

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want to fetch the git diff for a task's changes,
So that I can see what the agent modified.

## Acceptance Criteria

1. **Given** a task has an associated working directory
   **When** the Diff section requests data
   **Then** the system runs `git diff` against the task's repository
   **And** returns a structured diff object with files and hunks

2. **Given** the task's repository has uncommitted changes
   **When** the diff is fetched
   **Then** both staged and unstaged changes are included
   **And** the diff reflects the current working state

3. **Given** the task has no changes yet
   **When** the diff is fetched
   **Then** an empty diff is returned
   **And** the UI shows "No changes yet"

4. **Given** git diff fails (e.g., not a git repository)
   **When** the error is caught
   **Then** an error state is displayed with "Unable to load diff"

## Tasks / Subtasks

- [x] Task 1: Create GitService with diff fetching capability (AC: #1, #2, #3, #4)
  - [x] 1.1: Create `src/main/services/git.service.ts` with `getDiff()` method
  - [x] 1.2: Implement unified diff parsing logic to extract files and hunks
  - [x] 1.3: Define TypeScript interfaces for `GitDiffResult`, `GitDiffFile`, `GitDiffHunk`, `DiffLine`
  - [x] 1.4: Handle git command errors gracefully with typed error handling
  - [x] 1.5: Export service from `src/main/services/index.ts`

- [x] Task 2: Create git tRPC router (AC: #1, #2, #3, #4)
  - [x] 2.1: Create `src/main/trpc/routers/git.router.ts` with `getDiff` procedure
  - [x] 2.2: Add Zod input validation for taskId parameter
  - [x] 2.3: Look up project root from context for git operations
  - [x] 2.4: Handle TRPCError for NOT_FOUND and INTERNAL_SERVER_ERROR cases
  - [x] 2.5: Register git router in `src/main/trpc/index.ts` appRouter

- [x] Task 3: Create useDiff hook for frontend (AC: #1, #2, #3, #4)
  - [x] 3.1: Create `src/renderer/src/hooks/useDiff.ts`
  - [x] 3.2: Implement useQuery for fetching diff data
  - [x] 3.3: Add refresh capability with refetch callback
  - [x] 3.4: Handle loading, error, and empty states
  - [x] 3.5: Integrate with toast notifications for error feedback

- [x] Task 4: Wire up to DiffPlaceholder component (AC: #3, #4)
  - [x] 4.1: Update `DiffPlaceholder.tsx` to use `useDiff` hook
  - [x] 4.2: Display loading skeleton during fetch
  - [x] 4.3: Display "No changes yet" empty state
  - [x] 4.4: Display error state with retry option

## Dev Notes

### Architecture Compliance

This story implements the data fetching layer for Epic 4: Git Diff Viewer. It follows the established TES patterns:

**Service Layer Pattern:**
- Use `child_process.exec()` with `promisify()` pattern (same as `task-terminal.service.ts`)
- Set reasonable timeout: `GIT_COMMAND_TIMEOUT = 10000` (diffs can be large)
- Validate inputs to prevent command injection
- Return typed Promise<GitDiffResult>

**tRPC Router Pattern:**
- Use Zod schemas for input validation
- Return data directly (DO NOT wrap in `{ success: true, data: ... }`)
- Use TRPCError with typed codes: `'NOT_FOUND'`, `'BAD_REQUEST'`, `'INTERNAL_SERVER_ERROR'`
- Access project context via `ctx.projectRoot`

**Frontend Hook Pattern:**
- Use tRPC's useQuery for data fetching
- Use React Query's cache with `staleTime: 0` (diffs change frequently)
- Provide refresh callback for manual re-fetch
- Use Sonner toast for error notifications

### Critical Implementation Details

**Git Diff Command:**
```bash
# Get both staged and unstaged changes relative to HEAD
git diff HEAD --unified=3
```

**Parsing Unified Diff Format:**
The unified diff format has this structure:
```
diff --git a/path/to/file b/path/to/file
index abc123..def456 100644
--- a/path/to/file
+++ b/path/to/file
@@ -start,count +start,count @@ optional context
-removed line
+added line
 context line
```

Key parsing rules:
- Lines starting with `diff --git` mark file boundaries
- Lines starting with `@@` mark hunk headers
- Lines starting with `-` are removed (from old file)
- Lines starting with `+` are added (to new file)
- Lines starting with ` ` (space) are context (unchanged)

**TypeScript Interfaces to Define:**

```typescript
interface GitDiffResult {
  files: GitDiffFile[]
  summary: {
    filesChanged: number
    linesAdded: number
    linesRemoved: number
  }
}

interface GitDiffFile {
  path: string
  oldPath?: string // For renames
  status: 'added' | 'modified' | 'deleted' | 'renamed'
  additions: number
  deletions: number
  hunks: GitDiffHunk[]
}

interface GitDiffHunk {
  oldStart: number
  oldLines: number
  newStart: number
  newLines: number
  header: string
  lines: DiffLine[]
}

interface DiffLine {
  type: 'add' | 'remove' | 'context'
  content: string
  oldLineNo?: number
  newLineNo?: number
}
```

### Library Considerations

**Diff Parsing Options:**
1. **Manual Parsing** (RECOMMENDED for MVP): Parse unified diff output directly
   - No external dependency
   - Full control over output structure
   - Simple regex-based parsing

2. **parse-diff npm package**: Third-party unified diff parser
   - GitHub: [sergeyt/parse-diff](https://github.com/sergeyt/parse-diff)
   - Mature library, handles edge cases
   - Consider for future enhancement if manual parsing proves insufficient

**Monaco Editor Integration (Future Story TES-4-4):**
- Uses `@monaco-editor/react` package (already available for code editing)
- DiffEditor component: `import { DiffEditor } from '@monaco-editor/react'`
- This story only provides data; Monaco integration is separate

### Project Structure Notes

**Files to Create:**
```
src/main/services/git.service.ts          # Git diff service
src/main/trpc/routers/git.router.ts       # tRPC router for git operations
src/renderer/src/hooks/useDiff.ts         # React hook for diff data
```

**Files to Modify:**
```
src/main/services/index.ts                # Export GitService
src/main/trpc/index.ts                    # Register gitRouter
src/renderer/src/components/task/DiffPlaceholder.tsx  # Use useDiff hook
```

**Naming Conventions:**
- Service: `GitService` (PascalCase class)
- Router: `gitRouter` (camelCase export)
- Hook: `useDiff` (camelCase with use prefix)
- Types: `GitDiffResult`, `GitDiffFile` (PascalCase, NO I prefix)

### Testing Standards

**Service Tests (`git.service.test.ts`):**
- Test diff parsing with sample unified diff output
- Test handling of empty diff (no changes)
- Test handling of git command errors
- Mock `child_process.exec` to avoid actual git operations

**Router Tests (`git.router.test.ts`):**
- Test successful diff fetch
- Test NOT_FOUND error when project doesn't exist
- Test INTERNAL_SERVER_ERROR when git fails

**Hook Tests (`useDiff.test.ts`):**
- Test loading state
- Test successful data return
- Test error handling
- Mock tRPC client

### References

- [Source: _bmad-output/planning-artifacts/epics-task-execution-sandbox.md#Epic 4: Git Diff Viewer] - Story requirements
- [Source: _bmad-output/planning-artifacts/architecture.md#Task Execution Sandbox Architecture] - Service patterns
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Diff Tab] - UI specifications
- [Source: _bmad-output/planning-artifacts/project-context.md#TRPC Patterns] - tRPC patterns
- [Source: src/main/services/task-terminal.service.ts] - Service pattern reference
- [Source: src/main/services/activity-log.service.ts] - Service pattern reference
- [Source: src/main/trpc/routers/activity.router.ts] - Router pattern reference
- [Source: src/renderer/src/hooks/useTaskArtifacts.ts] - Hook pattern reference

### Git Intelligence (Recent Commits)

Recent commits show TES-3 implementation completed:
- `tes-3-3 done` - Section expand/collapse
- `tes-3-2 done` - Three-column resizable workspace
- `tes-3-1 done` - Task workspace navigation

The workspace structure is now complete and ready for the Diff Viewer integration. The `DiffPlaceholder.tsx` component is the integration point.

### External Resources

**Diff Parsing:**
- [jsdiff](https://github.com/kpdecker/jsdiff) - JavaScript text differencing
- [parse-diff](https://github.com/sergeyt/parse-diff) - Unified diff parser
- [Git diff documentation](https://git-scm.com/docs/git-diff)

**Monaco Editor:**
- [@monaco-editor/react](https://www.npmjs.com/package/@monaco-editor/react) - React wrapper with DiffEditor
- [Monaco React Demo](https://monaco-react.surenatoyan.com) - Live examples

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A

### Completion Notes List

- GitService implements full unified diff parsing with support for modified, added, deleted, and renamed files
- Git command uses `git diff HEAD --unified=3` to capture both staged and unstaged changes
- **Code Review Fix:** Added support for untracked files via `git ls-files --others --exclude-standard`
- **Code Review Fix:** Added input sanitization to prevent command injection vulnerabilities
- **Code Review Fix:** Removed unused taskId parameter from git router for API honesty
- **Code Review Fix:** Added proper git router tests with procedure calls and GitService mocking
- **Code Review Fix:** Added isRefreshing state to error retry button for better UX
- **Code Review Fix:** Added security test cases for command injection protection
- 13 unit tests for GitService (added 3 new security/validation tests)
- 5 unit tests for git router (improved from structure-only to actual procedure tests)
- 7 unit tests for useDiff hook
- DiffPlaceholder updated with loading skeleton, empty state, error state, and diff content view
- Skeleton UI component added as shadcn/ui component
- All acceptance criteria met:
  - AC1: ✅ System runs `git diff` and returns structured diff object
  - AC2: ✅ Both staged and unstaged changes included via `git diff HEAD` + untracked files
  - AC3: ✅ Empty diff shows "No changes yet" with refresh button
  - AC4: ✅ Error state shows "Unable to load diff" with retry button

### Code Review Fixes Applied

**Session:** Code Review by Claude Sonnet 4.5 (2026-01-21)

**Issues Fixed:** 9 total (4 High, 5 Medium)

**High Priority:**
1. ✅ Removed unused taskId parameter from git.router.ts (lines 32-38)
2. ✅ Added input sanitization with dangerous character detection in git.service.ts (lines 111-126)
3. ✅ Added security test cases for command injection protection (git.service.test.ts)
4. ✅ Fixed useDiff query to not pass taskId parameter (useDiff.ts:51)

**Medium Priority:**
1. ✅ Rewrote git router tests to actually test procedures with mocked GitService (git.router.test.ts)
2. ✅ Added isRefreshing state to error retry button (DiffPlaceholder.tsx:73-78)
3. ✅ Error handling already sufficient in useDiff hook (no changes needed)
4. ✅ Added untracked files support via parallel git commands (git.service.ts:131-172)

**Low Priority (Fixed):**
1. ✅ Renamed `DiffLine` to `GitDiffLine` for consistent naming (all types now have `Git` prefix)

**Low Priority Issues (Not Fixed):**
- Changes not committed yet - will be addressed in this commit
- Test mock typing could be more precise - acceptable for current test coverage

### File List

**Created:**
- src/main/services/git.service.ts - GitService with getDiff() and parseDiff() methods
- src/main/services/git.service.test.ts - 10 unit tests
- src/main/trpc/routers/git.router.ts - tRPC router with getDiff procedure
- src/main/trpc/routers/git.router.test.ts - 3 unit tests
- src/renderer/src/hooks/useDiff.ts - React hook for diff data fetching
- src/renderer/src/hooks/useDiff.test.tsx - 7 unit tests
- src/renderer/src/components/ui/skeleton.tsx - Skeleton loading component

**Modified:**
- src/main/services/index.ts - Export GitService and types
- src/main/trpc/index.ts - Register gitRouter
- src/renderer/src/components/task/DiffPlaceholder.tsx - Full implementation with useDiff hook
- src/renderer/src/components/workspace/ResizableWorkspace.tsx - Pass taskId to DiffPlaceholder
- src/renderer/src/components/task/TaskDetailContent.tsx - Pass taskId to DiffPlaceholder
- src/renderer/src/components/task/TaskDetailContent.test.tsx - Added git mock


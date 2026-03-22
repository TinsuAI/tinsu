# Story 1.11: Create New Project from Scratch

Status: review

🎨 FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.

## Story

As a founder,
I want to create a brand-new project from scratch inside TinSu,
so that I don't need to manually create a folder and run `git init` before I can start using TinSu.

## Acceptance Criteria

1. **Given** the Welcome screen, **When** I look at the "Get Started" card, **Then** I see a "Create New Project" button alongside the existing "Open Existing Project" button.

2. **Given** I click "Create New Project", **When** the dialog opens, **Then** I see:
   - A text input for "Project Name"
   - A "Choose Folder" button that opens the native OS folder picker to select a parent directory
   - A read-only preview showing the full path where the project will be created (e.g., `/Users/me/dev/my-project`)
   - A "Create Project" button (disabled until both project name and parent directory are provided)
   - A "Cancel" button

3. **Given** I fill in a valid project name and parent directory, **When** I click "Create Project", **Then**:
   - A new folder `{parentDir}/{projectName}` is created on disk
   - `git init` is executed in that folder
   - TinSu initializes the project (`.tinsu/` folder, `config.yaml`, `.gitignore` updated) via the existing `openProject()` flow
   - The app transitions to the main app view, same as after opening an existing project

4. **Given** a project name is typed, **When** it contains characters invalid for a folder name (e.g., `/`, `\`, `:`, `*`, `?`, `"`, `<`, `>`, `|`), **Then** those characters are either stripped or the input is rejected with an inline validation message and "Create Project" remains disabled.

5. **Given** a valid name and parent directory, **When** a folder with that name already exists in the parent directory, **Then** an error message is shown inside the dialog: "A folder named '{projectName}' already exists at that location."

6. **Given** the project creation flow, **When** `git init` fails (e.g., git not installed), **Then** an error message is shown: "Failed to initialize git repository. Please ensure git is installed."

7. **Given** the project creation flow, **When** folder creation fails (e.g., permission denied), **Then** an error message is shown with the specific reason.

8. **Given** the "Choose Folder" picker, **When** I cancel the folder picker without selecting, **Then** the parent directory field is unchanged and no error is shown.

9. **Given** the loading state while the project is being created, **When** creation is in progress, **Then** the "Create Project" button shows "Creating..." and all inputs are disabled.

## Tasks / Subtasks

- [x] Task 1: Add `createNewProject` method to `ProjectService` (AC: #3, #5, #6, #7)
  - [x] 1.1: Add new method `static async createNewProject(parentDir: string, projectName: string): Promise<ProjectInfo>` to `src/main/services/project.service.ts`
  - [x] 1.2: Validate `parentDir` exists and is a directory; throw `ProjectError` with code `'NOT_FOUND'` if not
  - [x] 1.3: Check `{parentDir}/{projectName}` does NOT already exist; throw `ProjectError` with code `'ALREADY_EXISTS'` if it does
  - [x] 1.4: Create the folder: `fs.mkdirSync(newProjectPath, { recursive: false })`
  - [x] 1.5: Run `git init` via `child_process.execSync('git init', { cwd: newProjectPath })`; wrap in try/catch and throw `ProjectError` with code `'GIT_INIT_FAILED'` on failure
  - [x] 1.6: Call existing `ProjectService.openProject(newProjectPath)` to complete initialization — reuse all existing logic (`.tinsu/`, config, DB registration, default sprint, planning tasks)
  - [x] 1.7: Add `'ALREADY_EXISTS'` and `'GIT_INIT_FAILED'` to `ProjectError` code union type

- [x] Task 2: Add `project.create` tRPC procedure to `project.router.ts` (AC: #3)
  - [x] 2.1: Add new procedure `create` to `src/main/trpc/routers/project.router.ts`
  - [x] 2.2: Input schema: `z.object({ parentDir: z.string().min(1), projectName: z.string().min(1) })`
  - [x] 2.3: Call `ProjectService.createNewProject(input.parentDir, input.projectName)` and return `ProjectInfo`
  - [x] 2.4: Add `'ALREADY_EXISTS'` and `'GIT_INIT_FAILED'` cases to `projectErrorToTRPCError()` converter (both map to `'BAD_REQUEST'`)

- [x] Task 3: Add `openParentDirectoryDialog` helper to `project.router.ts` (AC: #2, #8)
  - [x] 3.1: Add new procedure `selectParentDirectory` to the project router
  - [x] 3.2: Show Electron dialog with `properties: ['openDirectory', 'createDirectory']` and title `'Select Parent Folder'`
  - [x] 3.3: Return `{ canceled: boolean, path: string | null }` — reuse the `openDirectoryDialog` pattern already in the router
  - [x] 3.4: No input required — this is a mutation (side effect: opens native dialog)

- [x] Task 4: Build `NewProjectDialog` component (AC: #1, #2, #4, #8, #9)
  - [x] 4.1: Create `src/renderer/src/components/NewProjectDialog.tsx`
  - [x] 4.2: Use shadcn `Dialog` / `DialogContent` / `DialogHeader` / `DialogFooter` components
  - [x] 4.3: Project name input: `<Input>` with label "Project Name", placeholder "my-project"
  - [x] 4.4: Inline validation: strip or block characters matching `/[/\\:*?"<>|]/g`; show message "Project name contains invalid characters" if blocked
  - [x] 4.5: Parent folder section: display current selection as a path string, plus a "Choose Folder" button that calls `trpc.project.selectParentDirectory.useMutation()`
  - [x] 4.6: Path preview: show full path `{parentDir}/{projectName}` in a read-only `<code>` or muted text block; only shown when both fields have values
  - [x] 4.7: "Create Project" button: disabled unless `projectName.trim().length > 0 && parentDir !== null`
  - [x] 4.8: Use `trpc.project.create.useMutation()` on submit; on success call `onProjectCreated(result)` prop
  - [x] 4.9: Show inline error from mutation `onError` (not a toast — inside the dialog)
  - [x] 4.10: Show loading state: button text "Creating...", all inputs `disabled` during `isPending`
  - [x] 4.11: "Cancel" button dismisses dialog and resets form state

- [x] Task 5: Update `Welcome.tsx` to include "Create New Project" entry point (AC: #1)
  - [x] 5.1: Add state `isCreateDialogOpen: boolean` (default `false`) to `Welcome`
  - [x] 5.2: Add "Create New Project" `<Button>` below the existing "Open Existing Project" button with `variant="outline"` styling so it's visually secondary
  - [x] 5.3: Update the hint text below the buttons from "TinSu works with existing git repositories" to "Open an existing git repository or create a new project"
  - [x] 5.4: Render `<NewProjectDialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen} onProjectCreated={handleProjectOpened} />`
  - [x] 5.5: Disable both Welcome buttons while `isLoading` is true (keep existing `isLoading` logic, add `isCreateDialogOpen` to `isLoading` only during actual creation — handled inside the dialog)

- [x] Task 6: Write unit tests for `ProjectService.createNewProject()` (AC: #3, #5, #6, #7)
  - [x] 6.1: Extend `src/main/services/project.service.test.ts`
  - [x] 6.2: Test: creates folder and calls `openProject` on success (mock `execSync` and `fs.mkdirSync`)
  - [x] 6.3: Test: throws `ALREADY_EXISTS` when folder already exists
  - [x] 6.4: Test: throws `GIT_INIT_FAILED` when `execSync('git init')` throws
  - [x] 6.5: Test: throws `NOT_FOUND` when parent directory does not exist

- [x] Task 7: Write unit tests for the `project.create` tRPC procedure (AC: #3, #5)
  - [x] 7.1: Extend `src/main/trpc/routers/project.router.test.ts`
  - [x] 7.2: Test: calls `createNewProject` and returns `ProjectInfo`
  - [x] 7.3: Test: converts `ALREADY_EXISTS` error to `BAD_REQUEST` TRPCError

- [x] Task 8: Write unit tests for `NewProjectDialog` component (AC: #2, #4, #8, #9)
  - [x] 8.1: Create `src/renderer/src/components/NewProjectDialog.test.tsx`
  - [x] 8.2: Test: dialog renders project name input and Choose Folder button
  - [x] 8.3: Test: Create Project button is disabled until both fields are filled
  - [x] 8.4: Test: path preview shows `{parentDir}/{projectName}` when both are set
  - [x] 8.5: Test: inline error is shown on mutation failure
  - [x] 8.6: Test: inputs are disabled during `isPending`
  - [x] 8.7: Test: Cancel button closes dialog (calls `onOpenChange(false)`)

- [x] Task 9: Write updated tests for `Welcome.tsx` (AC: #1)
  - [x] 9.1: Extend `src/renderer/src/components/Welcome.test.tsx`
  - [x] 9.2: Test: "Create New Project" button renders on Welcome screen
  - [x] 9.3: Test: clicking "Create New Project" opens the NewProjectDialog

## Dev Notes

### Architecture Compliance

**Do NOT reinvent existing logic.** The `openProject()` flow in `project.service.ts` already handles:
- `.tinsu/` folder + `config.yaml` creation
- `.gitignore` update
- DB registration (`registerOrUpdateProject`)
- Default sprint creation (`ensureDefaultSprint`)
- Planning task initialization

`createNewProject()` ONLY needs to: validate → create folder → `git init` → call `openProject()`.

**File locations:**
- Service method: `src/main/services/project.service.ts` (extend existing class)
- tRPC router: `src/main/trpc/routers/project.router.ts` (add new procedures)
- Dialog component: `src/renderer/src/components/NewProjectDialog.tsx` (new file)
- Welcome update: `src/renderer/src/components/Welcome.tsx` (extend existing)
- Tests: co-located with source files using `.test.tsx` / `.test.ts` pattern

**Naming conventions (per architecture.md):**
- Component: `NewProjectDialog` (PascalCase)
- tRPC procedures: `create`, `selectParentDirectory` (camelCase verb prefix)
- New error codes: `'ALREADY_EXISTS'`, `'GIT_INIT_FAILED'` (added to `ProjectError` union)

### `ProjectError` Code Extension

```typescript
// In project.service.ts — extend the code union
export class ProjectError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'NOT_GIT_REPO'
      | 'NOT_FOUND'
      | 'ALREADY_OPEN'
      | 'INIT_ERROR'
      | 'INVALID_PATH'
      | 'ALREADY_EXISTS'   // ← new
      | 'GIT_INIT_FAILED', // ← new
    public readonly details?: string
  ) { ... }
}
```

### `createNewProject` Implementation Pattern

```typescript
import { execSync } from 'child_process'

static async createNewProject(parentDir: string, projectName: string): Promise<ProjectInfo> {
  // Validate parent directory exists
  if (!fs.existsSync(parentDir) || !fs.statSync(parentDir).isDirectory()) {
    throw new ProjectError(
      `Parent directory not found: ${parentDir}`,
      'NOT_FOUND'
    )
  }

  const newProjectPath = path.join(parentDir, projectName)

  // Check folder doesn't already exist
  if (fs.existsSync(newProjectPath)) {
    throw new ProjectError(
      `A folder named '${projectName}' already exists at that location.`,
      'ALREADY_EXISTS'
    )
  }

  // Create folder
  try {
    fs.mkdirSync(newProjectPath, { recursive: false })
  } catch (err) {
    throw new ProjectError(
      `Failed to create project folder: ${(err as Error).message}`,
      'INIT_ERROR'
    )
  }

  // Initialize git
  try {
    execSync('git init', { cwd: newProjectPath, stdio: 'pipe' })
  } catch {
    // Clean up folder on failure
    try { fs.rmSync(newProjectPath, { recursive: true, force: true }) } catch {}
    throw new ProjectError(
      'Failed to initialize git repository. Please ensure git is installed.',
      'GIT_INIT_FAILED'
    )
  }

  // Reuse existing openProject flow — handles .tinsu, config, DB, sprints, planning tasks
  return this.openProject(newProjectPath)
}
```

### `selectParentDirectory` tRPC Procedure Pattern

```typescript
selectParentDirectory: publicProcedure.mutation(async (): Promise<{ canceled: boolean; path: string | null }> => {
  const window = BrowserWindow.getFocusedWindow()
  const result = await dialog.showOpenDialog(window!, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Select Parent Folder'
  })
  return {
    canceled: result.canceled,
    path: result.canceled ? null : result.filePaths[0]
  }
}),
```

### `project.create` tRPC Procedure Pattern

```typescript
create: publicProcedure
  .input(z.object({
    parentDir: z.string().min(1, 'Parent directory is required'),
    projectName: z.string().min(1, 'Project name is required')
  }))
  .mutation(async ({ input }): Promise<ProjectInfo> => {
    try {
      return await ProjectService.createNewProject(input.parentDir, input.projectName)
    } catch (error) {
      if (error instanceof ProjectError) {
        throw projectErrorToTRPCError(error)
      }
      throw error
    }
  }),
```

And extend `projectErrorToTRPCError()`:
```typescript
case 'ALREADY_EXISTS':
case 'GIT_INIT_FAILED':
  return new TRPCError({ code: 'BAD_REQUEST', message: error.message, cause: error })
```

### Welcome.tsx UI Layout

The two buttons stack vertically inside the existing card. The visual hierarchy:
- "Open Existing Project" — primary `<Button>` (filled) — existing
- "Create New Project" — secondary `<Button variant="outline">` — new

Updated hint text:
```tsx
<p className="mt-4 text-center text-sm text-muted-foreground">
  Open an existing git repository or create a new project
</p>
```

### `NewProjectDialog` Component Structure

```tsx
import { useState } from 'react'
import { FolderOpen } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog'
import { trpc } from '@renderer/lib/trpc'

const INVALID_CHARS = /[/\\:*?"<>|]/g

interface NewProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onProjectCreated: (info: { path: string; projectName: string }) => void
}

export function NewProjectDialog({ open, onOpenChange, onProjectCreated }: NewProjectDialogProps) {
  const [projectName, setProjectName] = useState('')
  const [parentDir, setParentDir] = useState<string | null>(null)
  const [nameError, setNameError] = useState<string | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)

  const selectDirMutation = trpc.project.selectParentDirectory.useMutation({
    onSuccess: (result) => {
      if (!result.canceled && result.path) {
        setParentDir(result.path)
      }
    }
  })

  const createMutation = trpc.project.create.useMutation({
    onSuccess: (result) => {
      onProjectCreated({ path: result.path, projectName: result.config.projectName })
      onOpenChange(false)
    },
    onError: (err) => {
      setCreateError(err.message || 'Failed to create project')
    }
  })

  const handleNameChange = (value: string) => {
    if (INVALID_CHARS.test(value)) {
      setNameError('Project name contains invalid characters')
    } else {
      setNameError(null)
    }
    setProjectName(value.replace(INVALID_CHARS, ''))
  }

  const handleCreate = () => {
    if (!parentDir || !projectName.trim()) return
    setCreateError(null)
    createMutation.mutate({ parentDir, projectName: projectName.trim() })
  }

  const isValid = projectName.trim().length > 0 && parentDir !== null && !nameError
  const isLoading = createMutation.isPending || selectDirMutation.isPending
  const fullPath = parentDir && projectName ? `${parentDir}/${projectName}` : null

  // Reset state when dialog closes
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setProjectName('')
      setParentDir(null)
      setNameError(null)
      setCreateError(null)
    }
    onOpenChange(open)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Project Name */}
          <div className="space-y-2">
            <Label htmlFor="project-name">Project Name</Label>
            <Input
              id="project-name"
              placeholder="my-project"
              value={projectName}
              onChange={(e) => handleNameChange(e.target.value)}
              disabled={isLoading}
            />
            {nameError && <p className="text-xs text-destructive">{nameError}</p>}
          </div>

          {/* Parent Directory */}
          <div className="space-y-2">
            <Label>Location</Label>
            <div className="flex items-center gap-2">
              <div className="flex-1 truncate rounded border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
                {parentDir ?? 'No folder selected'}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => selectDirMutation.mutate()}
                disabled={isLoading}
              >
                <FolderOpen className="mr-2 h-4 w-4" />
                Choose
              </Button>
            </div>
          </div>

          {/* Path Preview */}
          {fullPath && (
            <p className="text-xs text-muted-foreground">
              Will be created at: <code className="font-mono">{fullPath}</code>
            </p>
          )}

          {/* Create Error */}
          {createError && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {createError}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => handleOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!isValid || isLoading}>
            {isLoading ? 'Creating...' : 'Create Project'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

### Testing Patterns (from Story 1.8 and 1.10)

**Service tests:**
- Create temp dirs in `/tmp/tinsu-*` using `fs.mkdirSync`
- Mock `../db` using `vi.mock()` pattern (see existing `project.service.test.ts`)
- Mock `PlanningInitService` to avoid DB dependencies
- Clean up with `fs.rmSync(TEST_BASE, { recursive: true, force: true })` in `afterEach`
- Reset singleton: `ProjectService.reset()` in `afterEach`

**Dialog component tests (`NewProjectDialog.test.tsx`):**
- Mock `trpc` module similar to `Welcome.test.tsx` pattern — mock `project.create.useMutation` and `project.selectParentDirectory.useMutation`
- Use `@testing-library/react` render + `fireEvent.click` / `fireEvent.change`
- Test button disabled state by checking `expect(button).toBeDisabled()`

**Welcome.test.tsx additions:**
- The existing mock only mocks `project.open` — extend the mock to include `project.create` (as a stub returning `{ mutate: vi.fn(), isPending: false }`) so existing tests don't break when `Welcome` renders `NewProjectDialog`

### Error Message Reference

| Scenario | Error Code | User-facing message |
|---|---|---|
| Parent dir not found | `NOT_FOUND` | "Parent directory not found: {path}" |
| Folder already exists | `ALREADY_EXISTS` | "A folder named '{name}' already exists at that location." |
| `git init` fails | `GIT_INIT_FAILED` | "Failed to initialize git repository. Please ensure git is installed." |
| Folder creation fails | `INIT_ERROR` | "Failed to create project folder: {reason}" |

### `execSync` for git init

Use `child_process.execSync` with `stdio: 'pipe'` to suppress output and capture errors. This is acceptable for a short-lived, synchronous operation in the Electron main process. **Do not use `execa` or other libraries — `child_process` is already available and no new dependencies are needed.**

### Project Structure Notes

**Files to create:**
```
src/renderer/src/components/NewProjectDialog.tsx
src/renderer/src/components/NewProjectDialog.test.tsx
```

**Files to modify:**
```
src/main/services/project.service.ts     — add createNewProject(), extend error codes
src/main/trpc/routers/project.router.ts  — add create, selectParentDirectory procedures
src/renderer/src/components/Welcome.tsx  — add button + dialog
src/renderer/src/components/Welcome.test.tsx — extend mock + add tests
src/main/services/project.service.test.ts    — extend tests for createNewProject
src/main/trpc/routers/project.router.test.ts — extend tests for create procedure
```

### References

- [Source: _bmad-output/implementation-artifacts/1-8-initialize-tinsu-in-existing-git-repository.md] — original openProject flow
- [Source: src/main/services/project.service.ts] — ProjectService, ProjectError, openProject()
- [Source: src/main/trpc/routers/project.router.ts] — existing dialog pattern, projectErrorToTRPCError
- [Source: src/renderer/src/components/Welcome.tsx] — current Welcome screen layout and mutations
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation Patterns] — naming conventions, file structure
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend Architecture] — shadcn/ui, Tailwind patterns

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Initial service test failure: `execSync` mock didn't create `.git` directory, causing `openProject` to fail with `NOT_GIT_REPO`. Fixed by making mock implementation also create `.git` dir.
- Router test failure: DB mock missing `.all()` chain method needed by `ensureDefaultSprint`. Fixed by extending mock.
- Renderer test failures: (1) Path preview test needed `waitFor` since state update triggers re-render; (2) Welcome dialog test matched button text instead of dialog role. Both fixed with more precise selectors.

### Completion Notes List

- Task 1: Added `createNewProject()` static method to `ProjectService`. Extended `ProjectError` union with `ALREADY_EXISTS` and `GIT_INIT_FAILED` codes. Method validates parent dir, checks no existing folder, creates folder, runs `git init`, cleans up on failure, then delegates to `openProject()`.
- Task 2: Added `project.create` tRPC mutation with Zod-validated input (`parentDir`, `projectName`). Extended `projectErrorToTRPCError()` to map new error codes to `BAD_REQUEST`.
- Task 3: Added `project.selectParentDirectory` tRPC mutation. Opens native OS folder picker with `openDirectory` and `createDirectory` properties. Returns `{ canceled, path }`.
- Task 4: Created `NewProjectDialog` component using shadcn/ui Dialog primitives. Includes project name input with inline validation (strips invalid chars), folder picker, path preview, inline error display, loading state with spinner, and form reset on close. Used `/frontend-design` skill for design guidance.
- Task 5: Updated `Welcome.tsx` with "Create New Project" outline button, `NewProjectDialog` integration, and updated hint text.
- Task 6: Added 4 unit tests for `createNewProject()` covering success path, `ALREADY_EXISTS`, `GIT_INIT_FAILED`, and `NOT_FOUND` cases. All pass (34 total in file).
- Task 7: Added 2 tests for `project.create` procedure and 2 tests for `project.selectParentDirectory`. All pass (16 total in file).
- Task 8: Created 7 tests for `NewProjectDialog` covering rendering, disabled state, path preview, error display, loading state, cancel, and input validation.
- Task 9: Extended Welcome tests with updated mock (covers all tRPC hooks), added 2 tests for "Create New Project" button rendering and dialog opening. All 10 Welcome tests pass.

### Change Log

- 2026-03-22: Implemented Story 1.11 - Create New Project from Scratch. Added `createNewProject` service method, `project.create` and `selectParentDirectory` tRPC procedures, `NewProjectDialog` UI component, Welcome screen integration, and 67 passing tests across 4 test files.

### File List

**New files:**
- src/renderer/src/components/NewProjectDialog.tsx
- src/renderer/src/components/NewProjectDialog.test.tsx

**Modified files:**
- src/main/services/project.service.ts (added `createNewProject()`, extended error codes, added `execSync` import)
- src/main/trpc/routers/project.router.ts (added `create`, `selectParentDirectory` procedures, extended error mapping)
- src/renderer/src/components/Welcome.tsx (added "Create New Project" button, dialog integration, updated hint text)
- src/main/services/project.service.test.ts (added `child_process` mock, 4 `createNewProject` tests)
- src/main/trpc/routers/project.router.test.ts (added `child_process` mock, extended DB mock, added `create` and `selectParentDirectory` tests)
- src/renderer/src/components/Welcome.test.tsx (extended tRPC mock for all hooks, added 2 new tests)

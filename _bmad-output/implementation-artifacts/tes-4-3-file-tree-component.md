# Story tes-4.3: File Tree Component

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want to see a list of changed files,
So that I can navigate to specific changes.

## Acceptance Criteria

1. **Given** a diff contains changed files
   **When** the file tree is displayed
   **Then** each file shows: filename, change indicator, line stats (+N -M)

2. **Given** a file was added (new)
   **When** displayed in the tree
   **Then** it shows a green "+" icon and "(new)" label

3. **Given** a file was modified
   **When** displayed in the tree
   **Then** it shows an orange "●" icon

4. **Given** a file was deleted
   **When** displayed in the tree
   **Then** it shows a red "-" icon and "(deleted)" label

5. **Given** a file entry in the tree
   **When** the user clicks on it
   **Then** the diff viewer scrolls to that file's diff
   **And** the file is highlighted as selected

6. **Given** many files are changed
   **When** the tree is displayed
   **Then** it is scrollable independently
   **And** files are sorted: modified first, then added, then deleted

## Tasks / Subtasks

- [x] Task 1: Create FileTree component structure (AC: #1, #6)
  - [x] 1.1: Create `src/renderer/src/components/diff/FileTree.tsx`
  - [x] 1.2: Define `FileTreeProps` interface accepting `files: GitDiffFile[]`, `selectedFile: string | null`, `onFileSelect: (path: string) => void`
  - [x] 1.3: Implement file sorting logic: modified → added → deleted → renamed
  - [x] 1.4: Add scrollable container with `overflow-auto` and `kanban-scroll` class
  - [x] 1.5: Export from `src/renderer/src/components/diff/index.ts`

- [x] Task 2: Implement FileTreeItem component for individual file entries (AC: #1, #2, #3, #4)
  - [x] 2.1: Create `FileTreeItem` as internal component or separate file
  - [x] 2.2: Display filename (truncated if long) with `title` tooltip showing full path
  - [x] 2.3: Add status icons based on file.status:
    - `added`: Green Plus icon (`text-green-500`)
    - `modified`: Orange Circle icon (`text-yellow-500`)
    - `deleted`: Red Minus icon (`text-red-500`)
    - `renamed`: Blue ArrowRight icon (`text-blue-500`)
  - [x] 2.4: Add "(new)" label for added files
  - [x] 2.5: Add "(deleted)" label for deleted files
  - [x] 2.6: Show line stats: `+{additions} -{deletions}` with green/red colors

- [x] Task 3: Implement file selection and highlighting (AC: #5)
  - [x] 3.1: Accept `selectedFile` prop and `onFileSelect` callback
  - [x] 3.2: Highlight selected file with `bg-muted/40` background
  - [x] 3.3: Make file items clickable with `cursor-pointer` and `hover:bg-muted/20`
  - [x] 3.4: Call `onFileSelect(file.path)` on click

- [x] Task 4: Integrate FileTree into DiffPlaceholder (AC: #5)
  - [x] 4.1: Add `selectedFile` state to DiffPlaceholder using `useState`
  - [x] 4.2: Replace inline file list with `FileTree` component
  - [x] 4.3: Pass `onFileSelect` callback that updates `selectedFile` state
  - [x] 4.4: Add scroll-into-view behavior when file is selected (using `scrollIntoView`)

- [x] Task 5: Add unit tests for FileTree component (AC: #1-6)
  - [x] 5.1: Create `src/renderer/src/components/diff/FileTree.test.tsx`
  - [x] 5.2: Test file list renders with correct count
  - [x] 5.3: Test sorting order (modified first, then added, then deleted)
  - [x] 5.4: Test status icons are displayed correctly for each status
  - [x] 5.5: Test "(new)" and "(deleted)" labels appear appropriately
  - [x] 5.6: Test file click calls onFileSelect with correct path
  - [x] 5.7: Test selected file has highlighted styling

## Dev Notes

### Architecture Compliance

This story creates a reusable FileTree component for Epic 4: Git Diff Viewer. It follows established TES patterns:

**Component Pattern:**
- Use shadcn/ui components where applicable (no new shadcn components needed for this story)
- Follow existing TailwindCSS patterns from `DiffPlaceholder.tsx` and `DiffSummaryBar.tsx`
- Use `cn()` utility for conditional classes
- Keep component focused on file tree display with clear separation of concerns

**File Structure Pattern:**
- Components go in `src/renderer/src/components/diff/` folder
- Co-locate tests next to component files
- Export from `index.ts` barrel file

**State Management Pattern:**
- Local UI state (`selectedFile`) managed with `useState` in DiffPlaceholder
- No server state needed - file data already available from `useDiff` hook

### Critical Implementation Details

**File Sorting Priority:**
```typescript
// Sort order: modified (most common) → added → deleted → renamed
const sortOrder = { modified: 0, added: 1, deleted: 2, renamed: 3 }
const sortedFiles = [...files].sort((a, b) => sortOrder[a.status] - sortOrder[b.status])
```

**Status Icons (from Lucide React):**
```tsx
import { Plus, Circle, Minus, ArrowRight } from 'lucide-react'

// Icon mapping
const statusIcons = {
  added: <Plus className="h-3.5 w-3.5 text-green-500" />,
  modified: <Circle className="h-3.5 w-3.5 text-yellow-500" fill="currentColor" />,
  deleted: <Minus className="h-3.5 w-3.5 text-red-500" />,
  renamed: <ArrowRight className="h-3.5 w-3.5 text-blue-500" />
}
```

**File Tree Item Layout:**
```
┌─────────────────────────────────────────────────────┐
│ [Icon] filename.tsx (new)              +45 -12     │
│ [Icon] another-file.ts                 +8  -3      │
│ [Icon] deleted.ts (deleted)            +0  -25     │
└─────────────────────────────────────────────────────┘
```

**Scroll Into View:**
```typescript
// When file selected, scroll to it if not visible
const fileRef = useRef<HTMLDivElement>(null)
useEffect(() => {
  if (selected && fileRef.current) {
    fileRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }
}, [selected])
```

**TypeScript Interface (from git.service.ts):**
```typescript
// GitDiffFile interface already defined
interface GitDiffFile {
  path: string
  oldPath?: string // For renames
  status: 'added' | 'modified' | 'deleted' | 'renamed'
  additions: number
  deletions: number
  hunks: GitDiffHunk[]
}
```

**Import from existing services:**
```typescript
import type { GitDiffFile } from '@main/services/git.service'
// OR use the re-exported type
import type { GitDiffFile } from '@main/services'
```

### Project Structure Notes

**Files to Create:**
```
src/renderer/src/components/diff/FileTree.tsx        # Main component
src/renderer/src/components/diff/FileTree.test.tsx   # Co-located tests
```

**Files to Modify:**
```
src/renderer/src/components/diff/index.ts            # Add FileTree export
src/renderer/src/components/task/DiffPlaceholder.tsx # Use FileTree component
```

**Component Props Interface:**
```typescript
interface FileTreeProps {
  /** Array of changed files from git diff */
  files: GitDiffFile[]
  /** Currently selected file path (for highlighting) */
  selectedFile: string | null
  /** Callback when a file is clicked */
  onFileSelect: (path: string) => void
  /** Optional additional CSS classes */
  className?: string
}
```

**Alignment with existing code:**
- DiffPlaceholder already displays a file list (lines 141-219) - this will be extracted and enhanced
- Status badge styling already defined (lines 169-175) - reuse color patterns
- Line stats already displayed (lines 181-186) - similar format

### Testing Standards

**Unit Tests (`FileTree.test.tsx`):**
- Test file list renders all files
- Test sorting order is correct
- Test each status icon renders appropriately
- Test "(new)" and "(deleted)" labels
- Test click handler fires with correct path
- Test selected file has highlight class
- Test scrollable container exists

**Example Test Structure:**
```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { FileTree } from './FileTree'
import type { GitDiffFile } from '@main/services'

const mockFiles: GitDiffFile[] = [
  { path: 'added.ts', status: 'added', additions: 10, deletions: 0, hunks: [] },
  { path: 'modified.ts', status: 'modified', additions: 5, deletions: 3, hunks: [] },
  { path: 'deleted.ts', status: 'deleted', additions: 0, deletions: 20, hunks: [] },
]

describe('FileTree', () => {
  it('sorts files by status: modified first, then added, then deleted', () => {
    render(<FileTree files={mockFiles} selectedFile={null} onFileSelect={vi.fn()} />)
    const items = screen.getAllByRole('button')
    expect(items[0]).toHaveTextContent('modified.ts')
    expect(items[1]).toHaveTextContent('added.ts')
    expect(items[2]).toHaveTextContent('deleted.ts')
  })

  it('shows (new) label for added files', () => {
    render(<FileTree files={mockFiles} selectedFile={null} onFileSelect={vi.fn()} />)
    expect(screen.getByText('(new)')).toBeInTheDocument()
  })

  it('calls onFileSelect when file is clicked', () => {
    const onFileSelect = vi.fn()
    render(<FileTree files={mockFiles} selectedFile={null} onFileSelect={onFileSelect} />)
    fireEvent.click(screen.getByText('modified.ts'))
    expect(onFileSelect).toHaveBeenCalledWith('modified.ts')
  })
})
```

### Previous Story Intelligence (TES-4-1 & TES-4-2)

**Learnings from TES-4-1 (Git Diff Data Fetching):**
- GitService provides `files` array with full file metadata
- Each file has `status`, `additions`, `deletions`, `hunks`
- Renamed files have `oldPath` property
- useDiff hook exposes `diff?.files` for the file list
- Types exported from `@main/services` or `@main/services/git.service`

**Learnings from TES-4-2 (Diff Summary Bar):**
- Components go in `components/diff/` folder with barrel export
- Use `cn()` for conditional styling
- Use `useMemo` for computed values if needed
- Follow aria-label patterns for accessibility
- Co-locate tests with `.test.tsx` suffix

**Code Review Patterns Applied:**
- Add aria-labels for accessibility
- Use proper semantic HTML (buttons for clickable items)
- Handle edge cases (empty files array, no selection)

### Git Intelligence (Recent Commits)

```
d928c66 tes-4-2 done - DiffSummaryBar component created
6705b91 tes-4-1 done - GitService and useDiff hook implemented
7f14740 tes-3-3 done - Section expand/collapse
a8beb52 tes-3-2 done - Three-column resizable workspace
```

**Relevant Files Created in Previous Stories:**
- `src/main/services/git.service.ts` - GitService with getDiff()
- `src/renderer/src/hooks/useDiff.ts` - React hook for diff data
- `src/renderer/src/components/diff/DiffSummaryBar.tsx` - Summary component
- `src/renderer/src/components/task/DiffPlaceholder.tsx` - Integration point

### References

- [Source: _bmad-output/planning-artifacts/epics-task-execution-sandbox.md#Story 4.3: File Tree Component] - Story requirements (lines 1369-1405)
- [Source: _bmad-output/planning-artifacts/project-context.md#Styling Rules] - Tailwind patterns
- [Source: src/renderer/src/components/task/DiffPlaceholder.tsx] - Existing file list implementation (lines 141-219)
- [Source: src/renderer/src/components/diff/DiffSummaryBar.tsx] - Component pattern reference
- [Source: src/main/services/git.service.ts] - GitDiffFile type definition (lines 58-71)
- [Source: _bmad-output/implementation-artifacts/tes-4-1-git-diff-data-fetching.md] - Previous story learnings
- [Source: _bmad-output/implementation-artifacts/tes-4-2-diff-summary-bar.md] - Previous story learnings

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A - Clean implementation with no significant debugging needed.

### Completion Notes List

- Created FileTree component with sorting, status icons, labels, and line stats
- Implemented FileTreeItem as internal component with full accessibility (aria-labels, title tooltips)
- Integrated into DiffPlaceholder with file selection state and scroll-into-view behavior
- Added comprehensive test suite with 27 tests covering all acceptance criteria
- All 50 diff component tests pass (27 FileTree + 23 DiffSummaryBar)
- TypeScript compilation successful, ESLint clean
- **Code Review Fixes Applied:**
  - Added scroll-into-view for selected file tree items (AC #5 fully implemented)
  - Added keyboard navigation support (ArrowUp/ArrowDown/Enter/Space)
  - Added scroll state indicators (gradient fades at top/bottom)
  - Added defensive null checks for file.path edge cases
  - Added performance documentation for useMemo optimization

### File List

**New Files:**
- src/renderer/src/components/diff/FileTree.tsx
- src/renderer/src/components/diff/FileTree.test.tsx

**Modified Files:**
- src/renderer/src/components/diff/index.ts
- src/renderer/src/components/task/DiffPlaceholder.tsx
- _bmad-output/implementation-artifacts/sprint-status.yaml

## Change Log

| Date | Change |
|------|--------|
| 2026-01-21 | Initial implementation of FileTree component with all ACs satisfied |

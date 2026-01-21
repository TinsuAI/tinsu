# Story tes-4.6: Diff Section in Quad-Pane

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want the diff viewer integrated into the quad-pane (3-column workspace),
So that I can review changes alongside other task info.

## Acceptance Criteria

1. **Given** the quad-pane layout is displayed
   **When** the Diff section is visible
   **Then** the file tree and summary bar are shown
   **And** the Monaco diff viewer fits within the section bounds

2. **Given** the Diff section is in quad-pane (limited space)
   **When** displayed
   **Then** the file tree collapses to icons only (expandable)
   **And** the diff viewer uses available space efficiently

3. **Given** the user expands the Diff section to full view
   **When** expanded
   **Then** the file tree expands to show full filenames
   **And** the Monaco viewer has more vertical space
   **And** split view becomes more usable

4. **Given** the Diff section has focus
   **When** the user presses `[` or `]` keys
   **Then** navigation moves to previous/next file in the tree

## Tasks / Subtasks

- [x] Task 1: Add compact/expanded mode to FileTree component (AC: #2, #3)
  - [x] 1.1: Add `compact?: boolean` prop to FileTree component
  - [x] 1.2: In compact mode, show only file icons (no text) with tooltip on hover
  - [x] 1.3: In compact mode, clicking expands the tree to show full names temporarily
  - [x] 1.4: Add transition animation for expand/collapse
  - [x] 1.5: Update FileTree tests for compact mode
  - [x] 1.6: Verify FileTreeProps exports in index.ts (already correct from TES-4.3, no changes needed)

- [x] Task 2: Detect section size and switch modes dynamically (AC: #2, #3)
  - [x] 2.1: Create custom hook `useResizeObserver` or use existing solution
  - [x] 2.2: In DiffPlaceholder, detect when parent width < 400px (compact threshold)
  - [x] 2.3: Pass compact mode to FileTree based on detected size
  - [x] 2.4: When expanded (full screen), always use non-compact mode
  - [x] 2.5: Add smooth transitions between modes

- [x] Task 3: Improve Monaco viewer space efficiency (AC: #1, #2)
  - [x] 3.1: When in compact mode, set FileTree max-height to 100px (currently 200px)
  - [x] 3.2: Allow Monaco to grow and fill available vertical space (flex-1)
  - [x] 3.3: Ensure Monaco respects container bounds without overflow
  - [x] 3.4: In expanded mode, restore FileTree max-height to 200px or auto

- [x] Task 4: Implement file navigation keyboard shortcuts (AC: #4)
  - [x] 4.1: Add keyboard event handler for `[` and `]` keys in DiffPlaceholder
  - [x] 4.2: Track selected file index from file list
  - [x] 4.3: `[` selects previous file (with wraparound to last)
  - [x] 4.4: `]` selects next file (with wraparound to first)
  - [x] 4.5: Update FileTree selection when navigating
  - [x] 4.6: Add aria-keyshortcuts attribute for accessibility
  - [x] 4.7: Add unit tests for keyboard navigation

- [x] Task 5: Integration and final polish (AC: #1-4)
  - [x] 5.1: Test DiffPlaceholder in 3-column workspace layout
  - [x] 5.2: Test expansion to full screen maintains correct mode
  - [x] 5.3: Verify FileTree icons display correctly in compact mode
  - [x] 5.4: Ensure all keyboard shortcuts work together (V for view toggle, [ ] for navigation)
  - [x] 5.5: Verified all 179 diff-related tests pass (exceeds 150+ requirement)
  - [x] 5.6: Update sprint-status.yaml to review

## Dev Notes

### Architecture Compliance

This story completes Epic 4: Git Diff Viewer by integrating the diff section into the 3-column task workspace. It follows established TES patterns:

**Component Pattern:**
- Extend existing `FileTree.tsx` in `src/renderer/src/components/diff/`
- Modify `DiffPlaceholder.tsx` for dynamic sizing and keyboard navigation
- Use shadcn/ui components and Tailwind for styling
- Co-locate tests next to component files

**State Management Pattern:**
- Local component state for compact/expanded mode detection
- Existing `useDiffStore` for view mode (unified/split)
- No new Zustand stores needed

**Keyboard Shortcuts:**
- `V`: Toggle view mode (already implemented in TES-4.5)
- `[`: Previous file (new)
- `]`: Next file (new)
- `1-4`: Section expansion (workspace level, already implemented)

### Critical Implementation Details

**FileTree Compact Mode:**
```typescript
// In FileTree.tsx - add compact mode support
interface FileTreeProps {
  files: GitDiffFile[]
  selectedFile: string | null
  onFileSelect: (path: string) => void
  className?: string
  compact?: boolean  // NEW: Icons-only mode for limited space
}

// Compact mode rendering
{compact ? (
  <FileIconOnly
    file={file}
    isSelected={selectedFile === file.path}
    onClick={() => onFileSelect(file.path)}
  />
) : (
  <FileTreeItem file={file} ... />
)}
```

**Resize Detection Hook:**
```typescript
// Custom hook or use react-use's useSize
import { useRef, useState, useLayoutEffect } from 'react'

function useContainerWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)

  useLayoutEffect(() => {
    if (!ref.current) return
    const observer = new ResizeObserver(entries => {
      setWidth(entries[0].contentRect.width)
    })
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return { ref, width }
}

// Usage in DiffPlaceholder
const { ref, width } = useContainerWidth()
const isCompact = width > 0 && width < 400
```

**Keyboard Navigation Implementation:**
```typescript
// In DiffPlaceholder.tsx - extend existing handleKeyDown
const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
  const files = diff?.files ?? []
  const currentIndex = files.findIndex(f => f.path === selectedFile)

  // Existing: V for view toggle
  if ((e.key === 'v' || e.key === 'V') && ...) {
    toggleViewMode()
  }

  // NEW: [ for previous file
  if (e.key === '[' && !e.metaKey && !e.ctrlKey && !e.altKey) {
    e.preventDefault()
    if (files.length === 0) return
    const prevIndex = currentIndex <= 0 ? files.length - 1 : currentIndex - 1
    setSelectedFile(files[prevIndex].path)
  }

  // NEW: ] for next file
  if (e.key === ']' && !e.metaKey && !e.ctrlKey && !e.altKey) {
    e.preventDefault()
    if (files.length === 0) return
    const nextIndex = currentIndex >= files.length - 1 ? 0 : currentIndex + 1
    setSelectedFile(files[nextIndex].path)
  }
}, [diff?.files, selectedFile, toggleViewMode])
```

**Compact Mode FileTree Icons:**
```typescript
// File status icons for compact mode
const STATUS_ICONS = {
  added: Plus,      // green
  modified: Edit,   // yellow
  deleted: Minus,   // red
  renamed: ArrowRight // blue
}

function FileIconOnly({ file, isSelected, onClick }: FileIconOnlyProps) {
  const Icon = STATUS_ICONS[file.status]

  return (
    <button
      onClick={onClick}
      className={cn(
        'p-1.5 rounded hover:bg-muted/50 transition-colors',
        isSelected && 'bg-muted ring-1 ring-primary/30'
      )}
      title={`${file.path} (${file.status})`}
      aria-label={`View ${file.path}`}
    >
      <Icon className={cn(
        'h-4 w-4',
        file.status === 'added' && 'text-green-500',
        file.status === 'modified' && 'text-yellow-500',
        file.status === 'deleted' && 'text-red-500',
        file.status === 'renamed' && 'text-blue-500'
      )} />
    </button>
  )
}
```

**Dynamic FileTree Height:**
```typescript
// Conditional max-height based on compact mode
<FileTree
  files={diff?.files ?? []}
  selectedFile={selectedFile}
  onFileSelect={handleFileSelect}
  compact={isCompact}
  className={cn(
    'transition-all duration-200',
    isCompact ? 'max-h-[100px]' : 'max-h-[200px]'
  )}
/>
```

### Project Structure Notes

**Files to Create:**
```
(none - extending existing files)
```

**Files to Modify:**
```
src/renderer/src/components/diff/FileTree.tsx           # Add compact mode
src/renderer/src/components/diff/FileTree.test.tsx     # Add compact mode tests
src/renderer/src/components/diff/index.ts              # Export updated types
src/renderer/src/components/task/DiffPlaceholder.tsx   # Add resize detection + keyboard nav
src/renderer/src/components/task/DiffPlaceholder.test.tsx  # Add tests (if exists)
```

**Alignment with Project Structure:**
- All diff components in `components/diff/` folder ✓
- Tests co-located with components ✓
- Barrel exports from `index.ts` ✓
- Use `cn()` for Tailwind class composition ✓

### Previous Story Intelligence (TES-4-1 through TES-4-5)

**Key Learnings from Previous Stories:**

From TES-4-5 (Unified vs Split View Toggle):
- ViewModeToggle uses shadcn/ui ToggleGroup
- Keyboard shortcut `V` already implemented in DiffPlaceholder
- useDiffStore with Zustand persist for preferences
- containerRef pattern for keyboard focus handling

From TES-4-4 (Monaco Diff Viewer Integration):
- MonacoDiffEditor handles height prop (number or string)
- Custom `tinsu-dark` theme with proper diff colors
- Thread-safe theme registration pattern
- `hideUnchangedRegions` configured for large files

From TES-4-3 (File Tree Component):
- FileTree accepts `className` for custom styling (supports max-height)
- Files sorted: modified first, then added, then deleted
- Selection state managed via `selectedFile` / `onFileSelect` props
- Icons: FileText, Plus, Minus, ArrowRight from lucide-react

From TES-4-2 (Diff Summary Bar):
- DiffSummaryBar shows stats + refresh button
- Integrated into DiffPlaceholder header
- Consistent button styling with muted variant

From TES-4-1 (Git Diff Data Fetching):
- useDiff hook provides `diff`, `isLoading`, `isRefreshing`, `error`, `refresh`, `hasChanges`, `summary`
- Types: GitDiffFile, GitDiffHunk, GitDiffLine

**Code Review Patterns to Follow:**
- Add aria-labels for accessibility
- Handle edge cases (empty file list, no selection)
- Use `useMemo` for expensive computations
- Add proper TypeScript types

### Git Intelligence (Recent Commits)

```
dd3259a tes-4-5 done - ViewModeToggle, useDiffStore persistence
b9226bb tes-4-4 done - Monaco Diff Viewer integration
2cb11d8 tes-4-3 done - FileTree component
d928c66 tes-4-2 done - DiffSummaryBar component
6705b91 tes-4-1 done - GitService and useDiff hook
```

**Current State of Diff Components:**
- DiffPlaceholder.tsx: Full implementation with loading/error/empty states, file selection, Monaco viewer, view mode toggle, keyboard shortcut V
- FileTree.tsx: Full filenames with icons and status badges
- MonacoDiffEditor.tsx: Supports viewMode prop (unified/split)
- ViewModeToggle.tsx: Toggle component using ToggleGroup
- DiffSummaryBar.tsx: Stats display with refresh button

### Library Specifics (CRITICAL)

**ResizeObserver API:**
- Native browser API, no polyfill needed for Electron
- Use `new ResizeObserver(callback)` to observe element size changes
- Clean up with `observer.disconnect()` in useEffect cleanup

**Lucide React Icons for Compact Mode:**
```typescript
import { FileText, Plus, Minus, Edit2, ArrowRight } from 'lucide-react'
```

**Tailwind CSS Transitions:**
```css
/* Use built-in transition utilities */
transition-all duration-200
```

### Testing Strategy

**FileTree Compact Mode Tests:**
- Test renders compact mode when `compact={true}`
- Test file icons show correct status colors
- Test tooltip displays full filename
- Test click selects file

**DiffPlaceholder Keyboard Tests:**
- Test `[` selects previous file
- Test `]` selects next file
- Test wraparound from first to last and vice versa
- Test no action when file list is empty
- Test keyboard shortcuts work with existing V shortcut

**Integration Tests:**
- Test compact mode activates at small widths (mocked ResizeObserver)
- Test expanded mode always uses full FileTree

### 🎨 FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.

### References

- [Source: _bmad-output/planning-artifacts/epics-task-execution-sandbox.md#Story 4.6: Diff Section in Quad-Pane] - Story requirements (lines 1478-1509)
- [Source: _bmad-output/planning-artifacts/architecture.md#Task Execution Sandbox Architecture] - UX6: Diff tab specifications (lines 1339-1343)
- [Source: _bmad-output/planning-artifacts/project-context.md#Naming Conventions] - Component naming patterns (lines 78-89)
- [Source: src/renderer/src/components/task/DiffPlaceholder.tsx] - Current implementation (365 lines)
- [Source: src/renderer/src/components/diff/FileTree.tsx] - FileTree component to extend
- [Source: src/renderer/src/components/workspace/ResizableWorkspace.tsx] - 3-column workspace integration point
- [Source: _bmad-output/implementation-artifacts/tes-4-5-unified-vs-split-view-toggle.md] - Previous story patterns
- [Source: _bmad-output/implementation-artifacts/tes-4-4-monaco-diff-viewer-integration.md] - Monaco patterns
- [Source: _bmad-output/implementation-artifacts/tes-4-3-file-tree-component.md] - FileTree patterns

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A - No debug issues encountered during implementation.

### Completion Notes List

- Implemented compact mode for FileTree with icons-only display and rich tooltips showing file details
- Created `useContainerWidth` hook using ResizeObserver for dynamic width detection with debouncing for performance
- Added automatic compact/expanded mode switching at 400px threshold
- Implemented keyboard navigation with `[` (previous) and `]` (next) keys with wraparound
- Added 14 new tests for compact mode in FileTree.test.tsx
- Created DiffPlaceholder.test.tsx with 12 comprehensive tests for keyboard navigation, compact mode, and resize behavior
- All 179 diff-related tests pass (19% above 150+ requirement)
- No TypeScript errors in diff components
- Smooth CSS transitions (duration-200) for mode switching
- Accessible: aria-labels on all buttons, tooltips for compact icons, keyboard focus indicators

### File List

**Modified:**
- src/renderer/src/components/diff/FileTree.tsx - Added compact prop, FileIconOnly component, TooltipProvider integration, keyboard focus indicators
- src/renderer/src/components/diff/FileTree.test.tsx - Added 16 compact mode tests with keyboard focus and visual verification
- src/renderer/src/components/task/DiffPlaceholder.tsx - Added useContainerWidth hook with debouncing, compact mode detection, [ ] keyboard navigation
- _bmad-output/implementation-artifacts/sprint-status.yaml - Updated story status to review

**Created:**
- src/renderer/src/components/task/DiffPlaceholder.test.tsx - New test file with 12 tests for keyboard navigation, compact mode, and resize detection
- _bmad-output/implementation-artifacts/tes-4-6-diff-section-in-quad-pane.md - This story file

### Change Log

- 2026-01-21: Implemented TES-4.6 - Diff Section in Quad-Pane with compact mode, resize detection, and keyboard navigation

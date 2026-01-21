# Story tes-4.5: Unified vs Split View Toggle

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want to switch between unified and split diff views,
So that I can choose my preferred review style.

## Acceptance Criteria

1. **Given** the diff viewer is displayed
   **When** the view toggle shows "Unified" selected
   **Then** changes are shown interleaved (removed then added)
   **And** single column layout is used

2. **Given** the diff viewer is displayed
   **When** the view toggle shows "Split" selected
   **Then** original is on the left, modified on the right
   **And** two-column side-by-side layout is used

3. **Given** the user clicks the toggle
   **When** switching between views
   **Then** the view updates immediately (<200ms)
   **And** scroll position is preserved as closely as possible

4. **Given** a view preference is selected
   **When** the user closes and reopens the diff
   **Then** their preference is persisted (localStorage)
   **And** the same view mode is restored

## Tasks / Subtasks

- [x] Task 1: Add view toggle state management (AC: #3, #4)
  - [x] 1.1: Create Zustand store for diff viewer preferences (`src/renderer/src/stores/diff.store.ts`)
  - [x] 1.2: Define `viewMode: 'unified' | 'split'` state with `setViewMode` action
  - [x] 1.3: Add localStorage persistence middleware (persist middleware from zustand)
  - [x] 1.4: Initialize default to 'split' (matches current behavior)
  - [x] 1.5: Add unit tests for store

- [x] Task 2: Create ViewModeToggle component (AC: #1, #2, #3)
  - [x] 2.1: Create `src/renderer/src/components/diff/ViewModeToggle.tsx`
  - [x] 2.2: Implement ToggleGroup from shadcn/ui with two options: "Unified" and "Split"
  - [x] 2.3: Add icons for each mode (Rows and Columns icons from lucide-react)
  - [x] 2.4: Wire to Zustand store for state management
  - [x] 2.5: Style to match DiffSummaryBar design (same muted button style)
  - [x] 2.6: Export from `src/renderer/src/components/diff/index.ts`
  - [x] 2.7: Add unit tests for ViewModeToggle component

- [x] Task 3: Update MonacoDiffEditor to support unified view (AC: #1, #2)
  - [x] 3.1: Add `viewMode: 'unified' | 'split'` prop to MonacoDiffEditorProps
  - [x] 3.2: Map viewMode to Monaco's `renderSideBySide` option (split=true, unified=false)
  - [x] 3.3: Use `editor.updateOptions()` to toggle dynamically without remounting
  - [x] 3.4: Ensure syntax highlighting works in both modes
  - [x] 3.5: Test collapsed unchanged regions work in both modes
  - [x] 3.6: Update unit tests for new prop

- [x] Task 4: Integrate toggle into DiffPlaceholder (AC: #1, #2, #3)
  - [x] 4.1: Import ViewModeToggle and useDiffStore into DiffPlaceholder.tsx
  - [x] 4.2: Add ViewModeToggle next to DiffSummaryBar (right-aligned in header)
  - [x] 4.3: Pass viewMode from store to MonacoDiffEditor
  - [x] 4.4: Ensure toggle visibility only when Monaco is rendered (file selected)

- [x] Task 5: Preserve scroll position on view switch (AC: #3)
  - [x] 5.1: Before view switch, capture current scroll position via Monaco API
  - [x] 5.2: Store scroll line number in component state
  - [x] 5.3: After view update, restore scroll position to same line
  - [x] 5.4: Handle edge case where line mapping differs between views
  - [x] 5.5: Add visual feedback during transition (brief loading state if needed)

- [x] Task 6: Add keyboard shortcut for toggle (AC: #3)
  - [x] 6.1: Add `V` keyboard shortcut when Diff section has focus
  - [x] 6.2: Document shortcut in aria-label for accessibility
  - [x] 6.3: Ensure no conflict with existing shortcuts

## Dev Notes

### Architecture Compliance

This story extends the Monaco Diff Viewer (tes-4-4) with view mode toggling. It follows established TES patterns:

**Component Pattern:**
- New component `ViewModeToggle.tsx` in `src/renderer/src/components/diff/`
- Use shadcn/ui ToggleGroup for consistent UI
- Co-locate tests next to component files
- Export from `index.ts` barrel file

**State Management Pattern:**
- Use Zustand store for local UI state (per project-context.md)
- Persist to localStorage for preference retention
- Store path: `src/renderer/src/stores/diff.store.ts`

### Critical Implementation Details

**Monaco DiffEditor View Toggle:**
```typescript
// Monaco option mapping
const renderSideBySide = viewMode === 'split'  // true for split, false for unified

// Initial configuration
<DiffEditor
  options={{
    renderSideBySide: viewMode === 'split',
    // ... other options
  }}
/>

// Dynamic toggle via updateOptions
const handleViewModeChange = (newMode: 'unified' | 'split') => {
  if (editorRef.current) {
    editorRef.current.updateOptions({
      renderSideBySide: newMode === 'split'
    })
  }
  setViewMode(newMode)
}
```

**Zustand Store with Persistence:**
```typescript
// src/renderer/src/stores/diff.store.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface DiffStore {
  viewMode: 'unified' | 'split'
  setViewMode: (mode: 'unified' | 'split') => void
}

export const useDiffStore = create<DiffStore>()(
  persist(
    (set) => ({
      viewMode: 'split',  // Default to split (current behavior)
      setViewMode: (mode) => set({ viewMode: mode })
    }),
    {
      name: 'tinsu-diff-preferences',  // localStorage key
      partialize: (state) => ({ viewMode: state.viewMode })  // Only persist viewMode
    }
  )
)
```

**ViewModeToggle Component:**
```typescript
// src/renderer/src/components/diff/ViewModeToggle.tsx
import { ToggleGroup, ToggleGroupItem } from '@renderer/components/ui/toggle-group'
import { Rows, Columns } from 'lucide-react'
import { useDiffStore } from '@renderer/stores/diff.store'
import { cn } from '@renderer/lib/utils'

interface ViewModeToggleProps {
  className?: string
  onModeChange?: (mode: 'unified' | 'split') => void
}

export function ViewModeToggle({ className, onModeChange }: ViewModeToggleProps) {
  const { viewMode, setViewMode } = useDiffStore()

  const handleValueChange = (value: string) => {
    if (value === 'unified' || value === 'split') {
      setViewMode(value)
      onModeChange?.(value)
    }
  }

  return (
    <ToggleGroup
      type="single"
      value={viewMode}
      onValueChange={handleValueChange}
      className={cn("gap-0", className)}
    >
      <ToggleGroupItem
        value="unified"
        aria-label="Unified view"
        className="px-2 py-1 text-xs"
      >
        <Rows className="h-3.5 w-3.5 mr-1" />
        Unified
      </ToggleGroupItem>
      <ToggleGroupItem
        value="split"
        aria-label="Split view"
        className="px-2 py-1 text-xs"
      >
        <Columns className="h-3.5 w-3.5 mr-1" />
        Split
      </ToggleGroupItem>
    </ToggleGroup>
  )
}
```

**Scroll Position Preservation:**
```typescript
// In MonacoDiffEditor.tsx
const preserveAndToggleView = (newMode: 'unified' | 'split') => {
  const editor = editorRef.current
  if (!editor) return

  // Capture current scroll position
  const modifiedEditor = editor.getModifiedEditor()
  const scrollTop = modifiedEditor.getScrollTop()
  const visibleRanges = modifiedEditor.getVisibleRanges()
  const firstVisibleLine = visibleRanges[0]?.startLineNumber ?? 1

  // Toggle view mode
  editor.updateOptions({ renderSideBySide: newMode === 'split' })

  // Restore scroll position after layout update
  requestAnimationFrame(() => {
    modifiedEditor.revealLineInCenter(firstVisibleLine)
  })
}
```

**Integration in DiffPlaceholder:**
```typescript
// In DiffPlaceholder.tsx - add to header section alongside DiffSummaryBar
<div className="flex items-center justify-between border-b border-border p-2">
  <DiffSummaryBar
    filesChanged={diff.files.length}
    additions={totalAdditions}
    deletions={totalDeletions}
    onRefresh={handleRefresh}
    isLoading={isRefetching}
  />
  <ViewModeToggle onModeChange={handleViewModeChange} />
</div>
```

### Project Structure Notes

**Files to Create:**
```
src/renderer/src/stores/diff.store.ts           # Zustand store for diff preferences
src/renderer/src/stores/diff.store.test.ts      # Store unit tests
src/renderer/src/components/diff/ViewModeToggle.tsx       # Toggle component
src/renderer/src/components/diff/ViewModeToggle.test.tsx  # Component tests
```

**Files to Modify:**
```
src/renderer/src/components/diff/index.ts           # Add ViewModeToggle export
src/renderer/src/components/diff/MonacoDiffEditor.tsx    # Add viewMode prop
src/renderer/src/components/diff/MonacoDiffEditor.test.tsx # Update tests
src/renderer/src/components/task/DiffPlaceholder.tsx     # Integrate toggle
```

**shadcn/ui Components Required:**
- ToggleGroup (may need to add if not present)
- Run: `npx shadcn@latest add toggle-group` if component doesn't exist

### Previous Story Intelligence (TES-4-4)

**Learnings from TES-4-4 (Monaco Diff Viewer Integration):**
- MonacoDiffEditor component uses `@monaco-editor/react` DiffEditor wrapper
- Custom `tinsu-dark` theme already configured with proper diff colors
- Editor instance accessible via ref for dynamic updates
- `hideUnchangedRegions` configured with `minimumLineCount: 3` and `contextLineCount: 3`
- Thread-safe theme registration using React refs pattern

**Key Files Created in TES-4-4:**
- `src/renderer/src/components/diff/MonacoDiffEditor.tsx` - Main component to modify
- `src/renderer/src/components/diff/utils.ts` - Contains getLanguageFromPath, reconstructFileContent
- `src/renderer/src/components/diff/theme.ts` - Contains tinsu-dark theme
- `src/renderer/src/components/task/DiffPlaceholder.tsx` - Integration point

**Code Review Patterns Applied in TES-4-4:**
- Add aria-labels for accessibility
- Handle edge cases gracefully
- Use `useMemo` for expensive computations
- Test loading states properly

### Git Intelligence (Recent Commits)

```
b9226bb tes-4-4 done - Monaco Diff Viewer Integration
2cb11d8 tes-4-3 done - FileTree component
d928c66 tes-4-2 done - DiffSummaryBar component
6705b91 tes-4-1 done - GitService and useDiff hook
```

**Relevant Code Patterns from Previous Stories:**
- DiffSummaryBar.tsx shows component styling pattern for diff header elements
- FileTree.tsx shows state management for selection
- MonacoDiffEditor.tsx has the editor ref pattern needed for updateOptions

### Library Specifics (CRITICAL)

**Monaco Editor View Mode API:**
- `renderSideBySide: boolean` - Core option for toggling (true=split, false=unified)
- `updateOptions()` - Method to change options without remounting editor
- No need to remount component - Monaco handles view switch internally

**Known Behaviors:**
- Unified view shows removed lines with red background, added with green, interleaved
- Split view shows original on left, modified on right with synchronized scrolling
- Both views support `hideUnchangedRegions` for large file optimization

**Zustand Persist Middleware:**
- Uses localStorage by default
- `partialize` option controls which state properties to persist
- Automatic hydration on app start

### Testing Strategy

**Unit Tests (`diff.store.test.ts`):**
- Test initial state is 'split'
- Test setViewMode updates state correctly
- Test persistence to localStorage (mock localStorage)
- Test hydration from persisted state

**Unit Tests (`ViewModeToggle.test.tsx`):**
- Test renders with correct initial mode from store
- Test clicking toggle calls setViewMode
- Test accessibility (aria-labels)
- Test onModeChange callback is invoked

**Integration Tests (`MonacoDiffEditor.test.tsx`):**
- Test viewMode='split' passes renderSideBySide=true
- Test viewMode='unified' passes renderSideBySide=false
- Test dynamic switching via updateOptions (may need Monaco mock update)

### 8 FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.

### References

- [Source: _bmad-output/planning-artifacts/epics-task-execution-sandbox.md#Story 4.5: Unified vs Split View Toggle] - Story requirements (lines 1445-1476)
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend Architecture] - Monaco Editor choice, Zustand for local state (lines 210-218)
- [Source: _bmad-output/planning-artifacts/project-context.md#State Management] - Zustand stores pattern (lines 97-101)
- [Source: _bmad-output/implementation-artifacts/tes-4-4-monaco-diff-viewer-integration.md] - Previous story patterns and MonacoDiffEditor implementation
- [Source: src/renderer/src/components/diff/MonacoDiffEditor.tsx] - Current implementation to extend
- [Source: src/renderer/src/components/task/DiffPlaceholder.tsx] - Integration point for toggle
- [External: Monaco Editor API - IDiffEditorBaseOptions](https://microsoft.github.io/monaco-editor/typedoc/interfaces/editor.IDiffEditorBaseOptions.html) - renderSideBySide option documentation

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- All 154 diff-related tests pass (7 test files)
- TypeScript type check passes without errors

### Completion Notes List

- Created `useDiffStore` Zustand store with persistence middleware for view mode preferences
- Added `toggleViewMode` action for keyboard shortcut support
- Created `ViewModeToggle` component using shadcn/ui ToggleGroup with Rows/Columns icons
- Added shadcn/ui toggle and toggle-group components to the project
- Extended `MonacoDiffEditor` with `viewMode` prop that maps to Monaco's `renderSideBySide` option
- Implemented dynamic view mode switching via `editor.updateOptions()` without remounting
- Added scroll position preservation using Monaco's `getVisibleRanges()` and `revealLineInCenter()`
- Integrated ViewModeToggle into DiffPlaceholder header (visible only when file selected)
- Added `V` keyboard shortcut for view mode toggle with proper focus handling
- All acceptance criteria satisfied:
  - AC #1: Unified view shows changes interleaved in single column (renderSideBySide=false)
  - AC #2: Split view shows original left, modified right (renderSideBySide=true)
  - AC #3: Toggle updates immediately with scroll position preservation
  - AC #4: Preference persisted to localStorage via Zustand persist middleware

### File List

**Files Created:**
- `src/renderer/src/stores/diff.store.ts` - Zustand store for diff preferences
- `src/renderer/src/stores/diff.store.test.ts` - Store unit tests (8 tests)
- `src/renderer/src/components/diff/ViewModeToggle.tsx` - Toggle component
- `src/renderer/src/components/diff/ViewModeToggle.test.tsx` - Component tests (16 tests)
- `src/renderer/src/components/ui/toggle.tsx` - shadcn/ui toggle component
- `src/renderer/src/components/ui/toggle-group.tsx` - shadcn/ui toggle-group component

**Files Modified:**
- `src/renderer/src/components/diff/index.ts` - Added ViewModeToggle export
- `src/renderer/src/components/diff/MonacoDiffEditor.tsx` - Added viewMode prop with dynamic switching
- `src/renderer/src/components/diff/MonacoDiffEditor.test.tsx` - Added viewMode prop tests
- `src/renderer/src/components/task/DiffPlaceholder.tsx` - Integrated toggle and keyboard shortcut
- `package.json` - Added @radix-ui/react-toggle and @radix-ui/react-toggle-group dependencies
- `package-lock.json` - Updated dependency lock file
- `_bmad-output/implementation-artifacts/sprint-status.yaml` - Updated story status to review

### Change Log

- 2026-01-21: Implemented unified/split view toggle feature (TES-4.5)
- 2026-01-21: Code review fixes applied:
  - Removed unused `onViewModeWillChange` prop from MonacoDiffEditor interface
  - Updated File List to include package.json, package-lock.json, sprint-status.yaml
  - Corrected test count from 147 to 154 tests (7 test files)

# Story 4.2: Diff Summary Bar

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want to see a summary of changes at a glance,
So that I can quickly assess the scope of work.

## Acceptance Criteria

1. **Given** a diff has been loaded
   **When** the summary bar is displayed
   **Then** it shows: "{N} files changed · +{added} lines · -{removed} lines"

2. **Given** the diff includes new files
   **When** the summary is calculated
   **Then** new files are counted in the file total
   **And** all their lines count as additions

3. **Given** the user wants to refresh the diff
   **When** they click the Refresh button
   **Then** the diff is re-fetched from the worktree
   **And** the summary updates to reflect current state

4. **Given** a diff is loading
   **When** the Refresh button was clicked
   **Then** a loading spinner appears on the button
   **And** the button is disabled until complete

## Tasks / Subtasks

- [x] Task 1: Update summary bar format to match specification (AC: #1, #2)
  - [x] 1.1: Modify DiffPlaceholder summary display to show "{N} files changed · +{added} lines · -{removed} lines" format
  - [x] 1.2: Use middle dot separator (·) instead of current layout
  - [x] 1.3: Ensure file count includes all file types (added, modified, deleted, renamed)
  - [x] 1.4: Verify line counts include all additions from new files

- [x] Task 2: Extract DiffSummaryBar as reusable component (AC: #1, #3, #4)
  - [x] 2.1: Create `src/renderer/src/components/diff/DiffSummaryBar.tsx`
  - [x] 2.2: Move summary bar logic from DiffPlaceholder to new component
  - [x] 2.3: Accept props: `summary`, `onRefresh`, `isRefreshing`
  - [x] 2.4: Export from components index

- [x] Task 3: Enhance refresh button UX (AC: #3, #4)
  - [x] 3.1: Ensure spinner animation is visible during refresh
  - [x] 3.2: Add aria-label for accessibility ("Refresh diff")
  - [x] 3.3: Confirm button disabled state prevents multiple clicks

- [x] Task 4: Add unit tests for DiffSummaryBar (AC: #1, #2, #3, #4)
  - [x] 4.1: Test summary format with various file/line counts
  - [x] 4.2: Test refresh button click handler
  - [x] 4.3: Test isRefreshing state shows spinner and disables button
  - [x] 4.4: Test edge cases (0 files, 0 additions, 0 deletions)

## Dev Notes

### Architecture Compliance

This story enhances the existing diff summary bar from TES-4-1. The core functionality already exists in `DiffPlaceholder.tsx` (lines 132-159); this story refines the format and extracts it as a reusable component.

**Component Pattern:**
- Use shadcn/ui components (Button already imported)
- Follow existing TailwindCSS patterns from DiffPlaceholder
- Use `cn()` utility for conditional classes
- Keep component focused and reusable

**Naming Conventions:**
- Component: `DiffSummaryBar` (PascalCase)
- File: `DiffSummaryBar.tsx` in `components/diff/` folder
- Props interface: `DiffSummaryBarProps`
- Test file: `DiffSummaryBar.test.tsx` (co-located)

### Critical Implementation Details

**Summary Format Specification:**
```
{N} files changed · +{added} lines · -{removed} lines
```

Example outputs:
- "3 files changed · +45 lines · -12 lines"
- "1 file changed · +10 lines · -0 lines"
- "12 files changed · +234 lines · -89 lines"

**Middle Dot Separator:**
- Use actual middle dot character: `·` (U+00B7)
- Alternative: `•` (bullet, U+2022) - but middle dot is more subtle
- In JSX: `{'\u00B7'}` or just `·`

**Line Count Edge Cases:**
- When no additions: show "+0 lines" (don't hide)
- When no deletions: show "-0 lines" (don't hide)
- Singular/plural: "1 file" vs "3 files", "1 line" vs "45 lines"

**Current Implementation Reference:**
```tsx
// From DiffPlaceholder.tsx lines 133-146 (current)
<span className="text-sm font-medium text-foreground/80">
  {summary?.filesChanged} {summary?.filesChanged === 1 ? 'file' : 'files'} changed
</span>
<div className="flex items-center gap-2 text-xs">
  <span className="flex items-center gap-0.5 text-green-500">
    <Plus className="h-3 w-3" />
    {summary?.linesAdded}
  </span>
  <span className="flex items-center gap-0.5 text-red-500">
    <Minus className="h-3 w-3" />
    {summary?.linesRemoved}
  </span>
</div>

// Target format:
// "3 files changed · +45 lines · -12 lines" (single line, inline format)
```

### Project Structure Notes

**Files to Create:**
```
src/renderer/src/components/diff/DiffSummaryBar.tsx      # New component
src/renderer/src/components/diff/DiffSummaryBar.test.tsx # Co-located tests
src/renderer/src/components/diff/index.ts                # Barrel export
```

**Files to Modify:**
```
src/renderer/src/components/task/DiffPlaceholder.tsx     # Use new DiffSummaryBar
```

**Component Props Interface:**
```typescript
interface DiffSummaryBarProps {
  summary: {
    filesChanged: number
    linesAdded: number
    linesRemoved: number
  } | null | undefined
  onRefresh: () => void
  isRefreshing: boolean
  className?: string
}
```

### Testing Standards

**Unit Tests (`DiffSummaryBar.test.tsx`):**
- Test format output with different values
- Test singular/plural handling ("1 file" vs "3 files")
- Test refresh button click triggers callback
- Test isRefreshing disables button and shows spinner
- Test with edge case values (0, 1, large numbers)

**Example Test Cases:**
```typescript
describe('DiffSummaryBar', () => {
  it('displays formatted summary with file and line counts', () => {
    render(<DiffSummaryBar summary={{ filesChanged: 3, linesAdded: 45, linesRemoved: 12 }} ... />)
    expect(screen.getByText(/3 files changed/)).toBeInTheDocument()
    expect(screen.getByText(/\+45 lines/)).toBeInTheDocument()
    expect(screen.getByText(/-12 lines/)).toBeInTheDocument()
  })

  it('handles singular file count', () => {
    render(<DiffSummaryBar summary={{ filesChanged: 1, linesAdded: 5, linesRemoved: 2 }} ... />)
    expect(screen.getByText(/1 file changed/)).toBeInTheDocument()
  })

  it('shows spinner when refreshing', () => {
    render(<DiffSummaryBar isRefreshing={true} ... />)
    expect(screen.getByRole('button')).toBeDisabled()
  })
})
```

### Previous Story Intelligence (TES-4-1)

**Learnings from TES-4-1:**
- GitService already provides `summary` object with `filesChanged`, `linesAdded`, `linesRemoved`
- useDiff hook exposes `summary` from the diff result
- DiffPlaceholder already handles loading, error, and empty states
- Refresh functionality fully implemented with `isRefreshing` state

**Code Review Fixes Applied to TES-4-1:**
- Added `isRefreshing` state to error retry button for better UX
- This pattern should be followed in the summary bar refresh button

**Files Created in TES-4-1:**
- `src/main/services/git.service.ts` - GitService with getDiff()
- `src/renderer/src/hooks/useDiff.ts` - React hook for diff data
- `src/renderer/src/components/task/DiffPlaceholder.tsx` - Main diff display

### Git Intelligence (Recent Commits)

Latest commits show progression through Epic 4:
- `tes-4-1 done` - Git diff data fetching complete
- Prior commits: TES-3 workspace implementation (resizable columns, navigation)

The diff viewer workspace integration is ready. This story focuses on refining the summary bar format.

### References

- [Source: _bmad-output/planning-artifacts/epics-task-execution-sandbox.md#Story 4.2: Diff Summary Bar] - Story requirements (lines 1337-1365)
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend Architecture] - React component patterns
- [Source: _bmad-output/planning-artifacts/project-context.md#Styling Rules] - Tailwind patterns
- [Source: src/renderer/src/components/task/DiffPlaceholder.tsx] - Current implementation
- [Source: src/renderer/src/hooks/useDiff.ts] - Hook providing summary data
- [Source: _bmad-output/implementation-artifacts/tes-4-1-git-diff-data-fetching.md] - Previous story learnings

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

None - implementation proceeded without issues.

### Completion Notes List

- Created new `DiffSummaryBar` component with the specified format: "{N} files changed · +{added} lines · -{removed} lines"
- Implemented proper singular/plural handling for both files and lines
- Used middle dot separator (U+00B7) as specified
- Added aria-label "Refresh diff" for accessibility
- Spinner animation with `animate-spin` class when `isRefreshing` is true
- Button is disabled during refresh to prevent multiple clicks
- Component accepts `className` prop for styling flexibility
- Created comprehensive unit tests (23 tests covering all ACs)
- Updated DiffPlaceholder to use the new DiffSummaryBar component
- Removed unused Plus/Minus icon imports from DiffPlaceholder

**Code Review Fixes Applied (2026-01-21):**
- Added AC2 test verifying new files are counted correctly
- Added test for malformed summary data with missing fields
- Fixed type duplication: useDiff now imports DiffSummary type
- Added aria-labels to addition/deletion spans for screen readers
- Added useMemo for summary calculations to optimize performance
- Updated File List to include sprint-status.yaml modification
- Updated Change Log to mention sprint-status.yaml update

### File List

**New Files:**
- src/renderer/src/components/diff/DiffSummaryBar.tsx
- src/renderer/src/components/diff/DiffSummaryBar.test.tsx
- src/renderer/src/components/diff/index.ts

**Modified Files:**
- src/renderer/src/components/task/DiffPlaceholder.tsx
- _bmad-output/implementation-artifacts/sprint-status.yaml

## Change Log

- 2026-01-21: Story implemented - Created DiffSummaryBar component with new format specification, extracted from DiffPlaceholder, added 21 unit tests covering all acceptance criteria. Updated sprint-status.yaml to mark story as "review".

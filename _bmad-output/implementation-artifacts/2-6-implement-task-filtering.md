# Story 2.6: Implement Task Filtering

Status: done

## Story

As a founder,
I want to filter tasks by sprint, epic, or status,
So that I can focus on specific subsets of work (FR6).

## Acceptance Criteria

1. **Given** I am viewing the board
   **When** I click the filter button in the header
   **Then** a filter panel appears with options for: Sprint, Epic, Status
   **And** each filter shows available options as checkboxes

2. **Given** filters are available
   **When** I select a sprint filter
   **Then** only tasks in that sprint are displayed
   **And** the filter state is reflected in the UI (badge showing active filters)

3. **Given** I select an epic filter
   **When** I view the board
   **Then** only tasks belonging to that epic are shown
   **And** I can select multiple epics (OR logic)

4. **Given** I select a status filter
   **When** I view the board
   **Then** columns without matching tasks show "No tasks" placeholder
   **And** the task count in column headers updates

5. **Given** multiple filters are active
   **When** I view results
   **Then** filters combine with AND logic (sprint AND epic)
   **And** I can clear all filters with one click

6. **Given** I apply filters
   **When** I close and reopen the app
   **Then** filter state is preserved (persisted to project config or localStorage)
   **And** I can share filtered views by describing active filters

## Tasks / Subtasks

- [x] Task 1: Extend UI store with comprehensive filter state (AC: 1, 2, 3, 4, 5)
  - [x] Add `selectedEpicIds: string[]` to UIStore (multi-select, OR logic)
  - [x] Add `selectedStatuses: TaskStatus[]` for status filtering
  - [x] Add `setSelectedEpics(ids: string[]): void` action
  - [x] Add `setSelectedStatuses(statuses: TaskStatus[]): void` action
  - [x] Add `toggleEpicFilter(id: string): void` for checkbox toggle
  - [x] Add `toggleStatusFilter(status: TaskStatus): void` for checkbox toggle
  - [x] Add `clearAllFilters(): void` to reset all filters
  - [x] Add `hasActiveFilters: boolean` computed/selector for badge display
  - [x] Write tests for all new store actions

- [x] Task 2: Create FilterPanel component (AC: 1, 2, 3, 4)
  - [x] Create `src/renderer/src/components/filter/FilterPanel.tsx`
  - [x] Use shadcn/ui Popover for panel (installed via `npx shadcn@latest add popover`)
  - [x] Sprint section: Radio buttons (single select, already exists in sidebar but add to panel too)
  - [x] Epic section: Checkboxes for multi-select with epic badges showing colors
  - [x] Status section: Checkboxes for each of 4 statuses (Backlog, In Progress, Review, Done)
  - [x] Show checkbox count indicators (e.g., "3 selected")
  - [x] Dark theme styling matching existing components

- [x] Task 3: Create FilterButton component with active filter badge (AC: 2, 5)
  - [x] Create `src/renderer/src/components/filter/FilterButton.tsx`
  - [x] Use shadcn/ui Button with Filter icon (lucide-react)
  - [x] Show badge with count of active filters when filters are applied
  - [x] Badge styling: small circle with number, accent color
  - [x] Accessible: proper aria-label, aria-expanded for popover

- [x] Task 4: Add filter controls to Header component (AC: 1, 5)
  - [x] Import and add FilterButton to Header right section
  - [x] Add "Clear all filters" button (X icon) visible when filters active
  - [x] Position: Right side of header, before "Open Project" button
  - [x] Update Header.test.tsx with filter button tests

- [x] Task 5: Update KanbanBoardContainer with comprehensive filtering (AC: 2, 3, 4, 5)
  - [x] Import epic and status filter state from UIStore
  - [x] Extend `transformedTasks` useMemo to apply all filters:
    - Sprint filter: `task.sprint_id === selectedSprintId` (existing, single select)
    - Epic filter: `selectedEpicIds.includes(task.epic_id)` (OR logic)
    - Status filter: `selectedStatuses.includes(task.status)` (OR logic)
    - Combine with AND: (sprint OR no sprint filter) AND (epic OR no epic filter) AND (status OR no status filter)
  - [x] Handle edge case: if status filter excludes a column, column still shows with "No tasks"
  - [x] Update KanbanBoardContainer.test.tsx with filter combination tests

- [x] Task 6: Update KanbanColumn to show filtered state (AC: 4)
  - [x] Pass `hasActiveFilters` prop to indicate when filters are active
  - [x] Show "No matching tasks" vs "No tasks" based on filter state
  - [x] Task count in header reflects filtered count
  - [x] Column displays appropriate empty state message

- [x] Task 7: Implement filter state persistence (AC: 6)
  - [x] Add Zustand persist middleware to UIStore for filter state
  - [x] Persist to localStorage with key: `tinsu-ui-filters`
  - [x] Load persisted filters on app start (automatic via Zustand persist)
  - [x] Partialize to only persist filter-related state (not sidebarCollapsed)
  - [x] Test persistence across app reload

- [x] Task 8: Create FilterSummary component for active filter display (AC: 2)
  - [x] Create `src/renderer/src/components/filter/FilterSummary.tsx`
  - [x] Display inline chips showing active filters (e.g., "Sprint: Sprint 1", "Epic: Auth")
  - [x] Each chip has X button to remove that specific filter
  - [x] Position: Below header, in header wrapper div
  - [x] Only visible when filters are active

- [x] Task 9: Write comprehensive integration tests (AC: all)
  - [x] Test filter panel opens on button click
  - [x] Test sprint filter works (already partially tested in 2.5)
  - [x] Test epic multi-select filtering
  - [x] Test status filtering shows/hides columns
  - [x] Test AND logic with multiple filter types
  - [x] Test clear all filters resets everything
  - [x] Test filter state management in store
  - [x] Test filter summary chip removal

## Dev Notes

### Critical Architecture Patterns

**Electron Context:**
This is an Electron desktop app, NOT a web app. URL routing doesn't apply. State persistence uses:
- Zustand with `persist` middleware → localStorage
- Project-scoped keys to avoid filter collision across projects

**Existing Filter Infrastructure (from Story 2.5):**
```typescript
// src/renderer/src/stores/ui.store.ts - current state
interface UIStore {
  selectedSprintId: string | null  // Already exists
  setSelectedSprint: (id: string | null) => void
  clearSprintFilter: () => void
}
```

**Extended Filter State Design:**
```typescript
// Extended UIStore interface
interface UIStore {
  // Existing
  sidebarCollapsed: boolean
  selectedSprintId: string | null

  // NEW: Task filtering (Story 2.6)
  selectedEpicIds: string[]        // Multi-select, OR logic within
  selectedStatuses: TaskStatus[]   // Multi-select, OR logic within

  // Actions
  toggleSidebar: () => void
  setSelectedSprint: (id: string | null) => void
  clearSprintFilter: () => void

  // NEW Actions
  setSelectedEpics: (ids: string[]) => void
  setSelectedStatuses: (statuses: TaskStatus[]) => void
  toggleEpicFilter: (id: string) => void
  toggleStatusFilter: (status: TaskStatus) => void
  clearAllFilters: () => void
}
```

**Filter Logic (AND between types, OR within type):**
```typescript
// In KanbanBoardContainer - filtering logic
const transformedTasks: Task[] = useMemo(() => {
  let filtered = (tasks ?? []).map((task) => ({
    ...task,
    status: task.status as TaskStatus,
    created_at: new Date(task.created_at),
    updated_at: new Date(task.updated_at)
  }))

  // Sprint filter (single select, existing)
  if (selectedSprintId) {
    filtered = filtered.filter((task) => task.sprint_id === selectedSprintId)
  }

  // Epic filter (multi-select, OR logic)
  if (selectedEpicIds.length > 0) {
    filtered = filtered.filter((task) =>
      task.epic_id && selectedEpicIds.includes(task.epic_id)
    )
  }

  // Status filter (multi-select, OR logic)
  // Note: If no statuses selected, show all. If some selected, only show those.
  if (selectedStatuses.length > 0 && selectedStatuses.length < 4) {
    filtered = filtered.filter((task) => selectedStatuses.includes(task.status))
  }

  return filtered
}, [tasks, selectedSprintId, selectedEpicIds, selectedStatuses])
```

### Component File Locations

**New Files to Create:**
```
src/renderer/src/components/filter/FilterPanel.tsx
src/renderer/src/components/filter/FilterButton.tsx
src/renderer/src/components/filter/FilterSummary.tsx
src/renderer/src/components/filter/index.ts
```

**Files to Modify:**
```
src/renderer/src/stores/ui.store.ts              # Add filter state
src/renderer/src/stores/ui.store.test.ts         # Test new state
src/renderer/src/components/layout/Header.tsx    # Add FilterButton
src/renderer/src/components/layout/Header.test.tsx
src/renderer/src/components/board/KanbanBoardContainer.tsx  # Apply filters
src/renderer/src/components/board/KanbanBoardContainer.test.tsx
src/renderer/src/components/board/KanbanColumn.tsx  # Filtered state indicator
```

### Zustand Persist Pattern

```typescript
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

// Get project-specific storage key
const getStorageKey = () => {
  // Access project path from project store or use default
  const projectPath = localStorage.getItem('tinsu-project-path') || 'default'
  return `tinsu-filters-${projectPath.replace(/[^a-zA-Z0-9]/g, '-')}`
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      selectedSprintId: null,
      selectedEpicIds: [],
      selectedStatuses: [],

      // ... actions
    }),
    {
      name: 'tinsu-ui-filters', // Base key, we'll customize per project
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist filter-related state
        selectedSprintId: state.selectedSprintId,
        selectedEpicIds: state.selectedEpicIds,
        selectedStatuses: state.selectedStatuses
      })
    }
  )
)
```

### shadcn/ui Components Needed

**Popover (likely needs install):**
```bash
npx shadcn@latest add popover
```

**Already installed:**
- Button (existing)
- Select (from 2.5)
- Checkbox (may need: `npx shadcn@latest add checkbox`)
- Badge (may need: `npx shadcn@latest add badge`)

### FilterPanel Component Structure

```typescript
// src/renderer/src/components/filter/FilterPanel.tsx
import { Popover, PopoverContent, PopoverTrigger } from '@renderer/components/ui/popover'
import { Checkbox } from '@renderer/components/ui/checkbox'
import { EpicBadge } from '@renderer/components/task/EpicBadge'
import { trpc } from '@renderer/lib/trpc'
import { useUIStore } from '@renderer/stores/ui.store'
import { TASK_STATUS } from '@shared/types/task.types'
import { COLUMN_CONFIG } from '../board/KanbanColumn'

interface FilterPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  trigger: React.ReactNode
}

export function FilterPanel({ open, onOpenChange, trigger }: FilterPanelProps) {
  const { data: epics } = trpc.epics.getAll.useQuery()
  const { data: sprints } = trpc.sprints.getAll.useQuery()

  const {
    selectedSprintId,
    selectedEpicIds,
    selectedStatuses,
    setSelectedSprint,
    toggleEpicFilter,
    toggleStatusFilter,
    clearAllFilters
  } = useUIStore()

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">Filters</h4>
            <button onClick={clearAllFilters} className="text-xs text-muted-foreground hover:text-foreground">
              Clear all
            </button>
          </div>

          {/* Sprint Section */}
          <div>
            <h5 className="text-xs font-medium text-muted-foreground mb-2">Sprint</h5>
            {/* Sprint radio buttons or select */}
          </div>

          {/* Epic Section */}
          <div>
            <h5 className="text-xs font-medium text-muted-foreground mb-2">
              Epic {selectedEpicIds.length > 0 && `(${selectedEpicIds.length})`}
            </h5>
            <div className="space-y-2">
              {epics?.map((epic) => (
                <label key={epic.id} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={selectedEpicIds.includes(epic.id)}
                    onCheckedChange={() => toggleEpicFilter(epic.id)}
                  />
                  <EpicBadge title={epic.title} color={epic.color} className="text-xs" />
                </label>
              ))}
            </div>
          </div>

          {/* Status Section */}
          <div>
            <h5 className="text-xs font-medium text-muted-foreground mb-2">
              Status {selectedStatuses.length > 0 && `(${selectedStatuses.length})`}
            </h5>
            <div className="space-y-2">
              {TASK_STATUS.map((status) => (
                <label key={status} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={selectedStatuses.includes(status)}
                    onCheckedChange={() => toggleStatusFilter(status)}
                  />
                  <span className="text-sm">{COLUMN_CONFIG[status].title}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
```

### FilterButton with Badge

```typescript
// src/renderer/src/components/filter/FilterButton.tsx
import { Filter } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { useUIStore } from '@renderer/stores/ui.store'
import { cn } from '@renderer/lib/utils'

interface FilterButtonProps {
  onClick?: () => void
  className?: string
}

export function FilterButton({ onClick, className }: FilterButtonProps) {
  const { selectedSprintId, selectedEpicIds, selectedStatuses } = useUIStore()

  // Count active filters
  const activeCount =
    (selectedSprintId ? 1 : 0) +
    selectedEpicIds.length +
    (selectedStatuses.length > 0 && selectedStatuses.length < 4 ? selectedStatuses.length : 0)

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className={cn('relative', className)}
      aria-label={`Filter tasks${activeCount > 0 ? `, ${activeCount} active` : ''}`}
    >
      <Filter className="h-4 w-4" />
      {activeCount > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
          {activeCount}
        </span>
      )}
    </Button>
  )
}
```

### Previous Story Intelligence (Story 2.5)

**Key Learnings:**
1. Sprint filter already works in sidebar via `selectedSprintId` in UIStore
2. Filter is applied in KanbanBoardContainer `transformedTasks` useMemo
3. EpicBadge component exists with 10-color palette
4. SprintList component exists in sidebar
5. Test pattern: mock tRPC hooks, use Testing Library
6. Query invalidation: use `utils.tasks.getAll.invalidate()`
7. All 409 tests pass - maintain test coverage

**Pattern from previous story:**
```typescript
// Radix Select empty value fix - use "none" not ""
<Select value={selectedSprintId || "none"} onValueChange={(v) => setSelectedSprint(v === "none" ? null : v)}>
```

### Git Intelligence (Recent Commits)

From most recent commits:
- `296428c`: Story 2.5 complete - Epic/Sprint hierarchy with filtering foundation
- Sprint filter already implemented in KanbanBoardContainer
- date-fns installed for date formatting
- shadcn/ui Select component installed

**Commit message format:** `2.6 done: <description>`

### Testing Standards

**Test files to create/update:**
```
src/renderer/src/stores/ui.store.test.ts         # Filter state tests
src/renderer/src/components/filter/FilterPanel.test.tsx
src/renderer/src/components/filter/FilterButton.test.tsx
src/renderer/src/components/layout/Header.test.tsx
src/renderer/src/components/board/KanbanBoardContainer.test.tsx
```

**Test pattern:**
```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Zustand store
vi.mock('@renderer/stores/ui.store', () => ({
  useUIStore: vi.fn(() => ({
    selectedSprintId: null,
    selectedEpicIds: [],
    selectedStatuses: [],
    toggleEpicFilter: vi.fn(),
    toggleStatusFilter: vi.fn(),
    clearAllFilters: vi.fn()
  }))
}))

// Mock tRPC
vi.mock('@renderer/lib/trpc', () => ({
  trpc: {
    epics: { getAll: { useQuery: vi.fn(() => ({ data: mockEpics })) } },
    sprints: { getAll: { useQuery: vi.fn(() => ({ data: mockSprints })) } }
  }
}))
```

### Performance Requirements (from PRD NFRs)

- NFR1: UI interactions complete in <100ms (filter toggling)
- NFR2: Board loads in <1 second (including filter application)
- NFR7: State changes persist immediately

Filtering is done client-side in `useMemo` - no backend call needed. This ensures instant filtering response.

### Accessibility Requirements

- Filter button has aria-label with active count
- Popover has proper focus management
- Checkboxes are keyboard accessible
- Filter summary chips can be removed via keyboard
- Screen reader announces filter changes

### Project Structure Notes

**Alignment with Architecture:**
- Components follow existing patterns (shadcn/ui, Tailwind)
- State management via Zustand (not useState for server-derived data)
- tRPC queries for epics/sprints data
- Tests co-located with components

**No backend changes needed:**
- Filtering is client-side only
- All data already fetched via existing `getAll` queries
- Persistence via localStorage, not database

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-2.6] - Full acceptance criteria
- [Source: _bmad-output/planning-artifacts/project-context.md] - Critical implementation rules
- [Source: _bmad-output/implementation-artifacts/2-5-add-sprint-epic-story-hierarchy.md] - Previous story patterns
- [Source: src/renderer/src/stores/ui.store.ts] - Existing filter state (selectedSprintId)
- [Source: src/renderer/src/components/board/KanbanBoardContainer.tsx] - Filtering logic location
- [Source: src/renderer/src/components/board/KanbanColumn.tsx] - Column with task count
- [Source: src/renderer/src/components/layout/Header.tsx] - Header component to extend
- [Source: src/renderer/src/components/task/EpicBadge.tsx] - Epic badge component to reuse

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

None - implementation proceeded smoothly.

### Completion Notes List

1. All 9 tasks completed following red-green-refactor TDD cycle
2. All 469 tests pass (21 new tests added for Story 2.6)
3. Filter state persists to localStorage using Zustand persist middleware
4. FilterPanel uses shadcn/ui Popover and Checkbox components (installed)
5. FilterButton shows badge with active filter count
6. FilterSummary displays chips below header with remove buttons
7. Filtering logic: AND between filter types (sprint AND epic AND status), OR within filter types
8. Status filter shows all columns if all 4 statuses selected (optimization to avoid unnecessary filter)
9. KanbanBoard shows "No matching tasks" when filters active vs "No tasks" when no filters
10. Pre-existing TypeScript errors in unrelated files (CreateTaskDialog, SprintSelect, XTerminal) not addressed - outside story scope

### File List

**New Files Created:**
- src/renderer/src/components/filter/FilterPanel.tsx
- src/renderer/src/components/filter/FilterPanel.test.tsx
- src/renderer/src/components/filter/FilterButton.tsx
- src/renderer/src/components/filter/FilterButton.test.tsx
- src/renderer/src/components/filter/FilterSummary.tsx
- src/renderer/src/components/filter/FilterSummary.test.tsx
- src/renderer/src/components/filter/index.ts
- src/renderer/src/components/ui/popover.tsx (shadcn)
- src/renderer/src/components/ui/checkbox.tsx (shadcn)

**Modified Files:**
- src/renderer/src/stores/ui.store.ts - Added filter state, actions, and persist middleware
- src/renderer/src/stores/ui.store.test.ts - Added 21 tests for filter state management
- src/renderer/src/components/layout/Header.tsx - Added FilterButton, FilterPanel, clear filters button, FilterSummary
- src/renderer/src/components/layout/Header.test.tsx - Added filter control tests
- src/renderer/src/components/layout/AppShell.test.tsx - Updated mocks for filter state
- src/renderer/src/components/board/KanbanBoardContainer.tsx - Added comprehensive filtering logic
- src/renderer/src/components/board/KanbanBoardContainer.test.tsx - Added filter combination tests
- src/renderer/src/components/board/KanbanBoard.tsx - Added hasActiveFilters prop for empty state
- package.json - Added @radix-ui/react-checkbox, @radix-ui/react-popover dependencies
- package-lock.json - Updated dependencies

### Changelog

#### Added
- Task filtering by sprint (single-select), epic (multi-select), and status (multi-select)
- FilterPanel component with popover UI for filter selection
- FilterButton component with badge showing active filter count
- FilterSummary component displaying removable filter chips
- Filter state persistence to localStorage via Zustand persist middleware
- "Clear all filters" button in header when filters are active
- "No matching tasks" vs "No tasks" empty state differentiation
- Comprehensive test coverage for all filter components and logic

#### Changed
- Header component now includes filter controls section
- KanbanBoardContainer applies comprehensive filtering (AND between types, OR within types)
- KanbanBoard accepts hasActiveFilters prop for context-aware empty states
- UI store extended with epic/status filter state and actions

#### Dependencies Added
- @radix-ui/react-checkbox
- @radix-ui/react-popover
- @radix-ui/react-radio-group

## Code Review Record

### Review Agent Model
Claude Opus 4.5 (claude-opus-4-5-20251101)

### Review Date
2026-01-05

### Issues Found and Fixed

| # | Severity | Issue | Fix Applied |
|---|----------|-------|-------------|
| 1 | HIGH | Status chip removal used label comparison (fragile) | Refactored to use status key directly |
| 2 | HIGH | Epic chip removal found epic by title (collision risk) | Refactored to use epic ID directly |
| 3 | HIGH | Persistence not project-scoped | Added `lastProjectPath` tracking and `syncProjectPath` action |
| 4 | MEDIUM | Sprint filter used Checkbox (should be Radio per dev notes) | Installed RadioGroup, added "All Sprints" option |
| 5 | MEDIUM | `hasActiveFilters` didn't exclude all-4-statuses case | Updated logic to return false when all 4 statuses selected |
| 6 | MEDIUM | Missing status chip removal test | Added test case |

### Additional Files Modified During Review
- src/renderer/src/components/ui/radio-group.tsx (new - shadcn)
- src/renderer/src/components/layout/AppShell.tsx - Added project path sync effect
- All test files updated with `lastProjectPath` state

### Final Test Results
- 476 tests pass (7 new tests added during review)
- All acceptance criteria verified


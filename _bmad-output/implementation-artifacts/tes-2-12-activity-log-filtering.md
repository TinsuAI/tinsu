# Story TES-2.12: Activity Log Filtering

Status: done

---

## Story

As a user,
I want to filter the activity log by event type,
So that I can focus on specific events.

**Story ID:** TES-2.12
**Epic:** TES Epic 2 - Activity Log & Event Tracking

---

## Acceptance Criteria

1. **Given** the activity log is displayed, **When** the user clicks the "Status" filter chip, **Then** only status_change events are shown, **And** the chip appears selected (highlighted)

2. **Given** filter chips exist for each category, **When** displayed, **Then** chips are: All, Status, Agent, User, Error, **And** "Agent" includes: agent_start, agent_complete, tool_used, **And** "Error" filter highlights error events prominently

3. **Given** multiple filters are selected, **When** events are filtered, **Then** events matching ANY selected filter are shown (OR logic)

4. **Given** the "All" chip is selected, **When** events are displayed, **Then** all event types are shown

---

## Tasks / Subtasks

- [x] Task 1: Create ActivitiesFilter component (AC: #1, #2, #4)
  - [x] 1.1: Create `src/renderer/src/components/task/ActivitiesFilter.tsx` component
  - [x] 1.2: Implement filter chip buttons: All, Status, Agent, User, Error
  - [x] 1.3: Style chips with selected/unselected states using Tailwind classes
  - [x] 1.4: Implement click handler to toggle filter selection
  - [x] 1.5: Emit selected filter categories via callback prop
  - [x] 1.6: Write unit tests for ActivitiesFilter component

- [x] Task 2: Implement filter logic in ActivitiesTab (AC: #2, #3)
  - [x] 2.1: Add state for selected filters in ActivitiesTab
  - [x] 2.2: Create event type to category mapping:
    - Status: `status_change`
    - Agent: `agent_start`, `agent_complete`, `tool_used`, `automation_trigger`, `stall_recovered`
    - User: `user_command`
    - Error: `error`, `session_ended`, `stall_detected`
  - [x] 2.3: Update tRPC query to include eventTypes filter parameter
  - [x] 2.4: Implement OR logic when multiple categories selected
  - [x] 2.5: Show "No matching events" when filter returns empty results
  - [x] 2.6: Write unit tests for filter logic

- [x] Task 3: Integrate ActivitiesFilter into ActivitiesTab (AC: #1)
  - [x] 3.1: Add ActivitiesFilter component above the activity list
  - [x] 3.2: Make filter chips sticky at the top when scrolling
  - [x] 3.3: Update activity count in header to reflect filtered count
  - [x] 3.4: Preserve filter state when switching away and back to Activities tab
  - [x] 3.5: Test integration with existing activity display from TES-2.11

- [x] Task 4: Write integration tests
  - [x] 4.1: Test clicking Status filter shows only status_change events
  - [x] 4.2: Test clicking Agent filter shows agent_start, agent_complete, tool_used events
  - [x] 4.3: Test multiple filters selected shows union of events (OR logic)
  - [x] 4.4: Test All filter resets to showing all events
  - [x] 4.5: Test empty filter state shows "No matching events" message

- [x] Review Follow-ups (AI)
  - [x] [AI-Review][Medium] Fix code duplication in ActivitiesTab.tsx by consolidating layout logic
  - [x] [AI-Review][Medium] Remove redundant sticky positioning in ActivitiesFilter.tsx

---

## Dev Notes

### Architecture Compliance

This story implements **FR18** from the Task Execution Sandbox PRD:
> FR18: User can filter the activity log by event type

And follows the UX design specification from the "Activities Tab" section showing filter chips.

[Source: _bmad-output/planning-artifacts/prd-task-execution-sandbox.md#activity-logging]
[Source: _bmad-output/planning-artifacts/epics-task-execution-sandbox.md#story-212-activity-log-filtering]

### Previous Story Learnings (CRITICAL)

**From TES-2.11 (Activity Log UI Display):**
- ActivitiesTab component at `src/renderer/src/components/task/ActivitiesTab.tsx`
- ActivityItem component at `src/renderer/src/components/task/ActivityItem.tsx`
- tRPC query: `trpc.activity.listActivities.useQuery({ taskId, limit: 100 })`
- 10 event types defined: `status_change`, `agent_start`, `agent_complete`, `tool_used`, `user_command`, `automation_trigger`, `error`, `session_ended`, `stall_detected`, `stall_recovered`
- Activity count shown in header
- Auto-refresh every 5 seconds (ACTIVITY_REFRESH_INTERVAL constant)
- Activities tab integrated in StoryDetailDialog as second tab
- Keyboard shortcuts 1/2/3 for tab switching

**From TES-2.2 (Activity Log Service Core):**
- tRPC router supports `eventTypes` filter parameter:
  ```typescript
  trpc.activity.listActivities.useQuery({
    taskId,
    eventTypes: ['status_change', 'agent_start'], // Optional array filter
    limit: 100
  })
  ```
- Filter is applied server-side for efficiency
- Activities returned sorted by `created_at` DESC (newest first)

[Source: src/renderer/src/components/task/ActivitiesTab.tsx]
[Source: src/main/trpc/routers/activity.router.ts]

### Technical Implementation Guidance

**Filter Category to Event Type Mapping:**

| Category | Event Types | Icon | Color Class |
|----------|-------------|------|-------------|
| All | (no filter) | Filter | `text-zinc-400` |
| Status | `status_change` | ArrowRight | `text-blue-400` |
| Agent | `agent_start`, `agent_complete`, `tool_used`, `automation_trigger` | Bot | `text-green-400` |
| User | `user_command` | Terminal | `text-purple-400` |
| Error | `error`, `session_ended`, `stall_detected` | AlertCircle | `text-red-400` |

**Note:** `stall_recovered` could be in Agent or Status category - putting in Agent for simplicity.

**Component Structure:**

```typescript
// src/renderer/src/components/task/ActivitiesFilter.tsx
import { cn } from '@renderer/lib/utils'
import { Filter, ArrowRight, Bot, Terminal, AlertCircle } from 'lucide-react'

type FilterCategory = 'all' | 'status' | 'agent' | 'user' | 'error'

interface ActivitiesFilterProps {
  selectedFilters: FilterCategory[]
  onFilterChange: (filters: FilterCategory[]) => void
}

const FILTER_CHIPS: { id: FilterCategory; label: string; icon: React.ElementType; color: string }[] = [
  { id: 'all', label: 'All', icon: Filter, color: 'zinc' },
  { id: 'status', label: 'Status', icon: ArrowRight, color: 'blue' },
  { id: 'agent', label: 'Agent', icon: Bot, color: 'green' },
  { id: 'user', label: 'User', icon: Terminal, color: 'purple' },
  { id: 'error', label: 'Error', icon: AlertCircle, color: 'red' }
]

export function ActivitiesFilter({ selectedFilters, onFilterChange }: ActivitiesFilterProps) {
  const handleChipClick = (category: FilterCategory) => {
    if (category === 'all') {
      // Reset to all
      onFilterChange(['all'])
      return
    }

    // Toggle category
    let newFilters = selectedFilters.filter(f => f !== 'all')

    if (newFilters.includes(category)) {
      newFilters = newFilters.filter(f => f !== category)
    } else {
      newFilters = [...newFilters, category]
    }

    // If no filters selected, default to all
    if (newFilters.length === 0) {
      newFilters = ['all']
    }

    onFilterChange(newFilters)
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800 bg-zinc-900/50 sticky top-0 z-10">
      <span className="text-xs text-zinc-500 mr-1">Filter:</span>
      {FILTER_CHIPS.map(chip => {
        const isSelected = selectedFilters.includes(chip.id) ||
          (chip.id === 'all' && selectedFilters.length === 0)
        const Icon = chip.icon

        return (
          <button
            key={chip.id}
            onClick={() => handleChipClick(chip.id)}
            className={cn(
              'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors',
              isSelected
                ? `bg-${chip.color}-500/20 text-${chip.color}-400 border border-${chip.color}-500/30`
                : 'bg-zinc-800 text-zinc-400 border border-transparent hover:bg-zinc-700'
            )}
            aria-pressed={isSelected}
          >
            <Icon className="w-3 h-3" />
            {chip.label}
          </button>
        )
      })}
    </div>
  )
}
```

**Updated ActivitiesTab with Filtering:**

```typescript
// src/renderer/src/components/task/ActivitiesTab.tsx - Updated
import { useState, useMemo } from 'react'
import { ActivitiesFilter, FilterCategory } from './ActivitiesFilter'

// Event type to category mapping
const CATEGORY_EVENT_TYPES: Record<Exclude<FilterCategory, 'all'>, string[]> = {
  status: ['status_change'],
  agent: ['agent_start', 'agent_complete', 'tool_used', 'automation_trigger', 'stall_recovered'],
  user: ['user_command'],
  error: ['error', 'session_ended', 'stall_detected']
}

function getEventTypesForFilters(filters: FilterCategory[]): string[] | undefined {
  if (filters.includes('all') || filters.length === 0) {
    return undefined // No filter = all events
  }

  // Combine event types from all selected categories (OR logic)
  const eventTypes = new Set<string>()
  for (const filter of filters) {
    if (filter !== 'all') {
      CATEGORY_EVENT_TYPES[filter].forEach(type => eventTypes.add(type))
    }
  }
  return Array.from(eventTypes)
}

export function ActivitiesTab({ taskId }: ActivitiesTabProps) {
  const [selectedFilters, setSelectedFilters] = useState<FilterCategory[]>(['all'])

  const eventTypes = useMemo(
    () => getEventTypesForFilters(selectedFilters),
    [selectedFilters]
  )

  const { data: activities, isLoading, error, refetch } = trpc.activity.listActivities.useQuery(
    { taskId, limit: 100, eventTypes },
    { refetchInterval: ACTIVITY_REFRESH_INTERVAL }
  )

  // ... rest of component with ActivitiesFilter at top
  return (
    <div className="flex flex-col h-full">
      <ActivitiesFilter
        selectedFilters={selectedFilters}
        onFilterChange={setSelectedFilters}
      />

      <div className="flex-1 overflow-y-auto">
        {/* Loading, error, empty, and list states */}
        {isLoading && <ActivityListSkeleton />}
        {error && /* ... error state ... */}
        {!isLoading && !error && activities?.length === 0 && (
          <div className="flex items-center justify-center h-full text-zinc-500">
            {selectedFilters.includes('all') ? 'No activity yet' : 'No matching events'}
          </div>
        )}
        {activities?.map(activity => (
          <ActivityItem key={activity.id} activity={activity} />
        ))}
      </div>
    </div>
  )
}
```

**Important Implementation Notes:**

1. **Use dynamic Tailwind classes carefully** - The color classes like `bg-${chip.color}-500/20` won't work with Tailwind's JIT. Instead, use explicit class mappings:
   ```typescript
   const colorClasses: Record<string, { selected: string; unselected: string }> = {
     zinc: { selected: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30', unselected: '...' },
     blue: { selected: 'bg-blue-500/20 text-blue-400 border-blue-500/30', unselected: '...' },
     // ... etc
   }
   ```

2. **Sticky filter bar** - Use `sticky top-0` with a background color to ensure chips stay visible while scrolling activities.

3. **OR logic for multiple filters** - When User and Agent are both selected, show events from BOTH categories (union, not intersection).

4. **Preserve filter state** - Use useState in ActivitiesTab. The state will persist as long as the dialog stays mounted. No need for global state.

5. **Server-side filtering** - The tRPC query already supports `eventTypes` array. Pass the combined event types to filter server-side for efficiency.

### UX Design Reference

From the UX Design Specification, Activities Tab section (Line 801-830):

```
┌─────────────────────────────────────────────────────┐
│ Terminal    Activities    Diff    Content           │
├─────────────────────────────────────────────────────┤
│ Filter: [All ▼] [Status] [Agent] [User] [Error]     │  ← THIS STORY
├─────────────────────────────────────────────────────┤
│ ┌─ 14:32:18 ─────────────────────────────────────┐  │
│ │ ● Status Changed                               │  │
│ │   backlog → in_progress                        │  │
│ └────────────────────────────────────────────────┘  │
```

**Filter Chip Behavior (from PRD):**
- Chips toggle between selected/unselected
- Multiple chips can be selected simultaneously
- "All" chip deselects other filters and shows everything
- Selecting a specific filter deselects "All"
- Visual distinction: selected chips have colored background and border

[Source: _bmad-output/planning-artifacts/epics-task-execution-sandbox.md:801-830]

### Project Structure Notes

**Files to Create:**

| File | Purpose |
|------|---------|
| `src/renderer/src/components/task/ActivitiesFilter.tsx` | Filter chip component |
| `src/renderer/src/components/task/ActivitiesFilter.test.tsx` | Unit tests |

**Files to Modify:**

| File | Action | Purpose |
|------|--------|---------|
| `src/renderer/src/components/task/ActivitiesTab.tsx` | MODIFY | Add filter state and integrate ActivitiesFilter |
| `src/renderer/src/components/task/ActivitiesTab.test.tsx` | MODIFY | Add filter integration tests |

**Existing Files to Reference:**

- `src/renderer/src/components/task/ActivitiesTab.tsx` - Component to extend
- `src/renderer/src/components/task/ActivityItem.tsx` - Event type patterns
- `src/main/trpc/routers/activity.router.ts` - Query signature with eventTypes
- `src/main/db/schema.ts` - `ACTIVITY_EVENT_TYPE` enum (line 261-273)

### Code Patterns (Following Project Standards)

**Naming Conventions:**
| Element | Convention | Example |
|---------|------------|---------|
| Components | PascalCase | `ActivitiesFilter.tsx` |
| Props interfaces | PascalCase + Props | `ActivitiesFilterProps` |
| Type aliases | PascalCase | `FilterCategory` |
| Constants | SCREAMING_SNAKE_CASE | `CATEGORY_EVENT_TYPES` |

[Source: _bmad-output/planning-artifacts/project-context.md#naming-conventions]

**Styling Rules:**
- Use Tailwind classes inline
- Use `cn()` utility from `@renderer/lib/utils` for conditional classes
- Follow dark theme color palette: zinc for base, specific colors for status
- Chip selected state: colored background with opacity (e.g., `bg-blue-500/20`)
- Chip unselected state: `bg-zinc-800 text-zinc-400`

**tRPC Usage Pattern:**

```typescript
import { trpc } from '@renderer/lib/trpc'

// With optional eventTypes filter
const { data, isLoading, error, refetch } = trpc.activity.listActivities.useQuery({
  taskId,
  eventTypes: ['status_change', 'agent_start'], // Optional - undefined shows all
  limit: 100
})
```

### Testing Pattern

```typescript
// ActivitiesFilter.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ActivitiesFilter, FilterCategory } from './ActivitiesFilter'

describe('ActivitiesFilter', () => {
  it('renders all filter chips', () => {
    render(<ActivitiesFilter selectedFilters={['all']} onFilterChange={vi.fn()} />)

    expect(screen.getByText('All')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()
    expect(screen.getByText('Agent')).toBeInTheDocument()
    expect(screen.getByText('User')).toBeInTheDocument()
    expect(screen.getByText('Error')).toBeInTheDocument()
  })

  it('shows "All" as selected by default', () => {
    render(<ActivitiesFilter selectedFilters={['all']} onFilterChange={vi.fn()} />)

    const allChip = screen.getByRole('button', { name: /all/i })
    expect(allChip).toHaveAttribute('aria-pressed', 'true')
  })

  it('calls onFilterChange when Status chip clicked', () => {
    const onChange = vi.fn()
    render(<ActivitiesFilter selectedFilters={['all']} onFilterChange={onChange} />)

    fireEvent.click(screen.getByText('Status'))

    expect(onChange).toHaveBeenCalledWith(['status'])
  })

  it('allows multiple filters to be selected', () => {
    const onChange = vi.fn()
    render(<ActivitiesFilter selectedFilters={['status']} onFilterChange={onChange} />)

    fireEvent.click(screen.getByText('Agent'))

    expect(onChange).toHaveBeenCalledWith(['status', 'agent'])
  })

  it('resets to All when clicking All chip', () => {
    const onChange = vi.fn()
    render(<ActivitiesFilter selectedFilters={['status', 'agent']} onFilterChange={onChange} />)

    fireEvent.click(screen.getByText('All'))

    expect(onChange).toHaveBeenCalledWith(['all'])
  })

  it('removes filter when clicking already-selected chip', () => {
    const onChange = vi.fn()
    render(<ActivitiesFilter selectedFilters={['status', 'agent']} onFilterChange={onChange} />)

    fireEvent.click(screen.getByText('Status'))

    expect(onChange).toHaveBeenCalledWith(['agent'])
  })

  it('defaults to All when last filter removed', () => {
    const onChange = vi.fn()
    render(<ActivitiesFilter selectedFilters={['status']} onFilterChange={onChange} />)

    fireEvent.click(screen.getByText('Status'))

    expect(onChange).toHaveBeenCalledWith(['all'])
  })
})
```

```typescript
// ActivitiesTab.test.tsx - Add these tests
describe('ActivitiesTab filtering', () => {
  it('passes undefined eventTypes when All filter selected', async () => {
    // Mock and verify trpc.activity.listActivities called with eventTypes: undefined
  })

  it('passes status_change eventType when Status filter selected', async () => {
    // Click Status filter, verify eventTypes: ['status_change']
  })

  it('passes combined eventTypes when multiple filters selected', async () => {
    // Select Status and Agent, verify eventTypes includes all relevant types
  })

  it('shows "No matching events" when filter returns empty', async () => {
    // Mock empty response with filter active
    // Verify "No matching events" message shown
  })

  it('shows "No activity yet" when no filter and empty', async () => {
    // Mock empty response with All filter
    // Verify "No activity yet" message shown
  })
})
```

### Non-Functional Requirements

| NFR | Target | Notes |
|-----|--------|-------|
| Filter response | <1s | NFR2: Activity log filter/search <1 second |
| Tab switch time | <200ms | NFR6: Tab switching feels instant |
| Activity event latency | <1s | NFR1: Events appear in UI within 1 second |

[Source: _bmad-output/planning-artifacts/epics-task-execution-sandbox.md:89-90]

### Scope Notes

**In Scope (This Story):**
- Filter chips: All, Status, Agent, User, Error
- Click to toggle filter selection
- Multiple filters with OR logic
- Visual selected/unselected states
- Server-side filtering via eventTypes parameter
- "No matching events" message when filter returns empty

**Out of Scope (Future Stories):**
- Real-time activity streaming (TES-2.13)
- Activity search by text
- Date range filtering
- Export filtered activities
- Saved filter presets

### Simplicity Assessment

This is a **low-to-moderate complexity UI story** with:
- One new React component (ActivitiesFilter)
- State management update to existing ActivitiesTab
- Simple click handlers and toggle logic
- Leverages existing tRPC eventTypes filter
- Standard Tailwind styling patterns

**Estimated Implementation:**
1. Create ActivitiesFilter component with chips and toggle logic
2. Update ActivitiesTab to manage filter state
3. Connect filter to tRPC query eventTypes parameter
4. Write comprehensive tests

### Important Notes

**FRONTEND/UI STORY:** This is a frontend-focused story implementing filter UI.

The dev agent MUST:
1. Follow existing component patterns from ActivitiesTab.tsx and ActivityItem.tsx
2. Use Tailwind classes inline (no separate CSS files)
3. Use explicit color class mappings (not template strings for JIT)
4. Co-locate tests with source files
5. Use the existing tRPC eventTypes filter parameter - do NOT create new backend endpoints

### References

- [Architecture: ActivityLogService](/_bmad-output/planning-artifacts/architecture.md#activitylogservice)
- [PRD: FR18 Activity Log Filtering](/_bmad-output/planning-artifacts/prd-task-execution-sandbox.md#activity-logging)
- [Epics: Story 2.12](/_bmad-output/planning-artifacts/epics-task-execution-sandbox.md#story-212-activity-log-filtering)
- [Project Context](/_bmad-output/planning-artifacts/project-context.md)
- [TES-2.11: Activity Log UI Display](/_bmad-output/implementation-artifacts/tes-2-11-activity-log-ui-display.md)
- [TES-2.2: Activity Log Service Core](/_bmad-output/implementation-artifacts/tes-2-2-activity-log-service-core.md)

### Testing Notes

Run tests with:
```bash
npm test src/renderer/src/components/task/ActivitiesFilter.test.tsx
npm test src/renderer/src/components/task/ActivitiesTab.test.tsx
```

**Remember native module rebuild:**
```bash
npm run rebuild:node   # Before tests
npm run rebuild:electron  # After tests (automatic via posttest)
```

---

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

None

### Completion Notes List

- Created ActivitiesFilter component with 5 filter chips (All, Status, Agent, User, Error)
- Used explicit Tailwind color class mappings for JIT compatibility (COLOR_CLASSES record)
- Implemented toggle logic with multi-select support and OR filtering
- "All" resets all filters; removing last specific filter defaults back to "All"
- Integrated filter into ActivitiesTab with sticky positioning
- Event type mapping: Status (status_change), Agent (agent_start, agent_complete, tool_used, automation_trigger, stall_recovered), User (user_command), Error (error, session_ended, stall_detected)
- Leveraged existing tRPC eventTypes filter parameter for server-side filtering
- Shows "No matching events" when filter returns empty, "No activity yet" when no filter and empty
- All 26 tests pass (10 ActivitiesFilter, 16 ActivitiesTab including 7 new filter integration tests)
- Followed red-green-refactor cycle: tests written first, then implementation
- Refactored `ActivitiesTab` to reduce code duplication and remove redundant sticky positioning in `ActivitiesFilter` per adversarial review.

### File List

**New Files:**
- src/renderer/src/components/task/ActivitiesFilter.tsx
- src/renderer/src/components/task/ActivitiesFilter.test.tsx

**Modified Files:**
- src/renderer/src/components/task/ActivitiesTab.tsx
- src/renderer/src/components/task/ActivitiesTab.test.tsx

### Change Log

- 2026-01-19: Implemented activity log filtering (TES-2.12) - Created ActivitiesFilter component with filter chips, integrated into ActivitiesTab with server-side filtering via eventTypes parameter, OR logic for multiple filters, comprehensive test coverage.
- 2026-01-19: Refactored ActivitiesTab.tsx to consolidate layout logic and remove code duplication. Removed redundant sticky positioning from ActivitiesFilter.tsx.
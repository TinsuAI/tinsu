# Story TES-2.11: Activity Log UI Display

Status: done

---

## Story

As a user,
I want to see the activity log for a task,
So that I can review what happened.

**Story ID:** TES-2.11
**Epic:** TES Epic 2 - Activity Log & Event Tracking

---

## Acceptance Criteria

1. **Given** a task has activity events, **When** the user views the Activities section, **Then** events are displayed in reverse chronological order (newest first), **And** each event shows: timestamp, event type icon, description, **And** timestamps are formatted as HH:MM:SS

2. **Given** an event has a payload with details, **When** the event is displayed, **Then** relevant details are shown (e.g., file path for tool_used, command for user_command)

3. **Given** a task has no activity events, **When** the user views the Activities section, **Then** an empty state displays "No activity yet"

---

## Tasks / Subtasks

- [x] Task 1: Create ActivityItem component (AC: #1, #2)
  - [x] 1.1: Create `src/renderer/src/components/task/ActivityItem.tsx` component
  - [x] 1.2: Implement timestamp formatting as HH:MM:SS using `date-fns`
  - [x] 1.3: Create event type icon mapping for all activity types (status_change, agent_start, agent_complete, tool_used, user_command, automation_trigger, error, session_ended, stall_detected, stall_recovered)
  - [x] 1.4: Implement payload detail rendering based on event type
  - [x] 1.5: Style component following the UX design (card-style events with subtle borders)
  - [x] 1.6: Write unit tests for ActivityItem with various event types

- [x] Task 2: Create ActivitiesTab component (AC: #1, #3)
  - [x] 2.1: Create `src/renderer/src/components/task/ActivitiesTab.tsx` component
  - [x] 2.2: Implement tRPC query to fetch activities: `trpc.activity.listActivities.useQuery({ taskId })`
  - [x] 2.3: Display events in a scrollable list using ActivityItem components
  - [x] 2.4: Implement empty state with "No activity yet" message
  - [x] 2.5: Implement loading state with skeleton loaders
  - [x] 2.6: Implement error state with retry option
  - [x] 2.7: Write unit tests for ActivitiesTab component

- [x] Task 3: Integrate with existing task detail panel
  - [x] 3.1: Locate where task detail panel renders (likely TaskPanel or similar)
  - [x] 3.2: Add ActivitiesTab to the task detail view
  - [x] 3.3: Ensure keyboard navigation works (press `2` for Activities tab per UX spec)
  - [x] 3.4: Test integration with live data from existing TES-2.1 through TES-2.10 events

- [x] Task 4: Write integration tests
  - [x] 4.1: Test loading state displays correctly
  - [x] 4.2: Test empty state displays "No activity yet"
  - [x] 4.3: Test events display in reverse chronological order
  - [x] 4.4: Test all event types display correctly with icons and payloads
  - [x] 4.5: Test error state displays with retry option

---

## Dev Notes

### Architecture Compliance

This story implements **FR17** from the Task Execution Sandbox PRD:
> FR17: User can view the activity log for a specific task

And follows the UX design specification from the "Activities Tab" section.

[Source: _bmad-output/planning-artifacts/prd-task-execution-sandbox.md#activity-logging]
[Source: _bmad-output/planning-artifacts/ux-design-specification.md#activities-tab]

### Previous Story Learnings

**From TES-2.10 (Error Event Capture) - CRITICAL:**
- ActivityLogService provides `getActivities(taskId, options)` method
- Activity events have: id, task_id, event_type, payload (JSON string), created_at (Unix timestamp ms)
- Event types defined in `ACTIVITY_EVENT_TYPE` schema
- Payloads are JSON-encoded strings that need parsing

**From TES-2.2 (Activity Log Service Core):**
- tRPC router: `activity.listActivities` query takes `{ taskId, eventTypes?, limit?, offset?, since? }`
- Activities returned sorted by `created_at` DESC (newest first)
- Default limit is 100 activities

**From TaskTerminal.tsx Pattern:**
- Use `forwardRef` if ref forwarding needed
- Handle loading, error, and empty states explicitly
- Use Badge component for status indicators
- Follow conditional rendering pattern for different states

[Source: src/renderer/src/components/task/TaskTerminal.tsx]

### Technical Implementation Guidance

**Activity Event Types and Icons:**

| Event Type | Icon | Color | Description Format |
|------------|------|-------|-------------------|
| `status_change` | ArrowRight | blue | "Status changed: {from} → {to}" |
| `agent_start` | Play | green | "Agent started ({phase})" |
| `agent_complete` | CheckCircle | green | "Agent completed ({duration})" |
| `tool_used` | Wrench | zinc | "Used {tool}: {details}" |
| `user_command` | Terminal | purple | "Command: {command}" |
| `automation_trigger` | Zap | amber | "Auto-triggered: {command}" |
| `error` | AlertCircle | red | "{message}" |
| `session_ended` | XCircle | zinc | "Session ended: {reason}" |
| `stall_detected` | Clock | amber | "Stall detected" |
| `stall_recovered` | CheckCircle | green | "Stall recovered" |

**Component Structure:**

```typescript
// src/renderer/src/components/task/ActivityItem.tsx
interface ActivityItemProps {
  activity: {
    id: string
    task_id: string
    event_type: ActivityEventType
    payload: string | null  // JSON string
    created_at: number      // Unix timestamp ms
  }
}

export function ActivityItem({ activity }: ActivityItemProps) {
  const timestamp = format(new Date(activity.created_at), 'HH:mm:ss')
  const payload = activity.payload ? JSON.parse(activity.payload) : {}

  // Render based on event_type
  return (
    <div className="flex items-start gap-3 p-3 border-b border-zinc-800">
      {/* Icon */}
      <div className={cn('mt-0.5', getIconColorClass(activity.event_type))}>
        {getEventIcon(activity.event_type)}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">{timestamp}</span>
          <span className="text-sm font-medium">{getEventTitle(activity.event_type)}</span>
        </div>
        <p className="text-sm text-zinc-400 mt-0.5">
          {formatPayload(activity.event_type, payload)}
        </p>
      </div>
    </div>
  )
}
```

```typescript
// src/renderer/src/components/task/ActivitiesTab.tsx
interface ActivitiesTabProps {
  taskId: string
}

export function ActivitiesTab({ taskId }: ActivitiesTabProps) {
  const { data: activities, isLoading, error, refetch } =
    trpc.activity.listActivities.useQuery({ taskId, limit: 100 })

  if (isLoading) {
    return <ActivityListSkeleton />
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-500">
        <AlertCircle className="w-8 h-8 mb-2 text-red-500" />
        <p>Failed to load activities</p>
        <Button variant="ghost" size="sm" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    )
  }

  if (!activities?.length) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-500">
        No activity yet
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {activities.map((activity) => (
        <ActivityItem key={activity.id} activity={activity} />
      ))}
    </div>
  )
}
```

**Icon Library:**

Use Lucide icons (already in the project) for activity type icons:
- `ArrowRight` for status_change
- `Play` for agent_start
- `CheckCircle` for agent_complete
- `Wrench` for tool_used
- `Terminal` for user_command
- `Zap` for automation_trigger
- `AlertCircle` for error
- `XCircle` for session_ended
- `Clock` for stall_detected

**Payload Formatting Examples:**

```typescript
function formatPayload(eventType: ActivityEventType, payload: Record<string, unknown>): string {
  switch (eventType) {
    case 'status_change':
      return `${payload.from} → ${payload.to}`
    case 'agent_start':
      return payload.phase ? `Phase: ${payload.phase}` : 'Started'
    case 'agent_complete':
      return payload.duration_ms
        ? `Completed in ${Math.round(payload.duration_ms / 1000)}s`
        : 'Completed'
    case 'tool_used':
      const file = payload.file ? ` on ${payload.file}` : ''
      return `${payload.tool}${file}`
    case 'user_command':
      return payload.command ? `$ ${payload.command}` : ''
    case 'automation_trigger':
      return `${payload.command} (${payload.trigger})`
    case 'error':
      return payload.message as string
    case 'session_ended':
      return payload.reason as string
    case 'stall_detected':
      return payload.stallDurationMs
        ? `No output for ${Math.round(payload.stallDurationMs / 60000)}min`
        : 'No output detected'
    case 'stall_recovered':
      return 'Output resumed'
    default:
      return JSON.stringify(payload)
  }
}
```

### UX Design Reference

From the UX Design Specification, Activities Tab section:

```
┌─────────────────────────────────────────────────────┐
│ Terminal    Activities    Diff    Content           │
├─────────────────────────────────────────────────────┤
│ Filter: [All ▼] [Status] [Agent] [User] [Error]     │  ← TES-2.12 (future)
├─────────────────────────────────────────────────────┤
│ ┌─ 14:32:18 ─────────────────────────────────────┐  │
│ │ ● Status Changed                               │  │
│ │   backlog → in_progress                        │  │
│ └────────────────────────────────────────────────┘  │
│                                                     │
│ ┌─ 14:32:19 ─────────────────────────────────────┐  │
│ │ ▶ Agent Started                                │  │
│ │   Phase: dev-story                             │  │
│ └────────────────────────────────────────────────┘  │
...
```

**Note:** Filter chips are part of TES-2.12, not this story. This story focuses only on displaying the events.

[Source: _bmad-output/planning-artifacts/ux-design-specification.md:1436-1510]

### Project Structure Notes

**Files to Create:**

| File | Purpose |
|------|---------|
| `src/renderer/src/components/task/ActivityItem.tsx` | Single activity event card |
| `src/renderer/src/components/task/ActivityItem.test.tsx` | Unit tests for ActivityItem |
| `src/renderer/src/components/task/ActivitiesTab.tsx` | Tab container with list |
| `src/renderer/src/components/task/ActivitiesTab.test.tsx` | Unit tests for ActivitiesTab |

**Files to Potentially Modify:**

| File | Action | Purpose |
|------|--------|---------|
| `src/renderer/src/components/task/TaskPanel.tsx` (or equivalent) | MODIFY | Add ActivitiesTab to task detail view |

**Existing Files to Reference:**

- `src/renderer/src/components/task/TaskTerminal.tsx` - Component pattern reference
- `src/main/trpc/routers/activity.router.ts` - tRPC query signature
- `src/main/services/activity-log.service.ts` - Activity types and payloads
- `src/main/db/schema.ts` - `ACTIVITY_EVENT_TYPE` enum (line 261-273)

### Code Patterns (Following Project Standards)

**Naming Conventions:**
| Element | Convention | Example |
|---------|------------|---------|
| Components | PascalCase | `ActivityItem.tsx`, `ActivitiesTab.tsx` |
| Props interfaces | PascalCase + Props | `ActivityItemProps` |
| Hooks | camelCase, use prefix | `useActivities` (if needed) |
| Event types | snake_case | `status_change`, `agent_start` |

[Source: _bmad-output/planning-artifacts/project-context.md#naming-conventions]

**Styling Rules:**
- Use Tailwind classes inline
- Use `cn()` utility from `@renderer/lib/utils` for conditional classes
- Follow dark theme color palette from UX design
- Use zinc colors for muted elements, specific colors for status

**tRPC Usage Pattern:**

```typescript
import { trpc } from '@renderer/lib/trpc'

// In component
const { data, isLoading, error, refetch } = trpc.activity.listActivities.useQuery({
  taskId,
  limit: 100
})
```

### Testing Pattern

```typescript
// ActivityItem.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ActivityItem } from './ActivityItem'

describe('ActivityItem', () => {
  it('displays timestamp in HH:MM:SS format', () => {
    const activity = {
      id: 'test-1',
      task_id: 'task-123',
      event_type: 'status_change' as const,
      payload: JSON.stringify({ from: 'backlog', to: 'in_progress' }),
      created_at: new Date('2026-01-19T14:32:18').getTime()
    }

    render(<ActivityItem activity={activity} />)

    expect(screen.getByText('14:32:18')).toBeInTheDocument()
  })

  it('displays status_change event with arrow format', () => {
    const activity = {
      id: 'test-1',
      task_id: 'task-123',
      event_type: 'status_change' as const,
      payload: JSON.stringify({ from: 'backlog', to: 'in_progress' }),
      created_at: Date.now()
    }

    render(<ActivityItem activity={activity} />)

    expect(screen.getByText(/backlog.*→.*in_progress/)).toBeInTheDocument()
  })

  it('displays error event in red with message', () => {
    const activity = {
      id: 'test-2',
      task_id: 'task-123',
      event_type: 'error' as const,
      payload: JSON.stringify({ message: 'Agent failed', code: 'AGENT_ERROR' }),
      created_at: Date.now()
    }

    render(<ActivityItem activity={activity} />)

    expect(screen.getByText('Agent failed')).toBeInTheDocument()
  })
})

// ActivitiesTab.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ActivitiesTab } from './ActivitiesTab'

// Mock tRPC
vi.mock('@renderer/lib/trpc', () => ({
  trpc: {
    activity: {
      listActivities: {
        useQuery: vi.fn()
      }
    }
  }
}))

describe('ActivitiesTab', () => {
  it('displays empty state when no activities', () => {
    const { trpc } = await import('@renderer/lib/trpc')
    vi.mocked(trpc.activity.listActivities.useQuery).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: vi.fn()
    } as any)

    render(<ActivitiesTab taskId="task-123" />)

    expect(screen.getByText('No activity yet')).toBeInTheDocument()
  })

  it('displays activities in reverse chronological order', () => {
    // Activities should already come from server in DESC order
    const mockActivities = [
      { id: '2', event_type: 'agent_complete', created_at: 1705678340000, payload: null },
      { id: '1', event_type: 'agent_start', created_at: 1705678338000, payload: null }
    ]

    // ... test that order is preserved
  })
})
```

### Non-Functional Requirements

| NFR | Target | Notes |
|-----|--------|-------|
| Activity list render | <100ms | List should render quickly |
| Activity event latency | <1s | Events from server appear within 1 second (NFR1) |
| Tab switch time | <200ms | Time from click to content visible |

[Source: _bmad-output/planning-artifacts/prd-task-execution-sandbox.md#non-functional-requirements]

### Scope Notes

**In Scope (This Story):**
- Display activity events in reverse chronological order
- Show timestamp (HH:MM:SS), event type icon, and description
- Show relevant payload details based on event type
- Empty state when no activities
- Loading state while fetching
- Error state with retry option

**Out of Scope (Future Stories):**
- Activity log filtering (TES-2.12)
- Real-time activity streaming (TES-2.13)
- Activity log retention settings
- Export activity log

### Simplicity Assessment

This is a **moderate complexity UI story** with:
- Two new React components (ActivityItem, ActivitiesTab)
- tRPC integration for data fetching
- Multiple event types with different rendering
- Standard loading/error/empty states
- Co-located unit tests

**Estimated Implementation:**
1. Create ActivityItem component with icon mapping and payload formatting
2. Create ActivitiesTab component with tRPC query
3. Integrate with task detail panel
4. Write comprehensive tests

### Important Notes

**FRONTEND/UI STORY:** This is a frontend-focused story implementing UI display.

The dev agent MUST:
1. Follow existing component patterns from TaskTerminal.tsx
2. Use Tailwind classes inline (no separate CSS files)
3. Use existing shadcn/ui components where applicable
4. Co-locate tests with source files
5. Use the tRPC query pattern established in the project

### References

- [Architecture: ActivityLogService](/_bmad-output/planning-artifacts/architecture.md#activitylogservice)
- [PRD: FR17 Activity Log Display](/_bmad-output/planning-artifacts/prd-task-execution-sandbox.md#activity-logging)
- [Epics: Story 2.11](/_bmad-output/planning-artifacts/epics-task-execution-sandbox.md#story-211-activity-log-ui-display)
- [UX Design: Activities Tab](/_bmad-output/planning-artifacts/ux-design-specification.md#activities-tab)
- [Project Context](/_bmad-output/planning-artifacts/project-context.md)
- [TES-2.10: Error Event Capture](/_bmad-output/implementation-artifacts/tes-2-10-error-event-capture.md)
- [TES-2.2: Activity Log Service Core](/_bmad-output/implementation-artifacts/tes-2-2-activity-log-service-core.md)

### Testing Notes

Run tests with:
```bash
npm test src/renderer/src/components/task/ActivityItem.test.tsx
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

N/A

### Completion Notes List

1. **ActivityItem component created** - Implemented with:
   - HH:MM:SS timestamp formatting using date-fns `format()` function
   - Icon mapping for all 10 activity event types using Lucide React icons
   - Color-coded icons (blue for status_change, green for success events, red for errors, amber for warnings, etc.)
   - Payload detail rendering with type-specific formatting (arrow format for status changes, phase display for agent_start, duration display for agent_complete, etc.)
   - Card-style layout with subtle zinc-800 borders, following project's dark theme

2. **ActivitiesTab component created** - Implemented with:
   - tRPC query integration using `trpc.activity.listActivities.useQuery({ taskId, limit: 100 })`
   - Auto-refresh every 5 seconds (temporary until TES-2.13 real-time streaming)
   - Loading state with skeleton loaders
   - Empty state showing "No activity yet" message
   - Error state with retry button using AlertCircle icon and Button component
   - Scrollable list showing activity count in header

3. **StoryDetailDialog integration** - Added Activities tab as second tab:
   - Three tabs now: Content (1), Activities (2), Terminal (3)
   - Keyboard shortcuts: Press 1, 2, or 3 to switch tabs
   - Dialog expands to 900px width for Activities and Terminal tabs
   - Activities tab only visible when task has an active session

4. **Unit tests** - 34 tests written across two test files:
   - ActivityItem.test.tsx: 25 tests covering timestamp formatting, all event types, and payload display
   - ActivitiesTab.test.tsx: 9 tests covering loading, empty, error states, and activity display

### File List

**Created:**
- `src/renderer/src/components/task/ActivityItem.tsx` - Single activity event component
- `src/renderer/src/components/task/ActivityItem.test.tsx` - Unit tests (25 tests)
- `src/renderer/src/components/task/ActivitiesTab.tsx` - Tab container with list and states
- `src/renderer/src/components/task/ActivitiesTab.test.tsx` - Unit tests (9 tests)

**Modified:**
- `src/renderer/src/components/dialogs/StoryDetailDialog.tsx` - Added Activities tab and keyboard shortcuts
- `_bmad-output/implementation-artifacts/sprint-status.yaml` - Updated story status

## Senior Developer Review (AI)

_Reviewer: Tinxu on Monday, January 19, 2026_

**Status:** Approved

**Summary:**
The implementation correctly addresses the requirements for displaying the activity log, including all event types, formatting, and handling of various states (loading, empty, error). The UI follows the design specifications and integrates seamlessly with the existing dialog.

**Findings:**
- **Medium (Fixed):** Improved test robustness for timezone-dependent timestamps.
- **Medium (Fixed):** Added tooltip to handle truncated payload text.
- **Low (Fixed):** Refactored magic number for refetch interval.
- **Low (Fixed):** Enhanced accessibility with ARIA attributes for tabs.

All identified issues have been fixed.

---

## Change Log

- 2026-01-19: Implemented TES-2.11 Activity Log UI Display
  - Created ActivityItem and ActivitiesTab components
  - Integrated with StoryDetailDialog as new Activities tab
  - Added keyboard navigation (1/2/3 for tab switching)
  - 77 tests passing for all related components
- 2026-01-19: Senior Developer Review - Fixed 4 issues (2 Medium, 2 Low) and Approved

# Story TES-2.13: Real-Time Activity Streaming

Status: done

---

## Story

As a user,
I want to see new activities appear in real-time,
So that I can monitor task progress live.

**Story ID:** TES-2.13
**Epic:** TES Epic 2 - Activity Log & Event Tracking

---

## Acceptance Criteria

1. **Given** the Activities section is open for a task, **When** a new activity event is logged, **Then** the event appears at the top of the list within 1 second, **And** the event animates in (slide + fade)

2. **Given** the user has scrolled up in the activity log, **When** new events arrive, **Then** events are added to the top but view doesn't auto-scroll, **And** a "New events" indicator appears, **And** clicking the indicator scrolls to the top

3. **Given** multiple events arrive rapidly, **When** they are streamed, **Then** all events appear in correct order without duplicates

4. **Given** the tRPC subscription is active, **When** a new activity is logged via ActivityLogService, **Then** subscribers for that taskId receive the event immediately

---

## Tasks / Subtasks

- [x] Task 1: Implement tRPC subscription for activity streaming (AC: #4)
  - [x] 1.1: Add `onActivityCreated` subscription procedure to `activity.router.ts`
  - [x] 1.2: Create an event emitter in `ActivityLogService` to broadcast new activities
  - [x] 1.3: Subscribe to the emitter in the tRPC subscription handler
  - [x] 1.4: Emit events only for the specific `taskId` being subscribed
  - [x] 1.5: Write unit tests for the subscription procedure

- [x] Task 2: Create useActivitySubscription hook (AC: #4)
  - [x] 2.1: Create `src/renderer/src/hooks/useActivitySubscription.ts`
  - [x] 2.2: Use `trpc.activity.onActivityCreated.useSubscription({ taskId })`
  - [x] 2.3: Merge streamed activities with initial query results
  - [x] 2.4: Handle subscription reconnection gracefully
  - [x] 2.5: Write unit tests for the hook

- [x] Task 3: Implement real-time activity list updates (AC: #1, #3)
  - [x] 3.1: Integrate `useActivitySubscription` in `ActivitiesTab.tsx`
  - [x] 3.2: Prepend new activities to the list without duplicates (check `id`)
  - [x] 3.3: Maintain sort order by `created_at` DESC (newest first)
  - [x] 3.4: Remove the 5-second polling refetch interval (replaced by subscription)
  - [x] 3.5: Add animation for new events (slide down + fade in)
  - [x] 3.6: Write unit tests for list update logic

- [x] Task 4: Implement scroll-aware new events indicator (AC: #2)
  - [x] 4.1: Track scroll position in ActivitiesTab
  - [x] 4.2: Detect when user has scrolled away from the top
  - [x] 4.3: Show "New events" indicator badge when new events arrive while scrolled
  - [x] 4.4: Implement smooth scroll-to-top on indicator click
  - [x] 4.5: Clear indicator count when scrolled back to top
  - [x] 4.6: Write unit tests for scroll-aware behavior

- [x] Task 5: Write integration tests
  - [x] 5.1: Test new activity appears in <1 second via subscription
  - [x] 5.2: Test animation triggers on new activity
  - [x] 5.3: Test no duplicates when same event streamed
  - [x] 5.4: Test "New events" indicator shows when scrolled
  - [x] 5.5: Test click indicator scrolls to top
  - [x] 5.6: Test rapid events arrive in correct order

---

## Dev Notes

### Architecture Compliance

This story implements **FR19** from the Task Execution Sandbox PRD:
> FR19: User can see activity events in real-time as they occur

And completes Epic 2's real-time capability defined in the architecture:

```typescript
// From architecture.md - ActivityLogService interface
// Stream (for real-time UI)
subscribeToTask(taskId: string): Observable<Activity>
```

[Source: _bmad-output/planning-artifacts/prd-task-execution-sandbox.md#activity-logging]
[Source: _bmad-output/planning-artifacts/architecture.md#activitylogservice]

### Previous Story Learnings (CRITICAL)

**From TES-2.12 (Activity Log Filtering) - COMPLETED TODAY:**
- `ActivitiesFilter` component with filter chips at `src/renderer/src/components/task/ActivitiesFilter.tsx`
- Filter state managed in ActivitiesTab: `useState<FilterCategory[]>(['all'])`
- Event type mapping: `CATEGORY_EVENT_TYPES` constant for filter-to-eventTypes conversion
- tRPC query: `trpc.activity.listActivities.useQuery({ taskId, eventTypes, limit: 100 })`
- Shows "No matching events" vs "No activity yet" based on filter state
- All 26 tests pass (10 ActivitiesFilter + 16 ActivitiesTab)
- Color classes defined in `COLOR_CLASSES` record for JIT compatibility

**From TES-2.11 (Activity Log UI Display):**
- `ActivitiesTab` component at `src/renderer/src/components/task/ActivitiesTab.tsx`
- `ActivityItem` component at `src/renderer/src/components/task/ActivityItem.tsx`
- 10 event types: `status_change`, `agent_start`, `agent_complete`, `tool_used`, `user_command`, `automation_trigger`, `error`, `session_ended`, `stall_detected`, `stall_recovered`
- Activity count shown in header
- **Auto-refresh every 5 seconds** (ACTIVITY_REFRESH_INTERVAL) - THIS SHOULD BE REMOVED and replaced with subscription
- Activities tab integrated in StoryFullView as second tab
- Keyboard shortcuts 1/2/3 for tab switching

**From TES-2.2 (Activity Log Service Core):**
- `ActivityLogService` at `src/main/services/activity-log.service.ts`
- `logActivity(taskId, eventType, payload)` function inserts records
- tRPC router at `src/main/trpc/routers/activity.router.ts`
- Query supports `eventTypes` filter parameter for server-side filtering

**Git Intelligence - Recent Commits:**
```
8aa3cc7 feat: Introduce tabbed interface to StoryFullView
4877885 feat(activity-log): implement activity log filtering (TES-2.12)
6eda557 feat(TES-2.11): Implement Activity Log UI Display with review fixes
9a6d655 tes-2-10 done
7fd8856 feat: implement automation trigger event capture (TES-2.9)
```

[Source: src/renderer/src/components/task/ActivitiesTab.tsx]
[Source: src/main/services/activity-log.service.ts]
[Source: src/main/trpc/routers/activity.router.ts]

### Technical Implementation Guidance

**1. tRPC Subscription Architecture**

tRPC v11 supports subscriptions via `observable`. The pattern:

```typescript
// activity.router.ts - Add subscription procedure
import { observable } from '@trpc/server/observable'
import { EventEmitter } from 'events'

// Create event emitter in activity service or as module-level singleton
const activityEmitter = new EventEmitter()

// Export for activity-log.service.ts to emit to
export function emitActivity(activity: Activity) {
  activityEmitter.emit(`activity:${activity.taskId}`, activity)
}

// In router:
onActivityCreated: t.procedure
  .input(z.object({ taskId: z.string() }))
  .subscription(({ input }) => {
    return observable<Activity>((emit) => {
      const handler = (activity: Activity) => {
        emit.next(activity)
      }

      activityEmitter.on(`activity:${input.taskId}`, handler)

      // Cleanup on unsubscribe
      return () => {
        activityEmitter.off(`activity:${input.taskId}`, handler)
      }
    })
  })
```

**2. ActivityLogService Event Emission**

Update `logActivity` to emit events:

```typescript
// activity-log.service.ts
import { emitActivity } from '../trpc/routers/activity.router'

export async function logActivity(
  taskId: string,
  eventType: EventType,
  payload?: object
): Promise<Activity> {
  const activity = {
    id: crypto.randomUUID(),
    taskId,
    eventType,
    payload: payload ? JSON.stringify(payload) : null,
    createdAt: Date.now()
  }

  // Insert into database
  const [inserted] = await db.insert(taskActivities).values(activity).returning()

  // Emit for real-time subscribers
  emitActivity(inserted)

  return inserted
}
```

**3. Client-Side Subscription Hook**

```typescript
// src/renderer/src/hooks/useActivitySubscription.ts
import { useEffect, useRef } from 'react'
import { trpc } from '@renderer/lib/trpc'
import type { Activity } from '@shared/types/activity.types'

interface UseActivitySubscriptionOptions {
  taskId: string
  onActivity: (activity: Activity) => void
  enabled?: boolean
}

export function useActivitySubscription({
  taskId,
  onActivity,
  enabled = true
}: UseActivitySubscriptionOptions) {
  const callbackRef = useRef(onActivity)
  callbackRef.current = onActivity

  trpc.activity.onActivityCreated.useSubscription(
    { taskId },
    {
      enabled,
      onData: (activity) => {
        callbackRef.current(activity)
      },
      onError: (err) => {
        console.error('Activity subscription error:', err)
      }
    }
  )
}
```

**4. ActivitiesTab Integration**

```typescript
// ActivitiesTab.tsx - Updated with subscription
import { useCallback, useRef, useState } from 'react'
import { useActivitySubscription } from '@renderer/hooks/useActivitySubscription'

export function ActivitiesTab({ taskId }: ActivitiesTabProps) {
  const [activities, setActivities] = useState<Activity[]>([])
  const [newEventCount, setNewEventCount] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const isScrolledToTop = useRef(true)

  // Initial data load
  const { data: initialActivities } = trpc.activity.listActivities.useQuery(
    { taskId, eventTypes, limit: 100 },
    {
      // NO refetchInterval - subscription handles updates
    }
  )

  // Initialize activities from query
  useEffect(() => {
    if (initialActivities) {
      setActivities(initialActivities)
    }
  }, [initialActivities])

  // Handle new activities from subscription
  const handleNewActivity = useCallback((activity: Activity) => {
    setActivities(prev => {
      // Prevent duplicates
      if (prev.some(a => a.id === activity.id)) {
        return prev
      }
      // Prepend new activity (newest first)
      return [activity, ...prev]
    })

    // Show indicator if scrolled away from top
    if (!isScrolledToTop.current) {
      setNewEventCount(prev => prev + 1)
    }
  }, [])

  useActivitySubscription({
    taskId,
    onActivity: handleNewActivity,
    enabled: true
  })

  // Scroll tracking
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop } = e.currentTarget
    isScrolledToTop.current = scrollTop < 50

    // Clear indicator when scrolled to top
    if (isScrolledToTop.current) {
      setNewEventCount(0)
    }
  }, [])

  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    setNewEventCount(0)
  }, [])

  return (
    <div className="flex flex-col h-full relative">
      <ActivitiesFilter ... />

      {/* New events indicator */}
      {newEventCount > 0 && (
        <button
          onClick={scrollToTop}
          className="absolute top-12 left-1/2 -translate-x-1/2 z-20
                     bg-blue-500 text-white px-3 py-1 rounded-full text-xs
                     shadow-lg animate-bounce"
        >
          {newEventCount} new event{newEventCount > 1 ? 's' : ''}
        </button>
      )}

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto"
        onScroll={handleScroll}
      >
        {activities.map((activity, index) => (
          <ActivityItem
            key={activity.id}
            activity={activity}
            className={index === 0 && !isScrolledToTop.current ? 'animate-slide-in' : ''}
          />
        ))}
      </div>
    </div>
  )
}
```

**5. Animation CSS**

Add to `globals.css` or define inline with Tailwind:

```css
/* In globals.css */
@keyframes slide-in {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-slide-in {
  animation: slide-in 0.3s ease-out;
}
```

Or use Tailwind's built-in animate classes with custom keyframes in `tailwind.config.js` (CSS-first in v4).

### trpc-electron Subscription Support

**CRITICAL:** Verify `trpc-electron` supports subscriptions. The architecture specifies:
- IPC Pattern: tRPC 11.6.0 with `trpc-electron` adapter

Check the adapter documentation. If subscriptions aren't supported out-of-box, alternatives:
1. Use WebSocket transport for subscriptions
2. Implement via IPC events (ipcMain.on/ipcRenderer.on) wrapped in tRPC-like interface
3. Fall back to short polling (500ms) as degraded experience

**Recommended Investigation Steps:**
1. Check `node_modules/trpc-electron` for subscription support
2. If not supported, implement via Electron IPC events directly
3. Wrap in a tRPC-like API for consistency

### Event Emitter Architecture

Use Node.js `EventEmitter` in main process:

```typescript
// src/main/services/activity-emitter.ts
import { EventEmitter } from 'events'
import type { Activity } from '@shared/types/activity.types'

class ActivityEventEmitter extends EventEmitter {
  emit(event: `activity:${string}`, activity: Activity): boolean {
    return super.emit(event, activity)
  }

  on(event: `activity:${string}`, listener: (activity: Activity) => void): this {
    return super.on(event, listener)
  }

  off(event: `activity:${string}`, listener: (activity: Activity) => void): this {
    return super.off(event, listener)
  }
}

export const activityEmitter = new ActivityEventEmitter()
```

### Project Structure Notes

**Files to Create:**

| File | Purpose |
|------|---------|
| `src/renderer/src/hooks/useActivitySubscription.ts` | Client-side subscription hook |
| `src/renderer/src/hooks/useActivitySubscription.test.ts` | Hook tests |
| `src/main/services/activity-emitter.ts` | Event emitter for activity broadcasts |

**Files to Modify:**

| File | Action | Purpose |
|------|--------|---------|
| `src/main/services/activity-log.service.ts` | MODIFY | Emit events after logging |
| `src/main/trpc/routers/activity.router.ts` | MODIFY | Add `onActivityCreated` subscription |
| `src/renderer/src/components/task/ActivitiesTab.tsx` | MODIFY | Integrate subscription, remove polling |
| `src/renderer/src/components/task/ActivitiesTab.test.tsx` | MODIFY | Add subscription tests |
| `src/renderer/src/globals.css` | MODIFY | Add slide-in animation keyframes |

**Existing Files to Reference:**

- `src/main/trpc/routers/activity.router.ts` - Existing query procedures
- `src/renderer/src/components/task/ActivitiesTab.tsx` - Current implementation with polling
- `src/renderer/src/components/task/ActivitiesFilter.tsx` - Filter integration
- `src/main/services/activity-log.service.ts` - logActivity function

### Code Patterns (Following Project Standards)

**Naming Conventions:**
| Element | Convention | Example |
|---------|------------|---------|
| Hooks | use prefix | `useActivitySubscription` |
| Event emitter | camelCase | `activityEmitter` |
| tRPC subscription | on prefix | `onActivityCreated` |
| Constants | SCREAMING_SNAKE_CASE | `SCROLL_TOP_THRESHOLD` |

[Source: _bmad-output/planning-artifacts/project-context.md#naming-conventions]

**tRPC Subscription Pattern:**

```typescript
// DO: Use observable from @trpc/server/observable
onActivityCreated: t.procedure
  .input(z.object({ taskId: z.string() }))
  .subscription(({ input }) => {
    return observable<Activity>((emit) => {
      // Setup and return cleanup
    })
  })

// DON'T: Return Promise or direct value
onActivityCreated: t.procedure.subscription(async () => { /* wrong */ })
```

**State Update Pattern (Prevent Duplicates):**

```typescript
// DO: Check for duplicates before prepending
setActivities(prev => {
  if (prev.some(a => a.id === activity.id)) return prev
  return [activity, ...prev]
})

// DON'T: Blindly prepend
setActivities(prev => [activity, ...prev]) // May cause duplicates
```

### Testing Pattern

```typescript
// useActivitySubscription.test.ts
import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useActivitySubscription } from './useActivitySubscription'

// Mock tRPC
vi.mock('@renderer/lib/trpc', () => ({
  trpc: {
    activity: {
      onActivityCreated: {
        useSubscription: vi.fn()
      }
    }
  }
}))

describe('useActivitySubscription', () => {
  it('subscribes to activity events for taskId', () => {
    const onActivity = vi.fn()

    renderHook(() => useActivitySubscription({
      taskId: 'task-123',
      onActivity,
      enabled: true
    }))

    expect(trpc.activity.onActivityCreated.useSubscription).toHaveBeenCalledWith(
      { taskId: 'task-123' },
      expect.objectContaining({ enabled: true })
    )
  })

  it('calls onActivity when subscription receives data', () => {
    const onActivity = vi.fn()
    const mockActivity = { id: '1', taskId: 'task-123', eventType: 'status_change' }

    // Mock subscription to immediately emit
    vi.mocked(trpc.activity.onActivityCreated.useSubscription).mockImplementation(
      (_, { onData }) => {
        onData?.(mockActivity)
      }
    )

    renderHook(() => useActivitySubscription({
      taskId: 'task-123',
      onActivity,
      enabled: true
    }))

    expect(onActivity).toHaveBeenCalledWith(mockActivity)
  })
})
```

```typescript
// ActivitiesTab.test.tsx - Add these tests
describe('ActivitiesTab real-time streaming', () => {
  it('displays new activity from subscription immediately', async () => {
    // Mock subscription to emit activity
    // Verify activity appears in list
  })

  it('does not add duplicate activities', async () => {
    // Emit same activity twice
    // Verify only one instance in list
  })

  it('shows new events indicator when scrolled away', async () => {
    // Scroll down
    // Emit new activity
    // Verify indicator shows "1 new event"
  })

  it('scrolls to top when clicking new events indicator', async () => {
    // Setup scrolled state with indicator
    // Click indicator
    // Verify scrollTop = 0
  })

  it('clears indicator when scrolled to top', async () => {
    // Setup indicator
    // Scroll to top
    // Verify indicator cleared
  })

  it('animates new activity with slide-in', async () => {
    // Emit activity
    // Verify animate-slide-in class applied
  })
})
```

### Non-Functional Requirements

| NFR | Target | Notes |
|-----|--------|-------|
| Activity event latency | <1s | NFR1: Events appear in UI within 1 second |
| No event loss | 100% | NFR11: No activity events lost during normal operation |
| Subscription reconnection | Auto | Handle disconnects gracefully |

[Source: _bmad-output/planning-artifacts/epics-task-execution-sandbox.md:88-103]

### Scope Notes

**In Scope (This Story):**
- tRPC subscription for real-time activity streaming
- Client-side hook for subscription management
- Prepend new activities to list without duplicates
- Slide + fade animation on new events
- "New events" indicator when scrolled away
- Click indicator to scroll to top
- Remove polling (5-second refetch)

**Out of Scope (Future Stories):**
- Activity search by text
- Date range filtering
- Export activities
- Activity notifications outside the tab
- Pagination/infinite scroll (current limit: 100)

### Simplicity Assessment

This is a **moderate complexity story** involving:
- Backend: Event emitter pattern, tRPC subscription
- Frontend: Subscription hook, state management, scroll tracking, animations

**Key Complexity Points:**
1. tRPC subscription support in Electron context - verify adapter capability
2. Event deduplication when initial query and subscription overlap
3. Scroll position tracking and "new events" indicator UX

**Risk Mitigation:**
- If tRPC subscriptions don't work in Electron, fall back to 500ms polling
- Use activity `id` for deduplication
- Test scroll behavior thoroughly

### Important Notes

**Backend + Frontend Story:** This story requires both main process changes (subscription, emitter) and renderer changes (hook, UI).

The dev agent MUST:
1. Verify tRPC subscription support in `trpc-electron` adapter FIRST
2. Implement event emitter in main process
3. Update `logActivity` to emit events
4. Add subscription procedure to activity router
5. Create client-side hook for subscription
6. Update ActivitiesTab to use subscription instead of polling
7. Implement scroll-aware "new events" indicator
8. Add slide-in animation for new events
9. Write comprehensive tests for all layers

### References

- [Architecture: ActivityLogService](/_bmad-output/planning-artifacts/architecture.md#activitylogservice)
- [Architecture: tRPC Subscriptions](/_bmad-output/planning-artifacts/architecture.md#new-trpc-router)
- [PRD: FR19 Real-Time Activity](/_bmad-output/planning-artifacts/prd-task-execution-sandbox.md#activity-logging)
- [Epics: Story 2.13](/_bmad-output/planning-artifacts/epics-task-execution-sandbox.md#story-213-real-time-activity-streaming)
- [Project Context](/_bmad-output/planning-artifacts/project-context.md)
- [TES-2.12: Activity Log Filtering](/_bmad-output/implementation-artifacts/tes-2-12-activity-log-filtering.md)
- [TES-2.11: Activity Log UI Display](/_bmad-output/implementation-artifacts/tes-2-11-activity-log-ui-display.md)

### Testing Notes

Run tests with:
```bash
npm test src/renderer/src/hooks/useActivitySubscription.test.ts
npm test src/renderer/src/components/task/ActivitiesTab.test.tsx
npm test src/main/trpc/routers/activity.router.test.ts
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

None - implementation completed without blocking issues.

### Completion Notes List

1. **Architecture Decision: Electron IPC vs tRPC Subscriptions**
   - `trpc-electron` adapter doesn't natively support tRPC subscriptions (uses IPC invoke, not persistent connections)
   - Implemented real-time streaming using Electron IPC events, following the existing pattern from Story 3.9 (file-change events)
   - Created `ActivityEventEmitter` class that broadcasts to both internal EventEmitter listeners and renderer via IPC

2. **Event Emitter Pattern**
   - Created `src/main/services/activity-emitter.ts` with `activityEmitter` singleton
   - Modified `ActivityLogService.logActivity()` to emit events after database insert
   - Events are broadcast to all BrowserWindows via `webContents.send()`

3. **Client-Side Subscription Hook**
   - Created `useActivitySubscription` hook that wraps Electron IPC events
   - Hook filters events by taskId (only processes events for subscribed task)
   - Uses ref pattern to avoid stale closure issues with callback

4. **ActivitiesTab Updates**
   - Integrated subscription hook for real-time updates
   - Removed 5-second polling (ACTIVITY_POLL_INTERVAL_MS)
   - Added local state management for activities to support subscription merging
   - Implemented duplicate prevention (checks activity.id before adding)
   - Added filter awareness for streamed events

5. **Scroll-Aware New Events Indicator**
   - Tracks scroll position with ref (isScrolledToTop)
   - Shows badge with count when new events arrive while scrolled down
   - Click badge scrolls to top smoothly and clears count
   - Badge auto-hides when user scrolls to top

6. **Animation**
   - Added `animate-activity-slide-in` CSS animation in globals.css
   - Tracks new activity IDs in state for animation class application
   - Animation cleared after 400ms (300ms animation + buffer)

7. **Test Coverage**
   - 12 tests for useActivitySubscription hook (subscription lifecycle, event filtering, callback handling, edge cases)
   - 9 new tests for ActivitiesTab real-time streaming (subscription, duplicates, animation, filter awareness, rapid events)
   - All 72 activity-related tests pass

### File List

**New Files:**
- `src/main/services/activity-emitter.ts` - ActivityEventEmitter for real-time broadcasts
- `src/renderer/src/hooks/useActivitySubscription.ts` - Client-side subscription hook
- `src/renderer/src/hooks/useActivitySubscription.test.ts` - Hook tests (12 tests)

**Modified Files:**
- `src/main/services/activity-log.service.ts` - Added emit after logActivity
- `src/main/services/index.ts` - Exported activityEmitter and related types
- `src/preload/index.ts` - Added onActivityCreated IPC handler
- `src/preload/index.d.ts` - Added ActivityEventPayload type and API method
- `src/renderer/src/components/task/ActivitiesTab.tsx` - Integrated subscription, removed polling
- `src/renderer/src/components/task/ActivitiesTab.test.tsx` - Added streaming tests (9 new tests)
- `src/renderer/src/components/task/ActivityItem.tsx` - Added className prop for animation
- `src/renderer/src/globals.css` - Added slide-in animation and badge styles

---

## Senior Developer Review (AI)

**Date:** 2026-01-19
**Reviewer:** Senior Developer Agent

### Findings
- **Medium Severity:** Unbounded state growth in `ActivitiesTab` could lead to memory issues with long-running sessions.
- **Low Severity:** Code duplication of `ActivityEventPayload` across multiple files.
- **Low Severity:** Debug `console.log` left in production code.

### Fixes Applied
- **State Management:** Limited `activities` array in `ActivitiesTab` to 1000 items (rolling window).
- **Code Organization:** Created `src/shared/types/activity.types.ts` and refactored all consumers to use shared `ActivityEventPayload`.
- **Cleanup:** Removed debug logging from `ActivityLogService`.

---

## Change Log

| Date | Change Description |
|------|-------------------|
| 2026-01-19 | Implemented real-time activity streaming via Electron IPC. Created activity emitter, subscription hook, integrated into ActivitiesTab with scroll-aware new events indicator and slide-in animation. Removed 5-second polling. 72 tests pass. |
| 2026-01-19 | **Code Review Fixes:** Added state limit (1000 items) to ActivitiesTab, centralized ActivityEventPayload type in shared/types, and removed debug logs. |

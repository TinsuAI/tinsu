import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { AlertCircle, RefreshCw, ChevronUp } from 'lucide-react'
import { trpc } from '@renderer/lib/trpc'
import { Button } from '@renderer/components/ui/button'
import { ActivityItem } from './ActivityItem'
import type { Activity } from '@shared/types/activity.types'
import { ActivitiesFilter, type FilterCategory } from './ActivitiesFilter'
import { useActivitySubscription } from '@renderer/hooks/useActivitySubscription'
import { cn } from '@renderer/lib/utils'
import type { ActivityEventType } from '@shared/types/activity.types'

interface ActivitiesTabProps {
  /** Task ID to fetch activities for */
  taskId: string
}

/**
 * Event type to category mapping.
 * Maps filter categories to their corresponding activity event types.
 *
 * @see TES-2.12: Activity Log Filtering (AC: #2)
 */
const CATEGORY_EVENT_TYPES: Record<Exclude<FilterCategory, 'all'>, ActivityEventType[]> = {
  status: ['status_change'],
  agent: ['agent_start', 'agent_complete', 'tool_used', 'automation_trigger', 'stall_recovered'],
  user: ['user_command'],
  error: ['error', 'session_ended', 'stall_detected']
}

/**
 * Convert selected filter categories to event types array for tRPC query.
 * Returns undefined when 'all' is selected (no filtering).
 *
 * @see TES-2.12: Activity Log Filtering (AC: #3 - OR logic)
 */
function getEventTypesForFilters(filters: FilterCategory[]): ActivityEventType[] | undefined {
  if (filters.includes('all') || filters.length === 0) {
    return undefined // No filter = all events
  }

  // Combine event types from all selected categories (OR logic)
  const eventTypes = new Set<ActivityEventType>()
  for (const filter of filters) {
    if (filter !== 'all') {
      CATEGORY_EVENT_TYPES[filter].forEach((type) => eventTypes.add(type))
    }
  }
  return Array.from(eventTypes)
}

/**
 * Check if an activity matches the current filter.
 *
 * @see TES-2.13: AC #3 - Filter streamed events
 */
function activityMatchesFilter(
  activity: Activity,
  eventTypes: ActivityEventType[] | undefined
): boolean {
  if (!eventTypes) {
    return true // No filter = all events match
  }
  return eventTypes.includes(activity.event_type)
}

/**
 * Skeleton loader for the activity list.
 * Shows placeholder items while loading.
 */
function ActivityListSkeleton(): React.ReactNode {
  return (
    <div className="flex flex-col gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-start gap-3 p-3 animate-pulse">
          {/* Icon skeleton */}
          <div className="w-4 h-4 bg-muted rounded-full flex-shrink-0 mt-0.5" />

          {/* Content skeleton */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-14 h-3 bg-muted rounded" />
              <div className="w-24 h-3 bg-muted rounded" />
            </div>
            <div className="w-48 h-3 bg-muted rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Scroll threshold in pixels to consider "scrolled away" from top */
const SCROLL_TOP_THRESHOLD = 50

/**
 * ActivitiesTab component - displays the activity log for a task.
 *
 * Shows a scrollable list of activity events in reverse chronological order
 * (newest first). Handles loading, error, and empty states.
 * Supports filtering by event category with OR logic.
 *
 * Uses tRPC for initial data fetch and Electron IPC subscription for
 * real-time updates (TES-2.13).
 *
 * @see TES-2.11: Activity Log UI Display (AC: #1, #3)
 * @see TES-2.12: Activity Log Filtering
 * @see TES-2.13: Real-Time Activity Streaming
 */
export function ActivitiesTab({ taskId }: ActivitiesTabProps): React.ReactNode {
  // Filter state - defaults to showing all events
  // @see TES-2.12: AC #4 - All filter shows all events
  const [selectedFilters, setSelectedFilters] = useState<FilterCategory[]>(['all'])

  // Local activities state for real-time updates
  // @see TES-2.13: AC #1, #3 - Real-time updates without duplicates
  const [activities, setActivities] = useState<Activity[]>([])

  // Track IDs of new activities (for animation)
  // @see TES-2.13: AC #1 - Slide-in animation
  const [newActivityIds, setNewActivityIds] = useState<Set<string>>(new Set())

  // Scroll tracking for "new events" indicator
  // @see TES-2.13: AC #2 - Scroll-aware indicator
  const scrollRef = useRef<HTMLDivElement>(null)
  const isScrolledToTop = useRef(true)
  const [newEventCount, setNewEventCount] = useState(0)

  // Convert filter categories to event types for tRPC query
  // @see TES-2.12: AC #2, #3 - Category mapping and OR logic
  const eventTypes = useMemo(
    () => getEventTypesForFilters(selectedFilters),
    [selectedFilters]
  )

  // Determine if we're filtering (not showing all)
  const isFiltering = !selectedFilters.includes('all') && selectedFilters.length > 0

  // Initial data fetch (no polling - replaced by subscription)
  // @see TES-2.13: AC #4 - Subscription replaces polling
  const {
    data: initialActivities,
    isLoading,
    error,
    refetch
  } = trpc.activity.listActivities.useQuery(
    { taskId, limit: 100, eventTypes },
    {
      // TES-2.13: No refetchInterval - subscription handles real-time updates
    }
  )

  // Initialize activities from query (and when filter changes)
  useEffect(() => {
    if (initialActivities) {
      setActivities(initialActivities as Activity[])
      // Clear animation state on initial load / filter change
      setNewActivityIds(new Set())
      setNewEventCount(0)
    }
  }, [initialActivities])

  // Handle new activities from subscription
  // @see TES-2.13: AC #1, #3 - Real-time updates, no duplicates, correct order
  const handleNewActivity = useCallback(
    (activity: Activity) => {
      // Check if activity matches current filter before adding
      if (!activityMatchesFilter(activity, eventTypes)) {
        return
      }

      setActivities((prev) => {
        // Prevent duplicates by checking ID
        if (prev.some((a) => a.id === activity.id)) {
          return prev
        }
        // Prepend new activity (newest first)
        const newActivities = [activity, ...prev]
        // Limit to 1000 items to prevent unbounded state growth (TES-2.13 review fix)
        return newActivities.slice(0, 1000)
      })

      // Track for animation
      setNewActivityIds((prev) => new Set([...prev, activity.id]))

      // Clear animation after it completes (300ms + buffer)
      setTimeout(() => {
        setNewActivityIds((prev) => {
          const next = new Set(prev)
          next.delete(activity.id)
          return next
        })
      }, 400)

      // Show indicator if scrolled away from top
      // @see TES-2.13: AC #2
      if (!isScrolledToTop.current) {
        setNewEventCount((prev) => prev + 1)
      }
    },
    [eventTypes]
  )

  // Subscribe to activity events via Electron IPC
  // @see TES-2.13: AC #4 - Real-time subscription
  useActivitySubscription({
    taskId,
    onActivity: handleNewActivity,
    enabled: true
  })

  // Scroll event handler
  // @see TES-2.13: AC #2 - Track scroll position
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop } = e.currentTarget
    isScrolledToTop.current = scrollTop < SCROLL_TOP_THRESHOLD

    // Clear indicator when scrolled to top
    if (isScrolledToTop.current) {
      setNewEventCount(0)
    }
  }, [])

  // Scroll to top when clicking the indicator
  // @see TES-2.13: AC #2 - Click indicator to scroll
  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    setNewEventCount(0)
  }, [])

  // Render logic
  return (
    <div className="flex flex-col h-full relative">
      {/* Header with event count */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted/30">
        <span className="text-xs text-muted-foreground">Activities</span>
        {activities.length > 0 && (
          <span className="text-xs text-muted-foreground/70">{activities.length} events</span>
        )}
      </div>

      {/* Filter chips */}
      <ActivitiesFilter selectedFilters={selectedFilters} onFilterChange={setSelectedFilters} />

      {/* New events indicator badge - TES-2.13: AC #2 */}
      {newEventCount > 0 && (
        <button
          onClick={scrollToTop}
          className={cn(
            'absolute z-20 left-1/2 -translate-x-1/2',
            'px-3 py-1.5 rounded-full',
            'text-xs font-medium text-white',
            'flex items-center gap-1.5',
            'activity-new-events-badge',
            'cursor-pointer'
          )}
          style={{ top: '5.5rem' }} // Below header + filter
        >
          <ChevronUp className="w-3 h-3" />
          {newEventCount} new event{newEventCount > 1 ? 's' : ''}
        </button>
      )}

      {/* Content Area */}
      <div
        ref={scrollRef}
        className="kanban-scroll flex-1 overflow-y-auto"
        onScroll={handleScroll}
      >
        {isLoading ? (
          <ActivityListSkeleton />
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
            <AlertCircle className="w-8 h-8 text-destructive" />
            <p className="text-sm">Failed to load activities</p>
            <Button variant="ghost" size="sm" onClick={() => refetch()} className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Retry
            </Button>
          </div>
        ) : activities.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <span className="text-sm">
              {isFiltering ? 'No matching events' : 'No activity yet'}
            </span>
          </div>
        ) : (
          activities.map((activity) => (
            <ActivityItem
              key={activity.id}
              activity={activity}
              className={newActivityIds.has(activity.id) ? 'animate-activity-slide-in' : ''}
            />
          ))
        )}
      </div>
    </div>
  )
}

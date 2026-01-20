import { useState, useMemo } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { trpc } from '@renderer/lib/trpc'
import { Button } from '@renderer/components/ui/button'
import { ActivityItem, type Activity } from './ActivityItem'
import { ActivitiesFilter, type FilterCategory } from './ActivitiesFilter'
import type { ActivityEventType } from '../../../../main/db/schema'

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
 * Skeleton loader for the activity list.
 * Shows placeholder items while loading.
 */
function ActivityListSkeleton(): React.ReactNode {
  return (
    <div className="flex flex-col gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-start gap-3 p-3 animate-pulse">
          {/* Icon skeleton */}
          <div className="w-4 h-4 bg-zinc-700 rounded-full flex-shrink-0 mt-0.5" />

          {/* Content skeleton */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-14 h-3 bg-zinc-700 rounded" />
              <div className="w-24 h-3 bg-zinc-700 rounded" />
            </div>
            <div className="w-48 h-3 bg-zinc-700 rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}

// Refetch interval for activity polling (5 seconds)
// TODO: Remove this when real-time streaming (TES-2.13) is implemented
const ACTIVITY_POLL_INTERVAL_MS = 5000

/**
 * ActivitiesTab component - displays the activity log for a task.
 *
 * Shows a scrollable list of activity events in reverse chronological order
 * (newest first). Handles loading, error, and empty states.
 * Supports filtering by event category with OR logic.
 *
 * Uses tRPC to fetch activities from the activity router.
 *
 * @see TES-2.11: Activity Log UI Display (AC: #1, #3)
 * @see TES-2.12: Activity Log Filtering
 */
export function ActivitiesTab({ taskId }: ActivitiesTabProps): React.ReactNode {
  // Filter state - defaults to showing all events
  // @see TES-2.12: AC #4 - All filter shows all events
  const [selectedFilters, setSelectedFilters] = useState<FilterCategory[]>(['all'])

  // Convert filter categories to event types for tRPC query
  // @see TES-2.12: AC #2, #3 - Category mapping and OR logic
  const eventTypes = useMemo(
    () => getEventTypesForFilters(selectedFilters),
    [selectedFilters]
  )

  // Determine if we're filtering (not showing all)
  const isFiltering = !selectedFilters.includes('all') && selectedFilters.length > 0

  const {
    data: activities,
    isLoading,
    error,
    refetch
  } = trpc.activity.listActivities.useQuery(
    { taskId, limit: 100, eventTypes },
    {
      // Refetch every 5 seconds to keep activity list fresh
      // This is temporary until TES-2.13 (real-time streaming) is implemented
      refetchInterval: ACTIVITY_POLL_INTERVAL_MS
    }
  )

  // Render logic
  return (
    <div className="flex flex-col h-full">
      {/* Header with event count */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-800 bg-zinc-900/50">
        <span className="text-xs text-zinc-500">Activities</span>
        {activities && <span className="text-xs text-zinc-600">{activities.length} events</span>}
      </div>

      {/* Filter chips */}
      <ActivitiesFilter selectedFilters={selectedFilters} onFilterChange={setSelectedFilters} />

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <ActivityListSkeleton />
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-3">
            <AlertCircle className="w-8 h-8 text-red-500" />
            <p className="text-sm">Failed to load activities</p>
            <Button variant="ghost" size="sm" onClick={() => refetch()} className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Retry
            </Button>
          </div>
        ) : !activities?.length ? (
          <div className="flex items-center justify-center h-full text-zinc-500">
            <span className="text-sm">
              {isFiltering ? 'No matching events' : 'No activity yet'}
            </span>
          </div>
        ) : (
          activities.map((activity) => (
            <ActivityItem key={activity.id} activity={activity as Activity} />
          ))
        )}
      </div>
    </div>
  )
}

import { AlertCircle, RefreshCw } from 'lucide-react'
import { trpc } from '@renderer/lib/trpc'
import { Button } from '@renderer/components/ui/button'
import { ActivityItem, type Activity } from './ActivityItem'

interface ActivitiesTabProps {
  /** Task ID to fetch activities for */
  taskId: string
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
 *
 * Uses tRPC to fetch activities from the activity router.
 *
 * @see TES-2.11: Activity Log UI Display (AC: #1, #3)
 */
export function ActivitiesTab({ taskId }: ActivitiesTabProps): React.ReactNode {
  const {
    data: activities,
    isLoading,
    error,
    refetch
  } = trpc.activity.listActivities.useQuery(
    { taskId, limit: 100 },
    {
      // Refetch every 5 seconds to keep activity list fresh
      // This is temporary until TES-2.13 (real-time streaming) is implemented
      refetchInterval: ACTIVITY_POLL_INTERVAL_MS
    }
  )

  // Loading state (AC: #2.5)
  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-800 bg-zinc-900/50">
          <span className="text-xs text-zinc-500">Activities</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          <ActivityListSkeleton />
        </div>
      </div>
    )
  }

  // Error state with retry option (AC: #2.6)
  if (error) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-800 bg-zinc-900/50">
          <span className="text-xs text-zinc-500">Activities</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 gap-3">
          <AlertCircle className="w-8 h-8 text-red-500" />
          <p className="text-sm">Failed to load activities</p>
          <Button variant="ghost" size="sm" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Retry
          </Button>
        </div>
      </div>
    )
  }

  // Empty state (AC: #3)
  if (!activities?.length) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-800 bg-zinc-900/50">
          <span className="text-xs text-zinc-500">Activities</span>
        </div>
        <div className="flex-1 flex items-center justify-center text-zinc-500">
          <span className="text-sm">No activity yet</span>
        </div>
      </div>
    )
  }

  // Display activities in reverse chronological order (AC: #1)
  // Server already returns them sorted by created_at DESC (newest first)
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-800 bg-zinc-900/50">
        <span className="text-xs text-zinc-500">Activities</span>
        <span className="text-xs text-zinc-600">{activities.length} events</span>
      </div>

      {/* Activity list */}
      <div className="flex-1 overflow-y-auto">
        {activities.map((activity) => (
          <ActivityItem key={activity.id} activity={activity as Activity} />
        ))}
      </div>
    </div>
  )
}

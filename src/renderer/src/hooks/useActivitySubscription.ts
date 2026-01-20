/**
 * useActivitySubscription Hook - TES-2.13
 *
 * Subscribes to real-time activity events for a specific task.
 * Uses Electron IPC events (via preload API) for communication
 * since trpc-electron doesn't support native tRPC subscriptions.
 *
 * @see TES-2.13: Real-Time Activity Streaming (AC: #4)
 * @see Architecture: activity streaming via Electron IPC
 */

import { useEffect, useRef, useCallback } from 'react'
import type { Activity, ActivityEventPayload } from '@shared/types/activity.types'

/**
 * Options for the activity subscription hook.
 */
export interface UseActivitySubscriptionOptions {
  /** Task ID to subscribe to activity events for */
  taskId: string
  /** Callback invoked when a new activity is received */
  onActivity: (activity: Activity) => void
  /** Whether the subscription is active (default: true) */
  enabled?: boolean
}

/**
 * Hook to subscribe to real-time activity events for a task.
 *
 * Uses Electron IPC events to receive activities as they're created
 * by the ActivityLogService. The subscription is automatically
 * cleaned up on unmount or when enabled becomes false.
 *
 * @example
 * ```tsx
 * function ActivitiesTab({ taskId }: { taskId: string }) {
 *   const [activities, setActivities] = useState<Activity[]>([])
 *
 *   const handleNewActivity = useCallback((activity: Activity) => {
 *     setActivities(prev => [activity, ...prev])
 *   }, [])
 *
 *   useActivitySubscription({
 *     taskId,
 *     onActivity: handleNewActivity,
 *     enabled: true
 *   })
 *
 *   return <ActivityList activities={activities} />
 * }
 * ```
 */
export function useActivitySubscription({
  taskId,
  onActivity,
  enabled = true
}: UseActivitySubscriptionOptions): void {
  // Use ref to avoid stale closure issues with the callback
  const callbackRef = useRef(onActivity)
  callbackRef.current = onActivity

  // Store unsubscribe function for cleanup
  const unsubscribeRef = useRef<(() => void) | null>(null)

  // Memoized handler to filter events by taskId
  const handleActivityEvent = useCallback(
    (event: ActivityEventPayload) => {
      // Only process events for our taskId
      if (event.taskId !== taskId) {
        return
      }

      // Convert to Activity type expected by components
      const activity: Activity = {
        id: event.activity.id,
        task_id: event.activity.task_id,
        event_type: event.activity.event_type,
        payload: event.activity.payload,
        created_at: event.activity.created_at
      }

      callbackRef.current(activity)
    },
    [taskId]
  )

  useEffect(() => {
    if (!enabled) {
      // Clean up existing subscription if disabled
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
        unsubscribeRef.current = null
      }
      return
    }

    // Subscribe to activity events
    unsubscribeRef.current = window.api.onActivityCreated(handleActivityEvent)

    // Cleanup on unmount or when dependencies change
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
        unsubscribeRef.current = null
      }
    }
  }, [enabled, handleActivityEvent])
}

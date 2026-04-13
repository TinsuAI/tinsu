/**
 * useActivitySubscription Hook - T1.7
 *
 * Subscribes to real-time activity events for a specific task.
 * Uses Tauri Events (listen) for cross-thread event delivery.
 *
 * @see T1.7: Migrate Hook Listener HTTP Server to Rust (AC: #11)
 * @see Architecture: activity streaming via Tauri Events
 */

import { useEffect, useRef } from 'react'
import { listen } from '@tauri-apps/api/event'
import type { UnlistenFn } from '@tauri-apps/api/event'
import type { Activity } from '@shared/types/activity.types'

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
 * Uses Tauri Events to receive activities as they're created
 * by the ActivityLogService in Rust. The subscription is automatically
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

  useEffect(() => {
    if (!enabled) return

    let cancelled = false
    let unlisten: UnlistenFn | undefined

    listen<{ task_id: string; activity: Activity }>('activity:created', (event) => {
      if (event.payload.task_id !== taskId) return
      callbackRef.current(event.payload.activity)
    })
      .then((fn) => {
        if (cancelled) fn()
        else unlisten = fn
      })
      .catch(() => {
        // listen() rejected — Tauri event system unavailable
      })

    return () => {
      cancelled = true
      unlisten?.()
    }
  }, [enabled, taskId])
}

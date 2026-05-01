/**
 * useGlobalActivitySubscription — Cross-task activity event subscription.
 *
 * Story T3.5-8, Task 12 (AC: 3).
 *
 * Design decision: This hook is the CROSS-TASK counterpart to the existing
 * per-task `useActivitySubscription`. It intentionally does NOT filter by
 * task_id — the Rust emitter at `activity_log.rs` already broadcasts globally.
 * No backend change is needed.
 *
 * Mirror of `useActivitySubscription` API, minus the taskId filter.
 * Lives at `src/hooks/` (parallel to `useActivitySubscription.ts`) since it
 * is a shared utility, not mobile-specific.
 *
 * @see useActivitySubscription — per-task counterpart
 * @see src-tauri/src/services/activity_log.rs — global emit source
 */

import { useEffect, useRef } from 'react'
import { listen } from '@tauri-apps/api/event'
import type { UnlistenFn } from '@tauri-apps/api/event'
import type { Activity } from '@shared/types/activity.types'

export interface UseGlobalActivitySubscriptionOptions {
  /** Callback invoked when any activity event arrives (any task_id) */
  onActivity: (activity: Activity) => void
  /** Whether the subscription is active (default: true) */
  enabled?: boolean
}

/**
 * Hook to subscribe to real-time activity events for ALL tasks.
 *
 * Unlike `useActivitySubscription`, this hook does NOT filter by task_id.
 * It is designed for cross-task views like the activity feed.
 *
 * The subscription is automatically cleaned up on unmount or when
 * `enabled` becomes false.
 *
 * @example
 * ```tsx
 * function MobileActivityFeedScreen() {
 *   const [activities, setActivities] = useState<Activity[]>([])
 *
 *   useGlobalActivitySubscription({
 *     onActivity: (activity) => {
 *       setActivities(prev => [activity, ...prev])
 *     },
 *   })
 *
 *   return <ActivityList activities={activities} />
 * }
 * ```
 */
export function useGlobalActivitySubscription({
  onActivity,
  enabled = true,
}: UseGlobalActivitySubscriptionOptions): void {
  // Use ref to avoid stale closure issues with the callback
  const callbackRef = useRef(onActivity)
  callbackRef.current = onActivity

  useEffect(() => {
    if (!enabled) return

    let cancelled = false
    let unlisten: UnlistenFn | undefined

    // Listen to 'activity:created' WITHOUT filtering by task_id.
    // The event payload shape mirrors useActivitySubscription:
    //   { task_id: string; activity: Activity }
    listen<{ task_id: string; activity: Activity }>('activity:created', (event) => {
      // No task_id filter — call handler for any task
      callbackRef.current(event.payload.activity)
    })
      .then((fn) => {
        if (cancelled) fn()
        else unlisten = fn
      })
      .catch(() => {
        // listen() rejected — Tauri event system unavailable (web/desktop without plugin)
      })

    return () => {
      cancelled = true
      unlisten?.()
    }
  }, [enabled])
}

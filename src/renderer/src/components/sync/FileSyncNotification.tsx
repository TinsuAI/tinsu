import { toast } from 'sonner'
import { useCallback } from 'react'
import { useStorySync } from '@renderer/hooks/useStorySync'

interface FileSyncNotificationProps {
  taskId: string
  taskTitle: string
  filePath?: string
}

/**
 * Shows a toast notification when a story file has changed externally.
 *
 * This is a helper component that provides a declarative way to show
 * sync notifications. It uses sonner toast with action buttons for
 * "Sync Now" and dismissal.
 *
 * Story 3.9: Bidirectional Sync (AC: 2, 3)
 *
 * @example
 * ```tsx
 * // Imperative usage via hook
 * const { showSyncNotification } = useFileSyncNotification()
 * showSyncNotification({ taskId: 'task-1', taskTitle: 'My Story' })
 *
 * // Or use the exported helper directly
 * import { showFileSyncNotification } from './FileSyncNotification'
 * showFileSyncNotification({ taskId: 'task-1', taskTitle: 'My Story' })
 * ```
 */
export function showFileSyncNotification({
  taskId,
  taskTitle,
  filePath,
  onSync
}: FileSyncNotificationProps & { onSync?: () => void }) {
  toast('Story file changed', {
    description: filePath
      ? `"${taskTitle}" (${filePath}) was modified externally`
      : `"${taskTitle}" was modified externally`,
    action: {
      label: 'Sync Now',
      onClick: onSync || (() => {})
    },
    duration: 30000 // Auto-dismiss after 30 seconds per UX spec
  })
}

/**
 * Hook that provides a function to show file sync notifications.
 * Integrates with useStorySync to automatically handle sync actions.
 *
 * @example
 * ```tsx
 * function FileWatcherHandler() {
 *   const { showSyncNotification } = useFileSyncNotification()
 *
 *   useEffect(() => {
 *     // When file change detected
 *     showSyncNotification({ taskId, taskTitle })
 *   }, [])
 * }
 * ```
 */
export function useFileSyncNotification() {
  const { syncFromFile } = useStorySync()

  const showSyncNotification = useCallback(
    ({ taskId, taskTitle, filePath }: FileSyncNotificationProps) => {
      showFileSyncNotification({
        taskId,
        taskTitle,
        filePath,
        onSync: () => syncFromFile(taskId)
      })
    },
    [syncFromFile]
  )

  return { showSyncNotification }
}

/**
 * FileSyncNotification component.
 *
 * This is a no-op render component that exists to satisfy the component
 * pattern. The actual notification is shown via toast, so this component
 * doesn't render anything.
 *
 * For showing notifications, use the useFileSyncNotification hook or
 * the showFileSyncNotification helper function.
 */
export function FileSyncNotification(_props: FileSyncNotificationProps) {
  // This component doesn't render anything - it's a notification toast
  // Use useFileSyncNotification() hook or showFileSyncNotification() helper
  return null
}

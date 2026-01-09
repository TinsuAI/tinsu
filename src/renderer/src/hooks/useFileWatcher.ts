import { useEffect, useRef } from 'react'
import { trpc } from '@renderer/lib/trpc'
import { useStorySync } from './useStorySync'

/**
 * Hook that manages file watching for story files.
 *
 * When called with a project path:
 * - Starts watching the implementation-artifacts directory
 * - Listens for file change IPC events
 * - Shows sync notification toasts when files change
 *
 * Story 3.9: Bidirectional Sync (AC: 2)
 *
 * @param projectPath - The project root path to watch, or null if no project
 *
 * @example
 * ```tsx
 * function App() {
 *   const { projectPath } = useProjectStore()
 *
 *   // Automatically starts/stops watching based on project
 *   useFileWatcher(projectPath)
 *
 *   return <KanbanBoard />
 * }
 * ```
 */
export function useFileWatcher(projectPath: string | null): void {
  const { showSyncNotification } = useStorySync()
  const startWatchingMutation = trpc.sync.startWatching.useMutation()
  const stopWatchingMutation = trpc.sync.stopWatching.useMutation()
  const unsubscribeRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!projectPath) {
      // No project, stop watching and cleanup
      stopWatchingMutation.mutate()
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
        unsubscribeRef.current = null
      }
      return
    }

    // Start watching files
    startWatchingMutation.mutate({ projectPath })

    // Subscribe to file change events
    unsubscribeRef.current = window.api.onFileChange((event) => {
      showSyncNotification(event.taskId, event.taskTitle)
    })

    // Cleanup on unmount or project change
    return () => {
      stopWatchingMutation.mutate()
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
        unsubscribeRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectPath])
}

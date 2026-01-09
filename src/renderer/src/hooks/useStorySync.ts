import { useCallback, useState } from 'react'
import { trpc } from '@renderer/lib/trpc'
import { toast } from 'sonner'

/**
 * Conflict information between Kanban and file versions.
 */
export interface ConflictInfo {
  hasConflict: boolean
  hasStatusConflict?: boolean
  hasContentConflict?: boolean
  kanbanStatus?: string
  fileStatus?: string
  kanbanContent?: string
  fileContent?: string
}

/**
 * Sync result from file operations.
 */
export interface SyncResult {
  synced: boolean
  reason?: string
  task?: {
    id: string
    status: string
    full_content: string | null
    story_file_path: string | null
  }
}

/**
 * Hook for bidirectional sync between Kanban tasks and story files.
 *
 * Provides functions to:
 * - Sync status changes to files
 * - Sync content from files to database
 * - Check for file changes
 * - Detect and resolve conflicts
 *
 * Story 3.9: Bidirectional Sync Between Kanban and Detail Story Files
 *
 * @example
 * ```tsx
 * function TaskCard({ task }) {
 *   const { syncFromFile, checkChanges, isSyncing } = useStorySync()
 *
 *   const handleSync = async () => {
 *     const hasChanges = await checkChanges(task.id)
 *     if (hasChanges) {
 *       await syncFromFile(task.id)
 *     }
 *   }
 *
 *   return (
 *     <button onClick={handleSync} disabled={isSyncing}>
 *       Sync
 *     </button>
 *   )
 * }
 * ```
 */
export function useStorySync() {
  const utils = trpc.useUtils()
  const [syncingTaskIds, setSyncingTaskIds] = useState<Set<string>>(new Set())

  // Mutation: Sync status to file
  const syncStatusMutation = trpc.sync.syncStatusToFile.useMutation({
    onSuccess: () => {
      // File updated silently, no toast needed for status sync
    },
    onError: (error) => {
      toast.error('Failed to sync status to file', {
        description: error.message
      })
    }
  })

  // Mutation: Sync content from file
  const syncFromFileMutation = trpc.sync.syncFromFile.useMutation({
    onSuccess: (result) => {
      if (result.synced) {
        toast.success('Story synced from file', {
          description: 'Content and status updated from file'
        })
        // Invalidate task queries to refresh the board
        utils.tasks.getAll.invalidate()
        utils.tasks.getAllWithEpics.invalidate()
      }
    },
    onError: (error) => {
      toast.error('Failed to sync from file', {
        description: error.message
      })
    }
  })

  // Query: Check for file changes (manual check, not a watched query)
  const checkFileChangesMutation = trpc.sync.checkFileChanges.useMutation()

  // Query: Detect conflicts
  const detectConflictMutation = trpc.sync.detectConflict.useMutation()

  // Mutation: Resolve conflict
  const resolveConflictMutation = trpc.sync.resolveConflict.useMutation({
    onSuccess: (result) => {
      if (result.resolved) {
        toast.success('Conflict resolved', {
          description: 'Story versions are now synchronized'
        })
        // Invalidate task queries to refresh the board
        utils.tasks.getAll.invalidate()
        utils.tasks.getAllWithEpics.invalidate()
      }
    },
    onError: (error) => {
      toast.error('Failed to resolve conflict', {
        description: error.message
      })
    }
  })

  // Add a task to syncing set
  const startSyncing = useCallback((taskId: string) => {
    setSyncingTaskIds((prev) => new Set(prev).add(taskId))
  }, [])

  // Remove a task from syncing set
  const stopSyncing = useCallback((taskId: string) => {
    setSyncingTaskIds((prev) => {
      const next = new Set(prev)
      next.delete(taskId)
      return next
    })
  }, [])

  // Check if a specific task is syncing
  const isTaskSyncing = useCallback(
    (taskId: string) => {
      return syncingTaskIds.has(taskId)
    },
    [syncingTaskIds]
  )

  // Sync status to file
  const syncStatusToFile = useCallback(
    async (taskId: string, newStatus: string): Promise<SyncResult> => {
      startSyncing(taskId)
      try {
        const result = await syncStatusMutation.mutateAsync({ taskId, newStatus })
        return result
      } finally {
        stopSyncing(taskId)
      }
    },
    [syncStatusMutation, startSyncing, stopSyncing]
  )

  // Sync content from file to database
  const syncFromFile = useCallback(
    async (taskId: string): Promise<SyncResult> => {
      startSyncing(taskId)
      try {
        const result = await syncFromFileMutation.mutateAsync({ taskId })
        return result
      } finally {
        stopSyncing(taskId)
      }
    },
    [syncFromFileMutation, startSyncing, stopSyncing]
  )

  // Check if file has changes
  const checkChanges = useCallback(
    async (taskId: string): Promise<boolean> => {
      try {
        const result = await checkFileChangesMutation.mutateAsync({ taskId })
        return result.hasChanges
      } catch {
        return false
      }
    },
    [checkFileChangesMutation]
  )

  // Detect conflicts between Kanban and file
  const detectConflict = useCallback(
    async (taskId: string): Promise<ConflictInfo> => {
      try {
        const result = await detectConflictMutation.mutateAsync({ taskId })
        return result
      } catch {
        return { hasConflict: false }
      }
    },
    [detectConflictMutation]
  )

  // Resolve conflict
  const resolveConflict = useCallback(
    async (taskId: string, keepKanban: boolean): Promise<void> => {
      startSyncing(taskId)
      try {
        await resolveConflictMutation.mutateAsync({ taskId, keepKanban })
      } finally {
        stopSyncing(taskId)
      }
    },
    [resolveConflictMutation, startSyncing, stopSyncing]
  )

  // Show sync notification toast with action buttons
  const showSyncNotification = useCallback(
    (taskId: string, taskTitle: string) => {
      toast('Story file changed', {
        description: `"${taskTitle}" was modified externally`,
        action: {
          label: 'Sync Now',
          onClick: () => syncFromFile(taskId)
        },
        duration: 30000 // Auto-dismiss after 30 seconds
      })
    },
    [syncFromFile]
  )

  // Mutation: Sync all stories from files (and import new ones)
  const syncAllMutation = trpc.sync.syncAllFromFiles.useMutation({
    onSuccess: (result) => {
      const totalSuccess = result.syncedCount + (result.importedCount || 0)
      if (totalSuccess > 0) {
        const parts: string[] = []
        if (result.syncedCount > 0) parts.push(`${result.syncedCount} synced`)
        if (result.importedCount && result.importedCount > 0)
          parts.push(`${result.importedCount} imported`)
        if (result.failedCount > 0) parts.push(`${result.failedCount} failed`)

        toast.success(`Stories updated`, {
          description: parts.join(', ')
        })
        utils.tasks.getAll.invalidate()
        utils.tasks.getAllWithEpics.invalidate()
      } else if (result.failedCount > 0) {
        toast.error(`Failed to sync ${result.failedCount} stories`)
      } else {
        toast.info('No stories to sync')
      }
    },
    onError: (error) => {
      toast.error('Failed to sync stories', { description: error.message })
    }
  })

  // Sync all stories from their files (and import new ones)
  const syncAllFromFiles = useCallback(
    async (projectPath?: string) => {
      await syncAllMutation.mutateAsync({ projectPath })
    },
    [syncAllMutation]
  )

  return {
    /** Sync status to story file */
    syncStatusToFile,
    /** Sync content from file to database */
    syncFromFile,
    /** Check if file has changes compared to database */
    checkChanges,
    /** Detect conflicts between Kanban and file */
    detectConflict,
    /** Resolve a conflict (keepKanban=true updates file, false updates DB) */
    resolveConflict,
    /** Show a toast notification about file changes */
    showSyncNotification,
    /** Check if a specific task is currently syncing */
    isTaskSyncing,
    /** Whether any sync operation is in progress */
    isSyncing: syncingTaskIds.size > 0,
    /** Set of task IDs currently being synced */
    syncingTaskIds,
    /** Add a task to syncing state */
    startSyncing,
    /** Remove a task from syncing state */
    stopSyncing,
    /** Sync all stories from their files */
    syncAllFromFiles,
    /** Whether sync all is in progress */
    isSyncingAll: syncAllMutation.isPending
  }
}

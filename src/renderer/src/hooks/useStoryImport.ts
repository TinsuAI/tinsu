import { useCallback } from 'react'
import { trpc } from '@renderer/lib/trpc'
import { toast } from 'sonner'

/**
 * Result returned by the import mutation.
 */
export interface ImportResult {
  epicsCreated: number
  epicsUpdated: number
  storiesCreated: number
  storiesUpdated: number
  epicIds: string[]
  storyIds: string[]
}

/**
 * Hook for importing stories from epics.md files.
 *
 * Provides a function to import stories from an epics.md file,
 * with automatic error handling, toast notifications, and query invalidation.
 *
 * Story 3.7: Story Import After Epics Phase
 *
 * @example
 * ```tsx
 * function ImportButton({ projectId }) {
 *   const { importStories, isImporting } = useStoryImport()
 *
 *   const handleImport = () => {
 *     importStories(projectId, '/path/to/epics.md')
 *   }
 *
 *   return (
 *     <button onClick={handleImport} disabled={isImporting}>
 *       Import Stories
 *     </button>
 *   )
 * }
 * ```
 */
export function useStoryImport() {
  const utils = trpc.useUtils()

  const importMutation = trpc.import.importStoriesFromEpics.useMutation({
    onSuccess: (result) => {
      // Show success toast with import counts (including updates for re-imports)
      const parts: string[] = []
      if (result.storiesCreated > 0) {
        parts.push(`${result.storiesCreated} new`)
      }
      if (result.storiesUpdated > 0) {
        parts.push(`${result.storiesUpdated} updated`)
      }
      const storyText = parts.length > 0 ? parts.join(', ') : '0'

      toast.success('Stories imported successfully', {
        description: `${storyText} stories from ${result.epicsCreated + result.epicsUpdated} epics`
      })

      // Invalidate task queries to refresh the board and detail views
      utils.tasks.getById.invalidate()
      utils.tasks.getAll.invalidate()
      utils.tasks.getAllWithEpics.invalidate()

      // Also invalidate epics queries
      utils.epics.getAll.invalidate()
    },
    onError: (error) => {
      // Show error toast with appropriate message
      const isNotFound = error.message.includes('not found')
      toast.error('Import failed', {
        description: isNotFound
          ? 'The epics.md file was not found. Please check the path and try again.'
          : error.message,
        duration: 10000
      })
    }
  })

  const importStories = useCallback(
    (projectId: string, epicsFilePath: string, statusFilePath?: string) => {
      importMutation.mutate({ projectId, epicsFilePath, statusFilePath })
    },
    [importMutation]
  )

  const importStoriesAsync = useCallback(
    async (
      projectId: string,
      epicsFilePath: string,
      statusFilePath?: string
    ): Promise<ImportResult> => {
      return importMutation.mutateAsync({ projectId, epicsFilePath, statusFilePath })
    },
    [importMutation]
  )

  return {
    /** Import stories from an epics.md file (fire-and-forget) */
    importStories,
    /** Import stories from an epics.md file (returns promise) */
    importStoriesAsync,
    /** Whether an import is currently in progress */
    isImporting: importMutation.isPending,
    /** The result of the last successful import */
    importResult: importMutation.data,
    /** The error from the last failed import */
    importError: importMutation.error,
    /** Reset the mutation state */
    reset: importMutation.reset
  }
}

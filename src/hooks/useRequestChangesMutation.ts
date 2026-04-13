import { useCallback } from 'react'
import { trpc } from '@renderer/lib/trpc'
import { toast } from 'sonner'
import type { InlineComment } from '@shared/types/task.types'

/**
 * Hook for requesting changes with inline comments (Story 7.5).
 *
 * Handles the "Request Changes" action in the 60-Second Velocity Loop:
 * 1. Calls requestChanges to store inline comments and move task back to in_progress
 * 2. Shows success toast on successful request
 * 3. Shows error toast on failure
 * 4. Invalidates task queries on success
 *
 * @example
 * ```tsx
 * function ReviewActions({ taskId, storyNumber }) {
 *   const { requestChanges, isPending } = useRequestChangesMutation({
 *     taskId,
 *     storyNumber,
 *     onSuccess: () => clearComments(taskId)
 *   })
 *
 *   return (
 *     <Button onClick={() => requestChanges(inlineComments)}>
 *       {isPending ? 'Requesting...' : 'Request Changes'}
 *     </Button>
 *   )
 * }
 * ```
 */
export interface UseRequestChangesMutationOptions {
  /** The task ID to request changes for */
  taskId: string
  /** The story number for the toast message (e.g., "7.5") */
  storyNumber?: string | null
  /** Callback when request succeeds */
  onSuccess?: () => void
  /** Callback when an error occurs */
  onError?: (error: Error) => void
}

export function useRequestChangesMutation(
  options: UseRequestChangesMutationOptions
) {
  const { taskId, storyNumber, onSuccess, onError } = options

  const utils = trpc.useUtils()

  const requestChangesMutation = trpc.tasks.requestChanges.useMutation({
    onSuccess: (data) => {
      // Story 7.5 AC 4: Show success notification
      const storyLabel = storyNumber ? `Story ${storyNumber}` : 'Task'
      const commentCount = data.commentCount || 0
      toast.success(`${storyLabel}: Changes requested`, {
        description: `${commentCount} comment${commentCount !== 1 ? 's' : ''} saved, returning to In Progress`
      })

      // Invalidate task queries to refresh UI
      utils.tasks.getById.invalidate({ id: taskId })
      utils.tasks.getAllWithEpics.invalidate()
      utils.tasks.getAll.invalidate()

      // Call success callback for dialog close/clearing state
      onSuccess?.()
    },
    onError: (error) => {
      toast.error('Request changes failed', {
        description: error.message
      })
      onError?.(new Error(error.message))
    }
  })

  // Story 7.5 Task 9.2: Request changes function that calls mutation
  const requestChanges = useCallback(
    (inlineComments: InlineComment[]) => {
      requestChangesMutation.mutate({
        id: taskId,
        inlineComments
      })
    },
    [taskId, requestChangesMutation]
  )

  return {
    /** Trigger the request changes action with inline comments */
    requestChanges,
    /** Whether the mutation is in progress */
    isPending: requestChangesMutation.isPending,
    /** Whether the mutation succeeded */
    isSuccess: requestChangesMutation.isSuccess,
    /** Whether the mutation failed */
    isError: requestChangesMutation.isError,
    /** The error if mutation failed */
    error: requestChangesMutation.error
  }
}

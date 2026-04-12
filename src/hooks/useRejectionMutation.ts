import { useCallback } from 'react'
import { trpc } from '@renderer/lib/trpc'
import { toast } from 'sonner'

/**
 * Hook for rejecting a task with feedback (Story 7.4).
 *
 * Handles the "Reject" action in the 60-Second Velocity Loop:
 * 1. Calls rejectWithFeedback to store feedback and move task back to in_progress
 * 2. Shows success toast on successful rejection
 * 3. Shows error toast on failure
 * 4. Invalidates task queries on success
 *
 * @example
 * ```tsx
 * function ReviewActions({ taskId, storyNumber }) {
 *   const { reject, isPending } = useRejectionMutation({ taskId, storyNumber })
 *
 *   return (
 *     <Button onClick={() => reject('Please fix the validation logic')}>
 *       {isPending ? 'Rejecting...' : 'Reject'}
 *     </Button>
 *   )
 * }
 * ```
 */
export interface UseRejectionMutationOptions {
  /** The task ID to reject */
  taskId: string
  /** The story number for the toast message (e.g., "7.4") */
  storyNumber?: string | null
  /** Callback when rejection succeeds */
  onSuccess?: () => void
  /** Callback when an error occurs */
  onError?: (error: Error) => void
}

export function useRejectionMutation(options: UseRejectionMutationOptions) {
  const { taskId, storyNumber, onSuccess, onError } = options

  const utils = trpc.useUtils()

  const rejectMutation = trpc.tasks.rejectWithFeedback.useMutation({
    onSuccess: () => {
      // Story 7.4 AC 2: Show success notification
      const storyLabel = storyNumber ? `Story ${storyNumber}` : 'Task'
      toast.success(`${storyLabel} rejected, returning to In Progress`, {
        description: 'Feedback saved for next attempt'
      })

      // Story 7.4 Task 2.5: Invalidate task queries to refresh UI
      utils.tasks.getById.invalidate({ id: taskId })
      utils.tasks.getAllWithEpics.invalidate()
      utils.tasks.getAll.invalidate()

      // Call success callback for dialog close/navigation
      onSuccess?.()
    },
    onError: (error) => {
      // Story 7.4 Task 2.4: Handle errors
      toast.error('Rejection failed', {
        description: error.message
      })
      onError?.(new Error(error.message))
    }
  })

  // Story 7.4 Task 2.2: Reject function that calls rejectWithFeedback mutation
  const reject = useCallback(
    (feedback: string | null) => {
      rejectMutation.mutate({
        id: taskId,
        feedback
      })
    },
    [taskId, rejectMutation]
  )

  return {
    /** Trigger the rejection action with optional feedback */
    reject,
    /** Whether the rejection mutation is in progress */
    isPending: rejectMutation.isPending,
    /** Whether the mutation succeeded */
    isSuccess: rejectMutation.isSuccess,
    /** Whether the mutation failed */
    isError: rejectMutation.isError,
    /** The error if mutation failed */
    error: rejectMutation.error
  }
}

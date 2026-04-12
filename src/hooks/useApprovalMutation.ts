import { useCallback } from 'react'
import { trpc } from '@renderer/lib/trpc'
import { toast } from 'sonner'

/**
 * Hook for approving a task (Story 7.3).
 *
 * Handles the "Approve" action in the 60-Second Velocity Loop:
 * 1. Calls updateStatus with status 'done' to trigger merge
 * 2. Shows success toast on successful merge
 * 3. Shows warning toast on merge conflict (PRECONDITION_FAILED)
 * 4. Shows error toast on other errors
 * 5. Invalidates task queries on success
 *
 * @example
 * ```tsx
 * function ReviewActions({ taskId, storyNumber }) {
 *   const { approve, isPending } = useApprovalMutation({ taskId, storyNumber })
 *
 *   return (
 *     <Button onClick={approve} disabled={isPending}>
 *       {isPending ? 'Approving...' : 'Approve'}
 *     </Button>
 *   )
 * }
 * ```
 */
export interface UseApprovalMutationOptions {
  /** The task ID to approve */
  taskId: string
  /** The story number for the toast message (e.g., "7.3") */
  storyNumber?: number | null
  /** Callback when approval succeeds */
  onSuccess?: () => void
  /** Callback when a merge conflict is detected */
  onConflict?: (message: string) => void
  /** Callback when an error occurs */
  onError?: (error: Error) => void
}

export function useApprovalMutation(options: UseApprovalMutationOptions) {
  const { taskId, storyNumber, onSuccess, onConflict, onError } = options

  const utils = trpc.useUtils()

  const updateStatusMutation = trpc.tasks.updateStatus.useMutation({
    onSuccess: () => {
      // Story 7.3 AC 2: Show success notification
      const storyLabel = storyNumber ? `Story ${storyNumber}` : 'Task'
      toast.success(`${storyLabel} approved and merged`, {
        description: 'Code merged to main'
      })

      // Story 7.3 Task 1.6: Invalidate task queries to refresh UI
      utils.tasks.getById.invalidate({ id: taskId })
      utils.tasks.getAllWithEpics.invalidate()
      utils.tasks.getAll.invalidate()

      // Call success callback for navigation/auto-focus
      onSuccess?.()
    },
    onError: (error) => {
      // Story 7.3 AC 3: Handle merge conflict (PRECONDITION_FAILED)
      // The backend throws PRECONDITION_FAILED when merge conflicts detected
      if (error.data?.code === 'PRECONDITION_FAILED') {
        toast.warning('Merge conflict detected', {
          description: error.message,
          duration: 6000
        })
        onConflict?.(error.message)
      } else {
        // Story 7.3 Task 1.5: Handle generic errors
        toast.error('Approval failed', {
          description: error.message
        })
        onError?.(new Error(error.message))
      }
    }
  })

  // Story 7.3 Task 1.2: Approve function that calls updateStatus with 'done'
  const approve = useCallback(() => {
    updateStatusMutation.mutate({
      id: taskId,
      status: 'done'
    })
  }, [taskId, updateStatusMutation])

  return {
    /** Trigger the approval action */
    approve,
    /** Whether the approval mutation is in progress */
    isPending: updateStatusMutation.isPending,
    /** Whether the mutation succeeded */
    isSuccess: updateStatusMutation.isSuccess,
    /** Whether the mutation failed */
    isError: updateStatusMutation.isError,
    /** The error if mutation failed */
    error: updateStatusMutation.error
  }
}

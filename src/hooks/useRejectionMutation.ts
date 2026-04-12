import { useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { commands } from '@renderer/lib/rspc'
import { toast } from 'sonner'

/**
 * Hook for rejecting a task with feedback (T1.8).
 *
 * Migrated from tRPC to Tauri commands. Calls commands.rejectTask(taskId, feedback)
 * which stores the feedback and moves the task back to in_progress.
 * The worktree is NOT modified — the agent continues in the same branch.
 */
export interface UseRejectionMutationOptions {
  taskId: string
  storyNumber?: string | null
  projectId?: string
  onSuccess?: () => void
  onError?: (error: Error) => void
}

export function useRejectionMutation(options: UseRejectionMutationOptions) {
  const { taskId, storyNumber, projectId = '', onSuccess, onError } = options

  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async (feedback: string | null) => {
      const r = await commands.rejectTask(taskId, feedback ?? '')
      if (r.status === 'error') throw new Error(JSON.stringify(r.error))
    },
    onSuccess: () => {
      const storyLabel = storyNumber ? `Story ${storyNumber}` : 'Task'
      toast.success(`${storyLabel} rejected, returning to In Progress`, {
        description: 'Feedback saved for next attempt'
      })

      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: ['tasks', 'list', projectId] })
      }

      onSuccess?.()
    },
    onError: (error: Error) => {
      toast.error('Rejection failed', {
        description: error.message
      })
      onError?.(error)
    }
  })

  const reject = useCallback(
    (feedback: string | null) => {
      mutation.mutate(feedback)
    },
    [mutation]
  )

  return {
    reject,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error
  }
}

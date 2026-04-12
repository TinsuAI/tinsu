import { useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { commands } from '@renderer/lib/rspc'
import { toast } from 'sonner'
import type { AppError } from '@renderer/lib/rspc'

/**
 * Hook for approving a task (T1.8).
 *
 * Migrated from tRPC to Tauri commands. Calls commands.approveTask(taskId)
 * which detects conflicts, merges the branch, and sets status=done.
 *
 * On merge conflict (AppError.GitConflict), invokes onConflict callback
 * so the caller can show ConflictWarningBanner.
 */
export interface UseApprovalMutationOptions {
  taskId: string
  storyNumber?: number | null
  projectId?: string
  onSuccess?: () => void
  onConflict?: (message: string) => void
  onError?: (error: Error) => void
}

function isGitConflictError(error: unknown): string | null {
  if (!(error instanceof Error)) return null
  try {
    const parsed = JSON.parse(error.message) as AppError
    if ('GitConflict' in parsed) return parsed.GitConflict as string
  } catch {
    // Not JSON — check plain message
  }
  if (error.message.toLowerCase().includes('conflict')) return error.message
  return null
}

export function useApprovalMutation(options: UseApprovalMutationOptions) {
  const { taskId, storyNumber, projectId = '', onSuccess, onConflict, onError } = options

  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async () => {
      const r = await commands.approveTask(taskId)
      if (r.status === 'error') throw new Error(JSON.stringify(r.error))
    },
    onSuccess: () => {
      const storyLabel = storyNumber ? `Story ${storyNumber}` : 'Task'
      toast.success(`${storyLabel} approved and merged`, {
        description: 'Code merged to main'
      })

      // Invalidate all tasks queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: ['tasks', 'list', projectId] })
      }

      onSuccess?.()
    },
    onError: (error: Error) => {
      const conflictMsg = isGitConflictError(error)
      if (conflictMsg) {
        toast.warning('Merge conflict detected', {
          description: conflictMsg,
          duration: 6000
        })
        onConflict?.(conflictMsg)
      } else {
        toast.error('Approval failed', {
          description: error.message
        })
        onError?.(error)
      }
    }
  })

  const approve = useCallback(() => {
    mutation.mutate()
  }, [mutation])

  return {
    approve,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error
  }
}

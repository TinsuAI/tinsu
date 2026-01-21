/**
 * useDiff Hook - TES-4.1
 *
 * React hook for fetching and managing git diff data.
 * Provides diff data, loading state, error handling, and refresh capability.
 *
 * @see TES-4.1: Git Diff Data Fetching
 */

import { useCallback } from 'react'
import { trpc } from '@renderer/lib/trpc'
import { toast } from 'sonner'

/**
 * Hook for fetching git diff data for a task.
 *
 * Uses tRPC's useQuery for data fetching with staleTime: 0
 * since diffs can change frequently during development.
 *
 * @param taskId - ID of the task to fetch diff for
 *
 * @example
 * ```tsx
 * function DiffViewer({ taskId }) {
 *   const { diff, isLoading, error, refresh } = useDiff(taskId)
 *
 *   if (isLoading) return <LoadingSkeleton />
 *   if (error) return <ErrorState onRetry={refresh} />
 *   if (!diff || diff.files.length === 0) return <EmptyState />
 *
 *   return <DiffContent diff={diff} />
 * }
 * ```
 */
export function useDiff(taskId: string | null): {
  diff: Awaited<ReturnType<typeof trpc.git.getDiff.useQuery>>['data'] | null
  isLoading: boolean
  isRefreshing: boolean
  error: string | null
  refresh: () => Promise<void>
  hasChanges: boolean
  summary: { filesChanged: number; linesAdded: number; linesRemoved: number } | null
} {
  // Query: Fetch diff data for the task
  const {
    data: diff,
    isLoading,
    error,
    refetch,
    isFetching
  } = trpc.git.getDiff.useQuery(undefined, {
    enabled: !!taskId,
    staleTime: 0, // Diffs change frequently during development
    refetchOnWindowFocus: false, // Don't auto-refresh on focus
    retry: 1, // Only retry once on failure
    retryDelay: 1000 // Wait 1 second before retry
  })

  // Refresh callback with error handling
  const refresh = useCallback(async () => {
    if (!taskId) return

    try {
      await refetch()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh diff'
      toast.error('Failed to refresh diff', {
        description: errorMessage
      })
    }
  }, [taskId, refetch])

  // Format error message for display
  const errorMessage = error ? error.message || 'Unable to load diff' : null

  return {
    /** Diff data including files and summary */
    diff: diff ?? null,
    /** Whether the initial diff is being loaded */
    isLoading,
    /** Whether a refresh is in progress */
    isRefreshing: isFetching && !isLoading,
    /** Error that occurred during fetch */
    error: errorMessage,
    /** Refresh the diff data */
    refresh,
    /** Whether the diff has any changes */
    hasChanges: diff ? diff.files.length > 0 : false,
    /** Summary of changes (files, lines added, lines removed) */
    summary: diff?.summary ?? null
  }
}

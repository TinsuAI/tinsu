/**
 * useDiff Hook - TES-4.1, Story 8.11
 *
 * React hook for fetching and managing git diff data.
 * Provides diff data, loading state, error handling, and refresh capability.
 *
 * Supports two modes:
 * - 'worktree': For active tasks with a worktree (uses worktreePath)
 * - 'historical': For completed tasks (uses mergeCommitSha)
 *
 * @see TES-4.1: Git Diff Data Fetching
 * @see Story 8.11: Historical Diff View for Completed Tasks
 */

import { useCallback } from 'react'
import { trpc } from '@renderer/lib/trpc'
import { toast } from 'sonner'
import type { DiffSummary } from '@renderer/components/diff'
import type { GitDiffResult } from '@shared/types/git-diff.types'

/**
 * Configuration for useDiff hook.
 *
 * @see Story 8.11: Task 1.1 - Add mode parameter
 */
export interface UseDiffOptions {
  /** Task ID (used for query key) */
  taskId: string | null
  /** Diff mode: 'worktree' for active tasks, 'historical' for completed tasks */
  mode: 'worktree' | 'historical'
  /** Path to the task's worktree (required for 'worktree' mode) */
  worktreePath?: string | null
  /** The merge commit SHA (required for 'historical' mode) */
  mergeCommitSha?: string | null
}

/**
 * Hook for fetching git diff data for a task.
 *
 * Uses tRPC's useQuery for data fetching with staleTime: 0
 * since diffs can change frequently during development.
 *
 * Story 8.11: Updated to support both worktree (active) and historical (done) modes.
 * Uses trpc.git.getTaskDiff which handles both worktreePath and mergeCommitSha.
 *
 * @param options - Configuration for the diff query
 *
 * @example
 * ```tsx
 * // For active tasks (in_progress, review):
 * const { diff, isLoading, error, refresh } = useDiff({
 *   taskId: task.id,
 *   mode: 'worktree',
 *   worktreePath: task.worktree_path
 * })
 *
 * // For completed tasks (done):
 * const { diff, isLoading, error } = useDiff({
 *   taskId: task.id,
 *   mode: 'historical',
 *   mergeCommitSha: task.merge_commit_sha
 * })
 * ```
 */
export function useDiff(options: UseDiffOptions): {
  diff: GitDiffResult | null
  isLoading: boolean
  isRefreshing: boolean
  error: string | null
  refresh: () => Promise<void>
  hasChanges: boolean
  summary: DiffSummary | null
} {
  const { taskId, mode, worktreePath, mergeCommitSha } = options

  // Story 8.11 Task 1.2, 1.3: Determine query parameters based on mode
  // For worktree mode, pass worktreePath; for historical mode, pass mergeCommitSha
  const queryInput =
    mode === 'worktree'
      ? { worktreePath: worktreePath ?? undefined }
      : { mergeCommitSha: mergeCommitSha ?? undefined }

  // Determine if the query should be enabled
  // - Needs a taskId for query key uniqueness
  // - For worktree mode: needs a valid worktreePath
  // - For historical mode: needs a valid mergeCommitSha
  const isQueryEnabled =
    !!taskId &&
    ((mode === 'worktree' && !!worktreePath) || (mode === 'historical' && !!mergeCommitSha))

  // Query: Fetch diff data for the task using getTaskDiff
  // Story 8.11 Task 1.2: Updated to call trpc.git.getTaskDiff instead of trpc.git.getDiff
  const {
    data: diff,
    isLoading,
    error,
    refetch,
    isFetching
  } = trpc.git.getTaskDiff.useQuery(queryInput, {
    enabled: isQueryEnabled,
    staleTime: mode === 'worktree' ? 0 : 5 * 60 * 1000, // Historical diffs are stable, can cache 5 min
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
    diff: (diff as GitDiffResult | undefined) ?? null,
    /** Whether the initial diff is being loaded */
    isLoading,
    /** Whether a refresh is in progress */
    isRefreshing: isFetching && !isLoading,
    /** Error that occurred during fetch */
    error: errorMessage,
    /** Refresh the diff data */
    refresh,
    /** Whether the diff has any changes */
    hasChanges: diff ? (diff as GitDiffResult).files.length > 0 : false,
    /** Summary of changes (files, lines added, lines removed) */
    summary: diff ? (diff as GitDiffResult).summary : null
  }
}

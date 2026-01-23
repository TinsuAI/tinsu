/**
 * useDiff Hook - TES-4.1, Story 8.11, Story 7.6
 *
 * React hook for fetching and managing git diff data.
 * Provides diff data, loading state, error handling, and refresh capability.
 *
 * Supports two modes:
 * - 'worktree': For active tasks with a worktree (uses worktreePath)
 * - 'historical': For completed tasks (uses mergeCommitSha)
 *
 * Story 7.6: When baselineCommit is provided, shows "changes since last review"
 * instead of all changes from main.
 *
 * @see TES-4.1: Git Diff Data Fetching
 * @see Story 8.11: Historical Diff View for Completed Tasks
 * @see Story 7.6: Agent Re-execution with Feedback Context
 */

import { useCallback } from 'react'
import { trpc } from '@renderer/lib/trpc'
import { toast } from 'sonner'
import type { DiffSummary } from '@renderer/components/diff'
import type { GitDiffResult } from '@shared/types/git-diff.types'

/** Cache time for historical diffs (5 minutes) - historical diffs are immutable */
const HISTORICAL_DIFF_CACHE_MS = 5 * 60 * 1000

/**
 * Configuration for useDiff hook.
 *
 * @see Story 8.11: Task 1.1 - Add mode parameter
 * @see Story 7.6: Task 8.3 - Add baselineCommit for "changes since last review"
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
  /**
   * Story 7.6: Optional baseline commit SHA for "changes since last review" diff.
   * When provided in worktree mode, shows only changes since this commit
   * instead of all changes from main.
   */
  baselineCommit?: string | null
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
  /** Story 7.6: Whether the diff is showing "changes since last review" */
  isBaselineDiff: boolean
} {
  const { taskId, mode, worktreePath, mergeCommitSha, baselineCommit } = options

  // Story 7.6: Determine if we should use baseline diff (changes since last review)
  const useBaselineDiff = mode === 'worktree' && !!worktreePath && !!baselineCommit

  // Story 8.11 Task 1.2, 1.3: Determine query parameters based on mode
  // For worktree mode, pass worktreePath; for historical mode, pass mergeCommitSha
  const standardQueryInput =
    mode === 'worktree'
      ? { worktreePath: worktreePath ?? undefined }
      : { mergeCommitSha: mergeCommitSha ?? undefined }

  // Story 7.6: Query input for baseline diff
  const baselineQueryInput = {
    worktreePath: worktreePath ?? '',
    baseCommit: baselineCommit ?? ''
  }

  // Determine if the query should be enabled
  // - Needs a taskId for query key uniqueness
  // - For worktree mode: needs a valid worktreePath
  // - For historical mode: needs a valid mergeCommitSha
  const isQueryEnabled =
    !!taskId &&
    ((mode === 'worktree' && !!worktreePath) || (mode === 'historical' && !!mergeCommitSha))

  // Query: Fetch standard diff data for the task using getTaskDiff
  // Story 8.11 Task 1.2: Updated to call trpc.git.getTaskDiff instead of trpc.git.getDiff
  // Enabled when NOT using baseline diff OR when baseline diff is enabled but fails (fallback)
  // Story 7.6: Always fetch standard diff in background as fallback for baseline failures
  const {
    data: standardDiff,
    isLoading: isStandardLoading,
    error: standardError,
    refetch: refetchStandard,
    isFetching: isStandardFetching
  } = trpc.git.getTaskDiff.useQuery(standardQueryInput, {
    enabled: isQueryEnabled, // Always enabled when query is valid (fallback for baseline)
    staleTime: mode === 'worktree' ? 0 : HISTORICAL_DIFF_CACHE_MS,
    refetchOnWindowFocus: false, // Don't auto-refresh on focus
    retry: 1, // Only retry once on failure
    retryDelay: 1000 // Wait 1 second before retry
  })

  // Story 7.6: Query for baseline diff (changes since last review)
  // Only enabled when using baseline diff
  // If baseline diff fails (e.g., commit SHA invalid), fallback to standard diff
  const {
    data: baselineDiff,
    isLoading: isBaselineLoading,
    error: baselineError,
    refetch: refetchBaseline,
    isFetching: isBaselineFetching
  } = trpc.git.getTaskDiffWithBaseline.useQuery(baselineQueryInput, {
    enabled: isQueryEnabled && useBaselineDiff,
    staleTime: 0, // Always fresh for active review
    refetchOnWindowFocus: false,
    retry: false, // Don't retry - fallback to standard diff instead
    retryDelay: 1000
  })

  // Select the appropriate result based on whether we're using baseline diff
  // If baseline diff fails (e.g., invalid commit SHA), fall back to standard diff
  const baselineFailed = useBaselineDiff && baselineError
  const shouldUseStandardFallback = baselineFailed && standardDiff

  const diff = shouldUseStandardFallback ? standardDiff : (useBaselineDiff ? baselineDiff : standardDiff)
  const isLoading = useBaselineDiff ? isBaselineLoading : isStandardLoading
  const error = shouldUseStandardFallback ? null : (useBaselineDiff ? baselineError : standardError)
  const refetch = useBaselineDiff ? refetchBaseline : refetchStandard
  const isFetching = useBaselineDiff ? isBaselineFetching : isStandardFetching

  // Log fallback if baseline diff failed
  if (baselineFailed && shouldUseStandardFallback) {
    console.warn('[useDiff] Baseline diff failed, falling back to standard diff. Baseline commit may be invalid.')
  }

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
    summary: diff ? (diff as GitDiffResult).summary : null,
    /** Story 7.6: Whether the diff is showing "changes since last review" */
    isBaselineDiff: useBaselineDiff
  }
}

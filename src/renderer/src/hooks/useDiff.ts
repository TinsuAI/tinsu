/**
 * useDiff Hook - TES-4.1, Story 8.11, Story 7.6, Story 7.7
 *
 * React hook for fetching and managing git diff data.
 * Provides diff data, loading state, error handling, and refresh capability.
 *
 * Supports multiple modes:
 * - 'worktree': For active tasks with a worktree (uses worktreePath)
 * - 'historical': For completed tasks (uses mergeCommitSha)
 * - 'version': For comparing two version snapshots (uses versionComparison)
 *
 * Story 7.6: When baselineCommit is provided, shows "changes since last review"
 * instead of all changes from main.
 *
 * Story 7.7: When versionComparison is provided, shows diff between two versions.
 *
 * @see TES-4.1: Git Diff Data Fetching
 * @see Story 8.11: Historical Diff View for Completed Tasks
 * @see Story 7.6: Agent Re-execution with Feedback Context
 * @see Story 7.7: Review History & Comparison
 */

import { useCallback } from 'react'
import { trpc } from '@renderer/lib/trpc'
import { toast } from 'sonner'
import type { DiffSummary } from '@renderer/components/diff'
import type { GitDiffResult } from '@shared/types/git-diff.types'

/** Cache time for historical diffs (5 minutes) - historical diffs are immutable */
const HISTORICAL_DIFF_CACHE_MS = 5 * 60 * 1000

/**
 * Story 7.7: Version comparison parameters for comparing two version snapshots.
 */
export interface VersionComparisonParams {
  /** Task ID for the comparison */
  taskId: string
  /** Source version commit SHA (null means compare from main/initial state) */
  fromCommitSha: string | null
  /** Target version commit SHA */
  toCommitSha: string
  /** Source version number (for display purposes) */
  fromVersionNumber: number | null
  /** Target version number (for display purposes) */
  toVersionNumber: number
}

/**
 * Configuration for useDiff hook.
 *
 * @see Story 8.11: Task 1.1 - Add mode parameter
 * @see Story 7.6: Task 8.3 - Add baselineCommit for "changes since last review"
 * @see Story 7.7: Task 8.1 - Add versionComparison for two-version comparison
 */
export interface UseDiffOptions {
  /** Task ID (used for query key) */
  taskId: string | null
  /** Diff mode: 'worktree' for active tasks, 'historical' for completed, 'version' for comparison */
  mode: 'worktree' | 'historical' | 'version'
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
  /**
   * Story 7.7: Version comparison parameters for comparing two version snapshots.
   * Required when mode is 'version'.
   */
  versionComparison?: VersionComparisonParams | null
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
 *
 * // Story 7.7: For comparing two versions:
 * const { diff, isLoading, isVersionComparison, versionComparisonInfo } = useDiff({
 *   taskId: task.id,
 *   mode: 'version',
 *   versionComparison: {
 *     taskId: task.id,
 *     fromCommitSha: 'abc123',
 *     toCommitSha: 'def456',
 *     fromVersionNumber: 1,
 *     toVersionNumber: 2
 *   }
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
  /** Story 7.7: Whether the diff is showing a version comparison */
  isVersionComparison: boolean
  /** Story 7.7: Version comparison info for display (null if not in version mode) */
  versionComparisonInfo: {
    fromVersionNumber: number | null
    toVersionNumber: number
  } | null
} {
  const { taskId, mode, worktreePath, mergeCommitSha, baselineCommit, versionComparison } = options

  // Story 7.6: Determine if we should use baseline diff (changes since last review)
  const useBaselineDiff = mode === 'worktree' && !!worktreePath && !!baselineCommit

  // Story 7.7: Determine if we're in version comparison mode
  const useVersionComparison = mode === 'version' && !!versionComparison?.toCommitSha

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

  // Story 7.7: Query input for version comparison
  const versionQueryInput = {
    taskId: versionComparison?.taskId ?? '',
    fromCommitSha: versionComparison?.fromCommitSha ?? null,
    toCommitSha: versionComparison?.toCommitSha ?? ''
  }

  // Determine if the query should be enabled
  // - Needs a taskId for query key uniqueness
  // - For worktree mode: needs a valid worktreePath
  // - For historical mode: needs a valid mergeCommitSha
  // - For version mode: needs valid versionComparison with toCommitSha
  const isQueryEnabled =
    !!taskId &&
    ((mode === 'worktree' && !!worktreePath) ||
      (mode === 'historical' && !!mergeCommitSha) ||
      (mode === 'version' && useVersionComparison))

  // Query: Fetch standard diff data for the task using getTaskDiff
  // Story 8.11 Task 1.2: Updated to call trpc.git.getTaskDiff instead of trpc.git.getDiff
  // Enabled when NOT using baseline diff OR when baseline diff is enabled but fails (fallback)
  // Story 7.6: Always fetch standard diff in background as fallback for baseline failures
  // Story 7.7: Disabled when in version comparison mode
  const {
    data: standardDiff,
    isLoading: isStandardLoading,
    error: standardError,
    refetch: refetchStandard,
    isFetching: isStandardFetching
  } = trpc.git.getTaskDiff.useQuery(standardQueryInput, {
    enabled: isQueryEnabled && !useVersionComparison, // Disabled in version mode
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
    enabled: isQueryEnabled && useBaselineDiff && !useVersionComparison,
    staleTime: 0, // Always fresh for active review
    refetchOnWindowFocus: false,
    retry: false, // Don't retry - fallback to standard diff instead
    retryDelay: 1000
  })

  // Story 7.7: Query for version comparison diff
  // Only enabled when in version comparison mode with valid parameters
  const {
    data: versionDiff,
    isLoading: isVersionLoading,
    error: versionError,
    refetch: refetchVersion,
    isFetching: isVersionFetching
  } = trpc.git.getVersionDiff.useQuery(versionQueryInput, {
    enabled: isQueryEnabled && useVersionComparison,
    staleTime: HISTORICAL_DIFF_CACHE_MS, // Version diffs are immutable once created
    refetchOnWindowFocus: false,
    retry: 1,
    retryDelay: 1000
  })

  // Select the appropriate result based on mode
  // Story 7.7: Version comparison takes precedence
  // Story 7.6: Baseline diff with fallback to standard
  // Default: Standard diff
  const baselineFailed = useBaselineDiff && baselineError
  const shouldUseStandardFallback = baselineFailed && standardDiff

  // Determine which diff data to use
  let diff: GitDiffResult | undefined
  let isLoading: boolean
  let error: Error | null
  let refetch: () => Promise<unknown>
  let isFetching: boolean

  if (useVersionComparison) {
    // Story 7.7: Version comparison mode
    diff = versionDiff
    isLoading = isVersionLoading
    error = versionError
    refetch = refetchVersion
    isFetching = isVersionFetching
  } else if (shouldUseStandardFallback) {
    // Baseline failed, use standard as fallback
    diff = standardDiff
    isLoading = isStandardLoading
    error = null
    refetch = refetchStandard
    isFetching = isStandardFetching
  } else if (useBaselineDiff) {
    // Story 7.6: Baseline diff mode
    diff = baselineDiff
    isLoading = isBaselineLoading
    error = baselineError
    refetch = refetchBaseline
    isFetching = isBaselineFetching
  } else {
    // Standard mode (worktree or historical)
    diff = standardDiff
    isLoading = isStandardLoading
    error = standardError
    refetch = refetchStandard
    isFetching = isStandardFetching
  }

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
    summary: diff ? diff.summary : null,
    /** Story 7.6: Whether the diff is showing "changes since last review" */
    isBaselineDiff: useBaselineDiff,
    /** Story 7.7: Whether the diff is showing a version comparison */
    isVersionComparison: useVersionComparison,
    /** Story 7.7: Version comparison info for display */
    versionComparisonInfo: useVersionComparison && versionComparison
      ? {
          fromVersionNumber: versionComparison.fromVersionNumber,
          toVersionNumber: versionComparison.toVersionNumber
        }
      : null
  }
}

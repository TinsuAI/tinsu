/**
 * useDiff Hook - T1.8
 *
 * React hook for fetching git diff data via Tauri commands.
 *
 * Supports:
 * - 'worktree': Active tasks — calls commands.getTaskDiff(taskId)
 * - 'historical': Completed tasks — deferred to T1.10
 * - 'version': Two-version comparison — deferred to T1.10
 *
 * Story 7.6 (baseline diff) and Story 7.7 (version comparison) modes are
 * deferred to T1.10 — they return null/disabled state with TODO comments.
 *
 * @see T1.8: Migrate Git Service to Rust
 */

import { useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { commands } from '@renderer/lib/rspc'
import { toast } from 'sonner'
import type { DiffSummary } from '@renderer/components/diff'
import type { GitDiffResult } from '@shared/types/git-diff.types'

/**
 * Story 7.7: Version comparison parameters for comparing two version snapshots.
 * Deferred to T1.10 — kept for type compatibility.
 */
export interface VersionComparisonParams {
  taskId: string
  fromCommitSha: string | null
  toCommitSha: string
  fromVersionNumber: number | null
  toVersionNumber: number
}

/**
 * Configuration for useDiff hook.
 */
export interface UseDiffOptions {
  taskId: string | null
  mode: 'worktree' | 'historical' | 'version'
  worktreePath?: string | null
  mergeCommitSha?: string | null
  /** Story 7.6: deferred to T1.10 */
  baselineCommit?: string | null
  /** Story 7.7: deferred to T1.10 */
  versionComparison?: VersionComparisonParams | null
}

/**
 * Hook for fetching git diff data for a task via Tauri commands.
 *
 * Migrated from tRPC in T1.8:
 * - Primary worktree diff: uses commands.getTaskDiff(taskId)
 * - Historical/version modes: TODO deferred to T1.10
 */
export function useDiff(options: UseDiffOptions): {
  diff: GitDiffResult | null
  isLoading: boolean
  isRefreshing: boolean
  error: string | null
  refresh: () => Promise<void>
  hasChanges: boolean
  summary: DiffSummary | null
  isBaselineDiff: boolean
  isVersionComparison: boolean
  versionComparisonInfo: {
    fromVersionNumber: number | null
    toVersionNumber: number
  } | null
} {
  const { taskId, mode, baselineCommit, versionComparison } = options

  // Story 7.6: baseline diff — deferred to T1.10
  const useBaselineDiff = mode === 'worktree' && !!baselineCommit

  // Story 7.7: version comparison — deferred to T1.10
  const useVersionComparison = mode === 'version' && !!versionComparison?.toCommitSha

  // Primary worktree diff via commands.getTaskDiff(taskId)
  // Enabled only in worktree mode with a valid taskId (historical/version deferred to T1.10)
  const isQueryEnabled = !!taskId && mode === 'worktree' && !useVersionComparison

  const {
    data: diff,
    isLoading,
    error: queryError,
    refetch,
    isFetching
  } = useQuery({
    queryKey: ['task-diff', taskId],
    queryFn: async () => {
      const r = await commands.getTaskDiff(taskId!)
      if (r.status === 'error') throw new Error(JSON.stringify(r.error))
      return r.data as GitDiffResult
    },
    enabled: isQueryEnabled,
    staleTime: 0,
    refetchOnWindowFocus: false
  })

  const refresh = useCallback(async () => {
    if (!taskId) return
    try {
      await refetch()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh diff'
      toast.error('Failed to refresh diff', { description: errorMessage })
    }
  }, [taskId, refetch])

  const errorMessage = queryError
    ? queryError instanceof Error
      ? queryError.message
      : 'Unable to load diff'
    : null

  return {
    diff: diff ?? null,
    isLoading,
    isRefreshing: isFetching && !isLoading,
    error: errorMessage,
    refresh,
    hasChanges: diff ? diff.files.length > 0 : false,
    summary: diff ? diff.summary : null,
    /** Story 7.6: deferred to T1.10 — always false */
    isBaselineDiff: useBaselineDiff,
    /** Story 7.7: deferred to T1.10 — always false */
    isVersionComparison: useVersionComparison,
    versionComparisonInfo:
      useVersionComparison && versionComparison
        ? {
            fromVersionNumber: versionComparison.fromVersionNumber,
            toVersionNumber: versionComparison.toVersionNumber
          }
        : null
  }
}

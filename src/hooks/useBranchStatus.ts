/**
 * Hook for fetching branch status for tasks with git branches.
 *
 * T1.8: Migrated from tRPC to Tauri commands.
 *
 * Story 8.9: AC 1, 2 - Branch Status Indicators
 *
 * This hook fetches branch status (commits ahead/behind, uncommitted changes)
 * for all tasks that have an associated branch. Uses react-query's useQueries
 * for parallel fetching with refetch on interval.
 */

import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import { commands } from '@renderer/lib/rspc'
import type { Task } from '@shared/types/task.types'

/**
 * Branch status data for a single task.
 */
export interface TaskBranchStatus {
  /** Number of commits ahead of main */
  commitsAhead: number
  /** Number of commits behind main */
  commitsBehind: number
  /** Whether there are uncommitted changes in the worktree */
  hasUncommittedChanges: boolean
}

/**
 * Map of task IDs to their branch status.
 */
export type BranchStatusMap = Record<string, TaskBranchStatus>

/**
 * Return type for useBranchStatus hook.
 */
export interface UseBranchStatusResult {
  branchStatuses: BranchStatusMap
  isLoading: boolean
  error: Error | null
  refetch: () => void
}

/**
 * Hook to fetch branch status for tasks with git branches.
 *
 * Filters tasks to only those with a branch_name and not yet merged
 * (merge_commit_sha is null), then fetches status for each via commands.getBranchStatus.
 *
 * Parallel query structure (one query per task) is preserved from the tRPC implementation.
 *
 * @param tasks - Array of tasks to check branch status for
 * @param options - Options for the hook
 */
export function useBranchStatus(
  tasks: Task[],
  options: {
    enabled?: boolean
    refetchInterval?: number
  } = {}
): UseBranchStatusResult {
  const { enabled = true, refetchInterval = 30000 } = options

  // Filter tasks that have branches and are not merged
  const tasksWithBranches = useMemo(() => {
    return tasks.filter((task) => task.branch_name && !task.merge_commit_sha)
  }, [tasks])

  // Use react-query's useQueries for parallel fetching
  // PERFORMANCE NOTE: Creates N parallel queries. Consider batching if >10 tasks.
  const results = useQueries({
    queries: tasksWithBranches.map((task) => ({
      queryKey: ['branch-status', task.id],
      queryFn: async () => {
        const r = await commands.getBranchStatus(task.id)
        if (r.status === 'error') throw new Error(JSON.stringify(r.error))
        return r.data
      },
      enabled: enabled && !!task.branch_name,
      refetchInterval,
      staleTime: refetchInterval / 2
    }))
  })

  // Build status map from results
  const branchStatuses = useMemo(() => {
    const map: BranchStatusMap = {}

    tasksWithBranches.forEach((task, index) => {
      const result = results[index]
      if (result?.data) {
        map[task.id] = {
          commitsAhead: result.data.commitsAhead,
          commitsBehind: result.data.commitsBehind,
          hasUncommittedChanges: result.data.hasUncommittedChanges
        }
      }
    })

    return map
  }, [tasksWithBranches, results])

  const isLoading = results.some((r) => r.isLoading)
  const error = results.find((r) => r.error)?.error ?? null

  const refetch = () => {
    results.forEach((r) => r.refetch())
  }

  return {
    branchStatuses,
    isLoading,
    error,
    refetch
  }
}

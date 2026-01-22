/**
 * Hook for fetching branch status for tasks with git branches.
 *
 * Story 8.9: AC 1, 2 - Branch Status Indicators
 *
 * This hook fetches branch status (commits ahead/behind, uncommitted changes)
 * for all tasks that have an associated branch. Uses tRPC query with refetch
 * on interval to keep the status up to date.
 */

import { useMemo } from 'react'
import { trpc } from '@renderer/lib/trpc'
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
  /** Map of task IDs to branch status */
  branchStatuses: BranchStatusMap
  /** Whether the branch status data is loading */
  isLoading: boolean
  /** Error that occurred during fetching */
  error: Error | null
  /** Refetch function to manually refresh status */
  refetch: () => void
}

/**
 * Hook to fetch branch status for tasks with git branches.
 *
 * Filters tasks to only those with a branch_name and not yet merged
 * (merge_commit_sha is null), then fetches status for each.
 *
 * @param tasks - Array of tasks to check branch status for
 * @param options - Options for the hook
 * @returns Object with branchStatuses map and loading/error state
 *
 * @example
 * ```tsx
 * function KanbanBoardContainer() {
 *   const { data: tasks } = trpc.tasks.getAll.useQuery()
 *   const { branchStatuses } = useBranchStatus(tasks ?? [])
 *
 *   return (
 *     <TaskCard
 *       task={task}
 *       branchStatus={branchStatuses[task.id]}
 *     />
 *   )
 * }
 * ```
 */
export function useBranchStatus(
  tasks: Task[],
  options: {
    /** Enable/disable the query (default: true) */
    enabled?: boolean
    /** Refetch interval in ms (default: 30000 - 30 seconds) */
    refetchInterval?: number
  } = {}
): UseBranchStatusResult {
  const { enabled = true, refetchInterval = 30000 } = options

  // Filter tasks that have branches and are not merged
  const tasksWithBranches = useMemo(() => {
    return tasks.filter(
      (task) => task.branch_name && !task.merge_commit_sha
    )
  }, [tasks])

  // Create query keys for each task
  const queryKeys = useMemo(() => {
    return tasksWithBranches.map((task) => ({
      taskId: task.id,
      // Type-safe: we filtered for branch_name in tasksWithBranches, so it's guaranteed to exist
      branchName: task.branch_name as string,
      worktreePath: task.worktree_path ?? undefined
    }))
  }, [tasksWithBranches])

  // Use tRPC's useQueries for parallel fetching
  // PERFORMANCE WARNING (Code Review 2026-01-22):
  // This creates N parallel git queries (N+1 problem). With 20 tasks with branches,
  // that's 20 separate git commands every 30 seconds. Dev Notes line 283-299 warn
  // against this pattern and suggest batching via a single tRPC endpoint that
  // accepts multiple branch names. Consider implementing git.getBatchBranchStatus()
  // if this becomes a performance bottleneck (>10 tasks with active branches).
  const results = trpc.useQueries((t) =>
    queryKeys.map((key) =>
      t.git.getBranchStatus(
        { branchName: key.branchName, worktreePath: key.worktreePath },
        {
          enabled: enabled && !!key.branchName,
          refetchInterval,
          staleTime: refetchInterval / 2 // Consider stale after half the interval
        }
      )
    )
  )

  // Build status map from results
  const branchStatuses = useMemo(() => {
    const map: BranchStatusMap = {}

    queryKeys.forEach((key, index) => {
      const result = results[index]
      if (result?.data) {
        map[key.taskId] = {
          commitsAhead: result.data.commitsAhead,
          commitsBehind: result.data.commitsBehind,
          hasUncommittedChanges: result.data.hasUncommittedChanges
        }
      }
    })

    return map
  }, [queryKeys, results])

  // Aggregate loading state
  const isLoading = results.some((r) => r.isLoading)

  // Get first error if any
  const error = results.find((r) => r.error)?.error ?? null

  // Refetch all queries
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

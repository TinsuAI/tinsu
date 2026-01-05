import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { trpc } from '@renderer/lib/trpc'
import { KanbanBoard } from './KanbanBoard'
import type { Task, TaskStatus } from '@shared/types/task.types'

export function KanbanBoardContainer() {
  const queryClient = useQueryClient()
  const { data: tasks, isLoading, isError, error } = trpc.tasks.getAll.useQuery()

  // Mutation for updating task status
  const updateStatusMutation = trpc.tasks.updateStatus.useMutation({
    // Optimistic update
    onMutate: async ({ id, status }) => {
      // Cancel outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: [['tasks', 'getAll']] })

      // Snapshot current state for rollback
      const previousTasks = queryClient.getQueryData([['tasks', 'getAll']])

      // Optimistically update the cache
      queryClient.setQueryData([['tasks', 'getAll']], (old: Task[] | undefined) => {
        if (!old) return old
        return old.map((task) =>
          task.id === id ? { ...task, status, updated_at: new Date() } : task
        )
      })

      return { previousTasks }
    },
    // Rollback on error and notify user
    onError: (err, _variables, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData([['tasks', 'getAll']], context.previousTasks)
      }
      // TODO: Replace with toast notification when toast component is added
      console.error('Failed to update task status:', err.message)
    },
    // Refetch after success or error
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [['tasks', 'getAll']] })
    }
  })

  // Handle status change from drag-drop
  const handleStatusChange = useCallback(
    (taskId: string, newStatus: TaskStatus) => {
      updateStatusMutation.mutate({ id: taskId, status: newStatus })
    },
    [updateStatusMutation]
  )

  // Mutation for reordering tasks within a column
  const reorderMutation = trpc.tasks.reorder.useMutation({
    onMutate: async ({ taskIds, status }) => {
      await queryClient.cancelQueries({ queryKey: [['tasks', 'getAll']] })
      const previousTasks = queryClient.getQueryData([['tasks', 'getAll']])

      // Optimistically update sort_order based on new positions
      queryClient.setQueryData([['tasks', 'getAll']], (old: Task[] | undefined) => {
        if (!old) return old
        return old.map((task) => {
          if (task.status !== status) return task
          const newIndex = taskIds.indexOf(task.id)
          if (newIndex === -1) return task
          return { ...task, sort_order: newIndex, updated_at: new Date() }
        })
      })

      return { previousTasks }
    },
    onError: (err, _variables, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData([['tasks', 'getAll']], context.previousTasks)
      }
      // TODO: Replace with toast notification when toast component is added
      console.error('Failed to reorder tasks:', err.message)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [['tasks', 'getAll']] })
    }
  })

  // Handle reorder within column
  const handleReorder = useCallback(
    (taskIds: string[], status: TaskStatus) => {
      reorderMutation.mutate({ taskIds, status })
    },
    [reorderMutation]
  )

  if (isError) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <p className="text-destructive">Failed to load tasks</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {error?.message || 'An unexpected error occurred'}
          </p>
        </div>
      </div>
    )
  }

  // Transform tasks to match the Task interface (handle date serialization from tRPC)
  const transformedTasks: Task[] = (tasks ?? []).map((task) => ({
    ...task,
    status: task.status as TaskStatus,
    created_at: new Date(task.created_at),
    updated_at: new Date(task.updated_at)
  }))

  return (
    <KanbanBoard
      tasks={transformedTasks}
      isLoading={isLoading}
      onStatusChange={handleStatusChange}
      onReorder={handleReorder}
    />
  )
}

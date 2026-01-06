import { useCallback, useState, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { trpc } from '@renderer/lib/trpc'
import { KanbanBoard } from './KanbanBoard'
import { CreateTaskDialog } from '../task/CreateTaskDialog'
import { useUIStore } from '@renderer/stores/ui.store'
import type { Task, TaskStatus } from '@shared/types/task.types'

export function KanbanBoardContainer() {
  const queryClient = useQueryClient()
  const { data: tasks, isLoading, isError, error } = trpc.tasks.getAll.useQuery()
  const { data: epics } = trpc.epics.getAll.useQuery()
  const selectedSprintId = useUIStore((state) => state.selectedSprintId)

  // Dialog state for creating new tasks
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogInitialStatus, setDialogInitialStatus] = useState<TaskStatus>('backlog')

  // Handle add task from column "+" button
  const handleAddTask = useCallback((status: TaskStatus) => {
    setDialogInitialStatus(status)
    setDialogOpen(true)
  }, [])

  // Global "N" keyboard shortcut to open dialog
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger if no input/textarea is focused
      if (
        e.key.toLowerCase() === 'n' &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault()
        setDialogOpen(true)
        setDialogInitialStatus('backlog')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

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
      toast.error('Failed to update task status', {
        description: err.message
      })
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
      toast.error('Failed to reorder tasks', {
        description: err.message
      })
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
  const transformedTasks: Task[] = useMemo(() => {
    const allTasks = (tasks ?? []).map((task) => ({
      ...task,
      status: task.status as TaskStatus,
      created_at: new Date(task.created_at),
      updated_at: new Date(task.updated_at)
    }))

    // Filter by selected sprint if one is selected (Story 2.5)
    if (selectedSprintId) {
      return allTasks.filter((task) => task.sprint_id === selectedSprintId)
    }

    return allTasks
  }, [tasks, selectedSprintId])

  // Create epic name and color maps for display on task cards
  const epicNames = useMemo(() => {
    if (!epics) return {}
    return epics.reduce(
      (acc, epic) => {
        acc[epic.id] = epic.title
        return acc
      },
      {} as Record<string, string>
    )
  }, [epics])

  const epicColors = useMemo(() => {
    if (!epics) return {}
    return epics.reduce(
      (acc, epic) => {
        acc[epic.id] = epic.color
        return acc
      },
      {} as Record<string, string>
    )
  }, [epics])

  return (
    <>
      <KanbanBoard
        tasks={transformedTasks}
        epicNames={epicNames}
        epicColors={epicColors}
        isLoading={isLoading}
        onStatusChange={handleStatusChange}
        onReorder={handleReorder}
        onAddTask={handleAddTask}
      />
      <CreateTaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialStatus={dialogInitialStatus}
      />
    </>
  )
}

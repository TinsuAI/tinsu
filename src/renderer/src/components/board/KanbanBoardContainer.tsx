import { useCallback, useState, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { trpc } from '@renderer/lib/trpc'
import { KanbanBoard } from './KanbanBoard'
import { CreateTaskDialog } from '../task/CreateTaskDialog'
import { ImportStoriesDialog } from '../dialogs/ImportStoriesDialog'
import { CreateStoryConfirmDialog } from '../dialogs/CreateStoryConfirmDialog'
import { DevStoryConfirmDialog } from '../dialogs/DevStoryConfirmDialog'
import { BasicTaskConfirmDialog } from '../dialogs/BasicTaskConfirmDialog'
import { useUIStore, useTerminalStore, useTaskWorkspaceStore } from '@renderer/stores'
import { useAgentLauncher } from '@renderer/hooks/useAgentLauncher'
import { useStorySync } from '@renderer/hooks/useStorySync'
import { useBranchStatus } from '@renderer/hooks/useBranchStatus'
import type { Task, TaskStatus } from '@shared/types/task.types'

export function KanbanBoardContainer() {
  const queryClient = useQueryClient()
  const { data: tasks, isLoading, isError, error } = trpc.tasks.getAll.useQuery()
  const { data: epics } = trpc.epics.getAll.useQuery()

  // Story 3.4: Agent launcher hook for planning tasks
  // Story 5.3: Extended with launchCreateStory and launchDevStory
  // Story 5.3b: Extended with launchBasicTask
  const { launchPlanningAgent, launchCreateStory, launchDevStory, launchBasicTask } = useAgentLauncher()

  // Story 3.9: Sync hook for bidirectional sync (AC: 5)
  const { syncingTaskIds } = useStorySync()

  // Story 8.9: Branch status hook for displaying commits ahead/behind
  const { branchStatuses } = useBranchStatus(tasks ?? [])

  // TES-3.1: Task workspace store for full-screen navigation
  const { openWorkspace, activeTaskId } = useTaskWorkspaceStore()

  // Story 2.6: Get all filter state
  const selectedSprintId = useUIStore((state) => state.selectedSprintId)
  const selectedEpicIds = useUIStore((state) => state.selectedEpicIds)
  const selectedStatuses = useUIStore((state) => state.selectedStatuses)
  const hasActiveFilters = useUIStore((state) => state.hasActiveFilters())

  // Dialog state for creating new tasks
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogInitialStatus, setDialogInitialStatus] = useState<TaskStatus>('backlog')

  // Story 3.7: Import stories dialog state
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [importDefaultPath, setImportDefaultPath] = useState<string>('')

  // Story 5.3: Create Story confirmation dialog state
  const [createStoryDialogOpen, setCreateStoryDialogOpen] = useState(false)
  const [createStoryTask, setCreateStoryTask] = useState<Task | null>(null)

  // Story 5.3: Dev Story confirmation dialog state
  const [devStoryDialogOpen, setDevStoryDialogOpen] = useState(false)
  const [devStoryTask, setDevStoryTask] = useState<Task | null>(null)

  // Story 5.3b: Basic Task confirmation dialog state
  const [basicTaskDialogOpen, setBasicTaskDialogOpen] = useState(false)
  const [basicTask, setBasicTask] = useState<Task | null>(null)

  // Handle add task from column "+" button
  const handleAddTask = useCallback((status: TaskStatus) => {
    setDialogInitialStatus(status)
    setDialogOpen(true)
  }, [])

  // Story 3.7: Handle import stories button click from phase 5 card
  const handleImportStories = useCallback((artifactPath: string) => {
    setImportDefaultPath(artifactPath)
    setImportDialogOpen(true)
  }, [])

  // Global "Ctrl+N" keyboard shortcut to open dialog
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger if Ctrl+N pressed and no input/textarea is focused
      if (
        e.key.toLowerCase() === 'n' &&
        e.ctrlKey &&
        !e.metaKey &&
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

  // Mutation for deleting tasks
  const deleteMutation = trpc.tasks.delete.useMutation({
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: [['tasks', 'getAll']] })
      const previousTasks = queryClient.getQueryData([['tasks', 'getAll']])

      // Optimistically remove the task from cache
      queryClient.setQueryData([['tasks', 'getAll']], (old: Task[] | undefined) => {
        if (!old) return old
        return old.filter((task) => task.id !== id)
      })

      // TES-1.6: Clear terminal buffer when task is deleted
      useTerminalStore.getState().clearBuffer(id)

      return { previousTasks }
    },
    onError: (err, _variables, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData([['tasks', 'getAll']], context.previousTasks)
      }
      toast.error('Failed to delete task', {
        description: err.message
      })
    },
    onSuccess: () => {
      toast.success('Task deleted')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [['tasks', 'getAll']] })
    }
  })

  // Handle delete task
  const handleDeleteTask = useCallback(
    (taskId: string) => {
      deleteMutation.mutate({ id: taskId })
    },
    [deleteMutation]
  )

  // Story 5.2c: Handle drag blocked notification
  // Story 5.3b AC4: Use toast.info for basic task guidance (not warning)
  const handleDragBlocked = useCallback((message: string) => {
    // Basic task guidance should be info, not warning
    if (message.includes('Basic Tasks execute directly')) {
      toast.info('Move blocked', {
        description: message
      })
    } else {
      toast.warning('Move blocked', {
        description: message
      })
    }
  }, [])

  // Story 5.3 - AC: 1: Handle create-story dialog request
  const handleCreateStoryRequested = useCallback((task: Task) => {
    console.log('[KanbanBoardContainer] handleCreateStoryRequested called:', { taskId: task.id, taskType: task.task_type })
    setCreateStoryTask(task)
    setCreateStoryDialogOpen(true)
  }, [])

  // Story 5.3 - AC: 1: Handle create-story confirmation
  const handleCreateStoryConfirm = useCallback(async () => {
    console.log('[KanbanBoardContainer] handleCreateStoryConfirm called, createStoryTask:', createStoryTask?.id)
    if (!createStoryTask) {
      console.log('[KanbanBoardContainer] handleCreateStoryConfirm: No createStoryTask, returning')
      return
    }

    // Move task to create_story status (this creates the tmux session)
    // Must await to ensure session is created before launching workflow
    console.log('[KanbanBoardContainer] handleCreateStoryConfirm: Updating status to create_story')
    await updateStatusMutation.mutateAsync({ id: createStoryTask.id, status: 'create_story' })
    console.log('[KanbanBoardContainer] handleCreateStoryConfirm: Status updated, now launching create-story')

    // Launch the create-story workflow
    launchCreateStory(createStoryTask.id)
    console.log('[KanbanBoardContainer] handleCreateStoryConfirm: launchCreateStory called')

    // Clear the dialog state
    setCreateStoryTask(null)
  }, [createStoryTask, updateStatusMutation, launchCreateStory])

  // Story 5.3 - AC: 3: Handle dev-story dialog request
  const handleDevStoryRequested = useCallback((task: Task) => {
    setDevStoryTask(task)
    setDevStoryDialogOpen(true)
  }, [])

  // Story 5.3 - AC: 3: Handle dev-story confirmation
  const handleDevStoryConfirm = useCallback(async () => {
    console.log('[KanbanBoardContainer] handleDevStoryConfirm called, devStoryTask:', devStoryTask?.id)
    if (!devStoryTask) {
      console.log('[KanbanBoardContainer] handleDevStoryConfirm: No devStoryTask, returning')
      return
    }

    // Move task to in_progress status (this creates the tmux session if needed)
    // Must await to ensure session is created before launching workflow
    console.log('[KanbanBoardContainer] handleDevStoryConfirm: Updating status to in_progress')
    await updateStatusMutation.mutateAsync({ id: devStoryTask.id, status: 'in_progress' })
    console.log('[KanbanBoardContainer] handleDevStoryConfirm: Status updated, now launching dev-story')

    // Launch the dev-story workflow
    launchDevStory(devStoryTask.id)
    console.log('[KanbanBoardContainer] handleDevStoryConfirm: launchDevStory called')

    // Clear the dialog state
    setDevStoryTask(null)
  }, [devStoryTask, updateStatusMutation, launchDevStory])

  // Story 5.3b - AC: 1: Handle basic task dialog request
  const handleBasicTaskRequested = useCallback((task: Task) => {
    setBasicTask(task)
    setBasicTaskDialogOpen(true)
  }, [])

  // Story 5.3b - AC: 1: Handle basic task confirmation
  const handleBasicTaskConfirm = useCallback(async () => {
    if (!basicTask) return

    // Move task to in_progress status (this creates the tmux session)
    // Must await to ensure session is created before launching workflow
    await updateStatusMutation.mutateAsync({ id: basicTask.id, status: 'in_progress' })

    // Launch the basic task directly
    launchBasicTask(basicTask.id)

    // Clear the dialog state
    setBasicTask(null)
  }, [basicTask, updateStatusMutation, launchBasicTask])

  // Transform tasks to match the Task interface (handle date serialization from tRPC)
  // Story 2.6: Apply comprehensive filtering with AND logic between filter types
  const transformedTasks: Task[] = useMemo(() => {
    let filtered = (tasks ?? []).map((task) => ({
      ...task,
      status: task.status as TaskStatus,
      task_type: task.task_type as 'planning' | 'story',
      created_at: new Date(task.created_at),
      updated_at: new Date(task.updated_at)
    }))

    // Sprint filter (single select, existing from Story 2.5)
    if (selectedSprintId) {
      filtered = filtered.filter((task) => task.sprint_id === selectedSprintId)
    }

    // Epic filter (multi-select, OR logic within - Story 2.6)
    if (selectedEpicIds.length > 0) {
      filtered = filtered.filter((task) => task.epic_id && selectedEpicIds.includes(task.epic_id))
    }

    // Status filter (multi-select, OR logic within - Story 2.6)
    // Only apply if some statuses are selected but not all 4 (selecting all = no filter)
    if (selectedStatuses.length > 0 && selectedStatuses.length < 4) {
      filtered = filtered.filter((task) => selectedStatuses.includes(task.status))
    }

    return filtered
  }, [tasks, selectedSprintId, selectedEpicIds, selectedStatuses])

  // TES-3.1: Handle story card click to open full-screen task workspace (AC: #1, #3)
  const handleStoryClick = useCallback(
    (taskId: string) => {
      openWorkspace(taskId)
    },
    [openWorkspace]
  )

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

  // Story 3.7: Get project ID from the first task that has one
  const projectId = useMemo(() => {
    const taskWithProject = transformedTasks.find((t) => t.project_id)
    return taskWithProject?.project_id ?? ''
  }, [transformedTasks])

  // Error state - must be after all hooks to avoid "fewer hooks than expected" error
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

  return (
    <>
      <KanbanBoard
        tasks={transformedTasks}
        epicNames={epicNames}
        epicColors={epicColors}
        branchStatuses={branchStatuses}
        isLoading={isLoading}
        hasActiveFilters={hasActiveFilters}
        syncingTaskIds={syncingTaskIds}
        selectedTaskId={activeTaskId}
        onStatusChange={handleStatusChange}
        onReorder={handleReorder}
        onAddTask={handleAddTask}
        onPlanningTaskStart={launchPlanningAgent}
        onImportStories={handleImportStories}
        onPhase5Complete={handleImportStories}
        onStoryClick={handleStoryClick}
        onDeleteTask={handleDeleteTask}
        onDragBlocked={handleDragBlocked}
        onCreateStoryRequested={handleCreateStoryRequested}
        onDevStoryRequested={handleDevStoryRequested}
        onBasicTaskRequested={handleBasicTaskRequested}
      />
      <CreateTaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialStatus={dialogInitialStatus}
        initialSprintId={selectedSprintId}
      />
      <ImportStoriesDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        projectId={projectId}
        defaultPath={importDefaultPath}
        sprintId={selectedSprintId}
        onSuccess={(result) => {
          toast.success('Import completed', {
            description: `Imported ${result.storiesCreated} stories from ${result.epicsCreated} epics`
          })
        }}
      />
      {/* Story 5.3 - AC: 1: Create Story confirmation dialog */}
      {createStoryTask && (
        <CreateStoryConfirmDialog
          open={createStoryDialogOpen}
          onOpenChange={setCreateStoryDialogOpen}
          task={createStoryTask}
          onConfirm={handleCreateStoryConfirm}
        />
      )}
      {/* Story 5.3 - AC: 3: Dev Story confirmation dialog */}
      {devStoryTask && (
        <DevStoryConfirmDialog
          open={devStoryDialogOpen}
          onOpenChange={setDevStoryDialogOpen}
          task={devStoryTask}
          onConfirm={handleDevStoryConfirm}
        />
      )}
      {/* Story 5.3b - AC: 1: Basic Task confirmation dialog */}
      {basicTask && (
        <BasicTaskConfirmDialog
          open={basicTaskDialogOpen}
          onOpenChange={setBasicTaskDialogOpen}
          task={basicTask}
          onConfirm={handleBasicTaskConfirm}
        />
      )}
    </>
  )
}

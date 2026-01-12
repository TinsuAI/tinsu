import { useCallback, useRef, useState } from 'react'
import {
  DndContext,
  closestCorners,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
  type Announcements
} from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { cn } from '@renderer/lib/utils'
import { KanbanColumn, COLUMN_CONFIG } from './KanbanColumn'
import { TaskCard } from './TaskCard'
import { SortableTaskCard } from './SortableTaskCard'
import { PlanningTaskCard } from './PlanningTaskCard'
import { SortablePlanningTaskCard } from './SortablePlanningTaskCard'
import { StoryTaskCard } from './StoryTaskCard'
import { SortableStoryTaskCard } from './SortableStoryTaskCard'
import { TASK_STATUS, type TaskStatus, type Task, isPlanningTask, isStoryTask } from '@shared/types/task.types'
import { validateDragMove } from '@shared/utils/drag-validation'

interface KanbanBoardProps {
  tasks: Task[]
  /** Map of epic_id to epic name for display on cards */
  epicNames?: Record<string, string>
  /** Map of epic_id to epic color for badge styling */
  epicColors?: Record<string, string>
  isLoading?: boolean
  className?: string
  /** Story 2.6: Whether any filters are currently active */
  hasActiveFilters?: boolean
  /** Story 3.9: Set of task IDs currently syncing (AC: 5) */
  syncingTaskIds?: Set<string>
  /** Callback when task status changes via drag-drop */
  onStatusChange?: (taskId: string, newStatus: TaskStatus) => void
  /** Callback when task order changes within a column (receives new order of task IDs) */
  onReorder?: (taskIds: string[], status: TaskStatus) => void
  /** Callback when the add task button is clicked in a column */
  onAddTask?: (status: TaskStatus) => void
  /** Story 3.3: Callback when a planning task artifact should be opened */
  onOpenArtifact?: (artifactPath: string) => void
  /** Story 3.4: Callback when a planning task is dragged to In Progress */
  onPlanningTaskStart?: (taskId: string) => void
  /** Story 3.7: Callback when Import Stories button is clicked on phase 5 card */
  onImportStories?: (artifactPath: string) => void
  /** Story 3.7: Callback when phase 5 (Epics & Stories) planning task is moved to done */
  onPhase5Complete?: (artifactPath: string) => void
  /** Story 3.7: Callback when a story task card is clicked to view details */
  onStoryClick?: (taskId: string) => void
  /** Callback when a task is deleted */
  onDeleteTask?: (taskId: string) => void
  /** Story 5.2c: Callback when a drag operation is blocked due to validation */
  onDragBlocked?: (message: string) => void
  /** Story 5.3 - AC: 1: Callback when story task is dragged to create_story column (requires confirmation) */
  onCreateStoryRequested?: (task: Task) => void
  /** Story 5.3 - AC: 3: Callback when story_ready task is dragged to in_progress column (requires confirmation) */
  onDevStoryRequested?: (task: Task) => void
}

export function KanbanBoard({
  tasks,
  epicNames = {},
  epicColors = {},
  isLoading = false,
  className,
  hasActiveFilters = false,
  syncingTaskIds = new Set(),
  onStatusChange,
  onReorder,
  onAddTask,
  onOpenArtifact,
  onPlanningTaskStart,
  onImportStories,
  onPhase5Complete,
  onStoryClick,
  onDeleteTask,
  onDragBlocked,
  onCreateStoryRequested,
  onDevStoryRequested
}: KanbanBoardProps) {
  // Ref to store all card elements for keyboard navigation
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  // Track active drag item
  const [activeId, setActiveId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)

  // Configure sensors for drag detection
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8 // Prevent accidental drags
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  // Group tasks by status and sort by sort_order
  const tasksByStatus = TASK_STATUS.reduce(
    (acc, status) => {
      acc[status] = tasks
        .filter((task) => task.status === status)
        .sort((a, b) => a.sort_order - b.sort_order)
      return acc
    },
    {} as Record<TaskStatus, Task[]>
  )

  // Sort columns by order
  const sortedStatuses = [...TASK_STATUS].sort(
    (a, b) => COLUMN_CONFIG[a].order - COLUMN_CONFIG[b].order
  )

  // Build a flat list of task IDs organized by column for navigation
  const taskGrid = sortedStatuses.map((status) =>
    tasksByStatus[status].map((task) => task.id)
  )

  // Handle keyboard navigation between cards
  const handleNavigate = useCallback(
    (taskId: string, direction: 'up' | 'down' | 'left' | 'right') => {
      // Find current position in grid
      let colIndex = -1
      let rowIndex = -1

      for (let c = 0; c < taskGrid.length; c++) {
        const r = taskGrid[c].indexOf(taskId)
        if (r !== -1) {
          colIndex = c
          rowIndex = r
          break
        }
      }

      if (colIndex === -1) return

      let targetTaskId: string | undefined

      switch (direction) {
        case 'up':
          if (rowIndex > 0) {
            targetTaskId = taskGrid[colIndex][rowIndex - 1]
          }
          break
        case 'down':
          if (rowIndex < taskGrid[colIndex].length - 1) {
            targetTaskId = taskGrid[colIndex][rowIndex + 1]
          }
          break
        case 'left':
          // Move to previous column, same row or last row if shorter
          for (let c = colIndex - 1; c >= 0; c--) {
            if (taskGrid[c].length > 0) {
              const targetRow = Math.min(rowIndex, taskGrid[c].length - 1)
              targetTaskId = taskGrid[c][targetRow]
              break
            }
          }
          break
        case 'right':
          // Move to next column, same row or last row if shorter
          for (let c = colIndex + 1; c < taskGrid.length; c++) {
            if (taskGrid[c].length > 0) {
              const targetRow = Math.min(rowIndex, taskGrid[c].length - 1)
              targetTaskId = taskGrid[c][targetRow]
              break
            }
          }
          break
      }

      if (targetTaskId) {
        const targetElement = cardRefs.current.get(targetTaskId)
        targetElement?.focus()
      }
    },
    [taskGrid]
  )

  // Register card ref for keyboard navigation
  const registerCardRef = useCallback((taskId: string, element: HTMLDivElement | null) => {
    if (element) {
      cardRefs.current.set(taskId, element)
    } else {
      cardRefs.current.delete(taskId)
    }
  }, [])

  // Get the active task being dragged
  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null

  // Story 5.2c: Use shared validation utility for drag moves

  // Drag event handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }, [])

  const handleDragOver = useCallback((event: DragOverEvent) => {
    setOverId(event.over?.id as string | null)
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event

      setActiveId(null)
      setOverId(null)

      if (!over) return

      const taskId = active.id as string
      const overId = over.id as string

      // Find the task being dragged
      const task = tasks.find((t) => t.id === taskId)
      if (!task) return

      // Helper to process status change (shared logic)
      const processStatusChange = (targetStatus: TaskStatus) => {
        if (task.status === targetStatus) return // Same status, no change

        // Story 5.2c: Validate drag before allowing status change
        const blockMessage = validateDragMove(task, targetStatus)
        if (blockMessage) {
          onDragBlocked?.(blockMessage)
          return // Block the move
        }

        // Story 5.3 - AC: 1: Intercept story tasks dragged to create_story
        if (targetStatus === 'create_story' && isStoryTask(task) && onCreateStoryRequested) {
          onCreateStoryRequested(task)
          return // Let the callback handle the status change
        }

        // Story 5.3 - AC: 3: Intercept story_ready tasks dragged to in_progress
        if (
          targetStatus === 'in_progress' &&
          isStoryTask(task) &&
          task.story_file_status === 'story_ready' &&
          onDevStoryRequested
        ) {
          onDevStoryRequested(task)
          return // Let the callback handle the status change
        }

        // Default: Commit the status change immediately
        if (onStatusChange) {
          onStatusChange(taskId, targetStatus)
          // Story 3.4: Trigger agent launch when planning task moved to in_progress
          if (targetStatus === 'in_progress' && isPlanningTask(task) && onPlanningTaskStart) {
            onPlanningTaskStart(taskId)
          }
          // Story 3.7: Trigger import when phase 5 (Epics & Stories) is moved to done
          if (
            targetStatus === 'done' &&
            isPlanningTask(task) &&
            task.phase_number === 5 &&
            task.artifact_path &&
            onPhase5Complete
          ) {
            onPhase5Complete(task.artifact_path)
          }
        }
      }

      // Check if dropped on a column
      if (overId.startsWith('column-')) {
        const targetStatus = overId.replace('column-', '') as TaskStatus
        processStatusChange(targetStatus)
        return
      }

      // Check if dropped on another task (reordering or cross-column)
      const targetTask = tasks.find((t) => t.id === overId)
      if (targetTask) {
        // If different columns, update status
        if (task.status !== targetTask.status) {
          processStatusChange(targetTask.status)
        }
        // If same column, handle reorder
        else if (onReorder && taskId !== overId) {
          const tasksInColumn = tasksByStatus[task.status]
          const oldIndex = tasksInColumn.findIndex((t) => t.id === taskId)
          const newIndex = tasksInColumn.findIndex((t) => t.id === overId)

          if (oldIndex >= 0 && newIndex >= 0) {
            // Create new order by moving the task from oldIndex to newIndex
            const newOrder = [...tasksInColumn]
            const [movedTask] = newOrder.splice(oldIndex, 1)
            newOrder.splice(newIndex, 0, movedTask)

            // Pass the new order of task IDs
            onReorder(
              newOrder.map((t) => t.id),
              task.status
            )
          }
        }
      }
    },
    [tasks, tasksByStatus, onStatusChange, onReorder, onPlanningTaskStart, onPhase5Complete, onDragBlocked, onCreateStoryRequested, onDevStoryRequested]
  )

  const handleDragCancel = useCallback(() => {
    setActiveId(null)
    setOverId(null)
  }, [])

  // ARIA announcements for screen readers
  const announcements: Announcements = {
    onDragStart({ active }) {
      const task = tasks.find((t) => t.id === active.id)
      return `Picked up task "${task?.title}". Use arrow keys to move between columns.`
    },
    onDragOver({ active, over }) {
      const task = tasks.find((t) => t.id === active.id)
      if (!over) return `Task "${task?.title}" is no longer over a drop target.`

      const overId = over.id as string
      if (overId.startsWith('column-')) {
        const status = overId.replace('column-', '')
        const columnName = COLUMN_CONFIG[status as TaskStatus]?.title || status
        return `Task "${task?.title}" is over the ${columnName} column.`
      }

      const targetTask = tasks.find((t) => t.id === overId)
      if (targetTask) {
        const columnName = COLUMN_CONFIG[targetTask.status]?.title || targetTask.status
        return `Task "${task?.title}" is over task "${targetTask.title}" in ${columnName} column.`
      }

      return undefined
    },
    onDragEnd({ active, over }) {
      const task = tasks.find((t) => t.id === active.id)
      if (!over) return `Task "${task?.title}" was dropped outside a valid drop target.`

      const overId = over.id as string
      if (overId.startsWith('column-')) {
        const status = overId.replace('column-', '')
        const columnName = COLUMN_CONFIG[status as TaskStatus]?.title || status
        return `Task "${task?.title}" was dropped in the ${columnName} column.`
      }

      const targetTask = tasks.find((t) => t.id === overId)
      if (targetTask) {
        const columnName = COLUMN_CONFIG[targetTask.status]?.title || targetTask.status
        return `Task "${task?.title}" was dropped in the ${columnName} column.`
      }

      return `Task "${task?.title}" was dropped.`
    },
    onDragCancel({ active }) {
      const task = tasks.find((t) => t.id === active.id)
      return `Drag cancelled. Task "${task?.title}" was returned to its original position.`
    }
  }

  if (isLoading) {
    return (
      <div className={cn('flex flex-1 items-center justify-center', className)}>
        <p className="text-muted-foreground">Loading tasks...</p>
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
      accessibility={{ announcements }}
    >
      {/* Story 5.2b: Updated from grid-cols-4 to grid-cols-5 for Create Story column */}
      <div
        className={cn(
          'kanban-board-bg grid h-full min-h-0 flex-1 grid-cols-5 gap-5 overflow-hidden p-5',
          className
        )}
        data-testid="kanban-board"
      >
        {sortedStatuses.map((status) => {
          const columnTasks = tasksByStatus[status]
          const taskIds = columnTasks.map((t) => t.id)

          return (
            <KanbanColumn
              key={status}
              status={status}
              taskCount={columnTasks.length}
              isOver={overId === `column-${status}`}
              onAddTask={onAddTask}
            >
              <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
                {columnTasks.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground">
                    {hasActiveFilters ? 'No matching tasks' : 'No tasks'}
                  </p>
                ) : (
                  <div className="flex flex-col gap-3" data-testid="task-list">
                    {columnTasks.map((task) => (
                      <div key={task.id} ref={(el) => registerCardRef(task.id, el)}>
                        {isPlanningTask(task) ? (
                          <SortablePlanningTaskCard
                            task={task}
                            isStartHere={task.is_start_here ?? false}
                            isCompleted={task.status === 'done'}
                            artifactPath={task.artifact_path}
                            onNavigate={(direction) => handleNavigate(task.id, direction)}
                            onOpenArtifact={
                              task.artifact_path && onOpenArtifact
                                ? () => onOpenArtifact(task.artifact_path!)
                                : undefined
                            }
                            onImportStories={
                              onImportStories
                                ? () => onImportStories(task.artifact_path ?? '')
                                : undefined
                            }
                            onDelete={onDeleteTask ? () => onDeleteTask(task.id) : undefined}
                            isDragging={activeId === task.id}
                          />
                        ) : isStoryTask(task) ? (
                          <SortableStoryTaskCard
                            task={task}
                            epicName={task.epic_id ? epicNames[task.epic_id] : undefined}
                            epicColor={task.epic_id ? epicColors[task.epic_id] : undefined}
                            onNavigate={(direction) => handleNavigate(task.id, direction)}
                            onClick={onStoryClick ? () => onStoryClick(task.id) : undefined}
                            onStoryFileClick={onStoryClick ? () => onStoryClick(task.id) : undefined}
                            onDelete={onDeleteTask ? () => onDeleteTask(task.id) : undefined}
                            isDragging={activeId === task.id}
                            isSyncing={syncingTaskIds.has(task.id)}
                          />
                        ) : (
                          <SortableTaskCard
                            task={task}
                            epicName={task.epic_id ? epicNames[task.epic_id] : undefined}
                            epicColor={task.epic_id ? epicColors[task.epic_id] : undefined}
                            onNavigate={(direction) => handleNavigate(task.id, direction)}
                            onDelete={onDeleteTask ? () => onDeleteTask(task.id) : undefined}
                            isDragging={activeId === task.id}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </SortableContext>
            </KanbanColumn>
          )
        })}
      </div>

      {/* Drag Overlay - rendered in portal for proper z-index */}
      <DragOverlay>
        {activeTask && (
          <div className="kanban-card kanban-card-dragging rounded-xl p-3.5">
            {isPlanningTask(activeTask) ? (
              <PlanningTaskCard
                task={activeTask}
                isStartHere={activeTask.is_start_here ?? false}
                isCompleted={activeTask.status === 'done'}
                artifactPath={activeTask.artifact_path}
              />
            ) : isStoryTask(activeTask) ? (
              <StoryTaskCard
                task={activeTask}
                epicName={activeTask.epic_id ? epicNames[activeTask.epic_id] : undefined}
                epicColor={activeTask.epic_id ? epicColors[activeTask.epic_id] : undefined}
                isSyncing={syncingTaskIds.has(activeTask.id)}
              />
            ) : (
              <TaskCard
                task={activeTask}
                epicName={activeTask.epic_id ? epicNames[activeTask.epic_id] : undefined}
                epicColor={activeTask.epic_id ? epicColors[activeTask.epic_id] : undefined}
              />
            )}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

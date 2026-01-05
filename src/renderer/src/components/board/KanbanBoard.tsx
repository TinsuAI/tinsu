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
import { TASK_STATUS, type TaskStatus, type Task } from '@shared/types/task.types'

interface KanbanBoardProps {
  tasks: Task[]
  /** Map of epic_id to epic name for display on cards */
  epicNames?: Record<string, string>
  isLoading?: boolean
  className?: string
  /** Callback when task status changes via drag-drop */
  onStatusChange?: (taskId: string, newStatus: TaskStatus) => void
  /** Callback when task order changes within a column (receives new order of task IDs) */
  onReorder?: (taskIds: string[], status: TaskStatus) => void
}

export function KanbanBoard({
  tasks,
  epicNames = {},
  isLoading = false,
  className,
  onStatusChange,
  onReorder
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

      // Check if dropped on a column
      if (overId.startsWith('column-')) {
        const targetStatus = overId.replace('column-', '') as TaskStatus
        if (task.status !== targetStatus && onStatusChange) {
          onStatusChange(taskId, targetStatus)
        }
        return
      }

      // Check if dropped on another task (reordering or cross-column)
      const targetTask = tasks.find((t) => t.id === overId)
      if (targetTask) {
        // If different columns, update status
        if (task.status !== targetTask.status && onStatusChange) {
          onStatusChange(taskId, targetTask.status)
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
    [tasks, tasksByStatus, onStatusChange, onReorder]
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
      <div
        className={cn('grid flex-1 grid-cols-4 gap-4 p-4', className)}
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
            >
              <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
                {columnTasks.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground">No tasks</p>
                ) : (
                  <div className="flex flex-col gap-3" data-testid="task-list">
                    {columnTasks.map((task) => (
                      <div key={task.id} ref={(el) => registerCardRef(task.id, el)}>
                        <SortableTaskCard
                          task={task}
                          epicName={task.epic_id ? epicNames[task.epic_id] : undefined}
                          onNavigate={(direction) => handleNavigate(task.id, direction)}
                          isDragging={activeId === task.id}
                        />
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
          <div className="scale-[1.02] rotate-[2deg] rounded-lg border border-primary bg-card p-3 shadow-lg">
            <TaskCard
              task={activeTask}
              epicName={activeTask.epic_id ? epicNames[activeTask.epic_id] : undefined}
            />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

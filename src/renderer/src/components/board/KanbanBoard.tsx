import { useCallback, useRef } from 'react'
import { cn } from '@renderer/lib/utils'
import { KanbanColumn, COLUMN_CONFIG } from './KanbanColumn'
import { TaskCard } from './TaskCard'
import { TASK_STATUS, type TaskStatus, type Task } from '@shared/types/task.types'

interface KanbanBoardProps {
  tasks: Task[]
  /** Map of epic_id to epic name for display on cards */
  epicNames?: Record<string, string>
  isLoading?: boolean
  className?: string
}

export function KanbanBoard({
  tasks,
  epicNames = {},
  isLoading = false,
  className
}: KanbanBoardProps) {
  // Ref to store all card elements for keyboard navigation
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  // Group tasks by status
  const tasksByStatus = TASK_STATUS.reduce(
    (acc, status) => {
      acc[status] = tasks.filter((task) => task.status === status)
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

  if (isLoading) {
    return (
      <div className={cn('flex flex-1 items-center justify-center', className)}>
        <p className="text-muted-foreground">Loading tasks...</p>
      </div>
    )
  }

  return (
    <div
      className={cn('grid flex-1 grid-cols-4 gap-4 p-4', className)}
      data-testid="kanban-board"
    >
      {sortedStatuses.map((status) => (
        <KanbanColumn
          key={status}
          status={status}
          taskCount={tasksByStatus[status].length}
        >
          {tasksByStatus[status].length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">No tasks</p>
          ) : (
            <div className="flex flex-col gap-3" data-testid="task-list">
              {tasksByStatus[status].map((task) => (
                <div
                  key={task.id}
                  ref={(el) => registerCardRef(task.id, el)}
                >
                  <TaskCard
                    task={task}
                    epicName={task.epic_id ? epicNames[task.epic_id] : undefined}
                    onNavigate={(direction) => handleNavigate(task.id, direction)}
                  />
                </div>
              ))}
            </div>
          )}
        </KanbanColumn>
      ))}
    </div>
  )
}

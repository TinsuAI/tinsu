import { cn } from '@renderer/lib/utils'
import { KanbanColumn, COLUMN_CONFIG } from './KanbanColumn'
import { TASK_STATUS, type TaskStatus, type Task } from '@shared/types/task.types'

interface KanbanBoardProps {
  tasks: Task[]
  isLoading?: boolean
  className?: string
}

export function KanbanBoard({ tasks, isLoading = false, className }: KanbanBoardProps) {
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

  if (isLoading) {
    return (
      <div className={cn('flex flex-1 items-center justify-center', className)}>
        <p className="text-muted-foreground">Loading tasks...</p>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'grid flex-1 grid-cols-4 gap-4 p-4',
        className
      )}
      data-testid="kanban-board"
    >
      {sortedStatuses.map((status) => (
        <KanbanColumn
          key={status}
          status={status}
          taskCount={tasksByStatus[status].length}
        >
          {/* Task cards will be rendered here in Story 2.2 */}
          {tasksByStatus[status].length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">No tasks</p>
          ) : (
            <p className="text-center text-sm text-muted-foreground">
              {tasksByStatus[status].length} task{tasksByStatus[status].length !== 1 ? 's' : ''} (cards coming in 2.2)
            </p>
          )}
        </KanbanColumn>
      ))}
    </div>
  )
}

import { useDroppable } from '@dnd-kit/core'
import { Plus } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { Button } from '@renderer/components/ui/button'
import type { TaskStatus } from '@shared/types/task.types'

// Column configuration mapping status to display names
export const COLUMN_CONFIG: Record<TaskStatus, { title: string; order: number }> = {
  backlog: { title: 'Backlog', order: 1 },
  in_progress: { title: 'In Progress', order: 2 },
  review: { title: 'Review', order: 3 },
  done: { title: 'Done', order: 4 }
}

interface KanbanColumnProps {
  status: TaskStatus
  taskCount: number
  className?: string
  children?: React.ReactNode
  /** Whether a dragged item is currently over this column */
  isOver?: boolean
  /** Callback when the add task button is clicked */
  onAddTask?: (status: TaskStatus) => void
}

export function KanbanColumn({
  status,
  taskCount,
  className,
  children,
  isOver: isOverProp,
  onAddTask
}: KanbanColumnProps) {
  const config = COLUMN_CONFIG[status]

  // Set up droppable for the column
  const { setNodeRef, isOver: isOverDroppable } = useDroppable({
    id: `column-${status}`,
    data: { status }
  })

  // Use prop if provided, otherwise use hook state
  const isOver = isOverProp ?? isOverDroppable

  return (
    <div
      ref={setNodeRef}
      role="listbox"
      aria-label={`${config.title} column with ${taskCount} tasks`}
      data-status={status}
      className={cn(
        // Base column styling with depth
        'kanban-column flex min-h-0 flex-col rounded-xl',
        // Highlight when item is dragged over
        isOver && 'kanban-column-over',
        // Smooth transition
        'transition-all duration-200',
        className
      )}
      data-testid={`column-${status}`}
    >
      {/* Column header with glass effect */}
      <div className="kanban-column-header flex items-center justify-between rounded-t-xl px-4 py-3">
        <div className="flex items-center gap-2.5">
          <h2 className="text-sm font-semibold tracking-wide text-foreground/95">{config.title}</h2>
          <span
            className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white/10 px-1.5 text-[11px] font-medium tabular-nums text-muted-foreground"
            data-testid={`count-${status}`}
          >
            {taskCount}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="kanban-add-btn h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
          onClick={() => onAddTask?.(status)}
          aria-label={`Add task to ${config.title}`}
          data-testid={`add-task-${status}`}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Column content with vertical scroll */}
      <div className="kanban-scroll flex-1 overflow-y-auto p-3">{children}</div>
    </div>
  )
}

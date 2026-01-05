import { cn } from '@renderer/lib/utils'
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
}

export function KanbanColumn({ status, taskCount, className, children }: KanbanColumnProps) {
  const config = COLUMN_CONFIG[status]

  return (
    <div
      role="listbox"
      aria-label={`${config.title} column with ${taskCount} tasks`}
      className={cn(
        'flex flex-col rounded-lg bg-card',
        'border border-border',
        className
      )}
      data-testid={`column-${status}`}
    >
      {/* Column header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">{config.title}</h2>
        <span className="text-xs text-muted-foreground" data-testid={`count-${status}`}>
          {taskCount}
        </span>
      </div>

      {/* Column content with vertical scroll */}
      <div className="flex-1 overflow-y-auto p-4">
        {children}
      </div>
    </div>
  )
}

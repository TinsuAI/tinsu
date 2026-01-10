import { useCallback, type KeyboardEvent, type MouseEvent } from 'react'
import { Trash2 } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { AgentStatusBadge, type AgentStatus } from '@renderer/components/ui/AgentStatusBadge'
import { EpicBadge } from '@renderer/components/task/EpicBadge'
import type { Task } from '@shared/types/task.types'

export interface TaskCardProps {
  task: Task
  /** Epic name to display as a badge */
  epicName?: string
  /** Epic color for the badge styling */
  epicColor?: string
  /** Agent status for the status badge (defaults to 'idle') */
  agentStatus?: AgentStatus
  /** Callback for keyboard navigation - called with direction */
  onNavigate?: (direction: 'up' | 'down' | 'left' | 'right') => void
  /** Callback when delete button is clicked */
  onDelete?: () => void
  className?: string
}

export function TaskCard({
  task,
  epicName,
  epicColor = 'blue',
  agentStatus = 'idle',
  onNavigate,
  onDelete,
  className
}: TaskCardProps) {
  const handleDeleteClick = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation()
      onDelete?.()
    },
    [onDelete]
  )

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (!onNavigate) return

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault()
          onNavigate('up')
          break
        case 'ArrowDown':
          e.preventDefault()
          onNavigate('down')
          break
        case 'ArrowLeft':
          e.preventDefault()
          onNavigate('left')
          break
        case 'ArrowRight':
          e.preventDefault()
          onNavigate('right')
          break
      }
    },
    [onNavigate]
  )

  return (
    <div
      role="option"
      tabIndex={0}
      aria-label={`Task: ${task.title}${epicName ? `, Epic: ${epicName}` : ''}`}
      onKeyDown={handleKeyDown}
      className={cn(
        // Base card styling with depth
        'kanban-card group rounded-xl p-3.5',
        // Focus states for keyboard navigation
        'focus-visible:outline-none',
        // Cursor
        'cursor-pointer',
        className
      )}
      data-testid={`task-card-${task.id}`}
    >
      {/* Header row with title, status badge, and delete button */}
      <div className="flex items-start justify-between gap-2">
        {/* Task title - prominent */}
        <h3 className="flex-1 text-sm font-medium text-foreground">{task.title}</h3>

        <div className="flex shrink-0 items-center gap-1">
          {/* Delete button - visible on hover */}
          {onDelete && (
            <button
              type="button"
              onClick={handleDeleteClick}
              className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
              aria-label={`Delete task: ${task.title}`}
              data-testid="task-delete-button"
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
          {/* Agent status badge */}
          <AgentStatusBadge status={agentStatus} className="shrink-0" />
        </div>
      </div>

      {/* Task description - truncated to 2 lines */}
      {task.description && (
        <p
          className="mt-1 line-clamp-2 text-xs text-muted-foreground"
          data-testid="task-description"
        >
          {task.description}
        </p>
      )}

      {/* Epic badge - colored indicator */}
      {epicName && (
        <div className="mt-2" data-testid="task-epic-label">
          <EpicBadge title={epicName} color={epicColor} />
        </div>
      )}
    </div>
  )
}

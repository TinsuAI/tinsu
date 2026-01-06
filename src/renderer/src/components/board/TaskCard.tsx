import { useCallback, type KeyboardEvent } from 'react'
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
  className?: string
}

export function TaskCard({
  task,
  epicName,
  epicColor = 'blue',
  agentStatus = 'idle',
  onNavigate,
  className
}: TaskCardProps) {
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
        // Base card styling
        'rounded-lg border border-border bg-card p-3',
        // Hover states
        'hover:border-primary/50 hover:bg-card/80',
        // Focus states for keyboard navigation
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        // Cursor
        'cursor-pointer',
        // Transition for smooth hover effect
        'transition-colors',
        className
      )}
      data-testid={`task-card-${task.id}`}
    >
      {/* Header row with title and status badge */}
      <div className="flex items-start justify-between gap-2">
        {/* Task title - prominent */}
        <h3 className="text-sm font-medium text-foreground">{task.title}</h3>

        {/* Agent status badge */}
        <AgentStatusBadge status={agentStatus} className="shrink-0" />
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

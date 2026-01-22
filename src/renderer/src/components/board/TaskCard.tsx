import { useCallback, type KeyboardEvent, type MouseEvent } from 'react'
import { Trash2, BookOpen, Zap, AlertTriangle } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { AgentStatusBadge, type AgentStatus } from '@renderer/components/ui/AgentStatusBadge'
import { StoryFileStatusBadge } from '@renderer/components/ui/StoryFileStatusBadge'
import { EpicBadge } from '@renderer/components/task/EpicBadge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@renderer/components/ui/tooltip'
import type { Task } from '@shared/types/task.types'
import type { StoryFileStatus } from '@shared/types/story-file-status.types'

/** Helper to check if task has merge conflicts (Story 8.7) */
function hasConflicts(task: Task): boolean {
  return task.has_merge_conflict === 1
}

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
  /** Callback when card is clicked */
  onClick?: () => void
  /** Whether this card is selected */
  isSelected?: boolean
  className?: string
}

export function TaskCard({
  task,
  epicName,
  epicColor = 'blue',
  agentStatus = 'idle',
  onNavigate,
  onDelete,
  onClick,
  isSelected,
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
        case 'Enter':
        case ' ':
          if (onClick) {
            e.preventDefault()
            onClick()
          }
          break
      }
    },
    [onNavigate, onClick]
  )

  return (
    <div
      role="option"
      tabIndex={0}
      aria-selected={isSelected}
      aria-label={`Task: ${task.title}${epicName ? `, Epic: ${epicName}` : ''}`}
      onKeyDown={handleKeyDown}
      onClick={onClick}
      className={cn(
        // Base card styling with depth
        'kanban-card group rounded-xl p-3.5',
        // Focus states for keyboard navigation
        'focus-visible:outline-none',
        // Cursor
        'cursor-pointer',
        // Selected state
        isSelected && 'ring-2 ring-cyan-500/60 ring-offset-1 ring-offset-background',
        className
      )}
      data-testid={`task-card-${task.id}`}
    >
      {/* Header row with title, status badge, and delete button */}
      <div className="flex items-start justify-between gap-2">
        {/* Story 5.2c: Task type indicator for story tasks */}
        {task.task_type === 'story' && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                {task.story_number !== null ? (
                  <BookOpen
                    className="mt-0.5 size-3.5 shrink-0 text-blue-400"
                    data-testid="task-type-imported"
                  />
                ) : (
                  <Zap
                    className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                    data-testid="task-type-basic"
                  />
                )}
              </TooltipTrigger>
              <TooltipContent>
                <p>{task.story_number !== null ? 'Imported Story' : 'Basic Task'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

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

      {/* Task description - first paragraph (story goal) */}
      {task.description && (
        <p
          className="mt-1 text-xs text-muted-foreground"
          data-testid="task-description"
        >
          {task.description.split('\n\n')[0].replace(/\n/g, ' ')}
        </p>
      )}

      {/* Epic badge - colored indicator */}
      {epicName && (
        <div className="mt-2" data-testid="task-epic-label">
          <EpicBadge title={epicName} color={epicColor} />
        </div>
      )}

      {/* Story 5.2c: Story file status badge for imported story tasks */}
      {task.story_file_status && (
        <div className="mt-2" data-testid="task-story-file-status">
          <StoryFileStatusBadge
            status={task.story_file_status as StoryFileStatus}
            storyFilePath={task.story_file_path}
          />
        </div>
      )}

      {/* Story 8.7: Merge conflict indicator */}
      {hasConflicts(task) && (
        <div className="mt-2" data-testid="task-conflict-indicator">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/15 border border-amber-600/30 px-2 py-1 text-xs font-medium text-amber-400">
                  <AlertTriangle className="h-3 w-3 animate-pulse" />
                  <span>Merge Conflict</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>This task has merge conflicts. Click to view details.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}
    </div>
  )
}

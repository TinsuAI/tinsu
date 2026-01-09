import { useCallback, type KeyboardEvent, type MouseEvent } from 'react'
import { BookOpen, Trash2 } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { EpicBadge } from '@renderer/components/task/EpicBadge'
import type { StoryTask } from '@shared/types/task.types'

export interface StoryTaskCardProps {
  task: StoryTask
  /** Epic name to display as a badge */
  epicName?: string
  /** Epic color for the badge styling */
  epicColor?: string
  /** Callback for keyboard navigation - called with direction */
  onNavigate?: (direction: 'up' | 'down' | 'left' | 'right') => void
  /** Callback when the card is clicked */
  onClick?: () => void
  /** Story 3.9: Whether this task is currently syncing with its story file */
  isSyncing?: boolean
  /** Callback when delete button is clicked */
  onDelete?: () => void
  className?: string
}

/**
 * Card component for story tasks imported from epics.md.
 *
 * Features distinct visual styling from planning tasks:
 * - Cyan left border to indicate story type
 * - Story icon indicator
 * - Displays epic badge when available
 *
 * Story 3.7: Story Import After Epics Phase (AC: 2, 4)
 */
export function StoryTaskCard({
  task,
  epicName,
  epicColor = 'blue',
  onNavigate,
  onClick,
  isSyncing = false,
  onDelete,
  className
}: StoryTaskCardProps) {
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

  // Build aria-label with sync status
  const ariaLabel = [
    `Story: ${task.title}`,
    epicName ? `Epic: ${epicName}` : null,
    isSyncing ? 'Syncing' : null
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <div
      role="option"
      tabIndex={isSyncing ? -1 : 0}
      aria-label={ariaLabel}
      aria-busy={isSyncing}
      onKeyDown={handleKeyDown}
      onClick={isSyncing ? undefined : onClick}
      className={cn(
        // Base card styling
        'group rounded-lg border border-border bg-card p-3',
        // Story-specific styling: cyan left border
        'border-l-2 border-l-cyan-500',
        // Hover states
        'hover:border-primary/50 hover:bg-card/80',
        // Focus states for keyboard navigation
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        // Cursor
        'cursor-pointer',
        // Transition for smooth hover effect
        'transition-colors',
        // Story 3.9: Sync state styling
        isSyncing && 'pointer-events-none opacity-70',
        className
      )}
      data-testid={`story-task-card-${task.id}`}
    >
      {/* Header row with title, story indicator, and delete button */}
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
              aria-label={`Delete story: ${task.title}`}
              data-testid="story-delete-button"
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
          {/* Story indicator icon */}
          <div
            className="flex size-5 items-center justify-center rounded bg-cyan-500/10"
            data-testid="story-indicator"
            title="Story"
          >
            <BookOpen className="size-3 text-cyan-500" aria-hidden="true" />
          </div>
        </div>
      </div>

      {/* Task description - truncated to 2 lines */}
      {task.description && (
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground" data-testid="task-description">
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

import { useCallback, type KeyboardEvent } from 'react'
import { BookOpen } from 'lucide-react'
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
  className
}: StoryTaskCardProps) {
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
      aria-label={`Story: ${task.title}${epicName ? `, Epic: ${epicName}` : ''}`}
      onKeyDown={handleKeyDown}
      onClick={onClick}
      className={cn(
        // Base card styling
        'rounded-lg border border-border bg-card p-3',
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
        className
      )}
      data-testid={`story-task-card-${task.id}`}
    >
      {/* Header row with title and story indicator */}
      <div className="flex items-start justify-between gap-2">
        {/* Task title - prominent */}
        <h3 className="text-sm font-medium text-foreground">{task.title}</h3>

        {/* Story indicator icon */}
        <div
          className="flex size-5 shrink-0 items-center justify-center rounded bg-cyan-500/10"
          data-testid="story-indicator"
          title="Story"
        >
          <BookOpen className="size-3 text-cyan-500" aria-hidden="true" />
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

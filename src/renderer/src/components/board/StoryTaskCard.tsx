import { useCallback, type KeyboardEvent, type MouseEvent } from 'react'
import { BookOpen, Loader2, Trash2, Zap } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { EpicBadge } from '@renderer/components/task/EpicBadge'
import { StoryFileStatusBadge } from '@renderer/components/ui/StoryFileStatusBadge'
import { DevProgressIndicator, type ProgressStep } from '@renderer/components/agent/DevProgressIndicator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@renderer/components/ui/tooltip'
import type { StoryTask } from '@shared/types/task.types'
import type { StoryFileStatus } from '@shared/types/story-file-status.types'

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
  /** Story 5.2c: Callback when story file path link is clicked */
  onStoryFileClick?: () => void
  /** Story 5.5: Whether an agent is currently running for this task */
  isAgentRunning?: boolean
  /** Story 5.5: Current step in the DEV agent workflow */
  agentProgressStep?: ProgressStep
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
  onStoryFileClick,
  isAgentRunning = false,
  agentProgressStep,
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
        // Base card styling with depth
        'kanban-card kanban-card-story group relative rounded-xl p-3.5',
        // Focus states for keyboard navigation
        'focus-visible:outline-none',
        // Cursor
        'cursor-pointer',
        // Story 3.9: Sync state styling
        isSyncing && 'pointer-events-none opacity-70',
        className
      )}
      data-testid={`story-task-card-${task.id}`}
    >
      {/* Story 3.9: Sync indicator when syncing */}
      {isSyncing && (
        <div
          className="absolute right-2 top-2 flex items-center gap-1 rounded bg-muted/80 px-1.5 py-0.5 text-xs text-muted-foreground"
          data-testid="sync-indicator"
        >
          <Loader2 className="size-3 animate-spin" />
          <span>Syncing</span>
        </div>
      )}

      {/* Header row with title, story indicator, and delete button */}
      <div className="flex items-start justify-between gap-2">
        {/* Story 5.2c: Task type indicator */}
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

      {/* Task description - first paragraph (story goal) */}
      {task.description && (
        <p className="mt-1 text-xs text-muted-foreground" data-testid="task-description">
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
            onPathClick={onStoryFileClick}
          />
        </div>
      )}

      {/* Story 5.5: DEV agent progress indicator */}
      {isAgentRunning && task.status === 'in_progress' && (
        <div className="mt-2" data-testid="task-dev-progress">
          <DevProgressIndicator currentStep={agentProgressStep ?? 'dev'} />
        </div>
      )}

      {/* Story 5.5: Ready for review summary (when task is in review status) */}
      {task.status === 'review' && !isAgentRunning && (
        <div className="mt-2" data-testid="task-review-summary">
          <DevProgressIndicator currentStep="review" showSummary />
        </div>
      )}
    </div>
  )
}

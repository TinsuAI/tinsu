/**
 * MobileTaskCard — leaf card component for the mobile kanban board.
 *
 * Terminal-glass aesthetic: frosted card surface with monospace metadata,
 * task-type pill with token-based colors, 2-line clamped title.
 *
 * Token contract: bg-card/95 backdrop-blur-xl surface. No inline color classes.
 * Touch target: min-h-[5.5rem] (88 px — well above 44 px minimum).
 *
 * @param task        The Task entity to display.
 * @param onPress     Short-tap handler (fired when not a drag initiation).
 * @param isDragging  When true, card renders at reduced opacity (ghost state).
 *
 * @example
 * <MobileTaskCard task={task} onPress={() => nav.push('workspace:' + task.id)} />
 */

import { cn } from '@renderer/lib/utils'
import type { Task } from '@shared/types/task.types'
import { isBasicTask } from '@shared/types/task.types'

interface MobileTaskCardProps {
  task: Task
  onPress?: () => void
  isDragging?: boolean
}

type PillConfig = {
  label: string
  className: string
}

function getTypePill(task: Task): PillConfig {
  // Use task_type for planning (any planning-type task shows Plan pill)
  if (task.task_type === 'planning') {
    return {
      label: 'Plan',
      className: 'bg-primary/10 text-primary',
    }
  }
  // Basic task: story_number === null (manually created, no BMAD story file)
  if (isBasicTask(task)) {
    return {
      label: 'Task',
      className: 'bg-muted/40 text-muted-foreground',
    }
  }
  // Imported story task: task_type === 'story' && story_number !== null
  return {
    label: 'Story',
    className: 'bg-primary/15 text-primary',
  }
}

function formatDate(date: Date): string {
  try {
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return ''
  }
}

export function MobileTaskCard({ task, onPress, isDragging = false }: MobileTaskCardProps) {
  const pill = getTypePill(task)

  return (
    <button
      type="button"
      data-testid={`mobile-task-card-${task.id}`}
      onClick={onPress}
      className={cn(
        // Base layout
        'w-full text-left',
        'min-h-[5.5rem] rounded-xl',
        'border border-border/40',
        'bg-card/95 backdrop-blur-xl',
        'p-3 flex flex-col gap-2',
        // Interactive states
        'transition-opacity duration-150',
        'active:opacity-70',
        // Drag ghost state
        isDragging && 'opacity-50',
      )}
      aria-label={task.title}
    >
      {/* Top row: type pill */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span
          className={cn(
            'text-xs rounded-full px-2 py-0.5 font-medium leading-none shrink-0',
            pill.className,
          )}
          data-testid={`mobile-task-card-pill-${task.id}`}
        >
          {pill.label}
        </span>
      </div>

      {/* Title row — 2-line clamp */}
      <p
        className="text-sm font-medium text-foreground line-clamp-2 leading-snug"
        data-testid={`mobile-task-card-title-${task.id}`}
      >
        {task.title}
      </p>

      {/* Metadata row — monospace date */}
      <p className="text-xs text-muted-foreground font-mono mt-auto leading-none">
        {formatDate(task.updated_at)}
      </p>
    </button>
  )
}

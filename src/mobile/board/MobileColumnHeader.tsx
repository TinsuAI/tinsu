/**
 * MobileColumnHeader — header row inside each kanban column pager slide.
 *
 * Shows column title, task count badge, and an add-task button.
 * For create_story column: renders the FileText icon inline.
 *
 * Token contract: text-foreground title, bg-muted/40 count badge,
 * text-primary add-task button. No inline color classes.
 *
 * Touch targets: Plus button is min-h-[2.75rem] min-w-[2.75rem] (44 px).
 *
 * @param status     TaskStatus — drives title via COLUMN_CONFIG.
 * @param count      Number of tasks in this column.
 * @param onAddTask  Called when plus button is pressed.
 *
 * @example
 * <MobileColumnHeader status="in_progress" count={3} onAddTask={openSheet} />
 */

import { FileText, Plus } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { COLUMN_CONFIG } from '@renderer/components/board/KanbanColumn'
import type { TaskStatus } from '@shared/types/task.types'

interface MobileColumnHeaderProps {
  status: TaskStatus
  count: number
  onAddTask: () => void
}

export function MobileColumnHeader({ status, count, onAddTask }: MobileColumnHeaderProps) {
  const config = COLUMN_CONFIG[status]
  const title = config.title
  const isCreateStory = status === 'create_story'

  return (
    <div
      className="flex items-center gap-2 px-3 py-2"
      data-testid={`mobile-column-header-${status}`}
    >
      {/* Title + create-story icon */}
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        {isCreateStory && (
          <FileText
            className="h-3.5 w-3.5 text-muted-foreground shrink-0"
            aria-hidden
            data-testid="mobile-column-header-file-text-icon"
          />
        )}
        <span
          className="text-xs font-semibold text-foreground uppercase tracking-wide truncate"
          data-testid={`mobile-column-header-title-${status}`}
        >
          {title}
        </span>
        <span
          className={cn(
            'bg-muted/40 text-xs text-muted-foreground',
            'rounded-full px-2 py-0.5',
            'font-mono leading-none shrink-0',
          )}
          data-testid={`mobile-column-header-count-${status}`}
        >
          {count}
        </span>
      </div>

      {/* Add task button — 44×44 touch target */}
      <button
        type="button"
        aria-label={`Add task to ${title}`}
        data-testid={`mobile-column-header-add-${status}`}
        onClick={onAddTask}
        className={cn(
          'flex items-center justify-center rounded-lg shrink-0',
          'min-h-[2.75rem] min-w-[2.75rem]',
          'text-muted-foreground',
          'transition-colors duration-150',
          'hover:text-primary active:opacity-60',
        )}
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  )
}

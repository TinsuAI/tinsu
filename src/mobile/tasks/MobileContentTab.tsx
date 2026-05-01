/**
 * MobileContentTab — Content sub-tab for the mobile task workspace.
 *
 * Displays task title, status badge, markdown description, and an optional
 * collapsible Story File section when task.story_number is set.
 *
 * Token contract: text-foreground, text-muted-foreground, bg-muted/40.
 * No inline color classes (AC 20).
 *
 * Cross-tree imports allowed (AC 16):
 *   - @renderer/components/ui/badge (status pill)
 *   - @renderer/components/task/MarkdownComponents (markdownComponents)
 *   - @renderer/lib/utils (cn)
 *
 * Read-only in v1 (AC 6f). Edit is deferred to a future story.
 *
 * @see Story T3.5-4
 */

import { cn } from '@renderer/lib/utils'
import { Badge } from '@renderer/components/ui/badge'
import { markdownComponents } from '@renderer/components/task/MarkdownComponents'
import { MobileLoadingSkeleton } from '../primitives/MobileLoadingSkeleton'
import type { Task } from '@shared/types/task.types'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// Status label mapping aligned with desktop conventions
const STATUS_LABELS: Record<string, string> = {
  backlog:      'Backlog',
  create_story: 'Create Story',
  in_progress:  'In Progress',
  review:       'Review',
  done:         'Done',
}

interface MobileContentTabProps {
  task: Task | null | undefined
}

export function MobileContentTab({ task }: MobileContentTabProps) {
  if (!task) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <MobileLoadingSkeleton variant="card" />
        <MobileLoadingSkeleton variant="card" />
      </div>
    )
  }

  const statusLabel = STATUS_LABELS[task.status] ?? task.status
  const hasStoryFile = task.story_number != null && task.full_content

  return (
    <div
      className={cn('flex flex-col gap-4 p-4 pb-6')}
      data-testid="mobile-content-tab"
    >
      {/* Title */}
      <h2 className="text-lg font-semibold text-foreground leading-snug">
        {task.title || `Task #${task.id.slice(0, 6)}`}
      </h2>

      {/* Status badge */}
      <div className="flex items-center gap-2" data-testid="mobile-content-tab-status">
        <Badge variant="secondary">
          {statusLabel}
        </Badge>
      </div>

      {/* Markdown description */}
      {task.description ? (
        <div
          className="prose prose-sm max-w-none text-foreground"
          data-testid="mobile-content-tab-description"
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {task.description}
          </ReactMarkdown>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground italic">No description provided.</p>
      )}

      {/* Collapsible Story File section (AC 6d) */}
      {hasStoryFile && (
        <details className="group" data-testid="mobile-content-tab-story-file">
          <summary
            className={cn(
              'flex items-center gap-2 cursor-pointer',
              'text-sm font-medium text-foreground',
              'py-2 select-none',
              'list-none',
            )}
          >
            <span className="transition-transform duration-150 group-open:rotate-90">▶</span>
            Story File
          </summary>
          <div className="prose prose-sm max-w-none text-foreground mt-2">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {task.full_content!}
            </ReactMarkdown>
          </div>
        </details>
      )}
    </div>
  )
}

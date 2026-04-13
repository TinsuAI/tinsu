import { useState } from 'react'
import { MessageSquare, Trash2, Plus } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'
import type { InlineComment } from '@shared/types/task.types'
import { InlineCommentInput } from './InlineCommentInput'

/**
 * InlineCommentThread component for displaying expanded comment threads (Story 7.5).
 *
 * Renders all comments for a specific file:line as a list with:
 * - Each comment with content and delete button
 * - "Add Reply" button to add more comments
 * - Animation for expand/collapse transitions
 *
 * @example
 * ```tsx
 * <InlineCommentThread
 *   comments={commentsForLine}
 *   lineNumber={42}
 *   filePath="src/App.tsx"
 *   onAddComment={(content) => addComment(content)}
 *   onDeleteComment={(id) => removeComment(id)}
 *   isExpanded={true}
 * />
 * ```
 */
export interface InlineCommentThreadProps {
  /** Array of comments for this line */
  comments: InlineComment[]
  /** Line number where the thread is located */
  lineNumber: number
  /** File path where the thread is located */
  filePath: string
  /** Callback to add a new comment to the thread */
  onAddComment: (content: string) => void
  /** Callback to delete a comment by ID */
  onDeleteComment: (commentId: string) => void
  /** Whether the thread is expanded */
  isExpanded: boolean
  /** Additional CSS classes */
  className?: string
}

export function InlineCommentThread({
  comments,
  lineNumber,
  filePath,
  onAddComment,
  onDeleteComment,
  isExpanded,
  className
}: InlineCommentThreadProps) {
  const [isAddingReply, setIsAddingReply] = useState(false)

  const handleAddReply = (content: string) => {
    onAddComment(content)
    setIsAddingReply(false)
  }

  if (!isExpanded) {
    return null
  }

  return (
    <div
      className={cn(
        'border-l-2 border-amber-500/40 bg-amber-500/5 pl-3 py-2',
        'animate-in slide-in-from-top-2 duration-200',
        className
      )}
      data-testid="inline-comment-thread"
    >
      {/* Thread header */}
      <div className="flex items-center gap-2 mb-2 text-xs text-amber-300/80">
        <MessageSquare className="h-3 w-3" />
        <span>
          {comments.length} comment{comments.length !== 1 ? 's' : ''} on line{' '}
          {lineNumber}
        </span>
      </div>

      {/* Comment list */}
      <div className="flex flex-col gap-2">
        {comments.map((comment) => (
          <div
            key={comment.id}
            className={cn(
              'flex items-start gap-2 rounded bg-background/50 p-2',
              'border border-border/30'
            )}
            data-testid={`comment-item-${comment.id}`}
          >
            {/* Comment content */}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground break-words">
                {comment.content}
              </p>
              <span className="text-[10px] text-muted-foreground/60">
                {formatRelativeTime(comment.createdAt)}
              </span>
            </div>

            {/* Delete button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDeleteComment(comment.id)}
              className="h-6 w-6 p-0 text-muted-foreground/50 hover:text-red-400 hover:bg-red-500/10"
              title="Delete comment"
              data-testid={`delete-comment-${comment.id}`}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>

      {/* Add reply section */}
      {isAddingReply ? (
        <div className="mt-2">
          <InlineCommentInput
            lineNumber={lineNumber}
            filePath={filePath}
            onSubmit={handleAddReply}
            onCancel={() => setIsAddingReply(false)}
          />
        </div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsAddingReply(true)}
          className="mt-2 h-7 gap-1 text-xs text-amber-400 hover:bg-amber-500/10"
          data-testid="add-reply-button"
        >
          <Plus className="h-3 w-3" />
          Add Reply
        </Button>
      )}
    </div>
  )
}

/**
 * Format a Unix timestamp as a relative time string.
 */
function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp

  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) {
    return `${days}d ago`
  }
  if (hours > 0) {
    return `${hours}h ago`
  }
  if (minutes > 0) {
    return `${minutes}m ago`
  }
  return 'just now'
}

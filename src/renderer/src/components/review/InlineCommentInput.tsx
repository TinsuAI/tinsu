import { useState, useRef, useEffect, useCallback } from 'react'
import { MessageSquare, X } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'

/**
 * InlineCommentInput component for adding inline review comments (Story 7.5).
 *
 * Appears at the clicked line position in the diff viewer.
 * Features:
 * - Compact text input with amber/yellow accent color
 * - Auto-focus on render
 * - Submit on Enter key
 * - Cancel on Escape key
 * - Submit and Cancel buttons
 *
 * @example
 * ```tsx
 * <InlineCommentInput
 *   lineNumber={42}
 *   filePath="src/App.tsx"
 *   onSubmit={(content) => addComment(content)}
 *   onCancel={() => setActiveInput(null)}
 * />
 * ```
 */
export interface InlineCommentInputProps {
  /** Line number where the comment is being added (for display) */
  lineNumber: number
  /** File path where the comment is being added (for display) */
  filePath: string
  /** Callback when comment is submitted */
  onSubmit: (content: string) => void
  /** Callback when input is cancelled */
  onCancel: () => void
  /** Additional CSS classes */
  className?: string
}

export function InlineCommentInput({
  lineNumber,
  filePath,
  onSubmit,
  onCancel,
  className
}: InlineCommentInputProps) {
  const [content, setContent] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Auto-focus on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = useCallback(() => {
    const trimmedContent = content.trim()
    if (trimmedContent) {
      onSubmit(trimmedContent)
    }
  }, [content, onSubmit])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSubmit()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
      }
    },
    [handleSubmit, onCancel]
  )

  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2',
        'shadow-lg shadow-amber-500/10',
        className
      )}
      data-testid="inline-comment-input"
    >
      {/* Header with context info */}
      <div className="flex items-center gap-2 text-xs text-amber-300/80">
        <MessageSquare className="h-3 w-3" />
        <span>
          Comment on line {lineNumber}
        </span>
      </div>

      {/* Text input */}
      <textarea
        ref={inputRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Add a comment..."
        className={cn(
          'w-full resize-none rounded border border-amber-500/30 bg-background/80 px-2 py-1.5',
          'text-sm text-foreground placeholder:text-muted-foreground/50',
          'focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500/50',
          'min-h-[60px]'
        )}
        data-testid="inline-comment-textarea"
      />

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="h-7 px-2 text-xs text-muted-foreground hover:bg-muted/50"
          data-testid="inline-comment-cancel"
        >
          <X className="mr-1 h-3 w-3" />
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!content.trim()}
          className={cn(
            'h-7 px-2 text-xs',
            'bg-amber-600 text-white hover:bg-amber-700',
            'disabled:bg-amber-600/50 disabled:text-white/50'
          )}
          data-testid="inline-comment-submit"
        >
          Add Comment
        </Button>
      </div>

      {/* Keyboard hints */}
      <div className="text-[10px] text-muted-foreground/50">
        Press <kbd className="rounded bg-muted/30 px-1">Enter</kbd> to submit,{' '}
        <kbd className="rounded bg-muted/30 px-1">Esc</kbd> to cancel
      </div>
    </div>
  )
}

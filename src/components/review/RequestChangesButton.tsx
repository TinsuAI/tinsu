import { Loader2, MessageSquare } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@renderer/components/ui/tooltip'

/**
 * RequestChangesButton component for the 60-Second Velocity Loop (Story 7.5).
 *
 * Styled with amber/yellow color per UX spec. Shows keyboard shortcut "C".
 * Displays loading spinner during request mutation.
 * Shows comment count badge when comments exist.
 * Disabled when no inline comments exist.
 *
 * @example
 * ```tsx
 * <RequestChangesButton
 *   onClick={handleRequestChanges}
 *   isPending={isPending}
 *   commentCount={inlineComments.length}
 *   disabled={task.status !== 'review'}
 * />
 * ```
 */
export interface RequestChangesButtonProps {
  /** Click handler for the request changes action */
  onClick: () => void
  /** Whether the request is in progress */
  isPending?: boolean
  /** Number of inline comments (button disabled if 0) */
  commentCount: number
  /** Whether the button is disabled (e.g., task not in review) */
  disabled?: boolean
  /** Additional CSS classes */
  className?: string
}

export function RequestChangesButton({
  onClick,
  isPending = false,
  commentCount,
  disabled = false,
  className
}: RequestChangesButtonProps) {
  const hasComments = commentCount > 0
  const isDisabled = disabled || isPending || !hasComments

  const button = (
    <Button
      onClick={onClick}
      disabled={isDisabled}
      className={cn(
        'gap-2 text-white',
        // Normal state: amber
        hasComments && 'bg-amber-600 hover:bg-amber-700',
        // No comments state: muted amber
        !hasComments && 'bg-amber-600/50 text-white/70 cursor-not-allowed',
        // Disabled state
        disabled && hasComments && 'bg-amber-600/50 text-white/70',
        className
      )}
      size="sm"
      data-testid="request-changes-button"
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <MessageSquare className="h-4 w-4" />
      )}
      Request Changes
      {hasComments && (
        <span
          className="ml-1 rounded-full bg-amber-700/50 px-1.5 text-[10px]"
          data-testid="comment-count"
        >
          {commentCount}
        </span>
      )}
      <kbd className="ml-1 rounded bg-amber-700/50 px-1.5 py-0.5 text-[10px] font-medium">
        C
      </kbd>
    </Button>
  )

  // Wrap in tooltip when disabled due to no comments
  if (!hasComments && !disabled) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent side="bottom">
            <p className="text-xs">Add inline comments first</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return button
}

import { MessageSquare, ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@renderer/components/ui/tooltip'

/**
 * InlineCommentIndicator component for showing comment markers in the gutter (Story 7.5).
 *
 * Displays:
 * - Yellow/amber comment icon in the gutter for lines with comments
 * - Comment count badge if multiple comments on same line
 * - Preview of first comment in tooltip on hover
 * - Expand/collapse chevron for thread visibility
 *
 * @example
 * ```tsx
 * <InlineCommentIndicator
 *   commentCount={3}
 *   firstCommentPreview="This function should handle null case"
 *   isExpanded={true}
 *   onClick={() => toggleThread(filePath, lineNumber)}
 * />
 * ```
 */
export interface InlineCommentIndicatorProps {
  /** Number of comments on this line */
  commentCount: number
  /** Preview text of the first comment (for tooltip) */
  firstCommentPreview?: string
  /** Whether the comment thread is expanded */
  isExpanded: boolean
  /** Click handler to toggle expand/collapse */
  onClick: () => void
  /** Additional CSS classes */
  className?: string
}

export function InlineCommentIndicator({
  commentCount,
  firstCommentPreview,
  isExpanded,
  onClick,
  className
}: InlineCommentIndicatorProps) {
  // Truncate preview for tooltip
  const tooltipPreview =
    firstCommentPreview && firstCommentPreview.length > 80
      ? `${firstCommentPreview.slice(0, 80)}...`
      : firstCommentPreview

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={cn(
            'inline-flex items-center gap-0.5 rounded px-1 py-0.5',
            'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30',
            'transition-colors duration-150',
            'focus:outline-none focus:ring-1 focus:ring-amber-500/50',
            className
          )}
          data-testid="inline-comment-indicator"
          aria-label={`${commentCount} comment${commentCount !== 1 ? 's' : ''} on this line`}
          aria-expanded={isExpanded}
        >
          <MessageSquare className="h-3 w-3" />
          {commentCount > 1 && (
            <span
              className="text-[10px] font-medium"
              data-testid="comment-count-badge"
            >
              {commentCount}
            </span>
          )}
          {isExpanded ? (
            <ChevronDown className="h-3 w-3" data-testid="chevron-expanded" />
          ) : (
            <ChevronRight className="h-3 w-3" data-testid="chevron-collapsed" />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="right"
        className="max-w-xs bg-popover/95 text-xs"
      >
        <div className="flex flex-col gap-1">
          <span className="font-medium text-amber-400">
            {commentCount} comment{commentCount !== 1 ? 's' : ''}
          </span>
          {tooltipPreview && (
            <span className="text-muted-foreground italic">
              "{tooltipPreview}"
            </span>
          )}
          <span className="text-[10px] text-muted-foreground/70">
            Click to {isExpanded ? 'collapse' : 'expand'}
          </span>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

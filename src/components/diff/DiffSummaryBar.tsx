import { useMemo } from 'react'
import { RefreshCw } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { Button } from '@renderer/components/ui/button'

/**
 * Summary data for the diff
 */
export interface DiffSummary {
  filesChanged: number
  linesAdded: number
  linesRemoved: number
}

/**
 * Props for DiffSummaryBar component
 */
export interface DiffSummaryBarProps {
  /** Diff summary statistics */
  summary: DiffSummary | null | undefined
  /** Callback when refresh is clicked */
  onRefresh: () => void
  /** Whether a refresh is in progress */
  isRefreshing: boolean
  /** Optional additional CSS classes */
  className?: string
}

/**
 * DiffSummaryBar - Displays a summary of changes with refresh capability.
 *
 * Format: "{N} files changed · +{added} lines · -{removed} lines"
 *
 * Story TES-4.2: Diff Summary Bar
 */
export function DiffSummaryBar({
  summary,
  onRefresh,
  isRefreshing,
  className
}: DiffSummaryBarProps): React.JSX.Element {
  // Memoize summary calculations to avoid recalculating on every render
  const summaryText = useMemo(() => {
    // Format values with fallback to 0
    const filesChanged = summary?.filesChanged ?? 0
    const linesAdded = summary?.linesAdded ?? 0
    const linesRemoved = summary?.linesRemoved ?? 0

    // Singular/plural handling
    const fileLabel = filesChanged === 1 ? 'file' : 'files'
    const addedLabel = linesAdded === 1 ? 'line' : 'lines'
    const removedLabel = linesRemoved === 1 ? 'line' : 'lines'

    return {
      filesChanged,
      linesAdded,
      linesRemoved,
      fileLabel,
      addedLabel,
      removedLabel
    }
  }, [summary])

  return (
    <div
      className={cn('flex items-center justify-between gap-3', className)}
      data-testid="diff-summary-bar"
    >
      {/* GitHub-style summary with refined typography */}
      <div className="flex items-center gap-2.5 text-sm">
        {/* Files changed - prominent */}
        <span className="font-medium text-foreground">
          {summaryText.filesChanged} {summaryText.fileLabel} changed
        </span>

        {/* Divider */}
        <span className="text-border">•</span>

        {/* Additions - GitHub green */}
        <span
          className="flex items-baseline gap-1 font-medium text-[#3fb950]"
          aria-label={`${summaryText.linesAdded} ${summaryText.addedLabel} added`}
        >
          <span className="text-base leading-none">+</span>
          <span>{summaryText.linesAdded}</span>
        </span>

        {/* Deletions - GitHub red */}
        <span
          className="flex items-baseline gap-1 font-medium text-[#f85149]"
          aria-label={`${summaryText.linesRemoved} ${summaryText.removedLabel} removed`}
        >
          <span className="text-base leading-none">−</span>
          <span>{summaryText.linesRemoved}</span>
        </span>
      </div>

      {/* Refresh button with refined hover state */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onRefresh}
        disabled={isRefreshing}
        className="h-8 w-8 rounded-md hover:bg-muted/40 active:bg-muted/60 transition-colors"
        aria-label="Refresh diff"
        data-testid="diff-refresh-button"
      >
        <RefreshCw
          className={cn(
            'h-4 w-4 text-muted-foreground transition-colors',
            isRefreshing && 'animate-spin'
          )}
        />
      </Button>
    </div>
  )
}

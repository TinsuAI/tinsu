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
      className={cn('flex items-center justify-between', className)}
      data-testid="diff-summary-bar"
    >
      <span className="text-sm text-foreground/80" data-testid="diff-summary-text">
        {summaryText.filesChanged} {summaryText.fileLabel} changed{' '}
        <span className="text-muted-foreground/60">{'\u00B7'}</span>{' '}
        <span
          className="text-green-500"
          aria-label={`${summaryText.linesAdded} ${summaryText.addedLabel} added`}
        >
          +{summaryText.linesAdded} {summaryText.addedLabel}
        </span>{' '}
        <span className="text-muted-foreground/60">{'\u00B7'}</span>{' '}
        <span
          className="text-red-500"
          aria-label={`${summaryText.linesRemoved} ${summaryText.removedLabel} removed`}
        >
          -{summaryText.linesRemoved} {summaryText.removedLabel}
        </span>
      </span>

      <Button
        variant="ghost"
        size="icon"
        onClick={onRefresh}
        disabled={isRefreshing}
        className="h-7 w-7"
        aria-label="Refresh diff"
        data-testid="diff-refresh-button"
      >
        <RefreshCw className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')} />
      </Button>
    </div>
  )
}

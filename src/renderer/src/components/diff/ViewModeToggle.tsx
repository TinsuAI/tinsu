/**
 * ViewModeToggle - Toggle between unified and split diff views
 *
 * Provides a segmented control for switching between:
 * - Unified: Changes shown interleaved in single column
 * - Split: Original on left, modified on right (side-by-side)
 *
 * Story TES-4.5: Unified vs Split View Toggle
 */

import { ToggleGroup, ToggleGroupItem } from '@renderer/components/ui/toggle-group'
import { Rows, Columns } from 'lucide-react'
import { useDiffStore, type DiffViewMode } from '@renderer/stores/diff.store'
import { cn } from '@renderer/lib/utils'

/**
 * Props for the ViewModeToggle component
 */
export interface ViewModeToggleProps {
  /** Optional additional CSS classes */
  className?: string
  /** Optional callback when mode changes (in addition to store update) */
  onModeChange?: (mode: DiffViewMode) => void
}

/**
 * ViewModeToggle component for switching between unified and split diff views.
 *
 * Features:
 * - AC #1: Unified view selection with single-column layout indicator
 * - AC #2: Split view selection with two-column layout indicator
 * - AC #3: Immediate visual feedback on toggle
 * - AC #4: Persisted preference via Zustand store with localStorage
 *
 * @example
 * <ViewModeToggle onModeChange={(mode) => console.log('Mode:', mode)} />
 */
export function ViewModeToggle({
  className,
  onModeChange
}: ViewModeToggleProps): React.JSX.Element {
  const { viewMode, setViewMode } = useDiffStore()

  const handleValueChange = (value: string) => {
    // Radix ToggleGroup passes empty string when deselecting in single mode
    // Only update if we have a valid value
    if (value === 'unified' || value === 'split') {
      setViewMode(value)
      onModeChange?.(value)
    }
  }

  return (
    <ToggleGroup
      type="single"
      value={viewMode}
      onValueChange={handleValueChange}
      className={cn('gap-0', className)}
      aria-label="Diff view mode"
      data-testid="view-mode-toggle"
    >
      <ToggleGroupItem
        value="unified"
        aria-label="Unified view - changes shown interleaved in single column"
        className="rounded-r-none border border-r-0 border-border/40 px-2.5 py-1 text-xs data-[state=on]:border-primary/50 data-[state=on]:bg-primary/10"
        data-testid="view-mode-unified"
      >
        <Rows className="mr-1.5 h-3.5 w-3.5" />
        Unified
      </ToggleGroupItem>
      <ToggleGroupItem
        value="split"
        aria-label="Split view - original and modified side by side"
        className="rounded-l-none border border-border/40 px-2.5 py-1 text-xs data-[state=on]:border-primary/50 data-[state=on]:bg-primary/10"
        data-testid="view-mode-split"
      >
        <Columns className="mr-1.5 h-3.5 w-3.5" />
        Split
      </ToggleGroupItem>
    </ToggleGroup>
  )
}

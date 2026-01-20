import { GitCompareArrows } from 'lucide-react'
import { cn } from '@renderer/lib/utils'

/**
 * DiffPlaceholder - A placeholder component for the Diff section.
 *
 * Displays a visually consistent placeholder indicating that the full
 * diff viewer will be implemented in Epic 4 (TES-4.x stories).
 *
 * Design: Maintains the "Mission Control" aesthetic with a subtle,
 * non-intrusive placeholder that doesn't distract from active sections.
 *
 * Story TES-3.2: Quad-Pane Layout
 */
export function DiffPlaceholder() {
  return (
    <div
      className={cn(
        // Center content
        'flex h-full flex-col items-center justify-center',
        // Padding
        'p-6',
        // Subtle background pattern
        'bg-gradient-to-br from-muted/5 to-transparent'
      )}
      data-testid="diff-placeholder"
    >
      {/* Icon container with subtle glow */}
      <div
        className={cn(
          'mb-4 rounded-xl p-4',
          'bg-muted/20',
          // Subtle border
          'border border-border/20'
        )}
      >
        <GitCompareArrows
          className={cn(
            'h-8 w-8',
            'text-muted-foreground/50'
          )}
        />
      </div>

      {/* Title */}
      <h4
        className={cn(
          'mb-1.5 text-sm font-medium',
          'text-muted-foreground/70'
        )}
      >
        Diff Viewer
      </h4>

      {/* Description */}
      <p
        className={cn(
          'text-center text-xs',
          'text-muted-foreground/50',
          'max-w-[200px]'
        )}
      >
        Code diff visualization coming in Epic 4
      </p>
    </div>
  )
}

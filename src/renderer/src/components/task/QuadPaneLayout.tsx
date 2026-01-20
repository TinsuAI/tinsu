import { type ReactNode } from 'react'
import { cn } from '@renderer/lib/utils'

/**
 * Props for the QuadPaneLayout component.
 * Each prop represents one of the four sections in the 2x2 grid.
 */
export interface QuadPaneLayoutProps {
  /** Top-left section: Terminal */
  terminal: ReactNode
  /** Top-right section: Activities */
  activities: ReactNode
  /** Bottom-left section: Diff */
  diff: ReactNode
  /** Bottom-right section: Content */
  content: ReactNode
  /** Optional additional CSS classes */
  className?: string
}

/**
 * QuadPaneLayout - A 2x2 CSS Grid layout for simultaneous task section viewing.
 *
 * Displays Terminal (top-left), Activities (top-right), Diff (bottom-left),
 * and Content (bottom-right) in a mission-control style workspace.
 *
 * Key design decisions:
 * - Uses CSS Grid for reliable 2x2 layout
 * - min-h-0 on children prevents content overflow (CSS Grid gotcha)
 * - gap-3 provides comfortable spacing between panes
 * - Fills available height for maximum workspace utilization
 *
 * Story TES-3.2: Quad-Pane Layout
 */
export function QuadPaneLayout({
  terminal,
  activities,
  diff,
  content,
  className
}: QuadPaneLayoutProps) {
  return (
    <div
      className={cn(
        // 2x2 CSS Grid with equal distribution
        'grid h-full grid-cols-2 grid-rows-2',
        // Gap between panes
        'gap-3',
        className
      )}
      data-testid="quad-pane-layout"
    >
      {/* Top-left: Terminal */}
      <div className="min-h-0" data-testid="quad-pane-terminal">
        {terminal}
      </div>

      {/* Top-right: Activities */}
      <div className="min-h-0" data-testid="quad-pane-activities">
        {activities}
      </div>

      {/* Bottom-left: Diff */}
      <div className="min-h-0" data-testid="quad-pane-diff">
        {diff}
      </div>

      {/* Bottom-right: Content */}
      <div className="min-h-0" data-testid="quad-pane-content">
        {content}
      </div>
    </div>
  )
}

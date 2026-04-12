import { type ReactNode } from 'react'
import { Maximize2, type LucideIcon } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { Button } from '@renderer/components/ui/button'

/**
 * Props for the QuadPaneSection component.
 */
export interface QuadPaneSectionProps {
  /** Section title displayed in the header */
  title: string
  /** Lucide icon component to display alongside the title */
  icon: LucideIcon
  /** Section content */
  children: ReactNode
  /** Callback when expand button is clicked */
  onExpand?: () => void
  /** Whether this section is currently expanded (affects styling) */
  isExpanded?: boolean
  /** Whether to show the header (default: true) */
  showHeader?: boolean
  /** Optional additional CSS classes */
  className?: string
}

/**
 * QuadPaneSection - A wrapper component for individual panes in the quad-pane layout.
 *
 * Features:
 * - Header with icon, title, and expand button
 * - Subtle glass morphism styling
 * - Independent scrollable content area
 * - Hover states for visual feedback
 *
 * Design: "Mission Control Station" aesthetic
 * - Each section feels like a dedicated monitoring panel
 * - Subtle gradient border that activates on hover
 * - Header with soft glow on the icon
 *
 * Story TES-3.2: Quad-Pane Layout
 */
export function QuadPaneSection({
  title,
  icon: Icon,
  children,
  onExpand,
  isExpanded,
  showHeader = true,
  className
}: QuadPaneSectionProps) {
  return (
    <div
      className={cn(
        // Base structure
        'group/section flex h-full flex-col overflow-hidden',
        // Border and background with glass effect
        'rounded-lg border border-border/30',
        'bg-card/30 backdrop-blur-sm',
        // Hover: subtle border glow
        'transition-all duration-200',
        'hover:border-border/50 hover:bg-card/40',
        // Expanded state styling
        isExpanded && 'border-cyan-500/40 bg-card/50',
        className
      )}
      data-testid="quad-pane-section"
      data-section={title.toLowerCase()}
    >
      {/* Section header */}
      {showHeader && (
        <div
          className={cn(
            // Layout
            'flex shrink-0 items-center justify-between',
            // Spacing
            'px-3 py-2',
            // Border and background
            'border-b border-border/20',
            'bg-gradient-to-r from-card/60 to-card/40'
          )}
          data-testid="quad-pane-section-header"
        >
          {/* Title with icon */}
          <div className="flex items-center gap-2">
            <Icon
              className={cn(
                'h-4 w-4',
                // Icon color with subtle glow effect
                'text-muted-foreground',
                'transition-colors duration-200',
                'group-hover/section:text-cyan-400/80'
              )}
            />
            <span
              className={cn(
                'text-sm font-medium',
                'text-muted-foreground',
                'transition-colors duration-200',
                'group-hover/section:text-foreground/80'
              )}
            >
              {title}
            </span>
          </div>

          {/* Expand button */}
          {onExpand && (
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'h-6 w-6',
                'text-muted-foreground/60',
                'hover:bg-white/5 hover:text-foreground',
                'transition-all duration-200',
                // Subtle scale on hover
                'hover:scale-110'
              )}
              onClick={onExpand}
              aria-label={`Expand ${title} section`}
              data-testid="quad-pane-section-expand"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )}

      {/* Section content - independently scrollable */}
      <div
        className={cn(
          // Fill remaining space
          'min-h-0 flex-1',
          // Enable scrolling with kanban-style scrollbar
          'kanban-scroll overflow-auto'
        )}
        data-testid="quad-pane-section-content"
      >
        {children}
      </div>
    </div>
  )
}

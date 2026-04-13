import { type LucideIcon, Maximize2, Minimize2 } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { Button } from '@renderer/components/ui/button'

export interface SectionHeaderProps {
  /** Lucide icon component to display alongside the title */
  icon: LucideIcon
  /** Section title displayed in the header */
  title: string
  /** Whether this section is currently expanded to full screen */
  isExpanded?: boolean
  /** Callback when expand button is clicked */
  onExpand?: () => void
  /** Callback when collapse button is clicked */
  onCollapse?: () => void
  /** Optional additional CSS classes */
  className?: string
}

/**
 * SectionHeader - Compact header for workspace sections.
 *
 * Features:
 * - Icon + title display
 * - Expand/collapse button
 * - Consistent height (h-8)
 * - Subtle styling matching project aesthetic
 *
 * Story TES-3.2: Three-Column Task Workspace (AC: #7)
 */
export function SectionHeader({
  icon: Icon,
  title,
  isExpanded,
  onExpand,
  onCollapse,
  className
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        // Layout
        'flex shrink-0 items-center justify-between',
        // Size: compact height (h-8 = 32px)
        'h-8 px-2',
        // Border and background
        'border-b border-border/30',
        'bg-gradient-to-r from-card/60 to-card/40',
        className
      )}
      data-testid={`section-header-${title.toLowerCase()}`}
    >
      {/* Title with icon */}
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-muted-foreground">{title}</span>
      </div>

      {/* Expand/Collapse button */}
      {(onExpand || onCollapse) && (
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'h-6 w-6',
            'text-muted-foreground/60',
            'hover:bg-white/5 hover:text-foreground',
            'transition-colors'
          )}
          onClick={isExpanded ? onCollapse : onExpand}
          aria-label={isExpanded ? `Collapse ${title}` : `Expand ${title}`}
          data-testid={`section-header-${title.toLowerCase()}-expand`}
        >
          {isExpanded ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
        </Button>
      )}
    </div>
  )
}

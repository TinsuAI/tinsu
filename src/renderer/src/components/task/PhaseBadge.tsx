import { cn } from '@renderer/lib/utils'

interface PhaseBadgeProps {
  phaseNumber: 1 | 2 | 3 | 4 | 5
  totalPhases?: number
  className?: string
}

// Planning badge uses a distinct cyan-blue color scheme to differentiate
// from story epic badges which use a variety of colors
const PLANNING_BADGE_CLASSES = 'bg-cyan-600/20 text-cyan-400 border-cyan-600/30'

export function PhaseBadge({ phaseNumber, totalPhases = 5, className }: PhaseBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium',
        PLANNING_BADGE_CLASSES,
        className
      )}
      data-testid="phase-badge"
    >
      {phaseNumber}/{totalPhases}
    </span>
  )
}

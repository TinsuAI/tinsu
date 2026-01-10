import { cn } from '@renderer/lib/utils'

interface PhaseBadgeProps {
  phaseNumber: 1 | 2 | 3 | 4 | 5
  totalPhases?: number
  className?: string
}

// Planning badge uses a distinct violet color scheme with depth
// to differentiate from story epic badges
const PLANNING_BADGE_CLASSES = 'bg-gradient-to-r from-violet-500/30 to-violet-600/15 text-violet-300 border-violet-500/40 shadow-[inset_0_1px_0_rgba(167,139,250,0.25)]'

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

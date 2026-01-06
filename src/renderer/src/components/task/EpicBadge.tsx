import { cn } from '@renderer/lib/utils'

// Color class mapping for epic badges (dark theme optimized)
const EPIC_COLOR_CLASSES: Record<string, string> = {
  blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  green: 'bg-green-500/20 text-green-400 border-green-500/30',
  yellow: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  red: 'bg-red-500/20 text-red-400 border-red-500/30',
  purple: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  orange: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  pink: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  cyan: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  indigo: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  teal: 'bg-teal-500/20 text-teal-400 border-teal-500/30'
}

interface EpicBadgeProps {
  title: string
  color: string
  className?: string
}

export function EpicBadge({ title, color, className }: EpicBadgeProps) {
  const colorClasses = EPIC_COLOR_CLASSES[color] || EPIC_COLOR_CLASSES.blue

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium',
        colorClasses,
        className
      )}
      data-testid="epic-badge"
    >
      {title}
    </span>
  )
}

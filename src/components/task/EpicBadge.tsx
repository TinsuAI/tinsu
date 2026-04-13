import { cn } from '@renderer/lib/utils'

// Color class mapping for epic badges (dark theme optimized with depth)
const EPIC_COLOR_CLASSES: Record<string, string> = {
  blue: 'bg-gradient-to-r from-blue-500/25 to-blue-600/15 text-blue-300 border-blue-500/40 shadow-[inset_0_1px_0_rgba(96,165,250,0.2)]',
  green: 'bg-gradient-to-r from-green-500/25 to-green-600/15 text-green-300 border-green-500/40 shadow-[inset_0_1px_0_rgba(74,222,128,0.2)]',
  yellow: 'bg-gradient-to-r from-yellow-500/25 to-yellow-600/15 text-yellow-300 border-yellow-500/40 shadow-[inset_0_1px_0_rgba(250,204,21,0.2)]',
  red: 'bg-gradient-to-r from-red-500/25 to-red-600/15 text-red-300 border-red-500/40 shadow-[inset_0_1px_0_rgba(248,113,113,0.2)]',
  purple: 'bg-gradient-to-r from-purple-500/25 to-purple-600/15 text-purple-300 border-purple-500/40 shadow-[inset_0_1px_0_rgba(192,132,252,0.2)]',
  orange: 'bg-gradient-to-r from-orange-500/25 to-orange-600/15 text-orange-300 border-orange-500/40 shadow-[inset_0_1px_0_rgba(251,146,60,0.2)]',
  pink: 'bg-gradient-to-r from-pink-500/25 to-pink-600/15 text-pink-300 border-pink-500/40 shadow-[inset_0_1px_0_rgba(244,114,182,0.2)]',
  cyan: 'bg-gradient-to-r from-cyan-500/25 to-cyan-600/15 text-cyan-300 border-cyan-500/40 shadow-[inset_0_1px_0_rgba(34,211,238,0.2)]',
  indigo: 'bg-gradient-to-r from-indigo-500/25 to-indigo-600/15 text-indigo-300 border-indigo-500/40 shadow-[inset_0_1px_0_rgba(129,140,248,0.2)]',
  teal: 'bg-gradient-to-r from-teal-500/25 to-teal-600/15 text-teal-300 border-teal-500/40 shadow-[inset_0_1px_0_rgba(45,212,191,0.2)]'
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

import { cn } from '@renderer/lib/utils'

type SprintStatus = 'planning' | 'active' | 'completed'

interface SprintStatusBadgeProps {
  status: SprintStatus
  className?: string
}

const statusConfig: Record<SprintStatus, { label: string; className: string }> = {
  planning: {
    label: 'Planning',
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
  },
  active: {
    label: 'Active',
    className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
  },
  completed: {
    label: 'Completed',
    className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
  }
}

export function SprintStatusBadge({ status, className }: SprintStatusBadgeProps) {
  const config = statusConfig[status]

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        config.className,
        className
      )}
      data-testid={`sprint-status-badge-${status}`}
    >
      {config.label}
    </span>
  )
}

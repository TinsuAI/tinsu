import { cn } from '@renderer/lib/utils'
import {
  Circle,
  Loader2,
  AlertTriangle,
  Eye,
  CheckCircle2,
  XCircle
} from 'lucide-react'

// Agent status types
export const AGENT_STATUS = ['idle', 'running', 'stalled', 'review', 'done', 'error'] as const
export type AgentStatus = (typeof AGENT_STATUS)[number]

// Status configuration with icons, colors, and labels
const STATUS_CONFIG: Record<
  AgentStatus,
  {
    icon: React.ComponentType<{ className?: string }>
    colorClass: string
    label: string
  }
> = {
  idle: {
    icon: Circle,
    colorClass: 'text-muted-foreground',
    label: 'Idle'
  },
  running: {
    icon: Loader2,
    colorClass: 'text-green-500',
    label: 'Running'
  },
  stalled: {
    icon: AlertTriangle,
    colorClass: 'text-amber-500',
    label: 'Stalled'
  },
  review: {
    icon: Eye,
    colorClass: 'text-purple-500',
    label: 'Review'
  },
  done: {
    icon: CheckCircle2,
    colorClass: 'text-green-500',
    label: 'Done'
  },
  error: {
    icon: XCircle,
    colorClass: 'text-destructive',
    label: 'Error'
  }
}

interface AgentStatusBadgeProps {
  status: AgentStatus
  className?: string
}

export function AgentStatusBadge({ status, className }: AgentStatusBadgeProps) {
  const config = STATUS_CONFIG[status]
  const Icon = config.icon

  return (
    <span
      className={cn(
        'inline-flex items-center',
        config.colorClass,
        className
      )}
      title={config.label}
      data-testid={`agent-status-${status}`}
    >
      <Icon
        className={cn(
          'size-4',
          // Add spin animation for running status
          status === 'running' && 'animate-spin'
        )}
      />
    </span>
  )
}

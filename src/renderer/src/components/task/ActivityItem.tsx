import { format } from 'date-fns'
import {
  ArrowRight,
  Play,
  CheckCircle,
  Wrench,
  Terminal,
  Zap,
  AlertCircle,
  XCircle,
  Clock
} from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import type { Activity, ActivityEventType } from '@shared/types/activity.types'

interface ActivityItemProps {
  activity: Activity
  /** Optional class name for animation or styling */
  className?: string
}

/**
 * Get the Lucide icon component for an event type.
 *
 * @see TES-2.11: Dev Notes - Activity Event Types and Icons
 */
function getEventIcon(eventType: ActivityEventType): React.ReactNode {
  const iconProps = { className: 'w-4 h-4' }

  switch (eventType) {
    case 'status_change':
      return <ArrowRight {...iconProps} />
    case 'agent_start':
      return <Play {...iconProps} />
    case 'agent_complete':
      return <CheckCircle {...iconProps} />
    case 'tool_used':
      return <Wrench {...iconProps} />
    case 'user_command':
      return <Terminal {...iconProps} />
    case 'automation_trigger':
      return <Zap {...iconProps} />
    case 'error':
      return <AlertCircle {...iconProps} />
    case 'session_ended':
      return <XCircle {...iconProps} />
    case 'stall_detected':
      return <Clock {...iconProps} />
    case 'stall_recovered':
      return <CheckCircle {...iconProps} />
    default:
      return <AlertCircle {...iconProps} />
  }
}

/**
 * Get the color class for an event type icon.
 *
 * @see TES-2.11: Dev Notes - Activity Event Types and Icons
 */
function getIconColorClass(eventType: ActivityEventType): string {
  switch (eventType) {
    case 'status_change':
      return 'text-blue-400'
    case 'agent_start':
      return 'text-green-400'
    case 'agent_complete':
      return 'text-green-400'
    case 'tool_used':
      return 'text-zinc-400'
    case 'user_command':
      return 'text-purple-400'
    case 'automation_trigger':
      return 'text-amber-400'
    case 'error':
      return 'text-red-400'
    case 'session_ended':
      return 'text-zinc-400'
    case 'stall_detected':
      return 'text-amber-400'
    case 'stall_recovered':
      return 'text-green-400'
    default:
      return 'text-zinc-400'
  }
}

/**
 * Get a human-readable title for an event type.
 */
function getEventTitle(eventType: ActivityEventType): string {
  switch (eventType) {
    case 'status_change':
      return 'Status Changed'
    case 'agent_start':
      return 'Agent Started'
    case 'agent_complete':
      return 'Agent Completed'
    case 'tool_used':
      return 'Tool Used'
    case 'user_command':
      return 'User Command'
    case 'automation_trigger':
      return 'Auto-triggered'
    case 'error':
      return 'Error'
    case 'session_ended':
      return 'Session Ended'
    case 'stall_detected':
      return 'Stall Detected'
    case 'stall_recovered':
      return 'Stall Recovered'
    default:
      return 'Event'
  }
}

/**
 * Format the payload into a human-readable description.
 *
 * @see TES-2.11: Dev Notes - Payload Formatting Examples
 */
function formatPayload(eventType: ActivityEventType, payload: Record<string, unknown>): string {
  switch (eventType) {
    case 'status_change':
      return `${payload.from ?? 'unknown'} → ${payload.to ?? 'unknown'}`

    case 'agent_start':
      return payload.phase ? `Phase: ${payload.phase}` : 'Started'

    case 'agent_complete':
      if (payload.duration_ms && typeof payload.duration_ms === 'number') {
        return `Completed in ${Math.round(payload.duration_ms / 1000)}s`
      }
      return 'Completed'

    case 'tool_used': {
      const file = payload.file ? ` on ${payload.file}` : ''
      return `${payload.tool ?? 'unknown'}${file}`
    }

    case 'user_command':
      return payload.command ? `$ ${payload.command}` : ''

    case 'automation_trigger':
      return `${payload.command ?? 'unknown'} (${payload.trigger ?? 'auto'})`

    case 'error':
      return (payload.message as string) ?? 'Unknown error'

    case 'session_ended':
      return (payload.reason as string) ?? 'Session ended'

    case 'stall_detected':
      if (payload.stallDurationMs && typeof payload.stallDurationMs === 'number') {
        return `No output for ${Math.round(payload.stallDurationMs / 60000)}min`
      }
      return 'No output detected'

    case 'stall_recovered':
      return 'Output resumed'

    default:
      // For unknown event types, show raw payload
      return Object.keys(payload).length > 0 ? JSON.stringify(payload) : ''
  }
}

/**
 * ActivityItem component - displays a single activity event in the activity log.
 *
 * Shows:
 * - Timestamp (HH:MM:SS format)
 * - Event type icon with appropriate color
 * - Event title
 * - Payload details formatted based on event type
 *
 * @see TES-2.11: Activity Log UI Display (AC: #1, #2)
 */
export function ActivityItem({ activity, className }: ActivityItemProps): React.ReactNode {
  // Format timestamp as HH:MM:SS (AC: #1)
  const timestamp = format(new Date(activity.created_at), 'HH:mm:ss')

  // Parse JSON payload (AC: #2)
  let payload: Record<string, unknown> = {}
  if (activity.payload) {
    try {
      payload = JSON.parse(activity.payload) as Record<string, unknown>
    } catch {
      // Invalid JSON, keep empty payload
    }
  }

  const eventTitle = getEventTitle(activity.event_type)
  const formattedPayload = formatPayload(activity.event_type, payload)

  return (
    <div className={cn('flex items-start gap-3 p-3 border-b border-zinc-800 last:border-b-0', className)}>
      {/* Icon */}
      <div className={cn('mt-0.5 flex-shrink-0', getIconColorClass(activity.event_type))}>
        {getEventIcon(activity.event_type)}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500 font-mono">{timestamp}</span>
          <span className="text-sm font-medium text-zinc-200">{eventTitle}</span>
        </div>
        {formattedPayload && (
          <p className="text-sm text-zinc-400 mt-0.5 truncate" title={formattedPayload}>
            {formattedPayload}
          </p>
        )}
      </div>
    </div>
  )
}

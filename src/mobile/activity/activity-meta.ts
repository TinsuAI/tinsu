/**
 * activity-meta.ts — Pure helper functions for the mobile activity feed.
 *
 * Story T3.5-8, Task 2.
 *
 * Covers all 12 event_types from activity.types.ts:
 *   status_change, agent_start, agent_complete, tool_used, user_command,
 *   automation_trigger, error, session_ended, stall_detected, stall_recovered,
 *   auto_commit, rejection
 *
 * AC-4 chip filter categories and their event_type mappings.
 * AC-17 token discipline: icon color helpers documented here (not in components).
 */

import type { ActivityEventType } from '@shared/types/activity.types'
import type { Activity } from '@shared/types/activity.types'

/* ── Category filter ──────────────────────────────────────────────── */

export type ActivityCategory =
  | 'All'
  | 'Status'
  | 'Agent'
  | 'Tools'
  | 'Errors'
  | 'User'
  | 'Auto'

/**
 * Maps chip filter category to its constituent event_types.
 * AC-4 canonical mapping.
 */
export function categoryFilterToEventTypes(
  category: ActivityCategory,
): ActivityEventType[] | null {
  switch (category) {
    case 'All':
      return null // no filter
    case 'Status':
      return ['status_change']
    case 'Agent':
      return ['agent_start', 'agent_complete']
    case 'Tools':
      return ['tool_used']
    case 'Errors':
      return ['error', 'stall_detected']
    case 'User':
      return ['user_command', 'rejection']
    case 'Auto':
      return ['automation_trigger', 'auto_commit', 'stall_recovered', 'session_ended']
  }
}

/**
 * Returns the category for a given event_type.
 */
export function eventTypeToCategory(type: ActivityEventType): ActivityCategory {
  switch (type) {
    case 'status_change':   return 'Status'
    case 'agent_start':
    case 'agent_complete':  return 'Agent'
    case 'tool_used':       return 'Tools'
    case 'error':
    case 'stall_detected':  return 'Errors'
    case 'user_command':
    case 'rejection':       return 'User'
    case 'automation_trigger':
    case 'auto_commit':
    case 'stall_recovered':
    case 'session_ended':   return 'Auto'
  }
}

/* ── Human-readable title ─────────────────────────────────────────── */

/**
 * Returns a human-readable title for an event_type.
 */
export function eventTypeToTitle(type: ActivityEventType): string {
  switch (type) {
    case 'status_change':       return 'Status Changed'
    case 'agent_start':         return 'Agent Started'
    case 'agent_complete':      return 'Agent Completed'
    case 'tool_used':           return 'Tool Used'
    case 'user_command':        return 'User Command'
    case 'automation_trigger':  return 'Automation Triggered'
    case 'error':               return 'Error'
    case 'session_ended':       return 'Session Ended'
    case 'stall_detected':      return 'Stall Detected'
    case 'stall_recovered':     return 'Stall Recovered'
    case 'auto_commit':         return 'Auto Commit'
    case 'rejection':           return 'Rejected'
  }
}

/* ── Icon name (returned as string key for caller to resolve) ─────── */

/**
 * Returns a Lucide icon name for each event_type.
 * Callers import the actual icon from lucide-react.
 *
 * AC-17 Token discipline rule for icon colors:
 *   Errors category  → text-destructive
 *   Agent category   → text-primary
 *   Status category  → text-foreground (muted)
 *   User category    → text-foreground
 *   Tools category   → text-muted-foreground
 *   Auto category    → text-muted-foreground
 * This is the documented exception for icon colors per AC-17.
 */
export function eventTypeToIconName(
  type: ActivityEventType,
): string {
  switch (type) {
    case 'status_change':       return 'ArrowRightLeft'
    case 'agent_start':         return 'Bot'
    case 'agent_complete':      return 'CheckCircle2'
    case 'tool_used':           return 'Wrench'
    case 'user_command':        return 'Terminal'
    case 'automation_trigger':  return 'Zap'
    case 'error':               return 'AlertTriangle'
    case 'session_ended':       return 'LogOut'
    case 'stall_detected':      return 'PauseCircle'
    case 'stall_recovered':     return 'PlayCircle'
    case 'auto_commit':         return 'GitCommit'
    case 'rejection':           return 'XCircle'
  }
}

/**
 * Returns the Tailwind token class for the icon color per AC-17.
 * ONLY semantic token classes are used — never text-red-500 etc.
 */
export function eventTypeToIconClass(type: ActivityEventType): string {
  const cat = eventTypeToCategory(type)
  switch (cat) {
    case 'Errors':  return 'text-destructive'
    case 'Agent':   return 'text-primary'
    case 'Status':  return 'text-foreground'
    case 'User':    return 'text-foreground'
    case 'Tools':   return 'text-muted-foreground'
    case 'Auto':    return 'text-muted-foreground'
    default:        return 'text-muted-foreground'
  }
}

/* ── Payload subtitle ─────────────────────────────────────────────── */

/**
 * Derives a one-line human-readable summary from an activity's payload.
 * Wraps JSON.parse in try/catch — payload may be null or invalid.
 */
export function payloadToSubtitle(activity: Activity): string {
  if (!activity.payload) return ''

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(activity.payload) as Record<string, unknown>
  } catch {
    // Fallback: truncate raw string
    return activity.payload.slice(0, 80)
  }

  // Type-specific extractions
  switch (activity.event_type) {
    case 'status_change': {
      const from = String(parsed.from_status ?? parsed.from ?? '')
      const to = String(parsed.to_status ?? parsed.to ?? '')
      if (from && to) return `${from} → ${to}`
      if (to) return `→ ${to}`
      break
    }
    case 'tool_used': {
      const name = String(parsed.tool_name ?? parsed.tool ?? parsed.name ?? '')
      if (name) return name
      break
    }
    case 'user_command': {
      const cmd = String(parsed.command ?? parsed.input ?? '')
      if (cmd) return cmd.slice(0, 80)
      break
    }
    case 'error': {
      const msg = String(parsed.message ?? parsed.error ?? parsed.msg ?? '')
      if (msg) return msg.slice(0, 80)
      break
    }
    case 'auto_commit': {
      const hash = String(parsed.commit_hash ?? parsed.hash ?? '')
      if (hash) return hash.slice(0, 12)
      break
    }
    case 'rejection': {
      const reason = String(parsed.reason ?? parsed.feedback ?? '')
      if (reason) return reason.slice(0, 80)
      break
    }
    case 'automation_trigger': {
      const trigger = String(parsed.trigger ?? parsed.workflow ?? '')
      if (trigger) return trigger
      break
    }
  }

  // Generic fallback: first string value in payload
  for (const val of Object.values(parsed)) {
    if (typeof val === 'string' && val.length > 0) return val.slice(0, 80)
  }

  return ''
}

/* ── Relative time ────────────────────────────────────────────────── */

/**
 * Returns a short relative time string for a Unix timestamp in ms.
 * Examples: "now", "2m", "1h", "yesterday", "3d"
 */
export function relativeTime(createdAtMs: number): string {
  const diffMs = Date.now() - createdAtMs
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)

  if (diffSec < 60) return 'now'
  if (diffMin < 60) return `${diffMin}m`
  if (diffHr < 24) return `${diffHr}h`
  if (diffDay === 1) return 'yesterday'
  return `${diffDay}d`
}

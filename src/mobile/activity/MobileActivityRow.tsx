/**
 * MobileActivityRow — a single row in the cross-task activity feed.
 *
 * Story T3.5-8, Task 2 (AC: 2, 4, 17, 18, 19).
 *
 * Renders: leading event-type icon + left accent bar, title, subtitle (payload),
 * trailing relative time, and tappable affordance.
 *
 * highlight prop: triggers a 1.5s left-to-right glow animation when true.
 * Respects prefers-reduced-motion (skip glow if reduced). AC-3, AC-17.
 *
 * Token discipline (AC-17):
 *   Icon colors use eventTypeToIconClass() — only semantic token classes.
 *   The left accent bar uses border-primary (Agent), border-destructive (Errors),
 *   border-border (others) — documented semantic exception per AC-17.
 *   No inline color classes (text-red-500, bg-blue-600, etc.).
 *
 * Touch target: min-h-11 (44 px) — AC-18.
 * Accessibility: role="listitem", aria-label. AC-19.
 */

import {
  ArrowRightLeft, Bot, CheckCircle2, Wrench, Terminal, Zap,
  AlertTriangle, LogOut, PauseCircle, PlayCircle, GitCommit, XCircle,
} from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { useReducedMotion } from '../hooks/useReducedMotion'
import {
  eventTypeToTitle,
  eventTypeToIconClass,
  eventTypeToIconName,
  eventTypeToCategory,
  payloadToSubtitle,
  relativeTime,
} from './activity-meta'
import type { Activity } from '@shared/types/activity.types'

/* ── Icon resolver ──────────────────────────────────────────────── */

/**
 * Maps icon name strings (from eventTypeToIconName) to Lucide components.
 * Isolated here so tree-shaking works correctly.
 */
function ActivityIcon({ name, className }: { name: string; className?: string }) {
  const props = { className: cn('h-4 w-4', className), 'aria-hidden': true as const }
  switch (name) {
    case 'ArrowRightLeft': return <ArrowRightLeft {...props} />
    case 'Bot':            return <Bot {...props} />
    case 'CheckCircle2':   return <CheckCircle2 {...props} />
    case 'Wrench':         return <Wrench {...props} />
    case 'Terminal':       return <Terminal {...props} />
    case 'Zap':            return <Zap {...props} />
    case 'AlertTriangle':  return <AlertTriangle {...props} />
    case 'LogOut':         return <LogOut {...props} />
    case 'PauseCircle':    return <PauseCircle {...props} />
    case 'PlayCircle':     return <PlayCircle {...props} />
    case 'GitCommit':      return <GitCommit {...props} />
    case 'XCircle':        return <XCircle {...props} />
    default:               return <Zap {...props} />
  }
}

/* ── Left accent bar class ──────────────────────────────────────── */

/**
 * Returns the left border accent class per category.
 * AC-17 documented exception: these are semantic border tokens, not inline colors.
 */
function accentBarClass(category: ReturnType<typeof eventTypeToCategory>): string {
  switch (category) {
    case 'Errors':  return 'border-l-[3px] border-destructive'
    case 'Agent':   return 'border-l-[3px] border-primary'
    case 'User':    return 'border-l-[3px] border-foreground/40'
    default:        return 'border-l-[3px] border-border/30'
  }
}

/* ── Props ──────────────────────────────────────────────────────── */

interface MobileActivityRowProps {
  activity: Activity
  onPress: (activity: Activity) => void
  highlight?: boolean
}

/* ── Component ──────────────────────────────────────────────────── */

export function MobileActivityRow({
  activity,
  onPress,
  highlight = false,
}: MobileActivityRowProps) {
  const reduced = useReducedMotion()

  const category = eventTypeToCategory(activity.event_type)
  const iconName = eventTypeToIconName(activity.event_type)
  const iconClass = eventTypeToIconClass(activity.event_type)
  const title = eventTypeToTitle(activity.event_type)
  const subtitle = payloadToSubtitle(activity)
  const time = relativeTime(activity.created_at)
  const accent = accentBarClass(category)

  return (
    <button
      type="button"
      role="listitem"
      aria-label={`${title}${subtitle ? ': ' + subtitle : ''}, ${time}`}
      data-testid="mobile-activity-row"
      onClick={() => onPress(activity)}
      className={cn(
        'w-full flex items-start gap-3 px-4 py-3 min-h-11',
        'text-left border-b border-border/20',
        'transition-colors duration-100 active:bg-muted/20',
        accent,
        // Glow animation on highlight — skip if reduced motion (AC-3)
        highlight && !reduced && 'animate-activity-glow',
      )}
    >
      {/* Leading icon in a circular container */}
      <span
        className={cn(
          'shrink-0 flex items-center justify-center',
          'w-8 h-8 rounded-full bg-muted/40 mt-0.5',
          iconClass,
        )}
        aria-hidden
      >
        <ActivityIcon name={iconName} className={iconClass} />
      </span>

      {/* Text block */}
      <span className="flex-1 min-w-0 flex flex-col gap-0.5">
        <span className="text-sm font-medium text-foreground leading-snug truncate">
          {title}
        </span>
        {subtitle ? (
          <span className="text-xs text-muted-foreground leading-snug line-clamp-1">
            {subtitle}
          </span>
        ) : null}
      </span>

      {/* Trailing: relative time */}
      <span
        className="shrink-0 text-xs text-muted-foreground mt-0.5 tabular-nums"
        aria-label={time}
      >
        {time}
      </span>
    </button>
  )
}

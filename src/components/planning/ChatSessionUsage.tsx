/**
 * ChatSessionUsage - Real-time context & rate limit display for chat sessions.
 *
 * Instrument-panel style gauges showing three metrics:
 *   • Context window usage (from StatusLine hook or Stop hook transcript)
 *   • 5-hour rate limit usage + time to reset
 *   • 7-day rate limit usage + time to reset
 *
 * Updated via Tauri `chat:usage-update` events emitted by:
 *   - `handle_chat_status_hook` (StatusLine — fires in real-time while Claude runs)
 *   - `handle_chat_stop_hook` (fallback — context only, from transcript at turn end)
 *
 * State is merged on each event so a Stop-only update doesn't wipe rate-limit
 * data accumulated from prior StatusLine events.
 */

import { useState, useEffect } from 'react'
import { listen } from '@tauri-apps/api/event'
import { cn } from '@renderer/lib/utils'

interface ChatSessionUsageProps {
  sessionId: string
}

interface UsageState {
  contextUsedPercent: number | null
  fiveHourUsedPercent: number | null
  sevenDayUsedPercent: number | null
  fiveHourResetSeconds: number | null
  sevenDayResetSeconds: number | null
}

interface UsageUpdatePayload {
  session_id: string
  context_used_percent: number | null
  five_hour_used_percent: number | null
  seven_day_used_percent: number | null
  five_hour_reset_seconds: number | null
  seven_day_reset_seconds: number | null
}

function estimateRemaining(usedPercent: number | null, windowSeconds: number): number | null {
  if (usedPercent == null) return null
  const remainingPercent = Math.max(0, 100 - usedPercent)
  return Math.round((remainingPercent / 100) * windowSeconds)
}

function formatRemaining(seconds: number | null): string | null {
  if (seconds == null || seconds <= 0) return null
  if (seconds < 60) return `${Math.ceil(seconds)}s`
  if (seconds < 3600) return `${Math.ceil(seconds / 60)}m`
  const hours = Math.floor(seconds / 3600)
  const mins = Math.ceil((seconds % 3600) / 60)
  return mins > 0 ? `${hours}h${mins}m` : `${hours}h`
}

/** Color tokens based on severity */
function gaugeColors(percent: number | null): {
  bar: string
  text: string
  glow: string
  track: string
} {
  if (percent == null) return {
    bar: 'bg-muted-foreground/15',
    text: 'text-muted-foreground/25',
    glow: '',
    track: 'bg-muted/30'
  }
  if (percent >= 90) return {
    bar: 'bg-red-400',
    text: 'text-red-400',
    glow: 'shadow-[0_0_6px_rgba(248,113,113,0.3)]',
    track: 'bg-red-400/10'
  }
  if (percent >= 70) return {
    bar: 'bg-amber-400',
    text: 'text-amber-400',
    glow: '',
    track: 'bg-amber-400/8'
  }
  return {
    bar: 'bg-emerald-400',
    text: 'text-emerald-400',
    glow: '',
    track: 'bg-emerald-400/8'
  }
}

function Gauge({ percent, label, remaining }: {
  percent: number | null
  label: string
  remaining?: string | null
}) {
  const pct = percent ?? 0
  const colors = gaugeColors(percent)

  return (
    <div className="flex flex-col gap-0.5 min-w-0 flex-1">
      {/* Label row */}
      <div className="flex items-baseline justify-between gap-1">
        <span className="font-mono text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/35">
          {label}
        </span>
        <div className="flex items-baseline gap-1">
          <span className={cn('font-mono text-[11px] font-semibold tabular-nums leading-none', colors.text)}>
            {percent != null ? `${Math.round(percent)}%` : '--'}
          </span>
          {remaining && (
            <span className="font-mono text-[8px] text-muted-foreground/25 leading-none">
              {remaining}
            </span>
          )}
        </div>
      </div>
      {/* Bar */}
      <div className={cn('h-[3px] w-full overflow-hidden rounded-full', colors.track)}>
        <div
          className={cn('h-full rounded-full transition-all duration-700 ease-out', colors.bar, colors.glow)}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  )
}

export function ChatSessionUsage({ sessionId }: ChatSessionUsageProps) {
  const [usage, setUsage] = useState<UsageState | null>(null)

  useEffect(() => {
    let unlisten: (() => void) | undefined
    let mounted = true

    listen<UsageUpdatePayload>('chat:usage-update', (event) => {
      if (!mounted || event.payload.session_id !== sessionId) return

      // Merge incoming values: only overwrite a field if the new event carries non-null data,
      // so a Stop-hook event (context only) doesn't wipe the rate-limit data from StatusLine.
      setUsage(prev => ({
        contextUsedPercent:
          event.payload.context_used_percent != null
            ? event.payload.context_used_percent
            : (prev?.contextUsedPercent ?? null),
        fiveHourUsedPercent:
          event.payload.five_hour_used_percent != null
            ? event.payload.five_hour_used_percent
            : (prev?.fiveHourUsedPercent ?? null),
        sevenDayUsedPercent:
          event.payload.seven_day_used_percent != null
            ? event.payload.seven_day_used_percent
            : (prev?.sevenDayUsedPercent ?? null),
        fiveHourResetSeconds:
          event.payload.five_hour_reset_seconds != null
            ? event.payload.five_hour_reset_seconds
            : (prev?.fiveHourResetSeconds ?? null),
        sevenDayResetSeconds:
          event.payload.seven_day_reset_seconds != null
            ? event.payload.seven_day_reset_seconds
            : (prev?.sevenDayResetSeconds ?? null),
      }))
    }).then((fn) => {
      if (mounted) {
        unlisten = fn
      } else {
        fn()
      }
    })

    return () => {
      mounted = false
      unlisten?.()
    }
  }, [sessionId])

  if (!usage) return null

  const fiveHourRemaining = formatRemaining(
    usage.fiveHourResetSeconds ?? estimateRemaining(usage.fiveHourUsedPercent, 5 * 3600)
  )
  const sevenDayRemaining = formatRemaining(
    usage.sevenDayResetSeconds ?? estimateRemaining(usage.sevenDayUsedPercent, 7 * 24 * 3600)
  )

  return (
    <div
      className="flex items-stretch gap-3 border-t border-border/15 bg-background/40 px-3 py-1.5"
      data-testid="chat-session-usage"
    >
      <Gauge percent={usage.contextUsedPercent} label="Context" />
      <div className="w-px self-stretch bg-border/10" />
      <Gauge percent={usage.fiveHourUsedPercent} label="5-Hour" remaining={fiveHourRemaining} />
      <div className="w-px self-stretch bg-border/10" />
      <Gauge percent={usage.sevenDayUsedPercent} label="Weekly" remaining={sevenDayRemaining} />
    </div>
  )
}

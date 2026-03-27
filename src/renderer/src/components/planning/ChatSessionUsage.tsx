/**
 * ChatSessionUsage - Real-time context & rate limit display for chat sessions.
 *
 * Instrument-panel style gauges showing Claude Code session context window
 * usage and rate limits (5-hour and weekly) with remaining time.
 * Updated in real-time via 3-second polling.
 */

import { trpc } from '@renderer/lib/trpc'
import { cn } from '@renderer/lib/utils'

interface ChatSessionUsageProps {
  sessionId: string
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
  const { data: status } = trpc.chatSession.getSessionStatus.useQuery(
    { sessionId },
    { refetchInterval: 3000 }
  )

  if (!status) return null

  const fiveHourRemaining = formatRemaining(
    status.fiveHourResetSeconds ?? estimateRemaining(status.fiveHourUsedPercent, 5 * 3600)
  )
  const sevenDayRemaining = formatRemaining(
    status.sevenDayResetSeconds ?? estimateRemaining(status.sevenDayUsedPercent, 7 * 24 * 3600)
  )

  return (
    <div
      className="flex items-stretch gap-3 border-t border-border/15 bg-background/40 px-3 py-1.5"
      data-testid="chat-session-usage"
    >
      <Gauge percent={status.contextUsedPercent} label="Context" />
      <div className="w-px self-stretch bg-border/10" />
      <Gauge percent={status.fiveHourUsedPercent} label="5-Hour" remaining={fiveHourRemaining} />
      <div className="w-px self-stretch bg-border/10" />
      <Gauge percent={status.sevenDayUsedPercent} label="Weekly" remaining={sevenDayRemaining} />
    </div>
  )
}

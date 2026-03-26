/**
 * ChatSessionUsage - Real-time context & rate limit display for chat sessions.
 *
 * Shows Claude Code session context window usage and rate limits
 * (5-hour and weekly) with remaining time, updated in real-time via polling.
 */

import { trpc } from '@renderer/lib/trpc'
import { cn } from '@renderer/lib/utils'

interface ChatSessionUsageProps {
  sessionId: string
}

/**
 * Estimate remaining seconds in a rate limit window.
 * Returns null if percentage is unknown.
 */
function estimateRemaining(usedPercent: number | null, windowSeconds: number): number | null {
  if (usedPercent == null) return null
  const remainingPercent = Math.max(0, 100 - usedPercent)
  return Math.round((remainingPercent / 100) * windowSeconds)
}

/** Format seconds into human-readable remaining time */
function formatRemaining(seconds: number | null): string | null {
  if (seconds == null || seconds <= 0) return null
  if (seconds < 60) return `${Math.ceil(seconds)}s`
  if (seconds < 3600) return `${Math.ceil(seconds / 60)}m`
  const hours = Math.floor(seconds / 3600)
  const mins = Math.ceil((seconds % 3600) / 60)
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}

/** Get color class based on usage percentage */
function usageColor(percent: number | null): string {
  if (percent == null) return 'text-muted-foreground/30'
  if (percent >= 90) return 'text-red-400'
  if (percent >= 70) return 'text-amber-400'
  return 'text-emerald-400'
}

/** Get bar fill color based on usage percentage */
function barColor(percent: number | null): string {
  if (percent == null) return 'bg-muted-foreground/20'
  if (percent >= 90) return 'bg-red-400'
  if (percent >= 70) return 'bg-amber-400'
  return 'bg-emerald-400'
}

/** Mini usage bar */
function UsageBar({ percent, label, remaining }: {
  percent: number | null
  label: string
  remaining?: string | null
}) {
  const pct = percent ?? 0
  const color = barColor(percent)
  const textColor = usageColor(percent)

  return (
    <div className="flex items-center gap-1.5">
      <span className="w-[26px] shrink-0 text-right font-mono text-[9px] text-muted-foreground/40">
        {label}
      </span>
      <div className="h-1 w-full max-w-[48px] overflow-hidden rounded-full bg-muted/40">
        <div
          className={cn('h-full rounded-full transition-all duration-700', color)}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className={cn('font-mono text-[9px] tabular-nums', textColor)}>
        {percent != null ? `${Math.round(percent)}%` : '--'}
      </span>
      {remaining && (
        <span className="font-mono text-[8px] text-muted-foreground/30">
          ({remaining})
        </span>
      )}
    </div>
  )
}

export function ChatSessionUsage({ sessionId }: ChatSessionUsageProps) {
  const { data: status } = trpc.chatSession.getSessionStatus.useQuery(
    { sessionId },
    { refetchInterval: 3000 }
  )

  // Don't render anything until we get first status data
  if (!status) return null

  // Show remaining time — use reset_seconds if available, otherwise estimate from percentage
  const fiveHourRemaining = formatRemaining(
    status.fiveHourResetSeconds ?? estimateRemaining(status.fiveHourUsedPercent, 5 * 3600)
  )
  const sevenDayRemaining = formatRemaining(
    status.sevenDayResetSeconds ?? estimateRemaining(status.sevenDayUsedPercent, 7 * 24 * 3600)
  )

  return (
    <div
      className="flex items-center gap-3 border-t border-border/20 bg-muted/10 px-3 py-1"
      data-testid="chat-session-usage"
    >
      {/* Context usage */}
      <UsageBar
        percent={status.contextUsedPercent}
        label="CTX"
      />

      {/* Separator */}
      <div className="h-2.5 w-px bg-border/20" />

      {/* 5h rate limit */}
      <UsageBar
        percent={status.fiveHourUsedPercent}
        label="5h"
        remaining={fiveHourRemaining}
      />

      {/* Separator */}
      <div className="h-2.5 w-px bg-border/20" />

      {/* Weekly rate limit */}
      <UsageBar
        percent={status.sevenDayUsedPercent}
        label="7d"
        remaining={sevenDayRemaining}
      />
    </div>
  )
}

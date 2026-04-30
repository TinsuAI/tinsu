/**
 * LiveStatusBadge — compact pill showing real-time chat session status.
 *
 * Mirrors desktop LIVE_STATUS_CONFIG from src/components/planning/ChatSessionList.tsx
 * intentionally duplicated here to keep the mobile tree decoupled (per CLAUDE.md
 * mobile-tree-not-branch rule). The cyan/emerald/zinc/amber color exception is
 * documented in AC 20 — these are UX-DR4 honest-status semantics, not arbitrary color use.
 *
 * "unknown" or undefined liveStatus renders nothing (hidden).
 *
 * Story T3.5-5 — Mobile Planning (AC 3, Task 3)
 */

import { Activity, Circle, CheckCircle2, XCircle } from 'lucide-react'
import { cn } from '@renderer/lib/utils'

// NOTE: The direct color classes below (cyan/emerald/zinc/amber) are the ONLY
// exception to the Calm Command token rule (AC 20). They mirror desktop
// ChatSessionList.tsx LIVE_STATUS_CONFIG exactly — UX-DR4 honest-status semantics.
const LIVE_STATUS_CONFIG: Record<string, {
  label: string
  className: string
  animationClassName?: string
  Icon: typeof Activity
}> = {
  thinking: {
    label: 'Thinking',
    className: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20',
    animationClassName: 'animate-pulse',
    Icon: Activity,
  },
  idle: {
    label: 'Idle',
    className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    Icon: Circle,
  },
  completed: {
    label: 'Done',
    className: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20',
    Icon: CheckCircle2,
  },
  exited: {
    label: 'Exited',
    className: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
    Icon: XCircle,
  },
}

interface LiveStatusBadgeProps {
  liveStatus: string | undefined
}

export function LiveStatusBadge({ liveStatus }: LiveStatusBadgeProps) {
  if (!liveStatus || liveStatus === 'unknown') return null

  const config = LIVE_STATUS_CONFIG[liveStatus]
  if (!config) return null

  const { label, className, animationClassName, Icon } = config

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium',
        className,
        animationClassName,
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {label}
    </span>
  )
}

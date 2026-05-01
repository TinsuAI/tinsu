/**
 * MobileSessionRow — a single planning chat session in the session list.
 *
 * Uses MobileListItem as the row primitive with:
 *   - leading: 8 px persona color dot
 *   - title: persona display name
 *   - subtitle: 1-line truncated last_message_preview
 *   - trailing: LiveStatusBadge + relative timestamp stack
 *
 * formatRelativeTime is a local helper mirroring
 * src/components/planning/ChatSessionList.tsx lines 38–62.
 * It is NOT imported from desktop to avoid cross-tree coupling (AC 17).
 *
 * Story T3.5-5 — Mobile Planning (AC 3, Task 2)
 */

import { AGENT_PERSONA_CONFIG } from '@renderer/constants/planning-workspace'
import { cn } from '@renderer/lib/utils'
import { MobileListItem } from '../primitives/MobileListItem'
import { LiveStatusBadge } from './LiveStatusBadge'

/* ─── Types ─────────────────────────────────────────────────────────── */

/** Shape returned by commands.listChatSessionsWithPreview */
export interface ChatSessionListItemPreview {
  id: string
  agent_persona: string | null
  last_message_preview: string | null
  last_message_at: string | null
  live_status: string | undefined
}

/* ─── Helpers ───────────────────────────────────────────────────────── */

/**
 * Format a timestamp to a human-readable relative time string.
 * Mirrors ChatSessionList.tsx formatRelativeTime (lines 38–62) — pure JS, zero deps.
 */
function formatRelativeTime(ts: string | null | undefined): string {
  if (!ts) return ''

  let date: Date
  if (typeof ts === 'number') {
    // Drizzle integer timestamp mode stores unix seconds
    date = new Date((ts as number) * 1000)
  } else {
    date = new Date(ts)
  }

  const now = Date.now()
  const diffMs = now - date.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  const diffHours = Math.floor(diffMs / 3_600_000)
  const diffDays = Math.floor(diffMs / 86_400_000)

  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return 'yesterday'
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/* ─── Component ─────────────────────────────────────────────────────── */

interface MobileSessionRowProps {
  session: ChatSessionListItemPreview
  onTap: () => void
}

export function MobileSessionRow({ session, onTap }: MobileSessionRowProps) {
  // Resolve persona config — fallback to 'general' on unknown persona (DO NOT crash)
  const personaKey = session.agent_persona ?? 'general'
  const personaConfig =
    AGENT_PERSONA_CONFIG[personaKey] ?? AGENT_PERSONA_CONFIG['general']

  const PersonaDot = (
    <span
      className={cn('h-2 w-2 rounded-full shrink-0 block', personaConfig.dot)}
      aria-hidden
    />
  )

  const Trailing = (
    <div className="flex flex-col items-end gap-1 shrink-0">
      <LiveStatusBadge liveStatus={session.live_status} />
      {session.last_message_at && (
        <span className="text-[10px] text-muted-foreground">
          {formatRelativeTime(session.last_message_at)}
        </span>
      )}
    </div>
  )

  return (
    <MobileListItem
      leadingIcon={PersonaDot}
      title={personaConfig.displayName}
      subtitle={session.last_message_preview ?? '—'}
      trailing={Trailing}
      onPress={onTap}
    />
  )
}

/**
 * ChatSessionList - Scrollable list of chat sessions with live status badges.
 *
 * Story 10.6: Session Persistence & Resume (AC: 1, 2, 6)
 * CTM-2.3: Session List with Live Status Badges (AC: 1, 2, 3, 4, 5)
 *
 * Renders session cards showing agent persona, last message preview,
 * relative timestamp, and live status badge from tmux/PTY monitoring.
 * Supports "New Chat" creation, session selection for resume,
 * context menu for complete/delete, and a background session summary strip.
 *
 * Sorted by most recently active. Completed sessions are dimmed.
 * Polls for updates every 2 seconds via tRPC refetchInterval (CTM-2.3).
 */

import { useState, useCallback } from 'react'
import { Plus, MoreVertical, MessageSquare, Activity, Circle, CheckCircle2, XCircle } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { commands } from '@renderer/lib/rspc'
import { AGENT_PERSONA_CONFIG } from '@renderer/constants/planning-workspace'
import { ChatSessionContextMenu, type ChatSessionListItem } from './ChatSessionContextMenu'

export type { ChatSessionListItem }

interface ChatSessionListProps {
  projectId: string
  onSelectSession: (session: ChatSessionListItem) => void
  onNewChat: () => void
  /** CTM-2.3: Currently selected session ID to exclude from background summary */
  selectedSessionId?: string | null
}

/**
 * Format a timestamp to a relative time string.
 * Uses basic logic without date-fns: "just now", "N min ago", "N hours ago", "yesterday", or date.
 */
function formatRelativeTime(ts: Date | string | number | null): string {
  if (ts == null) return ''

  let date: Date
  if (ts instanceof Date) {
    date = ts
  } else if (typeof ts === 'number') {
    // Drizzle integer timestamp mode stores unix seconds
    date = new Date(ts * 1000)
  } else {
    date = new Date(ts)
  }

  const now = Date.now()
  const diffMs = now - date.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  const diffHours = Math.floor(diffMs / 3_600_000)
  const diffDays = Math.floor(diffMs / 86_400_000)

  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin} min ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
  if (diffDays === 1) return 'yesterday'
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/**
 * CTM-2.3: Live status badge configuration.
 * Maps liveStatus values to visual indicators for real-time session state.
 */
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
    Icon: Activity
  },
  idle: {
    label: 'Idle',
    className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    Icon: Circle
  },
  completed: {
    label: 'Completed',
    className: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20',
    Icon: CheckCircle2
  },
  exited: {
    label: 'Exited',
    className: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
    Icon: XCircle
  }
}

/**
 * CTM-2.3: LiveStatusBadge - Compact pill badge showing real-time session status.
 *
 * Renders a colored pill with icon and label based on liveStatus.
 * "thinking" status gets an animate-pulse effect.
 * "unknown" status renders nothing (hidden).
 */
function LiveStatusBadge({
  liveStatus,
  sessionId
}: {
  liveStatus: string | undefined
  sessionId: string
}) {
  if (!liveStatus || liveStatus === 'unknown') return null

  const config = LIVE_STATUS_CONFIG[liveStatus]
  if (!config) return null

  const { label, className, animationClassName, Icon } = config

  return (
    <span
      className={cn(
        'ml-auto inline-flex items-center gap-1 rounded-full border px-1.5 py-px text-[10px] font-medium leading-tight',
        className,
        animationClassName
      )}
      data-testid={`session-status-${sessionId}`}
    >
      <Icon className="h-2.5 w-2.5" />
      {label}
    </span>
  )
}

/**
 * CTM-2.3: BackgroundSessionSummary - Thin status strip showing active background sessions.
 *
 * Shows persona name + workflow context + live status for each active
 * background session (thinking or idle). Hidden when no background sessions exist.
 */
export function BackgroundSessionSummary({
  sessions,
  selectedSessionId
}: {
  sessions: Array<ChatSessionListItem>
  selectedSessionId?: string | null
}) {
  // Filter to active background sessions (thinking or idle), excluding the selected foreground session
  const backgroundSessions = sessions.filter(
    (s) =>
      (s.liveStatus === 'thinking' || s.liveStatus === 'idle') &&
      s.id !== selectedSessionId
  )

  if (backgroundSessions.length === 0) return null

  return (
    <div
      className="shrink-0 border-b border-border/20 px-3 py-1.5"
      data-testid="background-session-summary"
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground/70">
        {backgroundSessions.map((session, idx) => {
          const persona = AGENT_PERSONA_CONFIG[session.agent_persona]
          const personaName = persona?.displayName ?? (session.agent_persona.split(':').pop() || 'Agent')
          const statusLabel = session.liveStatus === 'thinking' ? 'thinking' : 'idle'
          const statusColor = session.liveStatus === 'thinking' ? 'text-cyan-400' : 'text-emerald-400'

          return (
            <span key={session.id} className="inline-flex items-center gap-1">
              {idx > 0 && <span className="text-muted-foreground/30">|</span>}
              <span className="font-medium">{personaName}</span>
              {session.workflow_key && (
                <span className="text-muted-foreground/40">({session.workflow_key})</span>
              )}
              <span className="text-muted-foreground/40">--</span>
              <span className={cn('font-medium', statusColor, session.liveStatus === 'thinking' && 'animate-pulse')}>
                {statusLabel}
              </span>
            </span>
          )
        })}
      </div>
    </div>
  )
}

export function ChatSessionList({ projectId, onSelectSession, onNewChat, selectedSessionId }: ChatSessionListProps) {
  const queryClient = useQueryClient()

  // CTM-2.3: Poll every 2 seconds for real-time status badge updates (was 5000ms)
  const { data: sessions = [] } = useQuery({
    queryKey: ['chat-sessions-preview', projectId],
    queryFn: async () => {
      const r = await commands.listChatSessionsWithPreview(projectId)
      if (r.status === 'error') throw new Error(JSON.stringify(r.error))
      return r.data
    },
    enabled: !!projectId,
    refetchInterval: 2000,
  })

  const updateStatus = useMutation({
    mutationFn: async ({ sessionId, status }: { sessionId: string; status: string }) => {
      const r = await commands.updateSessionStatus(sessionId, status)
      if (r.status === 'error') throw new Error(JSON.stringify(r.error))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-sessions-preview', projectId] })
    },
  })

  const deleteSession = useMutation({
    mutationFn: async ({ sessionId }: { sessionId: string }) => {
      const r = await commands.deleteChatSession(sessionId)
      if (r.status === 'error') throw new Error(JSON.stringify(r.error))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-sessions-preview', projectId] })
    },
  })

  // Track which session's context menu is open
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  const handleComplete = useCallback(
    (sessionId: string) => {
      updateStatus.mutate({ sessionId, status: 'completed' })
    },
    [updateStatus]
  )

  const handleDelete = useCallback(
    (sessionId: string) => {
      deleteSession.mutate({ sessionId })
    },
    [deleteSession]
  )

  // Adapt ChatSessionPreview to ChatSessionListItem shape.
  // T1.10 will populate liveStatus from tmux state; for now we preserve it if present (e.g. from tests).
  type SessionWithLiveStatus = (typeof sessions)[0] & { liveStatus?: ChatSessionListItem['liveStatus'] }
  const sessionItems: ChatSessionListItem[] = (sessions as SessionWithLiveStatus[]).map((s) => ({
    id: s.id,
    session_uuid: s.session_uuid,
    agent_persona: s.agent_persona ?? 'bmad:bmm:agents:pm',
    workflow_key: s.workflow_key,
    status: s.status,
    created_at: s.created_at,
    updated_at: s.updated_at,
    last_message_at: s.last_message_at,
    last_message_preview: s.last_message_preview,
    skip_permissions: s.skip_permissions,
    liveStatus: s.liveStatus,
  }))

  return (
    <div className="flex h-full flex-col" data-testid="chat-session-list">
      {/* New Chat button */}
      <div className="shrink-0 border-b border-border/20 p-3">
        <button
          type="button"
          onClick={onNewChat}
          className={cn(
            'flex w-full items-center justify-center gap-2 rounded-lg py-2',
            'border border-dashed border-border/40 text-xs font-medium',
            'text-muted-foreground transition-all duration-150',
            'hover:border-cyan-500/30 hover:bg-cyan-500/5 hover:text-cyan-400'
          )}
          data-testid="new-chat-button"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>New Chat</span>
        </button>
      </div>

      {/* CTM-2.3: Background session summary strip */}
      <BackgroundSessionSummary
        sessions={sessionItems}
        selectedSessionId={selectedSessionId}
      />

      {/* Session list */}
      <div className="flex-1 overflow-y-auto">
        {sessionItems.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center gap-3 px-6 py-12"
            data-testid="session-list-empty"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted/30">
              <MessageSquare className="h-4 w-4 text-muted-foreground/40" />
            </div>
            <p className="text-center text-xs text-muted-foreground/50">
              No previous sessions
            </p>
          </div>
        ) : (
          <div className="space-y-px p-1.5" data-testid="session-cards-container">
            {sessionItems.map((session) => {
              const persona = AGENT_PERSONA_CONFIG[session.agent_persona]
              const isCompleted = session.status === 'completed'
              const preview = session.last_message_preview
                ? session.last_message_preview.length > 60
                  ? session.last_message_preview.slice(0, 60) + '\u2026'
                  : session.last_message_preview
                : null

              const timestamp = session.last_message_at ?? session.updated_at

              // CTM-2.3: Use liveStatus for badge display
              const liveStatus = session.liveStatus

              return (
                <div
                  key={session.id}
                  className={cn(
                    'group relative rounded-md border border-transparent',
                    'transition-all duration-100',
                    'hover:border-border/30 hover:bg-accent/20',
                    isCompleted && 'opacity-60'
                  )}
                  data-testid={`session-card-${session.id}`}
                >
                  {/* Clickable card body */}
                  <button
                    type="button"
                    onClick={() => onSelectSession(session)}
                    className="w-full px-3 py-2.5 text-left"
                    data-testid={`session-card-button-${session.id}`}
                  >
                    {/* Top row: persona + status + timestamp */}
                    <div className="flex items-center gap-2">
                      {/* Persona dot + name */}
                      <span
                        className={cn(
                          'h-2 w-2 shrink-0 rounded-full',
                          persona?.dot ?? 'bg-zinc-500'
                        )}
                      />
                      <span
                        className={cn(
                          'text-xs font-medium leading-none',
                          persona?.text ?? 'text-muted-foreground'
                        )}
                      >
                        {persona?.displayName ?? session.agent_persona.split(':').pop() ?? 'Agent'}
                      </span>

                      {/* Permission mode badge */}
                      <span
                        className={cn(
                          'rounded-full border px-1 py-px text-[9px] font-medium leading-tight',
                          session.skip_permissions
                            ? 'border-amber-500/20 bg-amber-500/10 text-amber-400'
                            : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                        )}
                        title={session.skip_permissions ? 'Auto-approve tool use' : 'Manual tool approval'}
                      >
                        {session.skip_permissions ? 'Auto' : 'Manual'}
                      </span>

                      {/* CTM-2.3: Live status badge (replaces static status badge) */}
                      <LiveStatusBadge
                        liveStatus={liveStatus}
                        sessionId={session.id}
                      />
                    </div>

                    {/* Preview text */}
                    {preview && (
                      <p className="mt-1.5 truncate text-[11px] leading-snug text-muted-foreground/60">
                        {preview}
                      </p>
                    )}

                    {/* Timestamp */}
                    <p className="mt-1 text-[10px] text-muted-foreground/40">
                      {formatRelativeTime(timestamp)}
                    </p>
                  </button>

                  {/* Kebab menu trigger */}
                  <div className="absolute right-1.5 top-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setOpenMenuId(openMenuId === session.id ? null : session.id)
                      }}
                      className={cn(
                        'flex h-6 w-6 items-center justify-center rounded',
                        'text-muted-foreground/30 transition-colors',
                        'opacity-0 group-hover:opacity-100',
                        'hover:bg-accent/40 hover:text-muted-foreground',
                        openMenuId === session.id && 'opacity-100 text-muted-foreground'
                      )}
                      aria-label={`Session actions for ${persona?.displayName ?? 'agent'}`}
                      data-testid={`session-menu-trigger-${session.id}`}
                    >
                      <MoreVertical className="h-3.5 w-3.5" />
                    </button>

                    {/* Context menu */}
                    <ChatSessionContextMenu
                      session={session}
                      onComplete={() => handleComplete(session.id)}
                      onDelete={() => handleDelete(session.id)}
                      isOpen={openMenuId === session.id}
                      onOpenChange={(open) => setOpenMenuId(open ? session.id : null)}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

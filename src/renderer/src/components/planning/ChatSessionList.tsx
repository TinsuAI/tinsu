/**
 * ChatSessionList - Scrollable list of chat sessions with previews.
 *
 * Story 10.6: Session Persistence & Resume (AC: 1, 2, 6)
 *
 * Renders session cards showing agent persona, last message preview,
 * relative timestamp, and status badge. Supports "New Chat" creation,
 * session selection for resume, and context menu for complete/delete.
 *
 * Sorted by most recently active. Completed sessions are dimmed.
 * Polls for updates every 5 seconds via tRPC refetchInterval.
 */

import { useState, useCallback } from 'react'
import { Plus, MoreVertical, MessageSquare } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { trpc } from '@renderer/lib/trpc'
import { AGENT_PERSONA_CONFIG } from '@renderer/constants/planning-workspace'
import { ChatSessionContextMenu, type ChatSessionListItem } from './ChatSessionContextMenu'

export type { ChatSessionListItem }

interface ChatSessionListProps {
  projectId: string
  onSelectSession: (session: ChatSessionListItem) => void
  onNewChat: () => void
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

/** Status badge configuration */
const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  active: {
    label: 'Active',
    className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
  },
  paused: {
    label: 'Paused',
    className: 'bg-amber-500/15 text-amber-400 border-amber-500/20'
  },
  completed: {
    label: 'Completed',
    className: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20'
  }
}

export function ChatSessionList({ projectId, onSelectSession, onNewChat }: ChatSessionListProps) {
  const { data: sessions = [] } = trpc.chatSession.listWithPreview.useQuery(
    { projectId },
    { refetchInterval: 5000 }
  )

  const trpcUtils = trpc.useUtils()

  const updateStatus = trpc.chatSession.updateStatus.useMutation({
    onSuccess: () => {
      trpcUtils.chatSession.listWithPreview.invalidate({ projectId })
    }
  })

  const deleteSession = trpc.chatSession.deleteSession.useMutation({
    onSuccess: () => {
      trpcUtils.chatSession.listWithPreview.invalidate({ projectId })
    }
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

      {/* Session list */}
      <div className="flex-1 overflow-y-auto">
        {sessions.length === 0 ? (
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
            {sessions.map((session) => {
              const persona = AGENT_PERSONA_CONFIG[session.agent_persona]
              const statusConfig = STATUS_CONFIG[session.status] ?? STATUS_CONFIG.active
              const isCompleted = session.status === 'completed'
              const preview = session.lastMessagePreview
                ? session.lastMessagePreview.length > 60
                  ? session.lastMessagePreview.slice(0, 60) + '\u2026'
                  : session.lastMessagePreview
                : null

              const timestamp = session.last_message_at ?? session.updated_at

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
                    onClick={() => onSelectSession(session as ChatSessionListItem)}
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

                      {/* Status badge */}
                      <span
                        className={cn(
                          'ml-auto rounded-full border px-1.5 py-px text-[10px] font-medium leading-tight',
                          statusConfig.className
                        )}
                        data-testid={`session-status-${session.id}`}
                      >
                        {statusConfig.label}
                      </span>
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
                      session={session as ChatSessionListItem}
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

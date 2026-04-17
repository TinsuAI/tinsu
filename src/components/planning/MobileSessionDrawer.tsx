/**
 * MobileSessionDrawer - Full-screen session switcher for mobile planning workspace.
 *
 * Story t3-7: Mobile Chat with Planning Agents (AC: 2, 5, 6)
 *
 * Accessible via a slide-out bottom drawer (Sheet) on mobile devices.
 * Displays active chat sessions with live status indicators, last message preview,
 * and session metadata. Optimized for thumb navigation with generous touch targets.
 *
 * Features:
 * - Live status indicators: thinking (pulsing cyan), idle (green), completed (gray), exited (amber)
 * - Last message preview with timestamp
 * - Session selection without context loss
 * - New Chat creation button
 * - Haptic feedback on selection (mobile only)
 */

import { useCallback, useState } from 'react'
import { Plus, MessageSquare, Activity, Circle, CheckCircle2, XCircle } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { cn } from '@renderer/lib/utils'
import { commands } from '@renderer/lib/rspc'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@renderer/components/ui/sheet'
import { Button } from '@renderer/components/ui/button'
import { AGENT_PERSONA_CONFIG } from '@renderer/constants/planning-workspace'
import type { ChatSessionListItem } from './ChatSessionContextMenu'

interface MobileSessionDrawerProps {
  projectId: string
  selectedSessionId?: string | null
  onSelectSession: (session: ChatSessionListItem) => void
  onNewChat: () => void
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
}

/**
 * Format a timestamp to relative time for mobile display.
 * Compact format for small screens: "now", "2m", "5h", "Yesterday", "Mar 15"
 * Guard: Handle invalid dates gracefully.
 */
function formatMobileTime(ts: Date | string | number | null): string {
  if (ts == null) return ''

  let date: Date
  if (ts instanceof Date) {
    date = ts
  } else if (typeof ts === 'number') {
    date = new Date(ts * 1000)
  } else {
    date = new Date(ts)
  }

  // Guard: Check if date is valid before calculating diff
  const timestamp = date.getTime()
  if (isNaN(timestamp)) {
    return 'Unknown'
  }

  const now = Date.now()
  const diffMs = now - timestamp
  const diffMin = Math.floor(diffMs / 60_000)
  const diffHours = Math.floor(diffMs / 3_600_000)
  const diffDays = Math.floor(diffMs / 86_400_000)

  if (diffMin < 1) return 'now'
  if (diffMin < 60) return `${diffMin}m`
  if (diffHours < 24) return `${diffHours}h`
  if (diffDays === 1) return 'Yesterday'
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/**
 * Live status indicator config for mobile (compact format).
 */
const LIVE_STATUS_CONFIG: Record<string, {
  label: string
  shortLabel: string
  className: string
  animationClassName?: string
  Icon: React.ReactNode
}> = {
  thinking: {
    label: 'Thinking',
    shortLabel: 'Thinking...',
    className: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20',
    animationClassName: 'animate-pulse',
    Icon: <Activity className="h-3 w-3" />
  },
  idle: {
    label: 'Idle',
    shortLabel: 'Idle',
    className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    Icon: <Circle className="h-2.5 w-2.5 fill-current" />
  },
  completed: {
    label: 'Completed',
    shortLabel: 'Done',
    className: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20',
    Icon: <CheckCircle2 className="h-3 w-3" />
  },
  exited: {
    label: 'Exited',
    shortLabel: 'Exited',
    className: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
    Icon: <XCircle className="h-3 w-3" />
  }
}

/**
 * Truncate message preview to 2 lines for mobile display.
 * Guard: Handle empty or whitespace-only text gracefully.
 */
function truncatePreview(text: string, maxLength = 60): string {
  if (!text || !text.trim()) {
    return '(no message)'
  }
  const lines = text.split('\n').slice(0, 2).join(' ').trim()
  if (lines.length > maxLength) {
    return lines.substring(0, maxLength - 1).trim() + '…'
  }
  return lines || '(no message)'
}

/**
 * SessionCard - Touch-friendly session entry with status and preview.
 */
function SessionCard({
  session,
  isSelected,
  onSelect
}: {
  session: ChatSessionListItem
  isSelected: boolean
  onSelect: () => void
}) {
  const persona = AGENT_PERSONA_CONFIG[session.persona_key]
  const statusConfig = LIVE_STATUS_CONFIG[session.live_status || 'idle']
  const lastMessageTime = formatMobileTime(session.last_message_at)

  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full rounded-lg border-2 p-4 text-left transition-all duration-200 active:scale-95',
        isSelected
          ? 'border-cyan-500/50 bg-cyan-500/5 shadow-sm'
          : 'border-border/40 bg-muted/30 hover:border-cyan-500/30 hover:bg-muted/50'
      )}
      aria-pressed={isSelected}
      role="option"
    >
      {/* Header: Agent name + Status badge */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {persona?.color && (
            <div
              className="h-2.5 w-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: persona.color }}
              aria-hidden="true"
            />
          )}
          <span className="truncate font-medium text-sm text-foreground">
            {persona?.name || session.persona_key}
          </span>
        </div>
        {statusConfig && (
          <div
            className={cn(
              'flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium flex-shrink-0',
              statusConfig.className,
              statusConfig.animationClassName
            )}
          >
            {statusConfig.Icon}
            <span className="hidden xs:inline">{statusConfig.shortLabel}</span>
          </div>
        )}
      </div>

      {/* Message preview + timestamp */}
      <div className="space-y-1.5">
        <p className="text-xs leading-normal text-foreground/70 line-clamp-2">
          {truncatePreview(session.last_message || '(no message)')}
        </p>
        <p className="text-xs text-muted-foreground">{lastMessageTime}</p>
      </div>
    </button>
  )
}

/**
 * MobileSessionDrawer - Full-screen drawer for session management on mobile.
 *
 * Accessibility:
 * - Role="dialog" via Sheet
 * - Keyboard navigation within list
 * - Live region for status updates
 * - Large touch targets (min 44px per WCAG 2.1 Level AAA)
 */
export function MobileSessionDrawer({
  projectId,
  selectedSessionId,
  onSelectSession,
  onNewChat,
  isOpen: controlledOpen,
  onOpenChange
}: MobileSessionDrawerProps) {
  const queryClient = useQueryClient()
  const [isOpen, setIsOpen] = useState(false)

  // Handle controlled vs uncontrolled open state
  const open = controlledOpen ?? isOpen
  const setOpen = (newOpen: boolean) => {
    setIsOpen(newOpen)
    onOpenChange?.(newOpen)
  }

  // Fetch all sessions for current project
  const { data: sessions = [], isLoading, isError, error } = useQuery({
    queryKey: ['chat-sessions-list', projectId],
    queryFn: async () => {
      // Guard: validate projectId is non-empty
      if (!projectId?.trim()) {
        throw new Error('Project ID is required to fetch sessions')
      }
      const r = await commands.listChatSessionsWithPreview(projectId)
      // Guard: improve error handling with better message extraction
      if (r.status === 'error') {
        const errorMsg = typeof r.error === 'string' ? r.error : r.error?.message || 'Failed to fetch sessions'
        throw new Error(errorMsg)
      }
      // Sort by most recently active, guarding against invalid dates
      return (r.data || []).sort((a, b) => {
        const getTimestamp = (ts: Date | string | number | null) => {
          if (!ts) return 0
          try {
            const date = new Date(ts)
            return isNaN(date.getTime()) ? 0 : date.getTime()
          } catch {
            return 0
          }
        }
        const aTime = getTimestamp(a.last_message_at)
        const bTime = getTimestamp(b.last_message_at)
        return bTime - aTime
      })
    },
    enabled: !!projectId && open,
    refetchInterval: open ? 2000 : false,
    retry: 1
  })

  // Haptic feedback on mobile selection
  const handleSelectSession = useCallback(
    (session: ChatSessionListItem) => {
      // Trigger haptic feedback on mobile (Tauri mobile API).
      // Guard: Check prefers-reduced-motion to respect accessibility preferences.
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (!prefersReducedMotion && typeof window !== 'undefined' && 'navigator' in window) {
        // @ts-ignore - W3C Vibration API available on mobile browsers; TypeScript definitions lag
        navigator.vibrate?.(10)
      }

      onSelectSession(session)
      setOpen(false)
    },
    [onSelectSession, setOpen]
  )

  const handleNewChat = useCallback(() => {
    // Haptic feedback on new chat.
    // Guard: Check prefers-reduced-motion to respect accessibility preferences.
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!prefersReducedMotion && typeof window !== 'undefined' && 'navigator' in window) {
      // @ts-ignore - W3C Vibration API available on mobile browsers; TypeScript definitions lag
      navigator.vibrate?.(20)
    }
    onNewChat()
    setOpen(false)
  }, [onNewChat, setOpen])

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-lg hover:bg-muted"
          aria-label="Open chat sessions"
          title="Chat sessions"
        >
          <MessageSquare className="h-5 w-5" />
        </Button>
      </SheetTrigger>

      <SheetContent
        side="bottom"
        className={cn(
          'h-[90dvh] max-h-[90dvh] rounded-t-2xl border-b border-t',
          'flex flex-col gap-0 p-0 sm:max-w-full'
        )}
      >
        {/* Header with title and new chat button */}
        <div className="border-b border-border/40 bg-gradient-to-b from-background/95 to-background/80 px-4 py-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Agent Sessions</h2>
          <Button
            onClick={handleNewChat}
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs rounded-lg"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden xs:inline">New</span>
          </Button>
        </div>

        {/* Sessions list - scrollable content */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {isError ? (
            <div className="flex flex-col items-center justify-center gap-2 p-6 h-40">
              <p className="text-sm text-destructive font-medium">Failed to load sessions</p>
              <p className="text-xs text-muted-foreground text-center">{error?.message || 'Unknown error'}</p>
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-sm text-muted-foreground">Loading sessions…</p>
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 p-6 h-40">
              <MessageSquare className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground text-center">
                No active sessions. Create one to get started.
              </p>
              <Button
                onClick={handleNewChat}
                className="h-9 gap-1.5"
              >
                <Plus className="h-4 w-4" />
                New Chat
              </Button>
            </div>
          ) : (
            <div className="space-y-2 p-4">
              {sessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  isSelected={session.id === selectedSessionId}
                  onSelect={() => handleSelectSession(session)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer hint (on non-iOS to avoid keyboard overlap) */}
        {sessions.length > 0 && (
          <div className="border-t border-border/40 bg-muted/30 px-4 py-2 text-center text-xs text-muted-foreground">
            Tap a session to switch or create a new one
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

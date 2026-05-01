/**
 * MobileChatMessageList — scrollable message area for the chat screen.
 *
 * Features:
 *   - Queries messages via useQuery (refetchInterval: 2000)
 *   - Subscribes to 'chat:message-received' Tauri event (isMounted guard, unlisten on cleanup)
 *   - Auto-scroll to bottom on new messages unless user scrolled up >100 px
 *   - Floating "↓ N new" pill when auto-scroll is locked
 *   - Renders last 200 messages max (virtualization deferred to T3.5-9)
 *   - isAgentThinking → renders ChatWorkingIndicator at bottom
 *   - Reduced motion: scrollTo behavior 'auto' vs 'smooth'
 *
 * Cross-tree imports (allowed per AC 17):
 *   - commands from @renderer/lib/rspc
 *   - ChatWorkingIndicator from @renderer/components/planning/ChatWorkingIndicator
 *
 * Story T3.5-5 — Mobile Planning (AC 8, 11, 12, 16, Task 7)
 */

import { useRef, useEffect, useCallback, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { listen } from '@tauri-apps/api/event'
import { commands } from '@renderer/lib/rspc'
import { ChatWorkingIndicator } from '@renderer/components/planning/ChatWorkingIndicator'
import type { AgentPersonaConfig } from '@renderer/constants/planning-workspace'
import { cn } from '@renderer/lib/utils'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { MobileLoadingSkeleton } from '../primitives/MobileLoadingSkeleton'
import { MobileEmptyState } from '../primitives/MobileEmptyState'
import { MobileChatBubble, type ChatMessage } from './MobileChatBubble'

/* ─── Component ─────────────────────────────────────────────────────── */

interface MobileChatMessageListProps {
  sessionId: string
  projectId: string | null
  persona: AgentPersonaConfig
  agentPersonaKey: string
  isAgentThinking: boolean
  toolActivity: null
}

export function MobileChatMessageList({
  sessionId,
  projectId,
  persona,
  agentPersonaKey,
  isAgentThinking,
  toolActivity,
}: MobileChatMessageListProps) {
  const queryClient = useQueryClient()
  const reduced = useReducedMotion()

  /* ── Data ──────────────────────────────────────────────────────────── */
  const { data, isLoading, error } = useQuery({
    queryKey: ['chat-messages', sessionId],
    queryFn: async () => {
      const r = await commands.getChatMessages(sessionId, null, null)
      if (r.status === 'error') throw new Error(JSON.stringify(r.error))
      return r.data as ChatMessage[]
    },
    refetchInterval: 2000,
    enabled: !!sessionId,
  })

  const messages = data ?? []

  /* ── Tauri event listener ──────────────────────────────────────────── */
  useEffect(() => {
    if (!sessionId) return
    let isMounted = true

    const setup = async () => {
      const unlisten = await listen<{ session_id: string }>(
        'chat:message-received',
        (event) => {
          if (!isMounted) return
          if (event.payload.session_id !== sessionId) return
          void queryClient.invalidateQueries({ queryKey: ['chat-messages', sessionId] })
          if (projectId) {
            void queryClient.invalidateQueries({ queryKey: ['chat-sessions-preview', projectId] })
          }
        },
      )
      if (!isMounted) {
        unlisten()
      } else {
        return unlisten
      }
    }

    let unlistenFn: (() => void) | undefined

    void setup().then((fn) => {
      unlistenFn = fn
    })

    return () => {
      isMounted = false
      unlistenFn?.()
    }
  }, [sessionId, queryClient, projectId])

  /* ── Auto-scroll & "↓ N new" pill ─────────────────────────────────── */
  const scrollRef = useRef<HTMLDivElement>(null)
  const isAtBottomRef = useRef(true)
  const prevMessageCountRef = useRef(0)
  const [newMessageCount, setNewMessageCount] = useState(0)

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = reduced ? 'auto' : 'smooth') => {
      const el = scrollRef.current
      if (!el) return
      el.scrollTo({ top: el.scrollHeight, behavior })
      setNewMessageCount(0)
      isAtBottomRef.current = true
    },
    [reduced],
  )

  // Handle scroll events to detect user scrolling up
  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    if (distanceFromBottom > 100) {
      isAtBottomRef.current = false
    } else if (distanceFromBottom < 50) {
      isAtBottomRef.current = true
      setNewMessageCount(0)
    }
  }, [])

  // Auto-scroll or increment pill count on new messages
  useEffect(() => {
    const count = messages.length
    if (count > prevMessageCountRef.current) {
      const delta = count - prevMessageCountRef.current
      if (isAtBottomRef.current) {
        scrollToBottom()
      } else {
        setNewMessageCount((n) => n + delta)
      }
    }
    prevMessageCountRef.current = count
  }, [messages.length, scrollToBottom])

  /* ── Render ────────────────────────────────────────────────────────── */

  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-2">
        <MobileLoadingSkeleton variant="chat-bubble" count={3} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 overflow-y-auto">
        <MobileEmptyState
          title="Couldn't load messages"
          subtitle={error instanceof Error ? error.message : 'Unknown error'}
        />
      </div>
    )
  }

  // Render last 200 messages only (virtualization deferred to T3.5-9)
  // Trade-off: real-world planning sessions rarely exceed 200 messages;
  // scroll perf is acceptable. Revisit in T3.5-9 real-device validation.
  const visibleMessages = messages.slice(-200)

  return (
    <div className="relative flex-1 min-h-0 flex flex-col">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overscroll-contain py-2"
        data-testid="mobile-chat-message-list"
      >
        {visibleMessages.length === 0 && !isAgentThinking && (
          <MobileEmptyState
            title="Start the conversation"
            subtitle="Send a message to begin your planning session."
          />
        )}

        {visibleMessages.map((msg) => (
          <MobileChatBubble
            key={msg.id}
            message={msg}
            persona={persona}
          />
        ))}

        {isAgentThinking && (
          <div className="px-3 py-1">
            <ChatWorkingIndicator
              agentPersona={agentPersonaKey}
              toolActivity={toolActivity}
            />
          </div>
        )}
      </div>

      {/* Floating "↓ N new messages" pill */}
      {newMessageCount > 0 && !isAtBottomRef.current && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10">
          <button
            type="button"
            onClick={() => scrollToBottom()}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full',
              'bg-card border border-border/40',
              'px-3 py-1.5 text-xs text-foreground shadow-md',
              'transition-all duration-150 active:scale-95',
            )}
            aria-label={`${newMessageCount} new message${newMessageCount !== 1 ? 's' : ''} — tap to scroll to bottom`}
          >
            <span>↓</span>
            <span>{newMessageCount} new</span>
          </button>
        </div>
      )}
    </div>
  )
}

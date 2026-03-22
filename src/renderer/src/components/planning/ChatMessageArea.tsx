/**
 * ChatMessageArea - Scrollable message container for chat panel.
 *
 * Story 10.2: Chat Panel UI & Message Bubbles (AC: 3, 7)
 *
 * Renders ChatMessageBubble for each message in the session.
 * Auto-scrolls to bottom on new messages unless user has scrolled up.
 * Shows empty state when no messages exist.
 */

import { useEffect, useRef, useCallback } from 'react'
import { MessageSquare } from 'lucide-react'
import { ChatMessageBubble } from './ChatMessageBubble'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'tool'
  content: string
  /** Timestamp — Date object, ISO string (from tRPC JSON), or unix-second number */
  created_at: Date | string | number
}

interface ChatMessageAreaProps {
  messages: ChatMessage[]
  agentPersona?: string | null
}

/** Threshold in pixels from bottom before auto-scroll is paused */
const SCROLL_THRESHOLD = 50

export function ChatMessageArea({ messages, agentPersona }: ChatMessageAreaProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const isUserScrolledUp = useRef(false)

  /** Detect user scroll position relative to bottom */
  const handleScroll = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight
    isUserScrolledUp.current = distanceFromBottom > SCROLL_THRESHOLD
  }, [])

  /** Auto-scroll to bottom on new messages if user hasn't scrolled up */
  useEffect(() => {
    if (!isUserScrolledUp.current && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages.length])

  // Empty state
  if (messages.length === 0) {
    return (
      <div
        className="flex flex-1 flex-col items-center justify-center gap-3 px-6"
        data-testid="chat-empty-state"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted/40">
          <MessageSquare className="h-5 w-5 text-muted-foreground/50" />
        </div>
        <p className="text-center text-sm text-muted-foreground/60">
          Start a conversation with your agent
        </p>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto px-3 py-3"
      data-testid="chat-message-area"
    >
      <div className="space-y-3">
        {messages
          .filter((msg) => msg.role !== 'tool')
          .map((msg) => (
            <ChatMessageBubble
              key={msg.id}
              role={msg.role as 'user' | 'assistant'}
              content={msg.content}
              agentPersona={agentPersona}
              createdAt={msg.created_at}
            />
          ))}
      </div>
      {/* Sentinel div for auto-scroll */}
      <div ref={bottomRef} />
    </div>
  )
}

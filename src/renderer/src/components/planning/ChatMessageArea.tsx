/**
 * ChatMessageArea - Scrollable message container for chat panel.
 *
 * Story 10.2: Chat Panel UI & Message Bubbles (AC: 3, 7)
 * Story 10.3: Claude Code CLI Chat Session Spawning (AC: 4)
 *
 * Renders ChatMessageBubble for each message in the session.
 * Auto-scrolls to bottom on new messages unless user has scrolled up.
 * Shows empty state when no messages exist.
 * Shows typing indicator when agent is thinking.
 */

import { useEffect, useRef, useCallback } from 'react'
import { MessageSquare } from 'lucide-react'
import { ChatMessageBubble } from './ChatMessageBubble'
import { AGENT_PERSONA_CONFIG } from '@renderer/constants/planning-workspace'

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
  /** When true, show a typing/thinking indicator at the bottom (AC: 4) */
  isAgentThinking?: boolean
}

/** Threshold in pixels from bottom before auto-scroll is paused */
const SCROLL_THRESHOLD = 50

export function ChatMessageArea({
  messages,
  agentPersona,
  isAgentThinking = false
}: ChatMessageAreaProps) {
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

  /** Auto-scroll to bottom on new messages or thinking indicator if user hasn't scrolled up */
  useEffect(() => {
    if (!isUserScrolledUp.current && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages.length, isAgentThinking])

  // Resolve persona display name for thinking indicator
  const personaLabel =
    agentPersona && AGENT_PERSONA_CONFIG[agentPersona]
      ? AGENT_PERSONA_CONFIG[agentPersona].displayName
      : 'Agent'

  // Empty state
  if (messages.length === 0 && !isAgentThinking) {
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

        {/* Typing indicator — visible when agent is processing (AC: 4) */}
        {isAgentThinking && (
          <div
            className="flex items-start gap-2"
            data-testid="chat-thinking-indicator"
          >
            <div className="max-w-[85%] rounded-xl rounded-tl-sm bg-muted/30 px-3 py-2">
              <div className="mb-1 text-[10px] font-medium text-muted-foreground/50">
                {personaLabel}
              </div>
              <div className="flex items-center gap-1">
                <span
                  className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/40"
                  style={{ animationDelay: '0ms' }}
                />
                <span
                  className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/40"
                  style={{ animationDelay: '200ms' }}
                />
                <span
                  className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/40"
                  style={{ animationDelay: '400ms' }}
                />
                <span className="ml-1.5 text-xs text-muted-foreground/40">
                  is thinking...
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* Sentinel div for auto-scroll */}
      <div ref={bottomRef} />
    </div>
  )
}

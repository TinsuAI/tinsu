/**
 * ChatMessageArea - Scrollable message container for chat panel.
 *
 * Story 10.2: Chat Panel UI & Message Bubbles (AC: 3, 7)
 * Story 10.3: Claude Code CLI Chat Session Spawning (AC: 4)
 * Story 10.5: Tool Activity & Working Indicators (AC: 1, 2, 3, 4, 5)
 *
 * Renders ChatMessageBubble for user/assistant messages, ChatToolActivityGroup
 * for consecutive tool messages, standalone notification cards for permission
 * prompts, and ChatWorkingIndicator when the agent is thinking.
 *
 * Auto-scrolls to bottom on new messages unless user has scrolled up.
 * Shows empty state when no messages exist.
 */

import { useEffect, useRef, useCallback, useMemo } from 'react'
import { MessageSquare, AlertTriangle } from 'lucide-react'
import { ChatMessageBubble } from './ChatMessageBubble'
import { ChatToolActivityGroup } from './ChatToolActivityGroup'
import { ChatWorkingIndicator } from './ChatWorkingIndicator'
import { ChatArtifactNotification } from './ChatArtifactNotification'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'tool'
  content: string
  tool_name?: string | null
  tool_input?: string | null
  /** Timestamp — Date object, ISO string (from tRPC JSON), or unix-second number */
  created_at: Date | string | number
}

interface ChatMessageAreaProps {
  messages: ChatMessage[]
  agentPersona?: string | null
  /** When true, show a typing/thinking indicator at the bottom (AC: 4) */
  isAgentThinking?: boolean
  /** Current tool activity for contextual working indicator (Story 10.5, AC: 1) */
  currentToolActivity?: {
    toolName: string
    toolInput: Record<string, unknown>
  } | null
}

/** Threshold in pixels from bottom before auto-scroll is paused */
const SCROLL_THRESHOLD = 50

/**
 * Segment type for rendering: user/assistant messages, tool groups, or notifications.
 */
type MessageSegment =
  | { type: 'message'; message: ChatMessage }
  | { type: 'toolGroup'; messages: ChatMessage[] }
  | { type: 'notification'; message: ChatMessage }
  | { type: 'artifactNotification'; message: ChatMessage }

/**
 * Group messages into segments for rendering.
 *
 * - user/assistant messages become individual 'message' segments
 * - consecutive tool messages (excluding __notification__) are grouped into 'toolGroup' segments
 * - __notification__ tool messages become individual 'notification' segments
 */
function groupMessages(messages: ChatMessage[]): MessageSegment[] {
  const segments: MessageSegment[] = []
  let currentToolGroup: ChatMessage[] = []

  function flushToolGroup(): void {
    if (currentToolGroup.length > 0) {
      segments.push({ type: 'toolGroup', messages: [...currentToolGroup] })
      currentToolGroup = []
    }
  }

  for (const msg of messages) {
    if (msg.role === 'tool') {
      // Artifact created messages render as artifact notification cards (Story 10.7, AC: 3)
      if (msg.tool_name === '__artifact_created__') {
        flushToolGroup()
        segments.push({ type: 'artifactNotification', message: msg })
      // Notification messages render standalone (AC: 5)
      } else if (msg.tool_name === '__notification__') {
        flushToolGroup()
        segments.push({ type: 'notification', message: msg })
      } else {
        // Regular tool messages group together (AC: 4)
        currentToolGroup.push(msg)
      }
    } else {
      // user/assistant messages flush any pending tool group
      flushToolGroup()
      segments.push({ type: 'message', message: msg })
    }
  }

  // Flush any trailing tool group
  flushToolGroup()

  return segments
}

/**
 * Parse notification tool_input JSON to extract type and message.
 */
function parseNotificationInput(
  toolInput: string | null | undefined
): { type: string; message: string } | null {
  if (!toolInput) return null
  try {
    const parsed = JSON.parse(toolInput) as Record<string, unknown>
    return {
      type: (parsed.type as string) ?? '',
      message: (parsed.message as string) ?? ''
    }
  } catch {
    return null
  }
}

export function ChatMessageArea({
  messages,
  agentPersona,
  isAgentThinking = false,
  currentToolActivity = null
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

  // Group messages into segments for rendering
  const segments = useMemo(() => groupMessages(messages), [messages])

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
        {segments.map((segment, idx) => {
          switch (segment.type) {
            case 'message':
              return (
                <ChatMessageBubble
                  key={segment.message.id}
                  role={segment.message.role as 'user' | 'assistant'}
                  content={segment.message.content}
                  agentPersona={agentPersona}
                  createdAt={segment.message.created_at}
                />
              )

            case 'toolGroup':
              return (
                <ChatToolActivityGroup
                  key={`tool-group-${segment.messages[0].id}`}
                  toolMessages={segment.messages.map((m) => ({
                    id: m.id,
                    role: 'tool' as const,
                    content: m.content,
                    tool_name: m.tool_name ?? null,
                    tool_input: m.tool_input ?? null,
                    created_at: m.created_at
                  }))}
                />
              )

            case 'artifactNotification':
              return (
                <ChatArtifactNotification
                  key={segment.message.id}
                  message={segment.message}
                />
              )

            case 'notification': {
              const notifInput = parseNotificationInput(segment.message.tool_input)
              const isPermissionPrompt = notifInput?.type === 'permission_prompt'
              return (
                <div
                  key={segment.message.id}
                  className="mx-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2"
                  data-testid="chat-notification-message"
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
                    <span className="text-xs font-medium text-amber-300">
                      {isPermissionPrompt
                        ? 'Agent needs permission to proceed'
                        : `Notification: ${notifInput?.type ?? 'unknown'}`}
                    </span>
                  </div>
                  {notifInput?.message && (
                    <p className="mt-1 pl-6 text-xs text-amber-200/70">
                      {notifInput.message}
                    </p>
                  )}
                </div>
              )
            }

            default:
              return null
          }
        })}

        {/* Working indicator — visible when agent is processing (Story 10.5, AC: 1) */}
        {isAgentThinking && (
          <ChatWorkingIndicator
            agentPersona={agentPersona}
            currentToolActivity={currentToolActivity}
          />
        )}
      </div>
      {/* Sentinel div for auto-scroll */}
      <div ref={bottomRef} />
    </div>
  )
}

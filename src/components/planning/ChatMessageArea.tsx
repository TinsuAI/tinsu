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

import { useState, useLayoutEffect, useRef, useCallback, useMemo } from 'react'
import { MessageSquare, AlertTriangle, ShieldAlert, Terminal, ChevronDown } from 'lucide-react'
import { ChatMessageBubble } from './ChatMessageBubble'
import { ChatToolActivityGroup } from './ChatToolActivityGroup'
import { ChatWorkingIndicator } from './ChatWorkingIndicator'
import { ChatArtifactNotification } from './ChatArtifactNotification'
import type { ChatMessageAttachment } from '@shared/types/chat.types'

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
  /** Pre-built lookup map: message_id -> attachments array */
  attachmentsByMessageId?: Record<string, ChatMessageAttachment[]>
  /** Callback to delete a single message by ID */
  onDeleteMessage?: (messageId: string) => void
  /** Callback to resolve a permission request (approve or deny) */
  onResolvePermission?: (requestId: string, decision: 'allow' | 'deny') => void
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
  | { type: 'permissionRequest'; message: ChatMessage }
  | { type: 'commandOutput'; message: ChatMessage }

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
      // Permission request messages render as interactive approve/deny cards
      if (msg.tool_name === '__permission_request__') {
        flushToolGroup()
        segments.push({ type: 'permissionRequest', message: msg })
      // Artifact created messages render as artifact notification cards (Story 10.7, AC: 3)
      } else if (msg.tool_name === '__artifact_created__') {
        flushToolGroup()
        segments.push({ type: 'artifactNotification', message: msg })
      // Slash command output renders as a code block (AC: 5)
      } else if (msg.tool_name === '__command_output__') {
        flushToolGroup()
        segments.push({ type: 'commandOutput', message: msg })
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

/**
 * Parse permission request tool_input JSON.
 */
function parsePermissionInput(
  toolInput: string | null | undefined
): { requestId: string; toolName: string; toolInput: Record<string, unknown> } | null {
  if (!toolInput) return null
  try {
    const parsed = JSON.parse(toolInput) as Record<string, unknown>
    return {
      requestId: (parsed.requestId as string) ?? '',
      toolName: (parsed.toolName as string) ?? '',
      toolInput: (parsed.toolInput as Record<string, unknown>) ?? {}
    }
  } catch {
    return null
  }
}

/**
 * Permission request card — shows tool name, input summary, and Approve/Deny buttons.
 * Buttons are disabled after the user makes a decision.
 */
function PermissionRequestCard({
  requestId,
  toolName,
  toolInput,
  onResolve
}: {
  requestId: string
  toolName: string
  toolInput: Record<string, unknown>
  onResolve?: (requestId: string, decision: 'allow' | 'deny') => void
}) {
  const [resolved, setResolved] = useState<'allow' | 'deny' | null>(null)

  const handleApprove = (): void => {
    setResolved('allow')
    onResolve?.(requestId, 'allow')
  }

  const handleDeny = (): void => {
    setResolved('deny')
    onResolve?.(requestId, 'deny')
  }

  // Build a short summary of what the tool wants to do
  const summary = toolInput.command
    ? String(toolInput.command).slice(0, 120)
    : toolInput.file_path
      ? String(toolInput.file_path)
      : toolInput.path
        ? String(toolInput.path)
        : toolInput.pattern
          ? String(toolInput.pattern)
          : null

  return (
    <div
      className="mx-1 rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-2.5"
      data-testid="permission-request-card"
    >
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 shrink-0 text-orange-400" />
        <span className="text-xs font-medium text-orange-300">
          Permission required: {toolName}
        </span>
      </div>
      {summary && (
        <p className="mt-1 truncate pl-6 font-mono text-[11px] text-orange-200/60">
          {summary}
        </p>
      )}
      {resolved ? (
        <p className="mt-2 pl-6 text-[11px] font-medium text-muted-foreground/60">
          {resolved === 'allow' ? 'Approved' : 'Denied'}
        </p>
      ) : (
        <div className="mt-2 flex items-center gap-2 pl-6">
          <button
            type="button"
            onClick={handleApprove}
            className="rounded bg-emerald-500/20 px-2.5 py-1 text-[11px] font-medium text-emerald-400 transition-colors hover:bg-emerald-500/30"
          >
            Approve
          </button>
          <button
            type="button"
            onClick={handleDeny}
            className="rounded bg-red-500/20 px-2.5 py-1 text-[11px] font-medium text-red-400 transition-colors hover:bg-red-500/30"
          >
            Deny
          </button>
        </div>
      )}
    </div>
  )
}

export function ChatMessageArea({
  messages,
  agentPersona,
  isAgentThinking = false,
  currentToolActivity = null,
  attachmentsByMessageId = {},
  onDeleteMessage,
  onResolvePermission
}: ChatMessageAreaProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  // True until the user intentionally scrolls up; reset to true when they scroll back to bottom.
  const isUserAtBottom = useRef(true)
  const [showScrollButton, setShowScrollButton] = useState(false)

  /** Track whether user is at the bottom on every scroll event */
  const handleScroll = useCallback(() => {
    const container = containerRef.current
    if (!container) return
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight
    const atBottom = distanceFromBottom <= SCROLL_THRESHOLD
    isUserAtBottom.current = atBottom
    setShowScrollButton(!atBottom)
  }, [])

  /** Scroll to bottom imperatively */
  const scrollToBottom = useCallback(() => {
    const container = containerRef.current
    if (!container) return
    container.scrollTop = container.scrollHeight
    isUserAtBottom.current = true
    setShowScrollButton(false)
  }, [])

  /** Auto-scroll to bottom when new content arrives, unless user has scrolled up */
  useLayoutEffect(() => {
    if (isUserAtBottom.current) {
      scrollToBottom()
    }
  }, [messages.length, isAgentThinking, scrollToBottom])

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
    <div className="relative min-h-0 flex-1 overflow-hidden">
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="h-full overflow-y-auto px-3 py-3"
      data-testid="chat-message-area"
    >
      <div className="space-y-3">
        {segments.map((segment) => {
          switch (segment.type) {
            case 'message':
              return (
                <ChatMessageBubble
                  key={segment.message.id}
                  role={segment.message.role as 'user' | 'assistant'}
                  content={segment.message.content}
                  agentPersona={agentPersona}
                  createdAt={segment.message.created_at}
                  attachments={attachmentsByMessageId[segment.message.id]}
                  onDelete={onDeleteMessage ? () => onDeleteMessage(segment.message.id) : undefined}
                />
              )

            case 'toolGroup': {
              // Mark the last tool group as "live" when the agent is actively working
              const isLastToolGroup =
                isAgentThinking &&
                segments
                  .slice(segments.indexOf(segment) + 1)
                  .every((s) => s.type !== 'toolGroup')
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
                  isLive={isLastToolGroup}
                />
              )
            }

            case 'permissionRequest': {
              const permInput = parsePermissionInput(segment.message.tool_input)
              return (
                <PermissionRequestCard
                  key={segment.message.id}
                  requestId={permInput?.requestId ?? ''}
                  toolName={permInput?.toolName ?? 'Unknown'}
                  toolInput={permInput?.toolInput ?? {}}
                  onResolve={onResolvePermission}
                />
              )
            }

            case 'artifactNotification':
              return (
                <ChatArtifactNotification
                  key={segment.message.id}
                  message={segment.message}
                />
              )

            case 'commandOutput':
              return (
                <div
                  key={segment.message.id}
                  className="mx-1 rounded-lg border border-border/30 bg-muted/20 px-3 py-2"
                  data-testid="chat-command-output"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <Terminal className="h-3.5 w-3.5 shrink-0 text-cyan-400/60" />
                    <span className="text-[10px] font-medium text-muted-foreground/50">Command Output</span>
                  </div>
                  <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap font-mono text-xs text-foreground/70 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border">
                    {segment.message.content}
                  </pre>
                </div>
              )

            case 'notification': {
              const notifInput = parseNotificationInput(segment.message.tool_input)
              const isPermissionPrompt = notifInput?.type === 'permission_prompt'
              // Use the message as the headline when type is missing/unknown
              const hasKnownType = notifInput?.type && notifInput.type !== 'unknown'
              const headline = isPermissionPrompt
                ? 'Agent needs permission to proceed'
                : hasKnownType
                  ? `Notification: ${notifInput.type}`
                  : notifInput?.message || 'Notification'
              const subtitle = (isPermissionPrompt || hasKnownType) ? notifInput?.message : null
              return (
                <div
                  key={segment.message.id}
                  className="mx-1 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2"
                  data-testid="chat-notification-message"
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-sky-400" />
                    <span className="text-xs font-medium text-foreground/80">
                      {headline}
                    </span>
                  </div>
                  {subtitle && (
                    <p className="mt-1 pl-6 text-xs text-muted-foreground">
                      {subtitle}
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
    </div>

    {/* Jump-to-bottom button — visible when user has scrolled up */}
    {showScrollButton && (
      <button
        type="button"
        onClick={scrollToBottom}
        className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full border border-border/40 bg-background/90 px-3 py-1.5 text-xs text-muted-foreground shadow-md backdrop-blur-sm transition-colors hover:bg-accent hover:text-foreground"
        aria-label="Jump to latest message"
      >
        <ChevronDown className="h-3 w-3" />
        Latest
      </button>
    )}
    </div>
  )
}

/**
 * ChatPanel - Main chat panel container for the Planning Workspace.
 *
 * Story 10.2: Chat Panel UI & Message Bubbles (AC: 1, 2, 6)
 * Story 10.3: Claude Code CLI Chat Session Spawning (AC: 1, 2, 4)
 * Story 10.5: Tool Activity & Working Indicators (AC: 1)
 *
 * Full-height flex column with three sections:
 * - Persona selector header
 * - Message area (center, scrollable)
 * - Input footer
 *
 * Manages session creation on first message, persona selection state,
 * agent thinking indicator, and current tool activity tracking.
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { trpc } from '@renderer/lib/trpc'
import { usePlanningWorkspaceStore } from '@renderer/stores'
import { ChatPersonaSelector, type ChatPersonaKey } from './ChatPersonaSelector'
import { ChatMessageArea } from './ChatMessageArea'
import { ChatInput } from './ChatInput'

export function ChatPanel() {
  const closeChat = usePlanningWorkspaceStore((s) => s.closeChat)
  const { data: project } = trpc.project.getCurrent.useQuery()
  const projectId = project?.id ?? ''

  // Persona selection — local state, defaults to PM
  const [selectedPersona, setSelectedPersona] = useState<ChatPersonaKey>('bmad:bmm:agents:pm')

  // Active session — transient UI state (not Zustand)
  const [sessionId, setSessionId] = useState<string | null>(null)

  // Agent thinking indicator — set true after sending, cleared when new assistant message arrives
  const [isAgentThinking, setIsAgentThinking] = useState(false)
  // Story 10.5: Track the latest PreToolUse event for contextual working indicator (AC: 1)
  const [currentToolActivity, setCurrentToolActivity] = useState<{
    toolName: string
    toolInput: Record<string, unknown>
  } | null>(null)
  const prevMessageCountRef = useRef(0)
  const thinkingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Track the persona that was active when the current session was created.
  // Used to guard against a race where persona switches mid-flight during session creation.
  const sessionPersonaRef = useRef<ChatPersonaKey | null>(null)

  // Story 10.4: Persona switch — reset session to force new CLI session for new persona
  // When persona changes, clear sessionId so the next message creates a new session
  // with the new persona. Old session remains in DB for future resume (Story 10.6).
  useEffect(() => {
    // Reset session state when persona changes
    setSessionId(null)
    sessionPersonaRef.current = null
    setIsAgentThinking(false)
    setCurrentToolActivity(null)
    if (thinkingTimeoutRef.current) {
      clearTimeout(thinkingTimeoutRef.current)
      thinkingTimeoutRef.current = null
    }
    // Intentionally only depend on selectedPersona — runs when persona changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPersona])

  // Fetch messages when a session is active
  const { data: messages = [] } = trpc.chatSession.getMessages.useQuery(
    { sessionId: sessionId! },
    { enabled: !!sessionId, refetchInterval: 2000 }
  )

  const trpcUtils = trpc.useUtils()

  // Track when new messages arrive to update thinking indicator and tool activity
  useEffect(() => {
    if (messages.length > prevMessageCountRef.current) {
      // Check if the latest message is from the assistant
      const lastMessage = messages[messages.length - 1]
      if (lastMessage && lastMessage.role === 'assistant') {
        setIsAgentThinking(false)
        setCurrentToolActivity(null)
        // Clear safety timeout — response arrived normally
        if (thinkingTimeoutRef.current) {
          clearTimeout(thinkingTimeoutRef.current)
          thinkingTimeoutRef.current = null
        }
      }
      // Story 10.5: Track PreToolUse events for contextual working indicator (AC: 1)
      if (
        lastMessage &&
        lastMessage.role === 'tool' &&
        lastMessage.content.startsWith('PreToolUse:') &&
        isAgentThinking
      ) {
        try {
          const toolInput = lastMessage.tool_input
            ? (JSON.parse(lastMessage.tool_input as string) as Record<string, unknown>)
            : {}
          setCurrentToolActivity({
            toolName: lastMessage.tool_name ?? 'Unknown',
            toolInput
          })
        } catch {
          setCurrentToolActivity({
            toolName: lastMessage.tool_name ?? 'Unknown',
            toolInput: {}
          })
        }
      }
    }
    prevMessageCountRef.current = messages.length
  }, [messages, isAgentThinking])

  // Mutations
  const createSession = trpc.chatSession.create.useMutation()
  const sendChatMessage = trpc.chatSession.sendChatMessage.useMutation({
    onSuccess: () => {
      if (sessionId) {
        trpcUtils.chatSession.getMessages.invalidate({ sessionId })
      }
    }
  })

  /** Send a message, creating a session if needed */
  const handleSend = useCallback(
    async (content: string) => {
      if (!projectId) return

      // Capture the persona at call-time to guard against mid-flight persona switches
      const personaAtSendTime = selectedPersona

      try {
        let activeSessionId = sessionId

        // Create session on first message
        if (!activeSessionId) {
          const session = await createSession.mutateAsync({
            agentPersona: personaAtSendTime,
            projectId
          })
          if (!session) {
            console.error('[ChatPanel] Session creation returned null')
            return
          }
          // Guard: if persona changed while session was being created, discard the session.
          // The useEffect will have already reset sessionId to null for the new persona.
          if (selectedPersona !== personaAtSendTime) {
            console.warn('[ChatPanel] Persona changed during session creation — discarding old session')
            return
          }
          activeSessionId = session.id
          sessionPersonaRef.current = personaAtSendTime
          setSessionId(activeSessionId)
        }

        // Set thinking indicator before sending
        setIsAgentThinking(true)

        // Safety timeout: clear thinking indicator after 120s if no assistant response
        // guards against CLI crashes that occur after the message is sent (AC: 4 safety)
        if (thinkingTimeoutRef.current) {
          clearTimeout(thinkingTimeoutRef.current)
        }
        thinkingTimeoutRef.current = setTimeout(() => {
          setIsAgentThinking(false)
          thinkingTimeoutRef.current = null
        }, 120_000)

        // Send via sendChatMessage — stores user message AND sends to CLI
        await sendChatMessage.mutateAsync({
          sessionId: activeSessionId,
          content
        })
      } catch (err) {
        console.error('[ChatPanel] Failed to send message:', err)
        setIsAgentThinking(false)
        setCurrentToolActivity(null)
        if (thinkingTimeoutRef.current) {
          clearTimeout(thinkingTimeoutRef.current)
          thinkingTimeoutRef.current = null
        }
      }
    },
    [projectId, sessionId, selectedPersona, createSession, sendChatMessage]
  )

  return (
    <div
      className={cn(
        'flex h-full w-[400px] shrink-0 flex-col',
        'border-l border-border/50 bg-card/20'
      )}
      data-testid="chat-panel"
    >
      {/* Header: persona selector + close button */}
      <div className="flex items-center justify-between border-b border-border/30 px-3 py-2">
        <ChatPersonaSelector
          selectedPersona={selectedPersona}
          onPersonaChange={setSelectedPersona}
        />
        <button
          type="button"
          onClick={closeChat}
          className="ml-2 flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground/60 transition-colors hover:bg-accent/40 hover:text-foreground"
          aria-label="Close chat panel"
          data-testid="chat-close-button"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Message area */}
      <ChatMessageArea
        messages={messages}
        agentPersona={selectedPersona}
        isAgentThinking={isAgentThinking}
        currentToolActivity={currentToolActivity}
      />

      {/* Input footer */}
      <ChatInput
        onSend={handleSend}
        disabled={!projectId || sendChatMessage.isPending || createSession.isPending}
        autoFocus
      />
    </div>
  )
}

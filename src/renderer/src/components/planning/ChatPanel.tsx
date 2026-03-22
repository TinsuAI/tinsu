/**
 * ChatPanel - Main chat panel container for the Planning Workspace.
 *
 * Story 10.2: Chat Panel UI & Message Bubbles (AC: 1, 2, 6)
 *
 * Full-height flex column with three sections:
 * - Persona selector header
 * - Message area (center, scrollable)
 * - Input footer
 *
 * Manages session creation on first message and persona selection state.
 */

import { useState, useCallback } from 'react'
import { X } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { trpc } from '@renderer/lib/trpc'
import { usePlanningWorkspaceStore } from '@renderer/stores'
import { useProjectStore } from '@renderer/stores/project.store'
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

  // Fetch messages when a session is active
  const { data: messages = [] } = trpc.chatSession.getMessages.useQuery(
    { sessionId: sessionId! },
    { enabled: !!sessionId, refetchInterval: 2000 }
  )

  const trpcUtils = trpc.useUtils()

  // Mutations
  const createSession = trpc.chatSession.create.useMutation()
  const addMessage = trpc.chatSession.addMessage.useMutation({
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

      try {
        let activeSessionId = sessionId

        // Create session on first message
        if (!activeSessionId) {
          const session = await createSession.mutateAsync({
            agentPersona: selectedPersona,
            projectId
          })
          if (!session) {
            console.error('[ChatPanel] Session creation returned null')
            return
          }
          activeSessionId = session.id
          setSessionId(activeSessionId)
        }

        // Add the user message
        await addMessage.mutateAsync({
          sessionId: activeSessionId,
          role: 'user',
          content
        })
      } catch (err) {
        console.error('[ChatPanel] Failed to send message:', err)
      }
    },
    [projectId, sessionId, selectedPersona, createSession, addMessage]
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
      <ChatMessageArea messages={messages} agentPersona={selectedPersona} />

      {/* Input footer */}
      <ChatInput
        onSend={handleSend}
        disabled={!projectId || addMessage.isPending || createSession.isPending}
        autoFocus
      />
    </div>
  )
}

/**
 * ChatPanel - Main chat panel container for the Planning Workspace.
 *
 * Story 10.2: Chat Panel UI & Message Bubbles (AC: 1, 2, 6)
 * Story 10.3: Claude Code CLI Chat Session Spawning (AC: 1, 2, 4)
 * Story 10.5: Tool Activity & Working Indicators (AC: 1)
 * Story 10.6: Session Persistence & Resume (AC: 1, 2, 3, 4, 5)
 * CTM-2.1: Concurrent Session Execution & Background Persistence (AC: 1, 2, 5)
 * Chat Attachments: File & image sharing in planning workspace
 *
 * Full-height flex column with two view modes:
 * - 'list' view: Shows ChatSessionList for browsing/resuming previous sessions
 * - 'chat' view: Shows persona selector header, message area, and input footer
 *
 * Manages session creation on first message, persona selection state,
 * agent thinking indicator, current tool activity tracking,
 * and pending attachment state for file/image sharing.
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { ArrowLeft, PanelLeftClose, Trash2, ShieldCheck, ShieldAlert } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { trpc } from '@renderer/lib/trpc'
import { usePlanningWorkspaceStore } from '@renderer/stores'
import { BMAD_WORKFLOWS } from '@renderer/constants/planning-workspace'
import { ChatPersonaSelector, type ChatPersonaKey } from './ChatPersonaSelector'
import { ChatMessageArea } from './ChatMessageArea'
import { ChatInput, type PendingAttachment } from './ChatInput'
import { ChatSessionList, type ChatSessionListItem } from './ChatSessionList'
import { ChatSessionUsage } from './ChatSessionUsage'
import type { ChatMessageAttachment } from '../../../../main/db/schema'

interface ChatPanelProps {
  /** Optional callback to collapse the panel from the header */
  onCollapse?: () => void
}

export function ChatPanel({ onCollapse }: ChatPanelProps = {}) {
  const targetChatSessionId = usePlanningWorkspaceStore((s) => s.targetChatSessionId)
  const clearTargetChatSession = usePlanningWorkspaceStore((s) => s.clearTargetChatSession)
  const selectedWorkflowKey = usePlanningWorkspaceStore((s) => s.selectedWorkflowKey)
  const pendingChatPrefill = usePlanningWorkspaceStore((s) => s.pendingChatPrefill)
  const pendingPersona = usePlanningWorkspaceStore((s) => s.pendingPersona)
  const clearPendingChatPrefill = usePlanningWorkspaceStore((s) => s.clearPendingChatPrefill)
  const setSelectedWorkflow = usePlanningWorkspaceStore((s) => s.setSelectedWorkflow)
  const setActivePhase = usePlanningWorkspaceStore((s) => s.setActivePhase)
  const { data: project } = trpc.project.getCurrent.useQuery()
  const projectId = project?.id ?? ''

  // Story 10.6: View mode — 'list' or 'chat' (AC: 1, 4)
  const [view, setView] = useState<'list' | 'chat'>('list')

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

  // Pending attachments — files staged before send
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([])

  // F5 fix: Revoke all pending object URLs on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      pendingAttachments.forEach((att) => {
        if (att.previewUrl) URL.revokeObjectURL(att.previewUrl)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Story 10.6 AC: 1 — Check if sessions exist to decide initial view.
  // If no sessions exist, go directly to 'chat' view to avoid empty list.
  // CTM-2.1: Query sessions for both list view and persona-switch session lookup.
  // Removed view === 'list' restriction — sessionsForCheck is needed in chat view
  // to find existing sessions when switching personas (AC: 1, 2).
  const { data: sessionsForCheck } = trpc.chatSession.listWithPreview.useQuery(
    { projectId },
    { enabled: !!projectId }
  )

  useEffect(() => {
    if (
      view === 'list' &&
      projectId &&
      sessionsForCheck !== undefined &&
      sessionsForCheck.length === 0
    ) {
      setView('chat')
    }
  }, [view, projectId, sessionsForCheck])

  // Story 10.7: Navigate to a specific session when targetChatSessionId is set (AC: 2)
  useEffect(() => {
    if (!targetChatSessionId) return

    // Wait until the session list has loaded before processing navigation.
    // If sessionsForCheck is undefined, the query is still in-flight — skip now
    // and re-run when sessionsForCheck becomes defined (via the dependency array).
    if (sessionsForCheck === undefined) return

    // Find the session in the preview list to get its persona
    const targetSession = sessionsForCheck.find((s) => s.id === targetChatSessionId)
    if (targetSession) {
      isSessionBindingRef.current = true
      setSessionId(targetChatSessionId)
      setSelectedPersona(targetSession.agent_persona as ChatPersonaKey)
      sessionPersonaRef.current = targetSession.agent_persona as ChatPersonaKey
      setIsAgentThinking(false)
      setCurrentToolActivity(null)
      prevMessageCountRef.current = 0
      setView('chat')
    } else {
      // Session not in current list (e.g. different project), just set session ID
      setSessionId(targetChatSessionId)
      setView('chat')
    }
    clearTargetChatSession()
  }, [targetChatSessionId, sessionsForCheck, clearTargetChatSession])

  // Chat-centric layout: Look up session bound to selected workflow key
  const { data: workflowSession, isLoading: isWorkflowSessionLoading } =
    trpc.chatSession.getByWorkflowKey.useQuery(
      { projectId, workflowKey: selectedWorkflowKey ?? '' },
      { enabled: !!projectId && !!selectedWorkflowKey }
    )

  // Flag to suppress persona-switch effect when session binding sets the persona
  // (workflow step click, session list click, or target navigation)
  const isSessionBindingRef = useRef(false)

  // When selectedWorkflowKey changes, wait for query to resolve then bind session
  const prevWorkflowKeyRef = useRef<string | null>(null)
  useEffect(() => {
    if (!selectedWorkflowKey) return
    // Wait for the query to finish loading before acting
    if (isWorkflowSessionLoading) return
    if (selectedWorkflowKey === prevWorkflowKeyRef.current) return
    prevWorkflowKeyRef.current = selectedWorkflowKey

    if (workflowSession) {
      // Resume existing workflow session — suppress persona effect
      isSessionBindingRef.current = true
      setSessionId(workflowSession.id)
      setSelectedPersona(workflowSession.agent_persona as ChatPersonaKey)
      sessionPersonaRef.current = workflowSession.agent_persona as ChatPersonaKey
      setIsAgentThinking(false)
      setCurrentToolActivity(null)
      prevMessageCountRef.current = 0
    } else {
      // No session for this workflow yet — clear session so a new one is created on send
      // Auto-select the persona matching this workflow
      if (pendingPersona) {
        isSessionBindingRef.current = true
        setSelectedPersona(pendingPersona as ChatPersonaKey)
        sessionPersonaRef.current = pendingPersona as ChatPersonaKey
      }
      setSessionId(null)
      setIsAgentThinking(false)
      setCurrentToolActivity(null)
      prevMessageCountRef.current = 0
    }
    setView('chat')
  }, [selectedWorkflowKey, workflowSession, isWorkflowSessionLoading, pendingPersona])

  // CTM-2.1: Persona switch — preserve background sessions and resume existing ones.
  // When persona changes, look for an existing alive session with the new persona.
  // If found, bind to it (resume). If not found, set sessionId(null) to create
  // a new session on next message. Old sessions continue running in background.
  // Skip when the persona change was caused by workflow session binding.
  useEffect(() => {
    if (isSessionBindingRef.current) {
      isSessionBindingRef.current = false
      return
    }

    // Look for an existing session with the new persona
    const existingSession = sessionsForCheck?.find(
      (s) => s.agent_persona === selectedPersona && s.status !== 'completed'
    )

    if (existingSession) {
      // Resume existing session for this persona (don't create new)
      isSessionBindingRef.current = true // suppress recursive effect
      setSessionId(existingSession.id)
      sessionPersonaRef.current = selectedPersona
      prevMessageCountRef.current = 0 // reset so message-arrival effect fires correctly for resumed session
    } else {
      // No existing session — will create on next message
      setSessionId(null)
      sessionPersonaRef.current = null
    }

    setIsAgentThinking(false)
    setCurrentToolActivity(null)
    if (thinkingTimeoutRef.current) {
      clearTimeout(thinkingTimeoutRef.current)
      thinkingTimeoutRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPersona, sessionsForCheck])

  // Fetch messages when a session is active
  const { data: messages = [] } = trpc.chatSession.getMessages.useQuery(
    { sessionId: sessionId! },
    { enabled: !!sessionId, refetchInterval: 2000 }
  )

  // Fetch attachments for user messages in this session
  const userMessageIds = useMemo(
    () => messages.filter((m) => m.role === 'user').map((m) => m.id),
    [messages]
  )

  const { data: attachments = [] } = trpc.chatSession.getMessageAttachments.useQuery(
    { messageIds: userMessageIds },
    { enabled: userMessageIds.length > 0 }
  )

  const attachmentsByMessageId = useMemo(() => {
    const map: Record<string, ChatMessageAttachment[]> = {}
    for (const att of attachments) {
      ;(map[att.message_id] ??= []).push(att as unknown as ChatMessageAttachment)
    }
    return map
  }, [attachments])

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
        trpcUtils.chatSession.getMessageAttachments.invalidate()
      }
    }
  })
  const saveAttachment = trpc.chatSession.saveAttachment.useMutation()
  const pickAttachmentFiles = trpc.chatSession.pickAttachmentFiles.useMutation()
  const copyFilesToAttachments = trpc.chatSession.copyFilesToAttachments.useMutation()
  const deleteMessage = trpc.chatSession.deleteMessage.useMutation({
    onSuccess: () => {
      if (sessionId) {
        trpcUtils.chatSession.getMessages.invalidate({ sessionId })
        trpcUtils.chatSession.getMessageAttachments.invalidate()
      }
    }
  })
  const clearSessionMessages = trpc.chatSession.clearSessionMessages.useMutation({
    onSuccess: () => {
      if (sessionId) {
        trpcUtils.chatSession.getMessages.invalidate({ sessionId })
        trpcUtils.chatSession.getMessageAttachments.invalidate()
        trpcUtils.chatSession.listWithPreview.invalidate()
      }
    }
  })
  const updateSkipPermissions = trpc.chatSession.updateSkipPermissions.useMutation({
    onSuccess: () => {
      trpcUtils.chatSession.listWithPreview.invalidate()
    }
  })
  const resolvePermissionMutation = trpc.chatSession.resolvePermission.useMutation({
    onSuccess: () => {
      if (sessionId) trpcUtils.chatSession.getMessages.invalidate({ sessionId })
    }
  })

  // Track skip_permissions for the active session
  const [skipPermissions, setSkipPermissions] = useState(true)

  // Sync skip_permissions from workflow session or session list selection
  useEffect(() => {
    if (workflowSession) {
      setSkipPermissions(workflowSession.skip_permissions as unknown as boolean)
    }
  }, [workflowSession])

  const handleToggleSkipPermissions = useCallback(() => {
    if (!sessionId) return
    const newValue = !skipPermissions
    setSkipPermissions(newValue)
    updateSkipPermissions.mutate({ sessionId, skipPermissions: newValue })
  }, [sessionId, skipPermissions, updateSkipPermissions])

  const handleResolvePermission = useCallback(
    (requestId: string, decision: 'allow' | 'deny') => {
      resolvePermissionMutation.mutate({ requestId, decision })
    },
    [resolvePermissionMutation]
  )

  /** Add files to pending attachments list */
  const handleAttachmentsAdded = useCallback((files: File[]) => {
    const newAttachments = files.map((file) => ({
      file,
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : '',
      isImage: file.type.startsWith('image/')
    }))
    setPendingAttachments((prev) => [...prev, ...newAttachments])
  }, [])

  /** Remove a pending attachment by index */
  const handleRemoveAttachment = useCallback((index: number) => {
    setPendingAttachments((prev) => {
      const removed = prev[index]
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl)
      return prev.filter((_, i) => i !== index)
    })
  }, [])

  /** Open native file picker via tRPC, copy selected files to attachment storage */
  const handleAttachClick = useCallback(async () => {
    try {
      const filePaths = await pickAttachmentFiles.mutateAsync()
      if (!filePaths || filePaths.length === 0) return

      // Store file paths as PendingAttachments with originalPath.
      // Actual copying to .tinsu/data/attachments/ happens at send time.
      const newAttachments = filePaths.map((filePath) => {
        const fileName = filePath.split('/').pop() || 'file'
        const file = new File([], fileName, { type: 'application/octet-stream' })
        return { file, previewUrl: '', isImage: false, originalPath: filePath }
      })
      setPendingAttachments((prev) => [...prev, ...newAttachments])
    } catch (err) {
      console.error('[ChatPanel] File picker error:', err)
    }
  }, [pickAttachmentFiles])

  /** Story 10.6 AC: 2 — Select a session from the session list to resume it */
  const handleSelectSession = useCallback((session: ChatSessionListItem) => {
    isSessionBindingRef.current = true
    setSessionId(session.id)
    setSelectedPersona(session.agent_persona as ChatPersonaKey)
    sessionPersonaRef.current = session.agent_persona as ChatPersonaKey
    setSkipPermissions(Boolean(session.skip_permissions))
    setIsAgentThinking(false)
    setCurrentToolActivity(null)
    prevMessageCountRef.current = 0
    setView('chat')

    // Navigate content panel to the session's workflow artifact
    if (session.workflow_key) {
      const wf = BMAD_WORKFLOWS.find((w) => w.key === session.workflow_key)
      if (wf) {
        setActivePhase(wf.phase)
      }
      setSelectedWorkflow(session.workflow_key)
    }
  }, [setSelectedWorkflow, setActivePhase])

  /** Story 10.6 AC: 4 — Start a new chat session */
  const handleNewChat = useCallback(() => {
    setSessionId(null)
    sessionPersonaRef.current = null
    setIsAgentThinking(false)
    setCurrentToolActivity(null)
    prevMessageCountRef.current = 0
    setView('chat')
  }, [])

  /** Story 10.6 AC: 5.5 — Back to session list without destroying session */
  const handleBackToSessions = useCallback(() => {
    setView('list')
    // Don't clear sessionId — user can return to this session
  }, [])

  /** Helper to read a File as base64 */
  const readFileAsBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        // Remove the data URL prefix (e.g., "data:image/png;base64,")
        const base64 = result.split(',')[1] || ''
        resolve(base64)
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })

  /** Send a message, creating a session if needed */
  const handleSend = useCallback(
    async (content: string, attachments: PendingAttachment[]) => {
      if (!projectId) return

      // Capture the persona at call-time to guard against mid-flight persona switches
      const personaAtSendTime = selectedPersona

      try {
        let activeSessionId = sessionId

        // Create session on first message
        if (!activeSessionId) {
          const session = await createSession.mutateAsync({
            agentPersona: personaAtSendTime,
            projectId,
            workflowKey: selectedWorkflowKey ?? undefined
          })
          if (!session) {
            console.error('[ChatPanel] Session creation returned null')
            return
          }
          // Guard: if persona changed while session was being created, discard the session.
          // The useEffect will have already reset sessionId to null for the new persona.
          if (selectedPersona !== personaAtSendTime) {
            console.warn(
              '[ChatPanel] Persona changed during session creation — discarding old session'
            )
            return
          }
          activeSessionId = session.id
          sessionPersonaRef.current = personaAtSendTime
          setSessionId(activeSessionId)
        }

        // Save attachments to disk and collect metadata
        const savedAttachments: Array<{
          filePath: string
          fileName: string
          mimeType: string
          fileSize: number
        }> = []

        for (const att of attachments) {
          // F8 fix: Guard against persona switch during attachment upload
          if (selectedPersona !== personaAtSendTime) {
            console.warn('[ChatPanel] Persona changed during attachment upload — aborting')
            return
          }

          if (att.originalPath) {
            // File from file picker — copy from original location
            const copied = await copyFilesToAttachments.mutateAsync({
              sessionId: activeSessionId,
              filePaths: [att.originalPath]
            })
            if (copied.length > 0) {
              savedAttachments.push(copied[0])
            }
          } else {
            // File from paste or drag-and-drop — upload base64
            const base64Data = await readFileAsBase64(att.file)
            // F14 fix: Robust fallback for filename generation
            const fileName =
              att.file.name || `paste-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`
            const saved = await saveAttachment.mutateAsync({
              sessionId: activeSessionId,
              fileName,
              mimeType: att.file.type || 'image/png',
              base64Data
            })
            savedAttachments.push({
              filePath: saved.filePath,
              fileName: saved.fileName,
              mimeType: att.file.type || 'image/png',
              fileSize: saved.fileSize
            })
          }
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
          content,
          attachments: savedAttachments.length > 0 ? savedAttachments : undefined
        })

        // Clear pending attachments after successful send
        for (const att of attachments) {
          if (att.previewUrl) URL.revokeObjectURL(att.previewUrl)
        }
        setPendingAttachments([])
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
    [
      projectId,
      sessionId,
      selectedPersona,
      selectedWorkflowKey,
      createSession,
      sendChatMessage,
      saveAttachment,
      copyFilesToAttachments
    ]
  )

  const handleDeleteMessage = useCallback(
    (messageId: string) => {
      if (!sessionId) return
      deleteMessage.mutate({ messageId, sessionId })
    },
    [sessionId, deleteMessage]
  )

  const handleClearAllMessages = useCallback(() => {
    if (!sessionId) return
    clearSessionMessages.mutate({ sessionId })
  }, [sessionId, clearSessionMessages])

  return (
    <div className={cn('flex h-full flex-col', 'bg-card/20')} data-testid="chat-panel">
      {view === 'list' ? (
        <>
          {/* Header: title (list view) */}
          <div className="flex items-center justify-between border-b border-border/30 px-3 py-2">
            <span className="text-xs font-medium text-muted-foreground">Chat Sessions</span>
            {onCollapse && (
              <button
                type="button"
                onClick={onCollapse}
                className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground/40 hover:text-muted-foreground hover:bg-accent/40 transition-colors"
                aria-label="Collapse chat panel"
                data-testid="collapse-chat-panel"
              >
                <PanelLeftClose className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Session list — CTM-2.3: pass selectedSessionId for background summary filtering */}
          <ChatSessionList
            projectId={projectId}
            onSelectSession={handleSelectSession}
            onNewChat={handleNewChat}
            selectedSessionId={sessionId}
          />
        </>
      ) : (
        <>
          {/* Header: back button + persona selector (chat view) */}
          <div className="flex items-center justify-between border-b border-border/30 px-3 py-2">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleBackToSessions}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground/60 transition-colors hover:bg-accent/40 hover:text-foreground"
                aria-label="Back to sessions"
                data-testid="chat-back-button"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
              </button>
              <ChatPersonaSelector
                selectedPersona={selectedPersona}
                onPersonaChange={setSelectedPersona}
              />
            </div>
            <div className="flex items-center gap-1">
              {sessionId && (
                <button
                  type="button"
                  onClick={handleToggleSkipPermissions}
                  className={cn(
                    'flex h-5 items-center gap-1 rounded px-1.5 transition-colors',
                    skipPermissions
                      ? 'text-amber-400/60 hover:text-amber-400 hover:bg-amber-500/10'
                      : 'text-emerald-400/60 hover:text-emerald-400 hover:bg-emerald-500/10'
                  )}
                  aria-label={skipPermissions ? 'Auto-approve is ON — click to require manual approval' : 'Manual approval is ON — click to auto-approve'}
                  title={skipPermissions ? 'Auto-approve: all tool uses approved automatically' : 'Manual: tool uses require your approval'}
                  data-testid="toggle-skip-permissions"
                >
                  {skipPermissions ? (
                    <ShieldCheck className="h-3 w-3" />
                  ) : (
                    <ShieldAlert className="h-3 w-3" />
                  )}
                  <span className="text-[10px]">{skipPermissions ? 'Auto' : 'Manual'}</span>
                </button>
              )}
              {sessionId && messages.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAllMessages}
                  className="flex h-5 items-center gap-1 rounded px-1.5 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors"
                  aria-label="Clear all messages"
                  data-testid="clear-all-messages-btn"
                  disabled={clearSessionMessages.isPending}
                >
                  <Trash2 className="h-3 w-3" />
                  <span className="text-[10px]">Clear</span>
                </button>
              )}
              {onCollapse && (
                <button
                  type="button"
                  onClick={onCollapse}
                  className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground/40 hover:text-muted-foreground hover:bg-accent/40 transition-colors"
                  aria-label="Collapse chat panel"
                  data-testid="collapse-chat-panel"
                >
                  <PanelLeftClose className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Message area */}
          <ChatMessageArea
            messages={messages as React.ComponentProps<typeof ChatMessageArea>['messages']}
            agentPersona={selectedPersona}
            isAgentThinking={isAgentThinking}
            currentToolActivity={currentToolActivity}
            attachmentsByMessageId={attachmentsByMessageId}
            onDeleteMessage={handleDeleteMessage}
            onResolvePermission={handleResolvePermission}
          />

          {/* Session usage — context & rate limits */}
          {sessionId && (
            <ChatSessionUsage sessionId={sessionId} />
          )}

          {/* Input footer */}
          <ChatInput
            onSend={handleSend}
            onAttachmentsAdded={handleAttachmentsAdded}
            onAttachClick={handleAttachClick}
            pendingAttachments={pendingAttachments}
            onRemoveAttachment={handleRemoveAttachment}
            disabled={!projectId || sendChatMessage.isPending || createSession.isPending}
            autoFocus
            initialValue={pendingChatPrefill}
            onInitialValueConsumed={clearPendingChatPrefill}
          />
        </>
      )}
    </div>
  )
}

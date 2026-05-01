/**
 * MobileChatScreen — full-screen planning chat push screen.
 *
 * Layout: no root MobileScreen shell, no tab bar.
 * isFullScreenRoute('chat:*') === true → MobileApp renders this directly.
 *
 * Header: back button (popRoute) + persona pill (opens read-only info sheet)
 *         + placeholder overflow button (disabled, aria-label for T3.5-8).
 *
 * Message area: MobileChatMessageList (AC 8, 12).
 * Composer: MobileChatComposer (AC 7, 10).
 * Thinking indicator: managed here, rendered inside MobileChatMessageList.
 *
 * Persona-info sheet: read-only, no persona switch (UX redesign §3.2, CTM-2.1).
 *
 * Cross-tree imports (allowed per AC 17):
 *   - commands, AGENT_PERSONA_CONFIG, useProjectStore (resolving projectId for invalidations)
 *
 * Story T3.5-5 — Mobile Planning (AC 6, 7, 10, 11, 13, 15, Task 6, 10, 11)
 * @see T3.5-8 for overflow menu wiring
 */

import { useState, useEffect, useRef } from 'react'
import { MoreVertical } from 'lucide-react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { commands } from '@renderer/lib/rspc'
import { AGENT_PERSONA_CONFIG } from '@renderer/constants/planning-workspace'
import { useProjectStore } from '@renderer/stores/project.store'
import { cn } from '@renderer/lib/utils'
import { useMobileNavStore } from '../shell/mobile-nav.store'
import { MobileSheet } from '../primitives/MobileSheet'
import { MobileChatMessageList } from './MobileChatMessageList'
import { MobileChatComposer } from './MobileChatComposer'

/* ─── Persona bios ──────────────────────────────────────────────────── */

/** Read-only persona info blurbs shown in the persona-info sheet (AC 13). */
const PERSONA_BIO: Record<string, string> = {
  'general': 'General assistant — handles broad questions and open-ended planning.',
  'bmad:bmm:agents:pm': 'Project Manager — focuses on requirements, PRDs, and roadmap planning.',
  'bmad:bmm:agents:architect': 'Architect — designs system architecture, evaluates trade-offs, and documents technical decisions.',
  'bmad:bmm:agents:ux-designer': 'UX Designer — crafts user experiences, wireframes, and UX specifications.',
  'bmad:bmm:agents:analyst': 'Analyst — researches markets, gathers insights, and structures business requirements.',
  'bmad:ghk:agents:growth-guru': 'Growth Guru — drives growth strategies, funnel analysis, and experiment planning.',
}

/* ─── Component ─────────────────────────────────────────────────────── */

interface MobileChatScreenProps {
  sessionId: string
}

/**
 * MobileChatScreen
 * @see Story T3.5-5
 * @see T3.5-8 for overflow-menu wiring
 */
export function MobileChatScreen({ sessionId }: MobileChatScreenProps) {
  const queryClient = useQueryClient()
  const projectId = useProjectStore((s) => s.projectId)

  /* ── Persona resolution ────────────────────────────────────────────── */
  // Fetch session info to get the persona (first message or session metadata)
  // We query chat-messages to infer persona from session data
  const { data: messages } = useQuery({
    queryKey: ['chat-messages', sessionId],
    queryFn: async () => {
      const r = await commands.getChatMessages(sessionId, null, null)
      if (r.status === 'error') throw new Error(JSON.stringify(r.error))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return r.data as any[]
    },
    enabled: !!sessionId,
    staleTime: 0,
  })

  // Resolve session persona from sessions list
  const { data: sessions } = useQuery({
    queryKey: ['chat-sessions-preview', projectId],
    queryFn: async () => {
      if (!projectId) return []
      const r = await commands.listChatSessionsWithPreview(projectId)
      if (r.status === 'error') throw new Error(JSON.stringify(r.error))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return r.data as any[]
    },
    enabled: !!projectId,
    staleTime: 2000,
  })

  const session = sessions?.find((s: { id: string }) => s.id === sessionId)
  const agentPersonaKey: string = session?.agent_persona ?? 'general'
  const persona = AGENT_PERSONA_CONFIG[agentPersonaKey] ?? AGENT_PERSONA_CONFIG['general']

  /* ── Navigation ────────────────────────────────────────────────────── */
  const popRoute = () => useMobileNavStore.getState().popRoute()

  /* ── Persona info sheet ────────────────────────────────────────────── */
  const [personaSheetOpen, setPersonaSheetOpen] = useState(false)

  /* ── Agent thinking state (AC 11) ─────────────────────────────────── */
  const [isAgentThinking, setIsAgentThinking] = useState(false)
  const thinkingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevMessageCountRef = useRef(0)

  // Clear thinking when assistant message arrives (mirrors desktop ChatPanel.tsx)
  useEffect(() => {
    const count = messages?.length ?? 0
    if (count > prevMessageCountRef.current && count > 0) {
      const msgs = messages ?? []
      const lastMsg = msgs[msgs.length - 1]
      // Clear thinking if last new message is an assistant message with no tool after
      const hasToolAfterLast = msgs
        .slice(prevMessageCountRef.current)
        .some((m: { role: string }) => m.role === 'tool')
      if (lastMsg?.role === 'assistant' && !hasToolAfterLast) {
        setIsAgentThinking(false)
        if (thinkingTimeoutRef.current) {
          clearTimeout(thinkingTimeoutRef.current)
          thinkingTimeoutRef.current = null
        }
      }
    }
    prevMessageCountRef.current = count
  }, [messages])

  // Reset prevMessageCountRef when sessionId changes
  useEffect(() => {
    prevMessageCountRef.current = 0
  }, [sessionId])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (thinkingTimeoutRef.current) {
        clearTimeout(thinkingTimeoutRef.current)
      }
    }
  }, [])

  /* ── Send mutation (AC 10, 11, 16) ────────────────────────────────── */
  const sendChatMessage = useMutation({
    mutationFn: async ({ content }: { content: string }) => {
      const r = await commands.sendChatMessage(sessionId, content)
      if (r.status === 'error') throw new Error(JSON.stringify(r.error))
      return r.data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['chat-messages', sessionId] })
      if (projectId) {
        void queryClient.invalidateQueries({ queryKey: ['chat-sessions-preview', projectId] })
      }
    },
    onError: () => {
      // Clear thinking on send error — no assistant reply will arrive
      setIsAgentThinking(false)
      if (thinkingTimeoutRef.current) {
        clearTimeout(thinkingTimeoutRef.current)
        thinkingTimeoutRef.current = null
      }
    },
  })

  const handleSend = async (content: string) => {
    // Start thinking — DO NOT clear on send resolve (wait for assistant message)
    setIsAgentThinking(true)

    // Safety timeout: 120 s auto-clears thinking if no assistant message arrives
    if (thinkingTimeoutRef.current) clearTimeout(thinkingTimeoutRef.current)
    thinkingTimeoutRef.current = setTimeout(() => {
      setIsAgentThinking(false)
    }, 120_000)

    await sendChatMessage.mutateAsync({ content })
  }

  /* ── Render ────────────────────────────────────────────────────────── */

  const PersonaPill = (
    <button
      type="button"
      onClick={() => setPersonaSheetOpen(true)}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full',
        'bg-card/60 border border-border/40',
        'px-2.5 py-1 text-xs',
        'transition-opacity duration-100 active:opacity-60',
      )}
      aria-label={`Agent: ${persona.displayName}. Tap for info.`}
    >
      <span
        className={cn('h-2 w-2 rounded-full shrink-0', persona.dot)}
        aria-hidden
      />
      <span className="text-foreground font-medium">{persona.displayName}</span>
    </button>
  )

  const OverflowButton = (
    <button
      type="button"
      disabled
      aria-label="Chat menu (Coming in T3.5-8)"
      className="flex items-center justify-center h-10 w-10 rounded-lg text-muted-foreground opacity-30 cursor-not-allowed"
    >
      <MoreVertical className="h-5 w-5" aria-hidden />
    </button>
  )

  return (
    <div
      className="flex flex-col h-[100dvh] w-full bg-background text-foreground overflow-hidden"
      data-testid="mobile-chat-screen"
    >
      {/* Header — inlined because MobileTopAppBar.title is string-only;
           we need back button + ReactNode persona pill + overflow.
           Token contract: bg-card/95 backdrop-blur-xl border-border/40 (mirrors MobileTopAppBar). */}
      <header
        className="w-full bg-card/95 backdrop-blur-xl border-b border-border/40 shrink-0"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
        data-testid="mobile-chat-header"
      >
        <div className="flex items-center justify-between px-2 h-[52px] gap-2">
          {/* Back button */}
          <button
            type="button"
            onClick={popRoute}
            aria-label="Back to sessions"
            data-testid="mobile-chat-back-button"
            className={cn(
              'flex items-center justify-center rounded-lg',
              'min-h-[2.75rem] min-w-[2.75rem] -ml-1',
              'text-foreground',
              'transition-opacity duration-150 active:opacity-60',
            )}
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Centre: persona pill */}
          <div className="flex-1 flex justify-center">
            {PersonaPill}
          </div>

          {/* Overflow button placeholder */}
          {OverflowButton}
        </div>
      </header>

      {/* Message area — flex-1 to fill remaining space */}
      <MobileChatMessageList
        sessionId={sessionId}
        projectId={projectId ?? null}
        persona={persona}
        agentPersonaKey={agentPersonaKey}
        isAgentThinking={isAgentThinking}
        toolActivity={null}
      />

      {/* Composer — sticky at bottom, above keyboard safe area */}
      <MobileChatComposer
        onSend={handleSend}
        disabled={!sessionId || sendChatMessage.isPending}
      />

      {/* Read-only persona info sheet (AC 13) — NO switch persona action */}
      <MobileSheet
        open={personaSheetOpen}
        onOpenChange={setPersonaSheetOpen}
        snapPoint="fit"
        title="Agent persona"
        description={`${persona.displayName}${persona.characterName ? ` — ${persona.characterName}` : ''}`}
      >
        <div className="flex flex-col gap-4 py-2">
          <div className="flex items-center gap-3">
            <span
              className={cn('h-4 w-4 rounded-full shrink-0', persona.dot)}
              aria-hidden
            />
            <div>
              <p className="text-sm font-semibold text-foreground">{persona.displayName}</p>
              {persona.characterName && (
                <p className="text-xs text-muted-foreground">{persona.characterName}</p>
              )}
            </div>
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed">
            {PERSONA_BIO[agentPersonaKey] ?? ''}
          </p>

          <p className="text-xs text-muted-foreground/60 italic">
            Persona cannot be changed mid-session.
          </p>
        </div>
      </MobileSheet>
    </div>
  )
}

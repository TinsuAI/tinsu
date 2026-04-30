/**
 * MobileNewSessionSheet — bottom sheet for starting a new planning chat session.
 *
 * Lists 6 BMAD personas in canonical order (intentionally duplicated from
 * src/components/planning/ChatPersonaSelector.tsx for mobile-tree-decoupling).
 *
 * On persona tap: calls commands.createChatSession, then notifies parent via
 * onSessionCreated. On error, surfaces inline error text (no toast).
 *
 * Story T3.5-5 — Mobile Planning (AC 5, Task 4)
 */

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { commands } from '@renderer/lib/rspc'
import { AGENT_PERSONA_CONFIG } from '@renderer/constants/planning-workspace'
import { cn } from '@renderer/lib/utils'
import { MobileSheet } from '../primitives/MobileSheet'
import { MobileListItem } from '../primitives/MobileListItem'

/* ─── Persona list ──────────────────────────────────────────────────── */

// Intentional duplicate of ChatPersonaSelector.tsx CHAT_PERSONAS for mobile decoupling (AC 17)
const CHAT_PERSONAS = [
  'general',
  'bmad:bmm:agents:pm',
  'bmad:bmm:agents:architect',
  'bmad:bmm:agents:ux-designer',
  'bmad:bmm:agents:analyst',
  'bmad:ghk:agents:growth-guru',
] as const

/* ─── Helpers ───────────────────────────────────────────────────────── */

function toPersonaSlug(displayName: string): string {
  return displayName.toLowerCase().replace(/\s+/g, '-')
}

/* ─── Component ─────────────────────────────────────────────────────── */

interface MobileNewSessionSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  onSessionCreated: (sessionId: string) => void
}

export function MobileNewSessionSheet({
  open,
  onOpenChange,
  projectId,
  onSessionCreated,
}: MobileNewSessionSheetProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const createSession = useMutation({
    mutationFn: async (personaKey: string) => {
      const r = await commands.createChatSession(projectId, personaKey, null)
      if (r.status === 'error') throw new Error(JSON.stringify(r.error))
      return r.data
    },
    onSuccess: (data) => {
      setErrorMessage(null)
      onSessionCreated(data.id)
      onOpenChange(false)
    },
    onError: (err: Error) => {
      setErrorMessage(err.message ?? 'Failed to create session. Please try again.')
    },
  })

  const handleSelect = (personaKey: string) => {
    if (createSession.isPending) return
    setErrorMessage(null)
    createSession.mutate(personaKey)
  }

  return (
    <MobileSheet
      open={open}
      onOpenChange={onOpenChange}
      snapPoint="fit"
      title="New planning chat"
      description="Pick a BMAD agent to start a new session."
    >
      <div data-testid="mobile-planning-new-session-sheet">
        <div role="list">
          {CHAT_PERSONAS.map((key) => {
            const cfg = AGENT_PERSONA_CONFIG[key] ?? AGENT_PERSONA_CONFIG['general']
            const slug = toPersonaSlug(cfg.displayName)
            const isPending =
              createSession.isPending && createSession.variables === key

            const Dot = (
              <span
                className={cn('h-2 w-2 rounded-full shrink-0 block', cfg.dot)}
                aria-hidden
              />
            )

            return (
              <MobileListItem
                key={key}
                leadingIcon={Dot}
                title={cfg.displayName}
                subtitle={
                  cfg.characterName ? `— ${cfg.characterName}` : undefined
                }
                trailing={
                  isPending ? (
                    <span className="text-xs text-muted-foreground animate-pulse">
                      Creating…
                    </span>
                  ) : undefined
                }
                onPress={() => handleSelect(key)}
                disabled={createSession.isPending}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                {...({ 'data-testid': `mobile-planning-persona-${slug}` } as any)}
              />
            )
          })}
        </div>

        {errorMessage && (
          <p className="mt-3 px-1 text-xs text-destructive" role="alert">
            {errorMessage}
          </p>
        )}
      </div>
    </MobileSheet>
  )
}

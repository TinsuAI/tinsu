/**
 * ChatPersonaSelector - Agent persona selection for chat panel.
 *
 * Story 10.2: Chat Panel UI & Message Bubbles (AC: 5)
 *
 * Renders a horizontal row of persona buttons (PM, Architect, UX Designer, Analyst).
 * Each button shows a colored dot + display name with the persona's color scheme.
 * Selected button has ring + bg tint matching the persona color.
 */

import { cn } from '@renderer/lib/utils'
import { AGENT_PERSONA_CONFIG, type AgentPersonaConfig } from '@renderer/constants/planning-workspace'

/** Ordered list of chat-eligible personas */
const CHAT_PERSONAS = [
  'general',
  'bmad:bmm:agents:pm',
  'bmad:bmm:agents:architect',
  'bmad:bmm:agents:ux-designer',
  'bmad:bmm:agents:analyst',
  'bmad:ghk:agents:growth-guru'
] as const

export type ChatPersonaKey = (typeof CHAT_PERSONAS)[number]

interface ChatPersonaSelectorProps {
  selectedPersona: ChatPersonaKey
  onPersonaChange: (persona: ChatPersonaKey) => void
}

export function ChatPersonaSelector({ selectedPersona, onPersonaChange }: ChatPersonaSelectorProps) {
  return (
    <div className="flex items-center gap-1.5" data-testid="chat-persona-selector">
      {CHAT_PERSONAS.map((personaKey) => {
        const config = AGENT_PERSONA_CONFIG[personaKey] as AgentPersonaConfig
        const isSelected = selectedPersona === personaKey

        return (
          <button
            key={personaKey}
            type="button"
            onClick={() => onPersonaChange(personaKey)}
            data-testid={`persona-button-${config.displayName.toLowerCase().replace(/\s+/g, '-')}`}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all duration-150',
              'hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
              isSelected && [config.bg, config.text, 'ring-1', config.border],
              !isSelected && 'text-muted-foreground'
            )}
            aria-pressed={isSelected}
            aria-label={`Select ${config.displayName} agent`}
          >
            <span
              className={cn(
                'h-2 w-2 shrink-0 rounded-full transition-colors',
                isSelected ? config.dot : 'bg-muted-foreground/40'
              )}
            />
            <span>{config.displayName}</span>
          </button>
        )
      })}
    </div>
  )
}

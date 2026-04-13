import { Bot } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import {
  getAgentPersona,
  BMAD_WORKFLOWS
} from '@renderer/constants/planning-workspace'

interface AgentPersonaIndicatorProps {
  agentName: string | null
  workflowKey: string | null
  isRunning: boolean
}

/**
 * Displays the active BMAD agent persona in the planning workspace header.
 *
 * Story 9.8: Agent Persona Indicator
 *
 * Shows persona name with color-coded breathing dot when an agent is running,
 * or a muted idle state when no agent is active.
 */
export function AgentPersonaIndicator({
  agentName,
  workflowKey,
  isRunning
}: AgentPersonaIndicatorProps) {
  // Idle state — no agent running
  if (!isRunning || !agentName) {
    return (
      <div
        className="flex items-center gap-1.5 text-xs text-muted-foreground/60"
        data-testid="agent-persona-indicator"
      >
        <Bot className="h-3.5 w-3.5" />
        <span>No agent active</span>
      </div>
    )
  }

  const persona = getAgentPersona(agentName)
  const workflowName =
    BMAD_WORKFLOWS.find((w) => w.key === workflowKey)?.name ?? workflowKey

  // Unknown agent fallback — extract last segment, show with muted styling
  if (!persona) {
    const fallbackName = agentName.includes(':')
      ? agentName.split(':').pop() || agentName
      : agentName

    return (
      <div
        className="flex items-center gap-1.5 text-xs text-zinc-400"
        data-testid="agent-persona-indicator"
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-pulse rounded-full bg-zinc-400/60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-zinc-400" />
        </span>
        <span className="font-medium">{fallbackName}</span>
        {workflowName && (
          <>
            <span className="text-muted-foreground/40">&middot;</span>
            <span className="text-zinc-500">{workflowName}</span>
          </>
        )}
      </div>
    )
  }

  // Known persona — full colored display with breathing dot
  return (
    <div
      className={cn('flex items-center gap-1.5 text-xs', persona.text)}
      data-testid="agent-persona-indicator"
    >
      {/* Breathing pulse dot — layered for depth */}
      <span className="relative flex h-2 w-2">
        <span
          className={cn(
            'absolute inline-flex h-full w-full animate-pulse rounded-full opacity-75',
            persona.dot
          )}
        />
        <span
          className={cn(
            'relative inline-flex h-2 w-2 rounded-full',
            persona.dot
          )}
        />
      </span>
      <span className="font-medium">{persona.displayName}</span>
      {workflowName && (
        <>
          <span className="opacity-40">&middot;</span>
          <span className="opacity-70">{workflowName}</span>
        </>
      )}
    </div>
  )
}

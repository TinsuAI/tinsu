/**
 * ChatWorkingIndicator - Contextual working/thinking indicator.
 *
 * Story 10.5: Tool Activity & Working Indicators (AC: 1)
 *
 * Replaces the generic "is thinking..." indicator with contextual
 * tool activity descriptions. When the agent is reading a file,
 * the indicator says "Reading architecture.md..." instead of generic dots.
 *
 * Design: left-aligned with persona label, animated pulse dot using
 * the agent persona's accent color, monospace tool activity text.
 */

import { cn } from '@renderer/lib/utils'
import { AGENT_PERSONA_CONFIG } from '@renderer/constants/planning-workspace'

interface ChatWorkingIndicatorProps {
  agentPersona?: string | null
  currentToolActivity?: {
    toolName: string
    toolInput: Record<string, unknown>
  } | null
}

/** Extract basename from a file path */
function basename(filePath: string): string {
  const parts = filePath.replace(/\\/g, '/').split('/')
  return parts[parts.length - 1] || filePath
}

/** Generate contextual working text from tool activity */
function getWorkingText(
  toolName: string,
  toolInput: Record<string, unknown>
): string {
  switch (toolName) {
    case 'Read': {
      const fp = toolInput.file_path as string | undefined
      return fp ? `Reading ${basename(fp)}...` : 'Reading file...'
    }
    case 'Write': {
      const fp = toolInput.file_path as string | undefined
      return fp ? `Writing ${basename(fp)}...` : 'Writing file...'
    }
    case 'Edit': {
      const fp = toolInput.file_path as string | undefined
      return fp ? `Editing ${basename(fp)}...` : 'Editing file...'
    }
    case 'Bash':
      return 'Running command...'
    case 'Grep': {
      const pattern = toolInput.pattern as string | undefined
      return pattern ? `Searching for "${pattern}"...` : 'Searching...'
    }
    case 'Glob':
      return 'Finding files...'
    default:
      return `Using ${toolName}...`
  }
}

export function ChatWorkingIndicator({
  agentPersona,
  currentToolActivity
}: ChatWorkingIndicatorProps) {
  const persona =
    agentPersona && AGENT_PERSONA_CONFIG[agentPersona]
      ? AGENT_PERSONA_CONFIG[agentPersona]
      : null

  const personaLabel = persona?.displayName ?? 'Agent'
  const dotColor = persona?.dot ?? 'bg-muted-foreground/40'

  const hasToolActivity = currentToolActivity != null

  return (
    <div
      className="flex items-start gap-2"
      data-testid="chat-thinking-indicator"
    >
      <div className="max-w-[85%] rounded-xl rounded-tl-sm bg-muted/30 px-3 py-2">
        {/* Persona label */}
        <div className="mb-1 text-[10px] font-medium text-muted-foreground/50">
          {personaLabel}
        </div>

        {/* Indicator content */}
        <div className="flex items-center gap-1.5">
          {/* Animated pulse dot — uses persona accent color */}
          <span
            className={cn(
              'inline-block h-1.5 w-1.5 animate-pulse rounded-full',
              dotColor
            )}
            data-testid="working-indicator-dot"
          />

          {hasToolActivity ? (
            /* Contextual tool activity text */
            <span
              className="font-mono text-[11px] text-muted-foreground/50"
              data-testid="working-indicator-tool-text"
            >
              {getWorkingText(
                currentToolActivity.toolName,
                currentToolActivity.toolInput
              )}
            </span>
          ) : (
            /* Generic thinking dots */
            <>
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
            </>
          )}
        </div>
      </div>
    </div>
  )
}

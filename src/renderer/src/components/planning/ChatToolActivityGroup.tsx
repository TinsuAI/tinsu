/**
 * ChatToolActivityGroup - Groups consecutive tool activity cards.
 *
 * Story 10.5: Tool Activity & Working Indicators (AC: 4)
 *
 * When a single tool message exists, renders it as a standalone card.
 * When multiple consecutive tool messages exist, collapses them under
 * an "Agent performed N actions" header with expand/collapse toggle.
 *
 * Design: thin vertical connector line on the left gives a timeline feel,
 * compact group header uses monospace count badge.
 */

import { useState } from 'react'
import { ChevronDown, ChevronRight, Activity } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { ChatToolActivityCard, getToolDescription } from './ChatToolActivityCard'

interface ToolMessage {
  id: string
  role: 'tool'
  content: string
  tool_name: string | null
  tool_input: string | null
  created_at: Date | string | number
}

interface ChatToolActivityGroupProps {
  toolMessages: ToolMessage[]
  defaultExpanded?: boolean
  /** When true, this group is actively receiving new tool messages (agent is working) */
  isLive?: boolean
}

/** Check if a tool message has meaningful output content */
function hasOutput(msg: ToolMessage): boolean {
  return msg.content.length > 0 && !msg.content.startsWith('PreToolUse:')
}

export function ChatToolActivityGroup({
  toolMessages,
  defaultExpanded = false,
  isLive = false
}: ChatToolActivityGroupProps) {
  // Auto-expand when any tool in the group has output content (but NOT when live — keep collapsed to show status line)
  const anyHasOutput = !isLive && toolMessages.some(hasOutput)
  const [expanded, setExpanded] = useState(defaultExpanded || anyHasOutput)

  // Single tool message — render directly, no group wrapper
  if (toolMessages.length === 1) {
    const msg = toolMessages[0]
    return (
      <div data-testid="chat-tool-activity-group">
        <ChatToolActivityCard
          toolName={msg.tool_name ?? 'Unknown'}
          toolInput={msg.tool_input}
          content={msg.content}
          createdAt={msg.created_at}
        />
      </div>
    )
  }

  // Multiple tool messages — collapsible group
  return (
    <div
      className="my-1"
      data-testid="chat-tool-activity-group"
    >
      {/* Group header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className={cn(
          'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5',
          'text-left transition-colors duration-150',
          'hover:bg-muted/10'
        )}
        data-testid="chat-tool-group-toggle"
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground/40" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/40" />
        )}
        <Activity className="h-3.5 w-3.5 shrink-0 text-cyan-400/50" />
        <span className="font-mono text-[11px] text-muted-foreground/50">
          Agent performed{' '}
          <span className="font-semibold text-muted-foreground/70">
            {toolMessages.length}
          </span>{' '}
          actions
        </span>
      </button>

      {/* Live status line — shows current action when collapsed */}
      {!expanded && isLive && toolMessages.length > 0 && (
        <div
          className="flex items-center gap-2 px-2.5 py-1"
          data-testid="chat-tool-group-live-status"
        >
          <span
            className="ml-[18px] inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400"
            style={{ animation: 'tool-live-pulse 1.5s ease-in-out infinite' }}
          />
          <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground/60">
            {getToolDescription(
              toolMessages[toolMessages.length - 1].tool_name ?? 'Unknown',
              toolMessages[toolMessages.length - 1].tool_input
            )}
          </span>
          <style>{`
            @keyframes tool-live-pulse {
              0%, 100% { opacity: 1; transform: scale(1); }
              50% { opacity: 0.3; transform: scale(0.7); }
            }
          `}</style>
        </div>
      )}

      {/* Expanded: individual cards with timeline connector */}
      {expanded && (
        <div
          className="ml-3 border-l-2 border-muted/20 pl-2 pt-1"
          data-testid="chat-tool-group-items"
        >
          {toolMessages.map((msg) => (
            <ChatToolActivityCard
              key={msg.id}
              toolName={msg.tool_name ?? 'Unknown'}
              toolInput={msg.tool_input}
              content={msg.content}
              createdAt={msg.created_at}
            />
          ))}
        </div>
      )}
    </div>
  )
}

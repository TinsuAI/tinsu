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
import { ChatToolActivityCard } from './ChatToolActivityCard'

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
}

/** Check if a tool message has meaningful output content */
function hasOutput(msg: ToolMessage): boolean {
  return msg.content.length > 0 && !msg.content.startsWith('PreToolUse:')
}

export function ChatToolActivityGroup({
  toolMessages,
  defaultExpanded = false
}: ChatToolActivityGroupProps) {
  // Auto-expand when any tool in the group has output content
  const anyHasOutput = toolMessages.some(hasOutput)
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

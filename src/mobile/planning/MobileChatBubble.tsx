/**
 * MobileChatBubble — renders a single chat message as a mobile bubble.
 *
 * Roles:
 *   user      → right-aligned, primary-tinted background
 *   assistant → left-aligned, card background + react-markdown rendering
 *   tool      → collapsed row with chevron; tap to expand raw JSON
 *
 * Cross-tree imports (allowed per AC 17):
 *   - markdownComponents from @renderer/components/task/MarkdownComponents
 *   - CodeBlock from @renderer/components/ui/code-block
 *
 * react-markdown + remark-gfm are imported directly (per T3.5-4 AC 16 alt path —
 * markdownComponents wraps the renderers but ReactMarkdown itself needs direct import).
 * Trade-off documented here and in Dev Notes.
 *
 * Story T3.5-5 — Mobile Planning (AC 9, Task 8)
 */

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { markdownComponents } from '@renderer/components/task/MarkdownComponents'
import type { AgentPersonaConfig } from '@renderer/constants/planning-workspace'

/* ─── Types ─────────────────────────────────────────────────────────── */

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'tool'
  content: string
  created_at: string | null
  tool_name?: string | null
  tool_input?: string | null
}

/* ─── Helpers ───────────────────────────────────────────────────────── */

function formatTime(ts: string | null | undefined): string {
  if (!ts) return ''
  try {
    const d = new Date(ts)
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

/* ─── Component ─────────────────────────────────────────────────────── */

interface MobileChatBubbleProps {
  message: ChatMessage
  // persona is passed but used for potential future persona-specific styling
  persona: AgentPersonaConfig
}

export function MobileChatBubble({ message }: MobileChatBubbleProps) {
  const [expanded, setExpanded] = useState(false)

  if (message.role === 'user') {
    return (
      <div className="flex flex-col items-end my-1.5 px-3">
        <div
          className={cn(
            'ml-auto max-w-[85%] rounded-2xl rounded-tr-sm',
            'bg-primary/15 border border-primary/20',
            'px-3.5 py-2.5 text-sm text-foreground whitespace-pre-wrap',
          )}
        >
          {message.content}
        </div>
        {message.created_at && (
          <time className="mt-0.5 text-[10px] text-muted-foreground">
            {formatTime(message.created_at)}
          </time>
        )}
      </div>
    )
  }

  if (message.role === 'tool') {
    return (
      <div className="flex flex-col items-start my-1 px-3">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className={cn(
            'mr-auto inline-flex items-center gap-2 rounded-lg',
            'bg-muted/40 border border-border/40',
            'px-3 py-1.5 text-xs text-muted-foreground',
            'transition-colors duration-100 active:bg-muted/60',
          )}
          aria-expanded={expanded}
          aria-label={`Tool: ${message.tool_name ?? 'unknown'}. Tap to ${expanded ? 'collapse' : 'expand'}`}
        >
          <span>🔧</span>
          <span>Tool: {message.tool_name ?? 'unknown'}</span>
          {expanded ? (
            <ChevronUp className="h-3 w-3" aria-hidden />
          ) : (
            <ChevronDown className="h-3 w-3" aria-hidden />
          )}
        </button>
        {expanded && message.tool_input && (
          <pre
            className={cn(
              'mt-1 mr-auto max-w-full overflow-x-auto rounded-lg',
              'bg-muted/30 border border-border/40',
              'p-2 text-[10px] text-muted-foreground',
            )}
          >
            {(() => {
              try {
                return JSON.stringify(JSON.parse(message.tool_input), null, 2)
              } catch {
                return message.tool_input
              }
            })()}
          </pre>
        )}
      </div>
    )
  }

  // assistant
  return (
    <div className="flex flex-col items-start my-1.5 px-3">
      <div
        className={cn(
          'mr-auto max-w-[85%] rounded-2xl rounded-tl-sm',
          'bg-card border border-border/40',
          'px-3.5 py-2.5 text-sm text-foreground',
          'prose prose-sm max-w-none',
        )}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={markdownComponents}
        >
          {message.content}
        </ReactMarkdown>
      </div>
      {message.created_at && (
        <time className="mt-0.5 text-[10px] text-muted-foreground">
          {formatTime(message.created_at)}
        </time>
      )}
    </div>
  )
}

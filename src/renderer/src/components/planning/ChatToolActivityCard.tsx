/**
 * ChatToolActivityCard - Collapsible tool activity card for chat panel.
 *
 * Story 10.5: Tool Activity & Working Indicators (AC: 2, 3)
 *
 * Renders a compact, collapsed-by-default card showing what tool the agent used.
 * Click to expand and see tool input details + truncated response preview.
 *
 * Design: utilitarian terminal-log aesthetic with monospace tool names,
 * compact density, and a subtle border-glow on expand.
 */

import { useState } from 'react'
import { format } from 'date-fns'
import {
  FileText,
  FileEdit,
  Pencil,
  Terminal,
  Search,
  FolderSearch,
  Wrench,
  ChevronRight
} from 'lucide-react'
import { cn } from '@renderer/lib/utils'

interface ChatToolActivityCardProps {
  toolName: string
  toolInput: string | null
  content: string
  createdAt: Date | string | number
}

/** Map tool names to their corresponding lucide icons */
const TOOL_ICON_MAP: Record<string, typeof FileText> = {
  Read: FileText,
  Write: FileEdit,
  Edit: Pencil,
  Bash: Terminal,
  Grep: Search,
  Glob: FolderSearch
}

/** Extract the basename from a file path */
function basename(filePath: string): string {
  const parts = filePath.replace(/\\/g, '/').split('/')
  return parts[parts.length - 1] || filePath
}

/** Parse tool_input JSON safely */
function parseToolInput(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return null
  }
}

/** Generate a contextual one-line description from tool name + input */
export function getToolDescription(toolName: string, toolInput: string | null): string {
  const parsed = parseToolInput(toolInput)

  switch (toolName) {
    case 'Read': {
      const fp = parsed?.file_path as string | undefined
      return fp ? `Read ${basename(fp)}` : 'Read file'
    }
    case 'Write': {
      const fp = parsed?.file_path as string | undefined
      return fp ? `Write ${basename(fp)}` : 'Write file'
    }
    case 'Edit': {
      const fp = parsed?.file_path as string | undefined
      return fp ? `Edit ${basename(fp)}` : 'Edit file'
    }
    case 'Bash': {
      const cmd = parsed?.command as string | undefined
      if (cmd) {
        const truncated = cmd.length > 40 ? cmd.slice(0, 40) + '...' : cmd
        return `Ran command: ${truncated}`
      }
      return 'Ran command'
    }
    case 'Grep': {
      const pattern = parsed?.pattern as string | undefined
      return pattern ? `Searched for "${pattern}"` : 'Searched'
    }
    case 'Glob': {
      const pattern = parsed?.pattern as string | undefined
      return pattern ? `Found files matching "${pattern}"` : 'Found files'
    }
    default:
      return toolName
  }
}

/** Format timestamp consistently */
function formatTimestamp(ts: Date | string | number): string {
  let date: Date
  if (ts instanceof Date) {
    date = ts
  } else if (typeof ts === 'number') {
    date = new Date(ts * 1000)
  } else {
    date = new Date(ts)
  }
  return format(date, 'h:mm:ss a')
}

/** Truncate content to first N lines or M characters */
function truncateContent(content: string, maxLines = 10, maxChars = 500): string {
  const lines = content.split('\n')
  const sliced = lines.slice(0, maxLines).join('\n')
  if (sliced.length > maxChars) {
    return sliced.slice(0, maxChars) + '...'
  }
  if (lines.length > maxLines) {
    return sliced + '\n...'
  }
  return sliced
}

export function ChatToolActivityCard({
  toolName,
  toolInput,
  content,
  createdAt
}: ChatToolActivityCardProps) {
  const [expanded, setExpanded] = useState(false)

  const IconComponent = TOOL_ICON_MAP[toolName] ?? Wrench
  const description = getToolDescription(toolName, toolInput)
  const parsed = parseToolInput(toolInput)

  // Determine if content has meaningful preview data
  // PreToolUse messages have content like "PreToolUse: Read" — not useful to show
  const isPreToolUse = content.startsWith('PreToolUse:')
  const hasContent = !isPreToolUse && content.length > 0
  const hasInputDetails = parsed && Object.keys(parsed).length > 0

  return (
    <div
      className={cn(
        'group rounded-md transition-all duration-200',
        expanded
          ? 'bg-muted/15 border border-border/30 shadow-sm'
          : 'hover:bg-muted/8'
      )}
      data-testid="chat-tool-activity-card"
    >
      {/* Collapsed header — always visible */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className={cn(
          'flex w-full items-center gap-2 px-2.5 py-1.5 text-left',
          'transition-colors duration-150'
        )}
        data-testid="chat-tool-activity-toggle"
      >
        <ChevronRight
          className={cn(
            'h-3 w-3 shrink-0 text-muted-foreground/40 transition-transform duration-200',
            expanded && 'rotate-90'
          )}
        />
        <IconComponent className="h-3.5 w-3.5 shrink-0 text-cyan-400/70" />
        <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground/70">
          {description}
        </span>
        <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground/30">
          {formatTimestamp(createdAt)}
        </span>
      </button>

      {/* Expanded details */}
      {expanded && (hasInputDetails || hasContent) && (
        <div
          className="border-t border-border/20 px-3 pb-2.5 pt-2"
          data-testid="chat-tool-activity-details"
        >
          {/* Tool input details */}
          {hasInputDetails && (
            <div className="mb-2">
              <div className="mb-1 font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground/40">
                Input
              </div>
              <pre className="overflow-x-auto rounded bg-background/50 p-2 font-mono text-[11px] leading-relaxed text-muted-foreground/60">
                {JSON.stringify(parsed, null, 2)}
              </pre>
            </div>
          )}

          {/* Content preview */}
          {hasContent && (
            <div>
              <div className="mb-1 font-mono text-[10px] font-medium uppercase tracking-wider text-muted-foreground/40">
                Output
              </div>
              <pre className="overflow-x-auto rounded bg-background/50 p-2 font-mono text-[11px] leading-relaxed text-muted-foreground/60">
                {truncateContent(content)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

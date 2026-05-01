/**
 * ChatMessageBubble - Individual chat message display.
 *
 * Story 10.2: Chat Panel UI & Message Bubbles (AC: 3, 4)
 * Chat Attachments: Inline image display and file chips
 *
 * User messages: right-aligned, cyan-tinted background, "You" label, timestamp.
 * Agent messages: left-aligned, muted background, persona name + colored dot, timestamp.
 * Agent bubbles render markdown with syntax-highlighted code blocks.
 */

import React, { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { format } from 'date-fns'
import { Paperclip, X } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { CodeBlock } from '@renderer/components/ui/code-block'
import { getAgentPersona } from '@renderer/constants/planning-workspace'
import type { ChatMessageAttachment } from '@shared/types/chat.types'

interface ChatMessageBubbleProps {
  role: 'user' | 'assistant' | 'tool'
  content: string
  /** Agent persona key for styling agent messages (e.g., 'bmad-agent-pm') */
  agentPersona?: string | null
  /** Message creation timestamp — may be a Date, ISO string (from tRPC JSON), or unix-second number */
  createdAt: Date | string | number
  /** Attachments for this message (images and files) */
  attachments?: ChatMessageAttachment[]
  /** Callback to delete this message */
  onDelete?: () => void
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Story t3-7: Markdown components optimized for mobile viewports.
 * Responsive font sizes: smaller on mobile, larger on desktop.
 * Code blocks support horizontal scrolling on narrow screens.
 */
const chatMarkdownComponents = {
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="mb-2 mt-4 text-sm md:text-lg font-bold tracking-tight text-foreground first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="mb-2 mt-3 text-xs md:text-base font-semibold tracking-tight text-foreground">{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="mb-1.5 mt-2.5 text-xs md:text-sm font-semibold text-foreground">{children}</h3>
  ),
  h4: ({ children }: { children?: React.ReactNode }) => (
    <h4 className="mb-1 mt-2 text-xs md:text-sm font-medium text-foreground">{children}</h4>
  ),
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="mb-2 text-xs md:text-sm leading-relaxed text-foreground/90 last:mb-0">{children}</p>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="mb-2 ml-4 list-disc space-y-1 text-xs md:text-sm text-foreground/90">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="mb-2 ml-4 list-decimal space-y-1 text-xs md:text-sm text-foreground/90">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="leading-relaxed">{children}</li>
  ),
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="my-2 border-l-2 border-cyan-500/40 pl-3 text-xs md:text-sm italic text-foreground/70">
      {children}
    </blockquote>
  ),
  code: ({ className, children }: { className?: string; children?: React.ReactNode }) => {
    const match = /language-(\w+)/.exec(className || '')
    const language = match ? match[1] : ''
    const codeString = String(children || '').replace(/\n$/, '')
    const isInline = !className && !codeString.includes('\n')

    if (isInline) {
      return (
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px] md:text-xs text-cyan-400">
          {children}
        </code>
      )
    }

    return <CodeBlock language={language} code={codeString} />
  },
  pre: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  hr: () => <hr className="my-3 border-border/30" />,
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="my-2 overflow-x-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border/30">
      <table className="w-full border-collapse text-[11px] md:text-xs">{children}</table>
    </div>
  ),
  thead: ({ children }: { children?: React.ReactNode }) => (
    <thead className="border-b border-border bg-muted/30">{children}</thead>
  ),
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="px-2 md:px-3 py-1 md:py-1.5 text-left text-[10px] md:text-xs font-semibold text-foreground">{children}</th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td className="border-b border-border/30 px-2 md:px-3 py-1 md:py-1.5 text-[10px] md:text-xs text-foreground/90">{children}</td>
  ),
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-cyan-400 underline decoration-cyan-400/30 underline-offset-2 transition-colors hover:text-cyan-300 hover:decoration-cyan-300/50"
    >
      {children}
    </a>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }: { children?: React.ReactNode }) => (
    <em className="italic text-foreground/90">{children}</em>
  )
}

function formatTimestamp(ts: Date | string | number): string {
  // tRPC serializes Date as ISO string; handle all three cases correctly.
  // Numeric values from the DB use unix-second integers (Drizzle timestamp mode).
  let date: Date
  if (ts instanceof Date) {
    date = ts
  } else if (typeof ts === 'number') {
    // Drizzle integer timestamp mode stores unix seconds
    date = new Date(ts * 1000)
  } else {
    // ISO string from tRPC JSON serialization
    date = new Date(ts)
  }
  return format(date, 'h:mm a')
}

export function ChatMessageBubble({
  role,
  content,
  agentPersona,
  createdAt,
  attachments,
  onDelete
}: ChatMessageBubbleProps) {
  const isUser = role === 'user'
  const persona = !isUser ? getAgentPersona(agentPersona ?? null) : null
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className={cn(
        'group relative flex w-full',
        isUser ? 'justify-end' : 'justify-start'
      )}
      data-testid={`chat-bubble-${role}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Delete button — shows on hover */}
      {onDelete && hovered && (
        <button
          type="button"
          onClick={onDelete}
          className={cn(
            'absolute top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full',
            'bg-destructive/80 text-destructive-foreground hover:bg-destructive',
            'transition-opacity',
            isUser ? 'left-0' : 'right-0'
          )}
          aria-label="Delete message"
          data-testid="delete-message-btn"
        >
          <X className="h-3 w-3" />
        </button>
      )}
      {/* Story t3-7: Mobile-optimized bubble with responsive width and padding */}
      <div
        className={cn(
          'rounded-xl px-3 py-2 md:px-3.5 md:py-2.5',
          'max-w-[90%] sm:max-w-[85%]',
          isUser
            ? 'bg-cyan-600/20 rounded-br-md'
            : 'bg-muted/60 rounded-bl-md'
        )}
      >
        {/* Sender label */}
        <div className="mb-1 flex items-center gap-1 md:gap-1.5">
          {isUser ? (
            <span className="text-[10px] md:text-[11px] font-medium text-cyan-400">You</span>
          ) : (
            <>
              {persona && (
                <span className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', persona.dot)} />
              )}
              <span className={cn('text-[10px] md:text-[11px] font-medium truncate', persona?.text ?? 'text-muted-foreground')}>
                {persona?.displayName ?? 'Agent'}
              </span>
            </>
          )}
          <span className="text-[9px] md:text-[10px] text-muted-foreground/60 flex-shrink-0">
            {formatTimestamp(createdAt)}
          </span>
        </div>

        {/* Story t3-7: Attachments with mobile-optimized sizes */}
        {attachments && attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1 md:gap-2" data-testid="message-attachments">
            {attachments.map((att) =>
              att.mime_type.startsWith('image/') ? (
                <img
                  key={att.id}
                  src={`tinsu-file://${att.file_path}`}
                  alt={att.file_name}
                  className="max-h-40 md:max-h-64 max-w-xs rounded border border-border/20 object-contain cursor-pointer"
                  data-testid={`attachment-image-${att.id}`}
                />
              ) : (
                <div
                  key={att.id}
                  className="flex items-center gap-1.5 md:gap-2 rounded border border-border/30 bg-muted/30 px-2 md:px-2.5 py-1 md:py-1.5"
                  data-testid={`attachment-file-${att.id}`}
                >
                  <Paperclip className="h-3 md:h-3.5 w-3 md:w-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="text-[10px] md:text-xs text-foreground/80 truncate">{att.file_name}</span>
                  <span className="text-[9px] md:text-[10px] text-muted-foreground flex-shrink-0">
                    {formatFileSize(att.file_size)}
                  </span>
                </div>
              )
            )}
          </div>
        )}

        {/* Story t3-7: Message content with responsive text size */}
        {isUser ? (
          content ? (
            <p className="text-xs md:text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap break-words">
              {content}
            </p>
          ) : null
        ) : (
          <div className="chat-markdown-content">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={chatMarkdownComponents}
            >
              {content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  )
}

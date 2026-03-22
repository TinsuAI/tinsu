/**
 * ChatInput - Message input component for chat panel.
 *
 * Story 10.2: Chat Panel UI & Message Bubbles (AC: 6)
 *
 * Auto-expanding textarea (max 6 rows) with Send button.
 * Submit on Enter (Shift+Enter for newline).
 * Clears after submit. Send disabled when empty/whitespace.
 * Auto-focus when panel opens.
 */

import { useRef, useEffect, useCallback, useState } from 'react'
import { Send } from 'lucide-react'
import { cn } from '@renderer/lib/utils'

interface ChatInputProps {
  onSend: (content: string) => void
  disabled?: boolean
  autoFocus?: boolean
}

/** Max textarea height in rows */
const MAX_ROWS = 6
const LINE_HEIGHT = 20 // approximate px per row
const MAX_HEIGHT = MAX_ROWS * LINE_HEIGHT

export function ChatInput({ onSend, disabled = false, autoFocus = true }: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [value, setValue] = useState('')

  const isEmpty = value.trim().length === 0

  /** Auto-focus textarea when component mounts or autoFocus changes */
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [autoFocus])

  /** Auto-resize textarea to fit content */
  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    // Reset height to calculate scrollHeight correctly
    textarea.style.height = 'auto'
    const newHeight = Math.min(textarea.scrollHeight, MAX_HEIGHT)
    textarea.style.height = `${newHeight}px`
  }, [])

  /** Handle textarea value change */
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setValue(e.target.value)
      adjustHeight()
    },
    [adjustHeight]
  )

  /** Handle message submission */
  const handleSubmit = useCallback(() => {
    const trimmed = value.trim()
    if (!trimmed || disabled) return

    onSend(trimmed)
    setValue('')

    // Reset textarea height after clearing
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
        textareaRef.current.focus()
      }
    })
  }, [value, onSend, disabled])

  /** Handle keydown for Enter/Shift+Enter behavior */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit]
  )

  return (
    <div
      className="flex items-end gap-2 border-t border-border/50 bg-card/30 px-3 py-2.5"
      data-testid="chat-input"
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder="Message your agent..."
        rows={1}
        className={cn(
          'flex-1 resize-none rounded-lg border border-border/40 bg-background/60 px-3 py-2',
          'text-sm text-foreground placeholder:text-muted-foreground/50',
          'focus:border-cyan-500/40 focus:outline-none focus:ring-1 focus:ring-cyan-500/20',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border'
        )}
        style={{ maxHeight: MAX_HEIGHT }}
        data-testid="chat-textarea"
      />
      <button
        type="button"
        onClick={handleSubmit}
        disabled={isEmpty || disabled}
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-all duration-150',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          isEmpty || disabled
            ? 'cursor-not-allowed bg-muted/30 text-muted-foreground/30'
            : 'bg-cyan-600/20 text-cyan-400 hover:bg-cyan-600/30 hover:text-cyan-300 active:scale-95'
        )}
        aria-label="Send message"
        data-testid="chat-send-button"
      >
        <Send className="h-4 w-4" />
      </button>
    </div>
  )
}

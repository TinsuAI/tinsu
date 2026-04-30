/**
 * MobileChatComposer — sticky bottom input bar for sending chat messages.
 *
 * Keyboard handling:
 *   - On hover-capable (non-touch) devices: Enter sends, Shift+Enter inserts newline.
 *   - On touch-only devices (mobile): Enter always inserts newline; Send button is the only submit affordance.
 * Detection uses window.matchMedia('(hover: none)') cached once at mount.
 *
 * Auto-grow: textarea expands up to max-h-[6rem] then internally scrolls.
 *
 * Safe-area: pb-[max(env(safe-area-inset-bottom),0.5rem)] clears home indicator / gesture bar.
 *
 * Story T3.5-5 — Mobile Planning (AC 7, 10, Task 9)
 */

import { useState, useRef, useEffect } from 'react'
import { Send } from 'lucide-react'
import { cn } from '@renderer/lib/utils'

interface MobileChatComposerProps {
  onSend: (content: string) => Promise<void> | void
  disabled: boolean
  placeholder?: string
}

export function MobileChatComposer({
  onSend,
  disabled,
  placeholder = 'Message…',
}: MobileChatComposerProps) {
  const [value, setValue] = useState('')
  const [sendError, setSendError] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Detect touch-only (soft keyboard) device once at mount
  const isTouchOnlyRef = useRef<boolean>(false)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      isTouchOnlyRef.current = window.matchMedia('(hover: none)').matches
    }
  }, [])

  // Auto-grow textarea
  const handleInput = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }

  const handleSend = async () => {
    const content = value.trim()
    if (!content || disabled || isSending) return

    // Optimistic clear
    const prev = value
    setValue('')
    setSendError(null)
    setIsSending(true)

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    try {
      await onSend(content)
    } catch (err) {
      // Revert on error
      setValue(prev)
      setSendError(err instanceof Error ? err.message : 'Send failed — tap to retry')
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      if (isTouchOnlyRef.current) {
        // Mobile: Enter always inserts newline — do nothing, let default run
        return
      }
      // Desktop/hover device: Enter sends; Shift+Enter = newline
      if (!e.shiftKey) {
        e.preventDefault()
        void handleSend()
      }
    }
  }

  const canSend = !disabled && !isSending && value.trim().length > 0

  return (
    <div
      className={cn(
        'relative', // needed for absolute-positioned sendError message (bottom-full)
        'sticky bottom-0 bg-background border-t border-border/40',
        'px-3 py-2',
        'pb-[max(env(safe-area-inset-bottom),0.5rem)]',
        'flex items-end gap-2',
      )}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled || isSending}
        aria-label="Type a message"
        rows={1}
        className={cn(
          'flex-1 resize-none rounded-xl',
          'bg-muted/40 border border-border/40',
          'px-3 py-2 text-sm text-foreground',
          'placeholder:text-muted-foreground',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          'max-h-[6rem] overflow-y-auto',
          'transition-colors duration-100',
          (disabled || isSending) ? 'opacity-50' : '',
        )}
        style={{ height: 'auto' }}
      />

      <button
        type="button"
        onClick={() => void handleSend()}
        disabled={!canSend}
        aria-label="Send message"
        className={cn(
          'flex items-center justify-center',
          'h-9 w-9 rounded-full',
          'bg-primary text-primary-foreground',
          'transition-opacity duration-150',
          'shrink-0',
          !canSend ? 'opacity-30 cursor-not-allowed' : 'active:opacity-70',
        )}
      >
        <Send className="h-4 w-4" aria-hidden />
      </button>

      {sendError && (
        <p
          className="absolute bottom-full left-3 right-3 mb-1 text-xs text-destructive"
          role="alert"
        >
          {sendError}
        </p>
      )}
    </div>
  )
}

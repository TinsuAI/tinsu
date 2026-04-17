/**
 * ChatInput - Message input component for chat panel.
 *
 * Story 10.2: Chat Panel UI & Message Bubbles (AC: 6)
 * Chat Attachments: Paste, drag-and-drop, file picker, preview strip
 *
 * Auto-expanding textarea (max 6 rows) with Send button.
 * Submit on Enter (Shift+Enter for newline).
 * Clears after submit. Send disabled when empty/whitespace and no attachments.
 * Auto-focus when panel opens.
 */

import { useRef, useEffect, useCallback, useState } from 'react'
import { Send, ArrowUp, Paperclip, FileIcon, X } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { useAutocomplete } from '@renderer/hooks/useAutocomplete'
import { AutocompleteDropdown } from './AutocompleteDropdown'

// Story t3-7: Mobile-optimized input field with viewport adjustment

/** A file staged for sending but not yet saved to disk */
export interface PendingAttachment {
  file: File
  previewUrl: string // Object URL for image preview, empty for non-images
  isImage: boolean
  /** For files selected via file picker — original filesystem path */
  originalPath?: string
}

interface ChatInputProps {
  onSend: (content: string, attachments: PendingAttachment[]) => void
  onAttachmentsAdded: (files: File[]) => void
  onAttachClick: () => void
  pendingAttachments: PendingAttachment[]
  onRemoveAttachment: (index: number) => void
  disabled?: boolean
  autoFocus?: boolean
  /** Pre-fill value set externally (e.g., from workflow click). Consumed once per change. */
  initialValue?: string | null
  /** Called after initialValue has been consumed */
  onInitialValueConsumed?: () => void
}

/** Max textarea height in rows */
const MAX_ROWS = 6
const LINE_HEIGHT = 20 // approximate px per row
const MAX_HEIGHT = MAX_ROWS * LINE_HEIGHT

export function ChatInput({
  onSend,
  onAttachmentsAdded,
  onAttachClick,
  pendingAttachments,
  onRemoveAttachment,
  disabled = false,
  autoFocus = true,
  initialValue,
  onInitialValueConsumed
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [value, setValue] = useState('')
  const [isPrefilled, setIsPrefilled] = useState(false)
  const lastConsumedPrefill = useRef<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const dragCounterRef = useRef(0)

  const autocomplete = useAutocomplete({ textareaRef, value, setValue })

  const isEmpty = value.trim().length === 0
  const hasAttachments = pendingAttachments.length > 0
  const canSend = !isEmpty || hasAttachments

  /** Auto-focus textarea when component mounts or autoFocus changes */
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [autoFocus])

  /**
   * Story t3-7: Handle mobile visualViewport changes to prevent keyboard overlap.
   * When soft keyboard appears on mobile, adjust scroll position and padding
   * to keep input field visible above the keyboard.
   * Guard: cancelAnimationFrame cleanup to prevent stale callbacks after unmount.
   */
  useEffect(() => {
    const handleVisualViewportChange = () => {
      if (!textareaRef.current) return

      const visualViewport = window.visualViewport
      if (!visualViewport) return

      // Scroll input into view when keyboard appears
      const frameId = requestAnimationFrame(() => {
        const textarea = textareaRef.current
        if (textarea) {
          const rect = textarea.getBoundingClientRect()
          // Guard: ensure keyboard height is never negative
          const keyboardHeight = Math.max(0, window.innerHeight - visualViewport.height)

          // If input would be obscured by keyboard, scroll it up
          if (rect.bottom > visualViewport.height - keyboardHeight) {
            textarea.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
          }
        }
      })

      return frameId
    }

    const visualViewport = window.visualViewport
    if (visualViewport) {
      const frameId = handleVisualViewportChange()
      visualViewport.addEventListener('resize', handleVisualViewportChange)
      return () => {
        visualViewport.removeEventListener('resize', handleVisualViewportChange)
        if (frameId !== undefined) cancelAnimationFrame(frameId)
      }
    }
  }, [])

  /** Consume initialValue when it changes (pre-fill from workflow click) */
  useEffect(() => {
    if (initialValue && initialValue !== lastConsumedPrefill.current) {
      setValue(initialValue)
      setIsPrefilled(true)
      lastConsumedPrefill.current = initialValue
      onInitialValueConsumed?.()
      // Adjust height after setting the value
      requestAnimationFrame(() => {
        const textarea = textareaRef.current
        if (textarea) {
          textarea.style.height = 'auto'
          const newHeight = Math.min(textarea.scrollHeight, MAX_HEIGHT)
          textarea.style.height = `${newHeight}px`
          textarea.focus()
        }
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValue])

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
      const newValue = e.target.value
      setValue(newValue)
      setIsPrefilled(false)
      adjustHeight()
      autocomplete.handleInputChange(newValue, e.target.selectionStart)
    },
    [adjustHeight, autocomplete]
  )

  /** Handle message submission */
  const handleSubmit = useCallback(() => {
    const trimmed = value.trim()
    if (!canSend || disabled) return

    // Story t3-7: Haptic feedback on send (mobile).
    // Guard: Check prefers-reduced-motion to respect accessibility preferences.
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!prefersReducedMotion && typeof window !== 'undefined' && 'navigator' in window) {
      // @ts-ignore - W3C Vibration API available on mobile browsers; TypeScript definitions lag
      navigator.vibrate?.(15)
    }

    onSend(trimmed, pendingAttachments)
    setValue('')
    setIsPrefilled(false)

    // Reset textarea height after clearing
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
        textareaRef.current.focus()
      }
    })
  }, [value, onSend, disabled, canSend, pendingAttachments])

  /** Handle keydown — autocomplete gets first crack, then Enter/Shift+Enter */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (autocomplete.handleKeyDown(e)) return
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [autocomplete, handleSubmit]
  )

  /** Handle paste — intercept image paste from clipboard */
  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = Array.from(e.clipboardData.items)
      const imageItems = items.filter((item) => item.type.startsWith('image/'))
      if (imageItems.length === 0) return // Let normal text paste proceed

      e.preventDefault()
      const files = imageItems.map((item) => item.getAsFile()).filter((f): f is File => f !== null)
      if (files.length > 0) onAttachmentsAdded(files)
    },
    [onAttachmentsAdded]
  )

  /** Handle drag enter — use counter to avoid flicker on child boundaries (F11) */
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current++
    if (dragCounterRef.current === 1) setIsDragOver(true)
  }, [])

  /** Handle drag over */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  /** Handle drag leave */
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current--
    if (dragCounterRef.current === 0) setIsDragOver(false)
  }, [])

  /** Handle drop */
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      dragCounterRef.current = 0
      setIsDragOver(false)
      const files = Array.from(e.dataTransfer.files)
      if (files.length > 0) onAttachmentsAdded(files)
    },
    [onAttachmentsAdded]
  )

  return (
    <div
      data-testid="chat-input"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative"
    >
      {/* Drop overlay */}
      {isDragOver && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center rounded-lg border-2 border-dashed border-cyan-500/60 bg-cyan-500/10"
          data-testid="chat-drop-overlay"
        >
          <span className="text-sm text-cyan-400">Drop files here</span>
        </div>
      )}

      {/* Hint banner when command is prefilled */}
      {isPrefilled && !isEmpty && (
        <div
          className="flex items-center gap-2 border-t border-cyan-500/20 bg-cyan-500/5 px-3 py-1.5"
          data-testid="chat-prefill-hint"
        >
          <ArrowUp className="h-3 w-3 shrink-0 animate-bounce text-cyan-400" />
          <span className="text-[11px] text-cyan-400/80">
            Press{' '}
            <kbd className="mx-0.5 rounded border border-cyan-500/30 bg-cyan-500/10 px-1 py-0.5 font-mono text-[10px]">
              Enter
            </kbd>{' '}
            to start this workflow
          </span>
        </div>
      )}

      {/* Attachment preview strip */}
      {hasAttachments && (
        <div
          className="flex gap-2 overflow-x-auto border-t border-border/30 px-3 py-2"
          data-testid="chat-attachment-preview-strip"
        >
          {pendingAttachments.map((att, i) => (
            <div
              key={i}
              className="group relative flex-shrink-0"
              data-testid={`attachment-preview-${i}`}
            >
              {att.isImage ? (
                <img
                  src={att.previewUrl}
                  alt={att.file.name}
                  className="h-16 w-16 rounded border border-border/30 object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded border border-border/30 bg-muted/40">
                  <FileIcon className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <button
                type="button"
                onClick={() => onRemoveAttachment(i)}
                className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs group-hover:flex"
                data-testid={`remove-attachment-${i}`}
              >
                <X className="h-2.5 w-2.5" />
              </button>
              <span className="mt-0.5 block max-w-[64px] truncate text-[10px] text-muted-foreground">
                {att.file.name}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Autocomplete dropdown — positioned above the input */}
      <AutocompleteDropdown state={autocomplete.state} onSelect={autocomplete.selectItem} />

      <div
        className={cn(
          'flex items-end gap-2 border-t border-border/50 bg-card/30 px-3 py-2.5',
          'md:gap-3 md:px-4 md:py-3',
          isDragOver && 'border-cyan-500/60 bg-cyan-500/5'
        )}
      >
        {/* Attach button - Story t3-7: Mobile touch target (min 44x44) */}
        <button
          type="button"
          onClick={onAttachClick}
          className={cn(
            'flex shrink-0 items-center justify-center rounded-lg text-muted-foreground',
            'transition-colors duration-150',
            'h-9 w-9 md:h-10 md:w-10',
            'hover:text-foreground active:scale-95',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
          )}
          data-testid="chat-attach-button"
          title="Attach files"
        >
          <Paperclip className="h-4 w-4 md:h-5 md:w-5" />
        </button>

        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          disabled={disabled}
          placeholder="Message your agent..."
          rows={1}
          className={cn(
            'flex-1 resize-none rounded-lg border border-border/40 bg-background/60 px-3 py-2',
            'md:px-4 md:py-2.5',
            'text-sm md:text-base text-foreground placeholder:text-muted-foreground/50',
            'focus:border-cyan-500/40 focus:outline-none focus:ring-1 focus:ring-cyan-500/20',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border'
          )}
          style={{ maxHeight: MAX_HEIGHT }}
          data-testid="chat-textarea"
        />

        {/* Send button - Story t3-7: Large mobile touch target, visible on all devices */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSend || disabled}
          className={cn(
            'flex shrink-0 items-center justify-center rounded-lg transition-all duration-150',
            'h-9 w-9 md:h-10 md:w-10',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            !canSend || disabled
              ? 'cursor-not-allowed bg-muted/30 text-muted-foreground/30'
              : 'bg-cyan-600/20 text-cyan-400 hover:bg-cyan-600/30 hover:text-cyan-300 active:scale-95'
          )}
          aria-label="Send message"
          data-testid="chat-send-button"
        >
          <Send className="h-4 w-4 md:h-5 md:w-5" />
        </button>
      </div>
    </div>
  )
}

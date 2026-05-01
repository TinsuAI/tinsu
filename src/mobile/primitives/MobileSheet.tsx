/**
 * MobileSheet — bottom sheet primitive for the mobile UI tree.
 *
 * Wraps `@radix-ui/react-dialog` so we get focus-trap, Esc-dismiss, and
 * ARIA modal semantics for free. Sheet mounts via Portal to document.body.
 *
 * Token contract: bg-card surface, bg-foreground/60 backdrop scrim,
 * bg-muted-foreground/40 drag handle, border-border/40 top border.
 * No inline color classes (bg-foreground/60 is a token-based scrim, not bg-black/60).
 *
 * Snap points:
 *   'half' → max-h-[50dvh]   (default — thumb-reachable content)
 *   'full' → h-[calc(100dvh-env(safe-area-inset-top,0px))]
 *   'fit'  → max-h-[90dvh], height is content-driven
 *
 * Dismiss actions:
 *   - Backdrop tap (Radix overlay click)
 *   - Esc key (Radix built-in)
 *   - Drag-handle drag past 30% of sheet height
 *   - Explicit onDismiss() invocation
 *
 * Body-scroll lock: sets document.body.style.overflow='hidden' while open;
 * restored on close or unmount.
 *
 * Motion: slide-in/out transitions disabled under prefers-reduced-motion.
 *
 * @param open           Controlled open state.
 * @param onOpenChange   Fired by Radix when the sheet should open/close.
 * @param children       Sheet body content.
 * @param snapPoint      Height contract — 'half' | 'full' | 'fit'. Default: 'half'.
 * @param title          Optional accessible title (rendered visually + aria-labelledby).
 * @param description    Optional accessible description.
 * @param onDismiss      Callback fired when sheet dismisses via any gesture.
 * @param ariaLabel      Overrides the aria-label when no title is provided.
 *
 * @example
 * <MobileSheet open={isOpen} onOpenChange={setIsOpen} snapPoint="half">
 *   <p>Sheet content</p>
 * </MobileSheet>
 */

import { useEffect, useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { cn } from '@renderer/lib/utils'
import { useReducedMotion } from '../hooks/useReducedMotion'

type SnapPoint = 'half' | 'full' | 'fit'

interface MobileSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
  snapPoint?: SnapPoint
  title?: string
  description?: string
  onDismiss?: () => void
  ariaLabel?: string
}

const SNAP_CLASSES: Record<SnapPoint, string> = {
  half: 'max-h-[50dvh]',
  full: 'h-[calc(100dvh-env(safe-area-inset-top,0px))]',
  fit:  'max-h-[90dvh]',
}

export function MobileSheet({
  open,
  onOpenChange,
  children,
  snapPoint = 'half',
  title,
  description,
  onDismiss,
  ariaLabel,
}: MobileSheetProps) {
  const reduced = useReducedMotion()
  const sheetRef = useRef<HTMLDivElement>(null)
  const dragStartYRef = useRef<number | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  /* ── Body-scroll lock ─────────────────────────────────────────── */
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  /* ── Drag-to-dismiss ──────────────────────────────────────────── */
  const handleDragStart = (e: React.PointerEvent) => {
    if (reduced) return
    dragStartYRef.current = e.clientY
    setIsDragging(true)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handleDragMove = (e: React.PointerEvent) => {
    if (!isDragging || dragStartYRef.current === null) return
    const deltaY = e.clientY - dragStartYRef.current
    const sheet = sheetRef.current
    if (!sheet) return
    // Provide visual feedback — clamp drag to positive (downward only)
    const clamped = Math.max(0, deltaY)
    sheet.style.transform = `translateY(${clamped}px)`
  }

  const handleDragEnd = (e: React.PointerEvent) => {
    if (!isDragging || dragStartYRef.current === null) return
    setIsDragging(false)

    const sheet = sheetRef.current
    if (sheet) sheet.style.transform = ''

    const deltaY = e.clientY - dragStartYRef.current
    dragStartYRef.current = null

    const sheetHeight = sheetRef.current?.offsetHeight ?? 400
    if (deltaY > sheetHeight * 0.3) {
      onOpenChange(false)
      onDismiss?.()
    }
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) onDismiss?.()
    onOpenChange(nextOpen)
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        {/* Backdrop */}
        <Dialog.Overlay
          data-testid="mobile-sheet-backdrop"
          className={cn(
            'fixed inset-0 z-50 bg-foreground/60',
            reduced
              ? 'data-[state=open]:opacity-100 data-[state=closed]:opacity-0'
              : [
                  'data-[state=open]:animate-in data-[state=closed]:animate-out',
                  'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
                  'duration-200',
                ].join(' '),
          )}
        />

        {/* Sheet content.
            aria-describedby={undefined} when no description: suppresses Radix's
            "Missing Description" dev warning — intentional, callers own the description. */}
        <Dialog.Content
          ref={sheetRef}
          aria-label={!title ? (ariaLabel ?? 'Bottom sheet') : undefined}
          {...(!description && { 'aria-describedby': undefined })}
          data-testid="mobile-sheet-content"
          className={cn(
            'fixed bottom-0 left-0 right-0 z-50',
            'flex flex-col',
            'bg-card rounded-t-2xl',
            'border-t border-border/40',
            'shadow-2xl',
            'outline-none',
            SNAP_CLASSES[snapPoint],
            reduced
              ? ''
              : [
                  'data-[state=open]:animate-in data-[state=closed]:animate-out',
                  'data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
                  'duration-250',
                ].join(' '),
          )}
          style={{
            transition: isDragging ? 'none' : undefined,
          }}
        >
          {/* Drag handle */}
          <div
            data-testid="mobile-sheet-drag-handle"
            className="flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing shrink-0"
            onPointerDown={handleDragStart}
            onPointerMove={handleDragMove}
            onPointerUp={handleDragEnd}
            onPointerCancel={handleDragEnd}
          >
            <div className="h-1 w-10 bg-muted-foreground/40 rounded-full" />
          </div>

          {/* Accessible title — always present for screen readers (Radix requirement).
              When no visible title, rendered visually hidden (sr-only). */}
          {!title && (
            <Dialog.Title className="sr-only">
              {ariaLabel ?? 'Bottom sheet'}
            </Dialog.Title>
          )}

          {/* Optional visible header */}
          {(title || description) && (
            <div className="px-4 pb-3 shrink-0">
              {title && (
                <Dialog.Title className="text-base font-semibold text-foreground">
                  {title}
                </Dialog.Title>
              )}
              {description && (
                <Dialog.Description className="text-sm text-muted-foreground mt-0.5">
                  {description}
                </Dialog.Description>
              )}
            </div>
          )}

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

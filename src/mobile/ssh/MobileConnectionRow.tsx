/**
 * MobileConnectionRow — single SSH connection row with swipe-left action layer.
 *
 * AC: 5, 7
 *
 * Swipe implementation: plain onPointer* handlers — NO framer-motion, react-spring,
 * react-swipeable. Threshold: |deltaX| > 80px → snap to revealed (-160px); else snap back.
 * Reduced-motion: skip CSS transition; toggle revealed/hidden instantly.
 *
 * Token discipline:
 *   - Status dot colors use UX-DR9 connection-state palette:
 *     bg-emerald-500 (connected), bg-amber-500 (testing)
 *   - Error dot uses bg-destructive (token)
 *   - Idle dot uses bg-muted-foreground/40 (token)
 *   - Action layer: bg-primary/15 + bg-destructive/15 (tokens)
 *   - All other surfaces: Calm Command tokens only
 */

import { useRef, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { useReducedMotion } from '../hooks/useReducedMotion'
import type { SshConnectionProfile } from '@renderer/lib/rspc'
import type { ConnectionStatus } from './MobileConnectionsListScreen'

interface MobileConnectionRowProps {
  connection: SshConnectionProfile
  status: ConnectionStatus
  isSwiped: boolean
  onSwipeChange: (id: string | null) => void
  onPress: () => void
  onEdit: () => void
  onDelete: () => void
}

const STATUS_DOT_CLASS: Record<ConnectionStatus, string> = {
  connected: 'bg-emerald-500',        // UX-DR9: connected state indicator
  testing:   'bg-amber-500',          // UX-DR9: in-progress state indicator
  error:     'bg-destructive',        // token: error/destructive state
  idle:      'bg-muted-foreground/40', // token: idle/unknown state
}

const SWIPE_SNAP = -160
const SWIPE_THRESHOLD = 80

export function MobileConnectionRow({
  connection,
  status,
  isSwiped,
  onSwipeChange,
  onPress,
  onEdit,
  onDelete,
}: MobileConnectionRowProps) {
  const reduced = useReducedMotion()
  const startXRef = useRef<number | null>(null)
  const [liveX, setLiveX] = useState(0)
  const isDraggingRef = useRef(false)

  const targetX = isSwiped ? SWIPE_SNAP : 0

  const handlePointerDown = (e: React.PointerEvent) => {
    startXRef.current = e.clientX
    isDraggingRef.current = false
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (startXRef.current === null) return
    const delta = e.clientX - startXRef.current
    if (Math.abs(delta) > 4) isDraggingRef.current = true
    // Clamp: left side limited to SWIPE_SNAP; right side stays at 0 max
    const baseX = isSwiped ? SWIPE_SNAP : 0
    const clamped = Math.max(SWIPE_SNAP, Math.min(0, baseX + delta))
    setLiveX(clamped)
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (startXRef.current === null) return
    const delta = e.clientX - startXRef.current

    if (!isDraggingRef.current) {
      // Tap (no meaningful drag)
      if (isSwiped) {
        // Tap on swiped row: collapse
        onSwipeChange(null)
      } else {
        // Tap on normal row: open detail
        onPress()
      }
      startXRef.current = null
      setLiveX(0)
      return
    }

    // Snap decision: combine base position with delta
    const baseX = isSwiped ? SWIPE_SNAP : 0
    const finalX = baseX + delta
    const shouldReveal = finalX < -SWIPE_THRESHOLD

    onSwipeChange(shouldReveal ? connection.id : null)
    setLiveX(0) // reset; CSS transition handles the snap
    startXRef.current = null
    isDraggingRef.current = false
  }

  // During active drag, use liveX; otherwise snap to targetX
  const currentX = isDraggingRef.current ? liveX : targetX
  const transition = isDraggingRef.current || reduced ? 'none' : 'transform 200ms ease-out'

  return (
    <div
      data-testid={`mobile-connection-row-${connection.id}`}
      aria-label={`SSH connection ${connection.host}`}
      className="relative overflow-hidden border-b border-border/30"
      role="listitem"
    >
      {/* Action layer — absolutely positioned behind the row */}
      <div
        aria-hidden
        className="absolute inset-y-0 right-0 flex items-stretch"
      >
        {/* Edit action */}
        <button
          type="button"
          data-testid={`mobile-connection-row-edit-${connection.id}`}
          aria-label="Edit connection"
          onClick={(e) => {
            e.stopPropagation()
            onEdit()
          }}
          className={cn(
            'px-4 min-h-[2.75rem] flex items-center justify-center',
            'bg-primary/15 text-primary border-l border-primary/40',
            'text-sm font-medium',
          )}
        >
          Edit
        </button>

        {/* Delete action */}
        <button
          type="button"
          data-testid={`mobile-connection-row-delete-${connection.id}`}
          aria-label="Delete connection"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className={cn(
            'px-4 min-h-[2.75rem] flex items-center justify-center',
            'bg-destructive/15 text-destructive border-l border-destructive/40',
            'text-sm font-medium',
          )}
        >
          Delete
        </button>
      </div>

      {/* Row content — translates left on swipe to reveal actions */}
      <div
        className="relative bg-card flex items-center gap-3 min-h-[3.25rem] px-4 py-3"
        style={{
          transform: `translateX(${currentX}px)`,
          transition,
          userSelect: 'none',
          touchAction: 'pan-y',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* Status dot — UX-DR9 connection-state palette (see STATUS_DOT_CLASS above) */}
        <span
          aria-hidden
          className={cn(
            'h-2 w-2 rounded-full shrink-0',
            STATUS_DOT_CLASS[status],
          )}
        />

        {/* Text content */}
        <span className="flex-1 flex flex-col min-w-0">
          <span className="text-sm text-foreground leading-snug truncate">
            {connection.host}
          </span>
          {/* Mono subtitle: username@host:port (AC 5c) */}
          <span className="font-mono text-xs text-muted-foreground mt-0.5 truncate">
            {connection.username}@{connection.host}:{connection.port}
          </span>
        </span>

        {/* Trailing chevron */}
        <ChevronRight className="h-4 w-4 text-muted-foreground/60 shrink-0" aria-hidden />
      </div>
    </div>
  )
}

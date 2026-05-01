/**
 * MobilePullToRefresh — pull-to-refresh wrapper for scrollable content.
 *
 * Tracks touchstart/touchmove/touchend on the wrapped content area.
 * When the user pulls from scrollTop=0 by ≥threshold px (default 80),
 * fires onRefresh() once and enters 'refreshing' state until the promise
 * resolves or rejects.
 *
 * Token contract: text-muted-foreground spinner. No inline color classes.
 *
 * Indicator: lucide Loader2 icon with animate-spin (static under reduced-motion).
 * Reduced-motion: snap-back transition is instant; spinner does not rotate.
 *
 * Disabled: all touch handlers are skipped.
 *
 * Pull below threshold cancels without firing onRefresh.
 * Below threshold snap-back uses 200 ms CSS transition (instant under reduced-motion).
 *
 * @param onRefresh  Async callback fired when pull threshold is exceeded.
 * @param threshold  Pull distance (px) required to trigger refresh. Default: 80.
 * @param children   Scrollable content to wrap.
 * @param disabled   When true, pull-to-refresh is disabled.
 *
 * @example
 * <MobilePullToRefresh onRefresh={fetchData}>
 *   <TaskList tasks={tasks} />
 * </MobilePullToRefresh>
 */

import { useRef, useState, useCallback } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { useReducedMotion } from '../hooks/useReducedMotion'

type RefreshState = 'idle' | 'pulling' | 'refreshing'

interface MobilePullToRefreshProps {
  onRefresh: () => Promise<void>
  threshold?: number
  children: React.ReactNode
  disabled?: boolean
}

export function MobilePullToRefresh({
  onRefresh,
  threshold = 80,
  children,
  disabled = false,
}: MobilePullToRefreshProps) {
  const reduced = useReducedMotion()
  const [state, setState] = useState<RefreshState>('idle')
  const [pullDelta, setPullDelta] = useState(0)
  const touchStartY = useRef<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const isRefreshing = useRef(false)

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled) return
    const container = containerRef.current
    if (!container) return
    // Only activate when scroll is at the very top
    if (container.scrollTop > 0) return
    touchStartY.current = e.touches[0].clientY
  }, [disabled])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (disabled || touchStartY.current === null) return
    const container = containerRef.current
    if (!container) return
    if (container.scrollTop > 0) {
      touchStartY.current = null
      return
    }

    const deltaY = e.touches[0].clientY - touchStartY.current
    if (deltaY <= 0) return

    // Cap visual pull at threshold * 1.5
    const capped = Math.min(deltaY, threshold * 1.5)
    setPullDelta(capped)
    setState(deltaY >= threshold ? 'pulling' : 'idle')
  }, [disabled, threshold])

  const handleTouchEnd = useCallback(async () => {
    if (disabled || touchStartY.current === null) return
    const delta = pullDelta

    touchStartY.current = null
    setPullDelta(0)

    if (delta >= threshold && !isRefreshing.current) {
      isRefreshing.current = true
      setState('refreshing')
      try {
        await onRefresh()
      } finally {
        isRefreshing.current = false
        setState('idle')
      }
    } else {
      setState('idle')
    }
  }, [disabled, pullDelta, threshold, onRefresh])

  const spinnerVisible = state === 'refreshing' || (state === 'pulling' && pullDelta >= threshold)
  const indicatorY = state === 'refreshing' ? threshold : pullDelta

  return (
    <div
      data-testid="mobile-pull-to-refresh"
      className="relative h-full"
    >
      {/* Pull indicator */}
      <div
        data-testid="mobile-pull-to-refresh-indicator"
        data-state={state}
        aria-hidden
        className={cn(
          'absolute top-0 left-0 right-0 z-10',
          'flex items-center justify-center',
          'pointer-events-none',
          'overflow-hidden',
        )}
        style={{
          height: `${indicatorY}px`,
          transition: state === 'idle' && !reduced ? 'height 200ms ease' : 'none',
        }}
      >
        {spinnerVisible && (
          <Loader2
            className={cn(
              'h-5 w-5 text-muted-foreground',
              state === 'refreshing' && !reduced ? 'animate-spin' : '',
            )}
          />
        )}
      </div>

      {/* Scrollable content */}
      <div
        ref={containerRef}
        data-testid="mobile-pull-to-refresh-content"
        className="h-full overflow-y-auto overscroll-contain"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: pullDelta > 0 ? `translateY(${pullDelta}px)` : undefined,
          transition: state === 'idle' && pullDelta === 0 && !reduced ? 'transform 200ms ease' : 'none',
        }}
      >
        {children}
      </div>
    </div>
  )
}

/**
 * MobileColumnPager — horizontal scroll-snap column pager.
 *
 * Displays children as snap-aligned columns with a configurable peek of
 * adjacent columns. Uses pure CSS scroll-snap — no JS animation library.
 * Touch-action: pan-x allows vertical scrolling inside each column.
 *
 * No @dnd-kit integration here — that is T3.5-3's responsibility.
 * No swipe-between-tabs content — that is T3.5-4's responsibility.
 *
 * Token contract: no color classes at pager level — columns inherit from children.
 *
 * Touch targets: navigation is handled by native touch scroll; no interactive
 * elements in pager itself except scroll container (pan-x).
 *
 * Index detection: IntersectionObserver on each column element. When a column
 * intersects at ≥50%, fires onIndexChange (once per settle).
 *
 * Controlled mode: when currentIndex changes externally, scrolls imperatively
 * with behavior:'smooth' (or 'instant' under reduced-motion).
 *
 * @param children       Array of ReactNode — one per column (required).
 * @param currentIndex   Controlled active index (optional).
 * @param defaultIndex   Uncontrolled initial index (default: 0).
 * @param onIndexChange  Fires with new index when scroll settles on a column.
 * @param peekPercent    Percentage of adjacent column visible at rest (default: 8).
 * @param ariaLabel      Accessible label for the scroll container.
 *
 * @example
 * <MobileColumnPager onIndexChange={setCol} peekPercent={8}>
 *   <BoardColumn />
 *   <BacklogColumn />
 *   <DoneColumn />
 * </MobileColumnPager>
 */

import { useRef, useEffect, useCallback, useState } from 'react'
import { cn } from '@renderer/lib/utils'
import { useReducedMotion } from '../hooks/useReducedMotion'

interface MobileColumnPagerProps {
  children: React.ReactNode[]
  currentIndex?: number
  defaultIndex?: number
  onIndexChange?: (index: number) => void
  peekPercent?: number
  ariaLabel?: string
}

export function MobileColumnPager({
  children,
  currentIndex,
  defaultIndex = 0,
  onIndexChange,
  peekPercent = 8,
  ariaLabel,
}: MobileColumnPagerProps) {
  const reduced = useReducedMotion()
  const scrollRef = useRef<HTMLDivElement>(null)
  const columnRefs = useRef<(HTMLDivElement | null)[]>([])
  const [internalIndex, setInternalIndex] = useState(defaultIndex)
  const isControlled = currentIndex !== undefined
  const activeIndex = isControlled ? currentIndex : internalIndex

  /* ── Scroll imperatively when controlled index changes ─────────── */
  useEffect(() => {
    if (currentIndex === undefined) return
    const container = scrollRef.current
    if (!container) return
    const col = columnRefs.current[currentIndex]
    if (!col) return
    container.scrollTo({
      left: col.offsetLeft,
      behavior: reduced ? 'instant' : 'smooth',
    })
  }, [currentIndex, reduced])

  /* ── IntersectionObserver to detect settled column ─────────────── */
  useEffect(() => {
    const container = scrollRef.current
    if (!container) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            const idx = columnRefs.current.indexOf(entry.target as HTMLDivElement)
            if (idx >= 0 && idx !== activeIndex) {
              if (!isControlled) setInternalIndex(idx)
              onIndexChange?.(idx)
            }
          }
        }
      },
      { root: container, threshold: 0.5 },
    )

    columnRefs.current.forEach((el) => {
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [children.length, isControlled, onIndexChange, activeIndex])

  // Column width = 100% - peek on each side
  const colWidthPercent = 100 - peekPercent * 2

  return (
    <div
      ref={scrollRef}
      role="region"
      aria-label={ariaLabel ?? 'Column pager'}
      data-testid="mobile-column-pager"
      className={cn(
        'flex overflow-x-auto',
        'snap-x snap-mandatory',
        'scroll-smooth',
        'touch-pan-x',
        // Hide scrollbar but keep functionality
        '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
      )}
    >
      {children.map((child, idx) => (
        <div
          key={idx}
          ref={(el) => { columnRefs.current[idx] = el }}
          data-testid={`mobile-column-pager-col-${idx}`}
          className="flex-shrink-0 snap-center h-full"
          style={{ width: `${colWidthPercent}%` }}
        >
          {child}
        </div>
      ))}
    </div>
  )
}

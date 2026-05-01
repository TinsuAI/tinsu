/**
 * MobileLoadingSkeleton — animated loading placeholder for various content shapes.
 *
 * Inline implementation — does NOT import from src/components/ui/skeleton.tsx
 * to satisfy AC 10 (no desktop-tree imports). The underlying Skeleton element
 * is a 5-line inline span with animate-pulse + bg-muted/50.
 *
 * Token contract: bg-muted/50 surface. No inline color classes.
 * Reduced-motion: animate-pulse replaced with static bg-muted/50 (no shimmer).
 *
 * Variants:
 *   'text-row'    → single h-4 rounded bar (single line of text)
 *   'list-row'    → flex row with circle 40 px + 2 stacked lines
 *   'card'        → h-32 rounded-lg card with internal text stack
 *   'chat-bubble' → max-w-[70%] rounded-2xl h-12 (chat message)
 *   'circle'      → h-10 w-10 rounded-full (avatar)
 *
 * @param variant    Shape of the skeleton block.
 * @param count      Number of skeleton blocks to render (default: 1).
 * @param className  Additional classes applied to each skeleton block wrapper.
 *
 * @example
 * <MobileLoadingSkeleton variant="list-row" count={5} />
 * <MobileLoadingSkeleton variant="card" />
 */

import { cn } from '@renderer/lib/utils'
import { useReducedMotion } from '../hooks/useReducedMotion'

type SkeletonVariant = 'text-row' | 'list-row' | 'card' | 'chat-bubble' | 'circle'

interface MobileLoadingSkeletonProps {
  variant: SkeletonVariant
  count?: number
  className?: string
}

// Inline skeleton element — no desktop import
function Bone({ className }: { className?: string }) {
  return <span className={cn('block rounded-md bg-muted/50', className)} />
}

interface SkeletonBlockProps {
  variant: SkeletonVariant
  animated: boolean
  className?: string
}

function SkeletonBlock({ variant, animated, className }: SkeletonBlockProps) {
  const animClass = animated ? 'animate-pulse' : ''

  if (variant === 'text-row') {
    return (
      <div
        data-testid="mobile-loading-skeleton-text-row"
        className={cn(animClass, className)}
      >
        <Bone className="h-4 w-full" />
      </div>
    )
  }

  if (variant === 'list-row') {
    return (
      <div
        data-testid="mobile-loading-skeleton-list-row"
        className={cn('flex items-center gap-3 py-3 px-4', animClass, className)}
      >
        <Bone className="h-10 w-10 rounded-full shrink-0" />
        <div className="flex-1 flex flex-col gap-2">
          <Bone className="h-4 w-3/4" />
          <Bone className="h-3 w-1/2" />
        </div>
      </div>
    )
  }

  if (variant === 'card') {
    return (
      <div
        data-testid="mobile-loading-skeleton-card"
        className={cn('rounded-lg overflow-hidden', animClass, className)}
      >
        <Bone className="h-32 w-full rounded-none" />
        <div className="p-3 flex flex-col gap-2">
          <Bone className="h-4 w-2/3" />
          <Bone className="h-3 w-full" />
          <Bone className="h-3 w-4/5" />
        </div>
      </div>
    )
  }

  if (variant === 'chat-bubble') {
    return (
      <div
        data-testid="mobile-loading-skeleton-chat-bubble"
        className={cn('my-1', animClass, className)}
      >
        <Bone className="max-w-[70%] h-12 rounded-2xl" />
      </div>
    )
  }

  // circle
  return (
    <div
      data-testid="mobile-loading-skeleton-circle"
      className={cn(animClass, className)}
    >
      <Bone className="h-10 w-10 rounded-full" />
    </div>
  )
}

export function MobileLoadingSkeleton({
  variant,
  count = 1,
  className,
}: MobileLoadingSkeletonProps) {
  const reduced = useReducedMotion()
  const animated = !reduced

  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonBlock
          key={i}
          variant={variant}
          animated={animated}
          className={className}
        />
      ))}
    </>
  )
}

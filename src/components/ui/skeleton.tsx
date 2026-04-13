import { cn } from '@renderer/lib/utils'

/**
 * Skeleton component for loading states.
 *
 * A simple animated placeholder that indicates content is loading.
 * Uses a subtle pulse animation with a muted background.
 *
 * @example
 * ```tsx
 * <Skeleton className="h-4 w-full" />
 * <Skeleton className="h-10 w-32 rounded-md" />
 * ```
 */
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return <div className={cn('animate-pulse rounded-md bg-muted/50', className)} {...props} />
}

export { Skeleton }

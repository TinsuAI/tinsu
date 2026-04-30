/**
 * MobileEmptyState — placeholder screen for unimplemented routes.
 *
 * Centred vertically and horizontally within whatever flex container
 * wraps it (typically the flex-1 scrollable area of MobileScreen).
 *
 * Uses only Calm Command tokens — no inline colour classes.
 *
 * Props:
 *   icon?     — React node for a large icon (e.g. lucide icon at h-10 w-10)
 *   title     — primary heading (text-foreground)
 *   subtitle? — supporting copy (text-muted-foreground)
 *   action?   — optional CTA button node
 */
interface MobileEmptyStateProps {
  icon?: React.ReactNode
  title: string
  subtitle?: string
  action?: React.ReactNode
}

export function MobileEmptyState({ icon, title, subtitle, action }: MobileEmptyStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center h-full w-full px-8 py-12 text-center gap-4"
      data-testid="mobile-empty-state"
    >
      {icon && (
        <div className="text-muted-foreground mb-1" aria-hidden>
          {icon}
        </div>
      )}

      <div className="flex flex-col items-center gap-1.5">
        <h2 className="text-lg font-semibold text-foreground leading-snug">
          {title}
        </h2>
        {subtitle && (
          <p className="text-sm text-muted-foreground leading-relaxed max-w-[260px]">
            {subtitle}
          </p>
        )}
      </div>

      {action && (
        <div className="mt-2">
          {action}
        </div>
      )}
    </div>
  )
}

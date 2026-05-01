/**
 * MobileEmptyState — empty/placeholder screen for routes with no content yet.
 *
 * Centred vertically and horizontally within whatever flex container wraps it
 * (typically the flex-1 scrollable area of MobileScreen).
 *
 * Token contract: text-foreground (title), text-muted-foreground (subtitle/icon).
 * No inline color classes. Max subtitle width is 260 px for comfortable line lengths.
 *
 * Touch target: action slot rendered as-is — caller controls button sizing.
 *
 * @param icon     Optional React node for a large icon (e.g. lucide icon at h-10 w-10).
 * @param title    Primary heading (text-lg, text-foreground).
 * @param subtitle Optional supporting copy (text-sm, text-muted-foreground, max-w-[260px]).
 * @param action   Optional CTA button node rendered below the copy block.
 *
 * @example
 * <MobileEmptyState
 *   icon={<Inbox className="h-10 w-10" />}
 *   title="No tasks yet"
 *   subtitle="Create a task to get started."
 *   action={<button onClick={onCreate}>New Task</button>}
 * />
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

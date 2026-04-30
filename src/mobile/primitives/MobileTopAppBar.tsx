/**
 * MobileTopAppBar — top application bar for the mobile UI tree.
 *
 * Shows the active project name on the left and an optional
 * connection-status pill on the right.  The bar is frosted-glass
 * (bg-card/95 + backdrop-blur) so underlying content can scroll
 * behind it while keeping the bar legible.
 *
 * Safe-area top inset is applied via inline style so real device
 * chrome is respected.  The inner content height is fixed at 52 px,
 * matching Android Material 3 / iOS Large-Title collapsed heights.
 *
 * Placeholder primitive — T3.5-2 will add navigation back-button slot
 * and elevation shadow tokens.
 */
interface MobileTopAppBarProps {
  projectName: string
  statusPill?: React.ReactNode
}

export function MobileTopAppBar({ projectName, statusPill }: MobileTopAppBarProps) {
  return (
    <header
      className="w-full bg-card/95 backdrop-blur-xl border-b border-border/40 shrink-0"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="flex items-center justify-between px-4 h-[52px]">
        {/* Project name — truncates cleanly on very long names */}
        <span
          className="text-sm font-semibold text-foreground truncate max-w-[70%] leading-none"
          data-testid="mobile-top-bar-project-name"
        >
          {projectName}
        </span>

        {/* Right slot: connection status pill or any other badge */}
        {statusPill && (
          <div className="flex items-center shrink-0" data-testid="mobile-top-bar-status-pill">
            {statusPill}
          </div>
        )}
      </div>
    </header>
  )
}

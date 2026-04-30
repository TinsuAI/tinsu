/**
 * MobileScreen — full-viewport wrapper for a single mobile screen.
 *
 * Layout contract (top → bottom):
 *   [topBar]    — fixed-height app bar (MobileTopAppBar or similar)
 *   [children]  — flex-1, overflow-y-auto; scrolls independently
 *   [tabBar]    — fixed-height bottom navigation (MobileTabBar or similar)
 *
 * Uses `h-[100dvh]` (dynamic viewport height) so the bar never hides
 * behind the iOS Safari address bar on scroll.
 *
 * bg-background + text-foreground are the root surface tokens so every
 * child inherits the dark theme correctly.
 *
 * NOTE: This is a placeholder primitive.  The full contract — UX-DR7
 * touch target enforcement, `prefers-reduced-motion` animation wrappers,
 * keyboard-aware scroll adjustment — lands in T3.5-2.
 */
interface MobileScreenProps {
  /** App bar rendered at the top (receives safe-area-inset-top internally) */
  topBar: React.ReactNode
  /** Tab bar rendered at the bottom (receives safe-area-inset-bottom internally) */
  tabBar: React.ReactNode
  /** Scrollable screen content */
  children: React.ReactNode
}

export function MobileScreen({ topBar, tabBar, children }: MobileScreenProps) {
  return (
    <div
      className="flex flex-col h-[100dvh] w-full bg-background text-foreground overflow-hidden"
      data-testid="mobile-screen"
    >
      {/* Top bar slot */}
      {topBar}

      {/* Scrollable content area */}
      <main className="flex-1 overflow-y-auto overscroll-contain">
        {children}
      </main>

      {/* Bottom navigation slot */}
      {tabBar}
    </div>
  )
}

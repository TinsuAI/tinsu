/**
 * MobileScreen — full-viewport wrapper for a single mobile screen.
 *
 * Layout contract (top → bottom):
 *   [topBar]     — fixed-height app bar (MobileTopAppBar)
 *   [children]   — flex-1, overflow-y-auto; scrolls independently
 *   [bottomBar?] — optional sticky action bar (MobileBottomActionBar)
 *   [tabBar]     — fixed-height bottom navigation (MobileTabBar)
 *
 * Uses `h-[100dvh]` (dynamic viewport height) so the layout never
 * hides behind iOS Safari address bar on scroll.
 *
 * Token contract: bg-background, text-foreground only at root level.
 * Safe-area insets are delegated to MobileTopAppBar (top) and
 * MobileTabBar / MobileBottomActionBar (bottom) — no double-padding here.
 *
 * @param topBar    Required. App bar slot rendered above the content.
 * @param tabBar    Required. Bottom tab navigation slot.
 * @param children  Scrollable screen body.
 * @param bottomBar Optional. MobileBottomActionBar — renders above tabBar.
 *
 * @example
 * <MobileScreen topBar={<MobileTopAppBar />} tabBar={<MobileTabBar />}>
 *   <MyContent />
 * </MobileScreen>
 */

interface MobileScreenProps {
  /** App bar rendered at the top (receives safe-area-inset-top internally) */
  topBar: React.ReactNode
  /** Tab bar rendered at the bottom (receives safe-area-inset-bottom internally) */
  tabBar: React.ReactNode
  /** Scrollable screen content */
  children: React.ReactNode
  /**
   * Optional bottom action bar (MobileBottomActionBar).
   * Rendered between scrollable content and tab bar.
   */
  bottomBar?: React.ReactNode
}

export function MobileScreen({ topBar, tabBar, children, bottomBar }: MobileScreenProps) {
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

      {/* Optional bottom action bar (above tab bar) */}
      {bottomBar}

      {/* Bottom navigation slot */}
      {tabBar}
    </div>
  )
}

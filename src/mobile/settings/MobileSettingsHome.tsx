/**
 * MobileSettingsHome — settings tab root screen.
 *
 * AC: 18 (T3.5-7 — transitional entry point for SSH connections)
 *
 * TRANSITIONAL T3.5-8 PLACEHOLDER:
 *   This screen renders a minimal settings list with a single "Connections" row so
 *   the connections list (T3.5-7) is reachable without a deep-link. The full settings
 *   rebuild — all settings categories, account info, preferences — lands in T3.5-8.
 *   This file WILL be replaced in T3.5-8. Do not add more settings rows here.
 *
 * The `'home'` route stays as the settings tab root in mobile-nav.store.ts — unchanged.
 * T3.5-7 pushes `connections` on top of `home` to navigate to the list.
 */

import { useMobileNavStore } from '../shell/mobile-nav.store'
import { MobileListItem } from '../primitives/MobileListItem'

export function MobileSettingsHome() {
  const { pushRoute } = useMobileNavStore()

  return (
    <div className="flex flex-col h-full">
      {/* Transitional minimal settings list — T3.5-8 will replace this with the full list */}
      <div role="list" aria-label="Settings">
        <MobileListItem
          title="Connections"
          subtitle="SSH connections"
          trailing="chevron"
          onPress={() => pushRoute('settings', 'connections')}
        />
      </div>

      {/* Transitional placeholder notice — T3.5-8 placeholder inline comment */}
      <p className="text-xs text-muted-foreground/50 px-4 py-3">
        Full settings coming in T3.5-8.
      </p>
    </div>
  )
}

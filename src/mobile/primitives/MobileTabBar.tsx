/**
 * MobileTabBar — bottom navigation tab bar for the mobile UI tree.
 *
 * Five tabs: Board / Planning / Tasks / Activity / Settings.
 * Active tab: text-primary + frosted pill bg-primary/10 + hairline indicator above.
 * Inactive tabs: text-muted-foreground.
 *
 * Token contract: bg-card/95 frosted glass, border-border/40 separator,
 * bg-primary/10 active pill, text-primary / text-muted-foreground labels.
 *
 * Touch targets: min-h-[3.5rem] (56 px) per tab — UX-DR7 + T3.5-1 baseline.
 * Long-press the active tab (≥500 ms) fires onLongPressActiveTab (iOS scroll-to-top).
 *
 * Optional badges prop renders a numeric count (≥10 = "9+") or dot over the icon.
 * The long-press stale-isActive bug from T3.5-1 is fixed here via isActiveRef.
 *
 * @param activeTab             Currently selected tab ID.
 * @param onTabPress            Fires when a tab is tapped.
 * @param onLongPressActiveTab  Fires after 500 ms long-press on the active tab.
 * @param badges                Optional badge counts per tab (≥1 = dot, shown as number or "9+").
 *
 * @example
 * <MobileTabBar
 *   activeTab="board"
 *   onTabPress={switchTab}
 *   onLongPressActiveTab={clearStack}
 *   badges={{ planning: 3 }}
 * />
 */

import { useRef, useCallback } from 'react'
import {
  LayoutDashboard,
  Compass,
  CheckSquare,
  Activity,
  Settings,
} from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import type { MobileTabId } from '../shell/mobile-nav.store'

interface TabConfig {
  id: MobileTabId
  label: string
  Icon: React.ComponentType<{ className?: string }>
}

const TABS: TabConfig[] = [
  { id: 'board',    label: 'Board',    Icon: LayoutDashboard },
  { id: 'planning', label: 'Planning', Icon: Compass },
  { id: 'tasks',    label: 'Tasks',    Icon: CheckSquare },
  { id: 'activity', label: 'Activity', Icon: Activity },
  { id: 'settings', label: 'Settings', Icon: Settings },
]

/** Duration in ms before a long-press fires */
const LONG_PRESS_MS = 500

interface MobileTabBarProps {
  activeTab: MobileTabId
  onTabPress: (tab: MobileTabId) => void
  onLongPressActiveTab: (tab: MobileTabId) => void
  /**
   * Badge counts per tab. Value ≥1 renders a badge dot/number above the icon.
   * Values ≥10 display as "9+".
   */
  badges?: Partial<Record<MobileTabId, number>>
}

export function MobileTabBar({
  activeTab,
  onTabPress,
  onLongPressActiveTab,
  badges,
}: MobileTabBarProps) {
  return (
    <nav
      className="flex w-full items-stretch bg-card/95 backdrop-blur-xl border-t border-border/40"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      role="tablist"
      aria-label="Main navigation"
    >
      {TABS.map((tab) => (
        <TabButton
          key={tab.id}
          tab={tab}
          isActive={activeTab === tab.id}
          onPress={onTabPress}
          onLongPress={onLongPressActiveTab}
          badge={badges?.[tab.id]}
        />
      ))}
    </nav>
  )
}

/* ─── Individual Tab Button ────────────────────────────────────────── */

interface TabButtonProps {
  tab: TabConfig
  isActive: boolean
  onPress: (tab: MobileTabId) => void
  onLongPress: (tab: MobileTabId) => void
  badge?: number
}

function TabButton({ tab, isActive, onPress, onLongPress, badge }: TabButtonProps) {
  const { id, label, Icon } = tab
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const didLongPressRef = useRef(false)
  // Fix: use ref so the timer callback always reads the latest isActive value
  const isActiveRef = useRef(isActive)
  isActiveRef.current = isActive

  const startPress = useCallback(() => {
    didLongPressRef.current = false
    timerRef.current = setTimeout(() => {
      didLongPressRef.current = true
      if (isActiveRef.current) onLongPress(id)
    }, LONG_PRESS_MS)
  }, [id, onLongPress])

  const endPress = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (!didLongPressRef.current) {
      onPress(id)
    }
  }, [id, onPress])

  const cancelPress = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    didLongPressRef.current = false
  }, [])

  // Badge display: ≥10 → "9+", ≥1 → number string, 0/undefined → hidden
  const badgeDisplay = badge != null && badge >= 1
    ? badge >= 10 ? '9+' : String(badge)
    : null

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      aria-label={badge ? `${label}, ${badge} notification${badge > 1 ? 's' : ''}` : label}
      data-testid={`mobile-tab-${id}`}
      onPointerDown={startPress}
      onPointerUp={endPress}
      onPointerLeave={cancelPress}
      onPointerCancel={cancelPress}
      className={cn(
        'relative flex flex-1 flex-col items-center justify-end gap-0.5',
        'min-h-[3.5rem] py-2 select-none',
        'transition-colors duration-150',
        isActive ? 'text-primary' : 'text-muted-foreground',
      )}
    >
      {/* Active hairline indicator above the tab */}
      <span
        aria-hidden
        className={cn(
          'absolute top-0 left-1/2 -translate-x-1/2',
          'h-[2px] rounded-b-full bg-primary',
          'transition-all duration-200',
          isActive ? 'w-7 opacity-100' : 'w-0 opacity-0',
        )}
      />

      {/* Icon wrapped in active-state pill + badge */}
      <span className="relative flex items-center justify-center">
        <span
          className={cn(
            'flex items-center justify-center rounded-xl transition-all duration-200',
            'w-10 h-7',
            isActive ? 'bg-primary/10' : 'bg-transparent',
          )}
        >
          <Icon className="h-[1.125rem] w-[1.125rem]" />
        </span>

        {/* Badge dot or count */}
        {badgeDisplay && (
          <span
            aria-hidden
            data-testid={`mobile-tab-badge-${id}`}
            className={cn(
              'absolute -top-1 -right-1',
              'flex items-center justify-center',
              'min-w-[1rem] h-4 rounded-full',
              'bg-primary text-primary-foreground',
              'text-[9px] font-bold leading-none px-0.5',
            )}
          >
            {badgeDisplay}
          </span>
        )}
      </span>

      {/* Label */}
      <span
        className={cn(
          'text-[10px] leading-none tracking-wide',
          isActive ? 'font-semibold' : 'font-medium',
        )}
      >
        {label}
      </span>
    </button>
  )
}

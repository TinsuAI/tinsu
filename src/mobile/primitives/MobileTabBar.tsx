import { useRef, useCallback } from 'react'
import {
  LayoutDashboard,
  Compass,
  CheckSquare,
  Activity,
  Settings,
} from 'lucide-react'
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
}

/**
 * Bottom tab navigation bar — Terminal-Luxe dark aesthetic.
 *
 * Five tabs: Board / Planning / Tasks / Activity / Settings.
 * Active tab receives primary accent colour + frosted pill behind icon.
 * A hairline indicator arc sits above the active tab.
 * Long-pressing the already-active tab fires `onLongPressActiveTab` (iOS scroll-to-top pattern).
 *
 * Safe-area padding is applied via env(safe-area-inset-bottom) inline style so it works
 * on both real devices and desktop webviews that don't expose the CSS env() variable.
 *
 * Touch targets are min 48dp (min-h-12 = 3rem = 48px at default rem).
 *
 * Placeholder primitive — T3.5-2 will harden animation tokens & full UX-DR7 compliance.
 */
export function MobileTabBar({ activeTab, onTabPress, onLongPressActiveTab }: MobileTabBarProps) {
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
        />
      ))}
    </nav>
  )
}

/* ─── Individual Tab Button ───────────────────────────────────────── */

interface TabButtonProps {
  tab: TabConfig
  isActive: boolean
  onPress: (tab: MobileTabId) => void
  onLongPress: (tab: MobileTabId) => void
}

function TabButton({ tab, isActive, onPress, onLongPress }: TabButtonProps) {
  const { id, label, Icon } = tab
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const didLongPressRef = useRef(false)

  const startPress = useCallback(() => {
    didLongPressRef.current = false
    timerRef.current = setTimeout(() => {
      didLongPressRef.current = true
      if (isActive) onLongPress(id)
    }, LONG_PRESS_MS)
  }, [id, isActive, onLongPress])

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

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      aria-label={label}
      data-testid={`mobile-tab-${id}`}
      onPointerDown={startPress}
      onPointerUp={endPress}
      onPointerLeave={cancelPress}
      onPointerCancel={cancelPress}
      className={[
        // Layout — fills its flex column, stacks icon + label
        'relative flex flex-1 flex-col items-center justify-end gap-0.5 min-h-[3.5rem] py-2 select-none',
        'transition-colors duration-150',
        isActive ? 'text-primary' : 'text-muted-foreground',
      ].join(' ')}
    >
      {/* Active hairline indicator above the tab */}
      <span
        aria-hidden
        className={[
          'absolute top-0 left-1/2 -translate-x-1/2',
          'h-[2px] rounded-b-full bg-primary',
          'transition-all duration-200',
          isActive ? 'w-7 opacity-100' : 'w-0 opacity-0',
        ].join(' ')}
      />

      {/* Icon wrapped in optional active-state pill */}
      <span
        className={[
          'flex items-center justify-center rounded-xl transition-all duration-200',
          'w-10 h-7',
          isActive ? 'bg-primary/10' : 'bg-transparent',
        ].join(' ')}
      >
        <Icon className="h-[1.125rem] w-[1.125rem]" />
      </span>

      {/* Label */}
      <span
        className={[
          'text-[10px] leading-none tracking-wide',
          isActive ? 'font-semibold' : 'font-medium',
        ].join(' ')}
      >
        {label}
      </span>
    </button>
  )
}

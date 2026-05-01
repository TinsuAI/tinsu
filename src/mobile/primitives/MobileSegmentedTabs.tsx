/**
 * MobileSegmentedTabs — segmented control / pill-shaped tab switcher.
 *
 * Purely controlled component. Owns no swipeable content pager —
 * that is T3.5-4's responsibility (task workspace owns content swiping).
 *
 * Token contract: bg-muted/30 container, bg-card active pill with shadow,
 * text-foreground active label, text-muted-foreground inactive labels.
 *
 * Touch targets: each tab is min-h-[2.75rem] flex-1 (≥44 px height UX-DR7).
 * Active tab indicator: CSS transform sliding pill with 200 ms ease
 * (instant under prefers-reduced-motion).
 *
 * ARIA: role="tablist" on container, role="tab" + aria-selected on each button.
 * Optional badge number displayed after label.
 *
 * @param tabs        Array of tab descriptors: {id, label, badge?}.
 * @param activeTabId Currently selected tab id (controlled).
 * @param onTabChange Fires with the new tab id when a tab is clicked.
 * @param ariaLabel   Accessible label for the tablist container.
 *
 * @example
 * <MobileSegmentedTabs
 *   tabs={[{ id: 'all', label: 'All' }, { id: 'open', label: 'Open', badge: 3 }]}
 *   activeTabId={activeTab}
 *   onTabChange={setActiveTab}
 * />
 */

import { cn } from '@renderer/lib/utils'
import { useReducedMotion } from '../hooks/useReducedMotion'

interface TabDescriptor {
  id: string
  label: string
  badge?: number
}

interface MobileSegmentedTabsProps {
  tabs: TabDescriptor[]
  activeTabId: string
  onTabChange: (id: string) => void
  ariaLabel?: string
}

export function MobileSegmentedTabs({
  tabs,
  activeTabId,
  onTabChange,
  ariaLabel,
}: MobileSegmentedTabsProps) {
  const reduced = useReducedMotion()
  const activeIndex = tabs.findIndex((t) => t.id === activeTabId)

  return (
    <div
      role="tablist"
      aria-label={ariaLabel ?? 'Segmented tabs'}
      data-testid="mobile-segmented-tabs"
      className="relative flex rounded-full bg-muted/30 p-1 gap-0"
    >
      {/* Sliding active pill indicator */}
      {activeIndex >= 0 && (
        <div
          aria-hidden
          data-testid="mobile-segmented-tabs-indicator"
          className={cn(
            'absolute top-1 bottom-1 rounded-full bg-card shadow-sm',
            reduced ? '' : 'transition-[left,width] duration-200 ease-in-out',
          )}
          style={{
            left: `calc(${(activeIndex / tabs.length) * 100}% + 4px)`,
            width: `calc(${(1 / tabs.length) * 100}% - 8px)`,
          }}
        />
      )}

      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            data-testid={`mobile-segmented-tab-${tab.id}`}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'relative z-10 flex-1 flex items-center justify-center gap-1.5',
              'min-h-[2.75rem] min-w-[5rem] rounded-full px-4',
              'text-sm font-medium transition-colors duration-150',
              'select-none',
              isActive ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            {tab.label}
            {tab.badge != null && tab.badge > 0 && (
              <span
                data-testid={`mobile-segmented-tab-badge-${tab.id}`}
                className={cn(
                  'flex items-center justify-center',
                  'min-w-[1.125rem] h-[1.125rem] rounded-full',
                  'text-[9px] font-bold px-0.5',
                  isActive
                    ? 'bg-primary/20 text-primary'
                    : 'bg-muted/50 text-muted-foreground',
                )}
              >
                {tab.badge >= 10 ? '9+' : tab.badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

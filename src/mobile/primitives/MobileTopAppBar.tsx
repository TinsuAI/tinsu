/**
 * MobileTopAppBar — top application bar for the mobile UI tree.
 *
 * Shows project name or back button on the left, optional status pill,
 * trailing actions, and optional collapse-on-scroll behaviour.
 *
 * Token contract: bg-card/95 frosted-glass surface, text-foreground for title,
 * border-border/40 hairline separator, text-muted-foreground for back icon.
 * Touch target: back button is min-h-[2.75rem] min-w-[2.75rem] (44 px).
 *
 * Safe-area inset-top is applied via inline style — real device chrome respected.
 * Inner content height: 52 px (collapsed: 44 px when collapsibleOnScroll active).
 *
 * @param projectName       Left-side project name (shown when no backButton).
 * @param title             Alternative left-side title (preferred over projectName when both provided).
 * @param backButton        When provided, renders a chevron-left 44×44 button on the left.
 * @param statusPill        Arbitrary React node displayed on the right (e.g. connection badge).
 * @param trailingActions   Additional right-side action nodes (shown before statusPill).
 * @param collapsibleOnScroll  When true, top bar height reduces from 52→44 px after 16 px scroll.
 *
 * @example
 * <MobileTopAppBar projectName="TinSu" statusPill={<ConnectionBadge />} />
 * <MobileTopAppBar title="Task Detail" backButton={{ onClick: () => nav.back() }} />
 */

import { useState, useEffect, useRef } from 'react'
import { ChevronLeft } from 'lucide-react'
import { cn } from '@renderer/lib/utils'

interface BackButtonProps {
  onClick: () => void
  ariaLabel?: string
}

interface MobileTopAppBarProps {
  /** Project name shown when no back button / title is provided */
  projectName?: string
  /** Page title — takes precedence over projectName in left slot */
  title?: string
  /**
   * When provided, renders a 44×44 chevron-left button on the left side
   * instead of the project name / title text.
   */
  backButton?: BackButtonProps
  /** Connection status pill or similar badge (right side) */
  statusPill?: React.ReactNode
  /** Additional trailing action nodes rendered to the right */
  trailingActions?: React.ReactNode
  /**
   * When true, collapses bar height from 52 → 44 px once the page
   * scrolls past 16 px. Uses a MutationObserver/scroll listener on the
   * nearest scrollable sibling (main element). Default: false.
   */
  collapsibleOnScroll?: boolean
}

export function MobileTopAppBar({
  projectName,
  title,
  backButton,
  statusPill,
  trailingActions,
  collapsibleOnScroll = false,
}: MobileTopAppBarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const headerRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!collapsibleOnScroll) return

    // Observe the next sibling <main> scroll position
    const header = headerRef.current
    if (!header) return
    const main = header.nextElementSibling as HTMLElement | null
    if (!main) return

    const handleScroll = () => {
      setCollapsed(main.scrollTop > 16)
    }

    main.addEventListener('scroll', handleScroll, { passive: true })
    return () => main.removeEventListener('scroll', handleScroll)
  }, [collapsibleOnScroll])

  const leftLabel = title ?? projectName

  return (
    <header
      ref={headerRef}
      className={cn(
        'w-full bg-card/95 backdrop-blur-xl border-b border-border/40 shrink-0',
        'transition-all duration-200',
      )}
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div
        className={cn(
          'flex items-center justify-between px-4 transition-all duration-200',
          collapsed ? 'h-[44px]' : 'h-[52px]',
        )}
      >
        {/* Left slot: back button OR title/project name */}
        {backButton ? (
          <button
            type="button"
            onClick={backButton.onClick}
            aria-label={backButton.ariaLabel ?? 'Go back'}
            data-testid="mobile-top-bar-back-button"
            className={cn(
              'flex items-center justify-center rounded-lg',
              'min-h-[2.75rem] min-w-[2.75rem] -ml-2',
              'text-foreground',
              'transition-opacity duration-150 active:opacity-60',
            )}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        ) : (
          <span
            className="text-sm font-semibold text-foreground truncate max-w-[70%] leading-none"
            data-testid="mobile-top-bar-project-name"
          >
            {leftLabel}
          </span>
        )}

        {/* Right slot */}
        <div className="flex items-center gap-1 shrink-0">
          {trailingActions && (
            <div className="flex items-center gap-1" data-testid="mobile-top-bar-trailing-actions">
              {trailingActions}
            </div>
          )}
          {statusPill && (
            <div className="flex items-center shrink-0" data-testid="mobile-top-bar-status-pill">
              {statusPill}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

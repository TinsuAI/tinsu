/**
 * MobileTaskWorkspaceScreen — Full-screen mobile task workspace.
 *
 * Shows a 4-sub-tab swipeable pager (Content / Terminal / Activities / Diff)
 * for a single task. The pager uses CSS scroll-snap + scrollTo, mirroring the
 * exact pattern from src/components/task/TaskDetailContent.tsx.
 *
 * Architecture (AC 13): workspace is a full-screen push — no MobileTabBar.
 * MobileApp.tsx renders this component directly when isFullScreenRoute() returns
 * true, bypassing the root MobileScreen shell.
 *
 * Cross-tree imports (AC 16): only the allowed set.
 *   - @renderer/lib/trpc            (task fetch)
 *   - @renderer/lib/utils           (cn)
 *
 * Sub-tab state is local React state (AC 11).
 * No new Zustand stores introduced (guardrail 17).
 *
 * @see Story T3.5-4
 * @see T3.5-6 — Future owner of full review wiring (Approve / Request Changes mutations).
 */

import { useState, useRef, useCallback } from 'react'
import { MoreVertical } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { trpc } from '@renderer/lib/trpc'
import { useMobileNavStore } from '../shell/mobile-nav.store'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { MobileTopAppBar } from '../primitives/MobileTopAppBar'
import { MobileSegmentedTabs } from '../primitives/MobileSegmentedTabs'
import { MobileSheet } from '../primitives/MobileSheet'
import { MobileBottomActionBar } from '../primitives/MobileBottomActionBar'
import { MobileEmptyState } from '../primitives/MobileEmptyState'
import { MobileLoadingSkeleton } from '../primitives/MobileLoadingSkeleton'
import { MobileContentTab } from './MobileContentTab'
import { MobileTerminalTab, type MobileTerminalTabRef } from './MobileTerminalTab'
import { MobileActivitiesTab } from './MobileActivitiesTab'
import { MobileDiffTab } from './MobileDiffTab'

/* ─── Types ─────────────────────────────────────────────────────────── */

type SubTabId = 'content' | 'terminal' | 'activities' | 'diff'

const SUB_TABS: { id: SubTabId; label: string }[] = [
  { id: 'content',    label: 'Content' },
  { id: 'terminal',   label: 'Terminal' },
  { id: 'activities', label: 'Activities' },
  { id: 'diff',       label: 'Diff' },
]

const SUB_TAB_IDS: SubTabId[] = SUB_TABS.map((t) => t.id)

/* ─── Overflow menu rows ────────────────────────────────────────────── */

const MENU_ROWS = [
  'View reasoning log',
  'Pause / Resume',
  'Run history',
  'Edit',
  'Archive',
  'Delete',
] as const

/* ─── Helpers ───────────────────────────────────────────────────────── */

/** Truncate title to 32 chars with ellipsis, fallback to Task #<short-id> */
function buildTitle(title: string | undefined | null, id: string | undefined | null): string {
  const raw = title?.trim() || `Task #${(id ?? '?').slice(0, 6)}`
  return raw.length > 32 ? raw.slice(0, 32) + '…' : raw
}

/* ─── Component ─────────────────────────────────────────────────────── */

interface MobileTaskWorkspaceScreenProps {
  taskId: string
}

/**
 * MobileTaskWorkspaceScreen
 *
 * @see Story T3.5-4
 * @see T3.5-6 for full review wiring (Approve / Request Changes mutations)
 */
export function MobileTaskWorkspaceScreen({ taskId }: MobileTaskWorkspaceScreenProps) {
  /* ── Data ─────────────────────────────────────────────────────────── */
  const { data: task, isLoading, error } = trpc.tasks.getById.useQuery({ id: taskId })

  /* ── Navigation ───────────────────────────────────────────────────── */
  const activeTab = useMobileNavStore((s) => s.activeTab)

  /* ── Reduced motion ───────────────────────────────────────────────── */
  const reduced = useReducedMotion()

  /* ── Overflow menu ────────────────────────────────────────────────── */
  const [menuOpen, setMenuOpen] = useState(false)

  /* ── Sub-tab state ────────────────────────────────────────────────── */
  const [activeSubTab, setActiveSubTab] = useState<SubTabId>('content')

  /* ── Pager refs (mirrors TaskDetailContent.tsx) ───────────────────── */
  const pagerRef = useRef<HTMLDivElement>(null)
  const isManualScrollingRef = useRef(false)
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* ── Terminal ref (forwarded from MobileTerminalTab) ─────────────── */
  const terminalRef = useRef<MobileTerminalTabRef>(null)

  /* ── Tab click handler (mirrors TaskDetailContent.tsx: AC 4) ─────── */
  const handleTabClick = useCallback(
    (id: SubTabId) => {
      setActiveSubTab(id)
      const container = pagerRef.current
      if (!container) return

      const index = SUB_TAB_IDS.indexOf(id)
      if (index === -1) return

      isManualScrollingRef.current = true
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current)

      container.scrollTo({
        left: index * container.clientWidth,
        behavior: reduced ? 'auto' : 'smooth',
      })

      scrollTimeoutRef.current = setTimeout(() => {
        isManualScrollingRef.current = false
      }, 800)
    },
    [reduced],
  )

  /* ── Scroll sync handler (mirrors TaskDetailContent.tsx: AC 4) ───── */
  const handleScroll = useCallback(() => {
    const container = pagerRef.current
    if (!container || isManualScrollingRef.current) return

    const { scrollLeft, clientWidth } = container
    if (clientWidth < 50) return

    const index = Math.round(scrollLeft / clientWidth)
    const next = SUB_TAB_IDS[index]
    if (next && next !== activeSubTab) {
      setActiveSubTab(next)
    }
  }, [activeSubTab])

  /* ── Action bar (per-sub-tab, AC 11) ─────────────────────────────── */
  const renderActionBar = () => {
    switch (activeSubTab) {
      case 'content':
        return (
          <MobileBottomActionBar
            primary={{
              label: 'Edit',
              ariaLabel: 'Edit (Coming soon)',
              onPress: () => {},
              disabled: true,
              variant: 'primary',
            }}
          />
        )

      case 'terminal':
        return (
          <MobileBottomActionBar
            primary={{
              label: 'Focus terminal',
              onPress: () => terminalRef.current?.focusInput?.(),
              variant: 'primary',
            }}
          />
        )

      case 'activities':
        // No action bar for activities (AC 11)
        return null

      case 'diff':
        /**
         * Both Approve and Request Changes push to the review screen.
         * MobileReviewActionBar on MobileDiffViewerScreen owns the actual
         * mutation wiring (Approve → approve confirm sheet, Request Changes →
         * feedback sheet, Reject → rejection sheet). AC 2, T3.5-6.
         */
        return (
          <MobileBottomActionBar
            primary={{
              label: 'Approve',
              onPress: () => {
                useMobileNavStore.getState().pushRoute(activeTab, `review:${task?.id ?? taskId}`)
              },
              disabled: task?.status !== 'review',
              variant: 'primary',
            }}
            secondary={{
              label: 'Request changes',
              ariaLabel: 'Request changes',
              onPress: () => {
                useMobileNavStore.getState().pushRoute(activeTab, `review:${task?.id ?? taskId}`)
              },
              disabled: task?.status !== 'review',
            }}
          />
        )
    }
  }

  /* ── Loading / error states ───────────────────────────────────────── */
  if (isLoading) {
    return (
      <div
        className="flex flex-col h-[100dvh] bg-background"
        data-testid="mobile-task-workspace"
      >
        <MobileTopAppBar
          backButton={{ onClick: () => useMobileNavStore.getState().popRoute() }}
        />
        <div className="flex-1 p-4 flex flex-col gap-4">
          <MobileLoadingSkeleton variant="card" />
          <MobileLoadingSkeleton variant="card" />
        </div>
      </div>
    )
  }

  if (error || !task) {
    return (
      <div
        className="flex flex-col h-[100dvh] bg-background"
        data-testid="mobile-task-workspace"
      >
        <MobileTopAppBar
          backButton={{ onClick: () => useMobileNavStore.getState().popRoute() }}
        />
        <div className="flex-1 flex items-center justify-center">
          <MobileEmptyState
            title="Task not found"
            subtitle="This task could not be loaded. Please try again."
          />
        </div>
      </div>
    )
  }

  const displayTitle = buildTitle(task.title, task.id)

  return (
    <div
      className="flex flex-col h-[100dvh] bg-background"
      data-testid="mobile-task-workspace"
    >
      {/* ── Top app bar (AC 2) ──────────────────────────────────────── */}
      {/*
        MobileTopAppBar shows backButton OR title in left slot — not both.
        To show both, we use a custom layout: back button (left) + centered
        title + overflow menu (right), wrapped as trailingActions.
        The title is a sibling flex element inside the bar's content row.
      */}
      <div
        className={cn(
          'w-full bg-card/95 backdrop-blur-xl border-b border-border/40 shrink-0',
        )}
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
        data-testid="mobile-workspace-top-bar"
      >
        <div className="flex items-center h-[52px] px-2">
          {/* Back button */}
          <button
            type="button"
            aria-label="Go back"
            data-testid="mobile-top-bar-back-button"
            onClick={() => useMobileNavStore.getState().popRoute()}
            className={cn(
              'flex items-center justify-center rounded-lg shrink-0',
              'min-h-[2.75rem] min-w-[2.75rem]',
              'text-foreground',
              'transition-opacity duration-150 active:opacity-60',
            )}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Centered title */}
          <span
            data-testid="mobile-workspace-title"
            className="flex-1 text-sm font-semibold text-foreground truncate text-center px-2 leading-none"
          >
            {displayTitle}
          </span>

          {/* Trailing actions: overflow menu */}
          <button
            type="button"
            aria-label="Task menu"
            data-testid="mobile-task-workspace-menu"
            onClick={() => setMenuOpen(true)}
            className={cn(
              'flex items-center justify-center rounded-lg shrink-0',
              'min-h-[2.75rem] min-w-[2.75rem]',
              'text-foreground',
              'transition-opacity duration-150 active:opacity-60',
            )}
          >
            <MoreVertical className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* ── Overflow menu sheet (AC 2) ──────────────────────────────── */}
      <MobileSheet
        open={menuOpen}
        onOpenChange={setMenuOpen}
        snapPoint="fit"
        title="Task menu"
        description="Task actions"
      >
        <div className="flex flex-col">
          {MENU_ROWS.map((label) => (
            <button
              key={label}
              type="button"
              disabled
              aria-disabled="true"
              className="flex w-full items-center justify-between px-4 py-3 text-left text-foreground/60"
            >
              <span>{label}</span>
              <span className="text-xs text-muted-foreground">Coming soon</span>
            </button>
          ))}
        </div>
      </MobileSheet>

      {/* ── Segmented tabs (AC 3) ──────────────────────────────────── */}
      <div className="px-4 py-2 shrink-0 border-b border-border/40">
        <MobileSegmentedTabs
          tabs={SUB_TABS}
          activeTabId={activeSubTab}
          onTabChange={(id) => handleTabClick(id as SubTabId)}
          ariaLabel="Task workspace sub-tabs"
        />
      </div>

      {/* ── Horizontal pager (AC 4, 5) ─────────────────────────────── */}
      {/*
        All four slides are always mounted (AC 5). The scroll-snap pager
        preserves DOM scroll position and terminal state across tab switches.
        DO NOT add key={activeSubTab} or conditional rendering here.
      */}
      <div
        ref={pagerRef}
        onScroll={handleScroll}
        className="flex flex-1 overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden min-h-0"
      >
        {/* Content slide */}
        <section className="snap-start shrink-0 w-full h-full overflow-y-auto">
          <MobileContentTab task={task} />
        </section>

        {/* Terminal slide */}
        <section className="snap-start shrink-0 w-full h-full overflow-hidden">
          <MobileTerminalTab ref={terminalRef} taskId={taskId} />
        </section>

        {/* Activities slide */}
        <section className="snap-start shrink-0 w-full h-full overflow-hidden">
          <MobileActivitiesTab taskId={taskId} />
        </section>

        {/* Diff slide */}
        <section className="snap-start shrink-0 w-full h-full overflow-y-auto">
          <MobileDiffTab task={task} />
        </section>
      </div>

      {/* ── Per-sub-tab action bar (AC 11) — sibling of pager ─────── */}
      {renderActionBar()}
    </div>
  )
}

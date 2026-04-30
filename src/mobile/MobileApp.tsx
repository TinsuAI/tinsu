import { useEffect, useRef, lazy, Suspense } from 'react'
import { useMobileNavStore } from './shell/mobile-nav.store'
import { MobileScreen } from './primitives/MobileScreen'
import { MobileTopAppBar } from './primitives/MobileTopAppBar'
import { MobileTabBar } from './primitives/MobileTabBar'
import { MobileEmptyState } from './primitives/MobileEmptyState'
import { MobileBoardScreen } from './board/MobileBoardScreen'
import { MobilePlanningHome } from './planning/MobilePlanningHome'
import { MobileTaskListScreen } from './tasks/MobileTaskListScreen'
import { MobileActivityFeedScreen } from './activity/MobileActivityFeedScreen'
import { MobileSettingsHome } from './settings/MobileSettingsHome'
import { MobileTaskWorkspaceScreen } from './tasks/MobileTaskWorkspaceScreen'
import { MobileChatScreen } from './planning/MobileChatScreen'
import { MobileDiffViewerScreen } from './review/MobileDiffViewerScreen'
import { useProjectStore } from '@renderer/stores/project.store'
import type { MobileTabId } from './shell/mobile-nav.store'

/**
 * Returns true for routes that should render as full-screen pushes
 * (no tab bar, no root MobileScreen shell).
 *
 * Story T3.5-4: workspace routes are full-screen (AC 13).
 * Story T3.5-5: chat routes will also be full-screen.
 * Story T3.5-6: review routes are full-screen (AC 1).
 */
export function isFullScreenRoute(route: string): boolean {
  return route.startsWith('workspace:') || route.startsWith('chat:') || route.startsWith('review:')
}

// DEV-ONLY: Primitives harness — never ships to production.
// Access at: http://localhost:1420#__mobile-primitives
// Guard: import.meta.env.DEV ensures Vite tree-shakes this entire block in production builds.
// The hash check means tests (hash='') never trigger the harness render path.
const MobilePrimitivesHarness = import.meta.env.DEV
  ? lazy(() =>
      import('./dev/MobilePrimitivesHarness').then((m) => ({
        default: m.MobilePrimitivesHarness,
      })),
    )
  : null

/**
 * Root component for the mobile UI tree.
 *
 * Rendered by `App.tsx` when the viewport is detected as mobile (< 1024 px
 * or Tauri Android/iOS target).  The desktop tree is NOT mounted when this
 * component is active — see the early-return viewport router in App.tsx.
 *
 * This component owns:
 *   - Mobile-nav store reads (activeTab + tabStacks)
 *   - Top app bar + tab bar composition
 *   - Route rendering via MobileRouteRenderer
 *   - Deep-link subscription via @tauri-apps/plugin-deep-link
 *
 * Story T3.5-1 — Mobile Shell Foundation.
 */
export function MobileApp() {
  // DEV-only: render primitives harness when hash matches
  // This entire block is tree-shaken in production since import.meta.env.DEV is false.
  if (import.meta.env.DEV && typeof window !== 'undefined' && window.location.hash === '#__mobile-primitives') {
    if (MobilePrimitivesHarness) {
      return (
        <Suspense fallback={<div className="h-screen bg-background" />}>
          <MobilePrimitivesHarness />
        </Suspense>
      )
    }
  }

  const { activeTab, tabStacks, switchTab, clearStack, navigateToDeepLink } = useMobileNavStore()
  const projectName = useProjectStore((state) => state.projectName)

  // Resolve top-of-stack route for active tab
  const stack = tabStacks[activeTab]
  const topRoute = stack[stack.length - 1] ?? activeTab

  // Deep-link subscription (AC: 8)
  // Dynamically imported to avoid crash when plugin is not registered (desktop / web).
  const deepLinkCleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    let cancelled = false

    const setupDeepLink = async (): Promise<void> => {
      try {
        const { onOpenUrl, getCurrent } = await import('@tauri-apps/plugin-deep-link')

        if (cancelled) return

        // Handle cold-start deep link (app launched via URL)
        const coldStartUrls = await getCurrent()
        if (!cancelled && coldStartUrls) {
          const uris = Array.isArray(coldStartUrls) ? coldStartUrls : [coldStartUrls]
          uris.forEach((u) => navigateToDeepLink(u))
        }

        if (cancelled) return

        // Subscribe to subsequent deep links while app is running
        const unlisten = await onOpenUrl((urls) => {
          urls.forEach((u) => navigateToDeepLink(u))
        })

        if (cancelled) {
          unlisten()
          return
        }

        deepLinkCleanupRef.current = unlisten
      } catch {
        // Plugin not available (desktop without plugin, or web env) — safe no-op
      }
    }

    void setupDeepLink()

    return () => {
      cancelled = true
      deepLinkCleanupRef.current?.()
      deepLinkCleanupRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])   // run once on mount

  const handleTabPress = (tab: MobileTabId): void => {
    switchTab(tab)
  }

  const handleLongPressActiveTab = (tab: MobileTabId): void => {
    // iOS-native scroll-to-top pattern: reset the tab's stack to root
    clearStack(tab)
  }

  // Full-screen routes (workspace, chat) bypass the root MobileScreen shell
  // so they own their full chrome (no bottom tab bar). AC 13, T3.5-4.
  if (isFullScreenRoute(topRoute)) {
    return <MobileRouteRenderer route={topRoute} />
  }

  return (
    <MobileScreen
      topBar={
        <MobileTopAppBar
          projectName={projectName ?? 'TinSu'}
        />
      }
      tabBar={
        <MobileTabBar
          activeTab={activeTab}
          onTabPress={handleTabPress}
          onLongPressActiveTab={handleLongPressActiveTab}
        />
      }
    >
      <MobileRouteRenderer route={topRoute} />
    </MobileScreen>
  )
}

/* ─── Route renderer ────────────────���─────────────────────────────── */

/**
 * Maps the top-of-stack route string to the appropriate screen component.
 *
 * Tab roots render their placeholder screens.  All other routes (future
 * feature routes: 'workspace:*', 'chat:*', 'diff', etc.) render an
 * AC-10 placeholder naming the responsible follow-up story.
 */
function MobileRouteRenderer({ route }: { route: string }) {
  // Tab root routes
  switch (route) {
    case 'board':    return <MobileBoardScreen />
    case 'sessions': return <MobilePlanningHome />
    case 'list':     return <MobileTaskListScreen />
    case 'feed':     return <MobileActivityFeedScreen />
    case 'home':     return <MobileSettingsHome />
  }

  // Feature routes — workspace renders real workspace screen (T3.5-4)
  if (route.startsWith('workspace:')) {
    const taskId = route.slice('workspace:'.length)
    return <MobileTaskWorkspaceScreen taskId={taskId} />
  }
  if (route.startsWith('chat:')) {
    const sessionId = route.slice('chat:'.length)
    return <MobileChatScreen sessionId={sessionId} />
  }
  // T3.5-6: review route — full-screen diff viewer + action bar (AC 1)
  if (route.startsWith('review:')) {
    const reviewTaskId = route.slice('review:'.length)
    return <MobileDiffViewerScreen taskId={reviewTaskId} />
  }
  if (route === 'connections') {
    return (
      <MobileEmptyState
        title="Connections"
        subtitle="Coming in T3.5-7 — SSH connection management."
      />
    )
  }

  // Fallback for any unrecognised route
  return (
    <MobileEmptyState
      title="Coming Soon"
      subtitle={`Route "${route}" is not yet implemented.`}
    />
  )
}

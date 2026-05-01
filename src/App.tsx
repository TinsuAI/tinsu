import { useEffect, useRef, useCallback, useState } from 'react'
import { AppShell } from './components/layout/AppShell'
import { Welcome } from './components/Welcome'
import { KanbanBoardContainer } from './components/board'
import { StoryFullView } from './components/story'
import { TaskWorkspacePage } from './pages/TaskWorkspacePage'
import { PlanningWorkspacePage } from './pages/PlanningWorkspacePage'
import { CrashRecoveryDialog } from './components/dialogs/CrashRecoveryDialog'
import { Toaster } from './components/ui/sonner'
import { useProjectStore } from './stores/project.store'
import { useStoryViewStore, useTaskWorkspaceStore, usePlanningWorkspaceStore } from './stores'
import { trpc } from './lib/trpc'
import { useFileWatcher } from './hooks/useFileWatcher'
import { ProjectSetupDialog } from './components/ProjectSetupDialog'
import { useOpenProjectByPath } from './hooks/useProjectCommands'
import { useNetworkResilience } from './hooks/useNetworkResilience'
import { useViewportClass } from './hooks/useViewportClass'
import { MobileApp } from './mobile/MobileApp'
import { useOpenRemoteProjectSync } from './hooks/useRemoteSyncLifecycle'

/**
 * Root component — viewport router (T3.5-1).
 *
 * Renders `<MobileApp />` when the viewport is mobile (< 1024 px or
 * Android/iOS Tauri target), `<DesktopApp />` otherwise.
 *
 * The split into two components is required by React's Rules of Hooks:
 * DesktopApp has many hooks; we must not skip them with an early return
 * in the same function body.  By delegating to a separate component,
 * the mobile path never mounts DesktopApp at all — no hook calls leak.
 *
 * AC: 1 (mobile renders MobileApp), 7 (no useIsMobile in desktop tree),
 *     11 (deleting src/mobile/ and reverting App.tsx leaves no dangling refs).
 */
function App(): React.JSX.Element {
  const viewport = useViewportClass()

  if (viewport === 'mobile') {
    return <MobileApp />
  }

  return <DesktopApp />
}

/* ─── Desktop tree ──────────────────────────────────────────────────── */

/**
 * Full desktop application tree.
 * Only mounted when viewport is NOT mobile — mirrors the pre-T3.5-1 App component.
 */
function DesktopApp(): React.JSX.Element {
  // Global network resilience monitor
  useNetworkResilience()

  const { projectPath, projectName, setProject, clearProject } = useProjectStore()
  const activeStoryId = useStoryViewStore((state) => state.activeStoryId)
  // TES-3.1: Full-screen task workspace navigation
  const activeTaskId = useTaskWorkspaceStore((state) => state.activeTaskId)
  // Story 9.1: Planning workspace navigation
  const isPlanningOpen = usePlanningWorkspaceStore((state) => state.isOpen)

  // Story 3.9: Start file watching when project is opened
  useFileWatcher(projectPath)
  const hasAttemptedReopen = useRef(false)
  // Track whether we're attempting to reopen a persisted project
  const [isReopening, setIsReopening] = useState(() => {
    // If there's a persisted path but no projectName yet, we need to reopen
    return !!projectPath && !projectName
  })

  // Onboarding wizard state
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [onboardingProjectPath, setOnboardingProjectPath] = useState<string | null>(null)

  // Story 8.10 AC4: Crash recovery state
  const [showCrashRecovery, setShowCrashRecovery] = useState(false)
  const [crashRecoveryData, setCrashRecoveryData] = useState<{
    crashedOperations: any[]
    summary: string | null
  } | null>(null)

  // Story 8.10 AC4: Crash recovery check query
  const crashRecoveryQuery = trpc.git.checkCrashRecovery.useQuery(undefined, {
    enabled: false // Only run manually after project opens
  })

  // Try to re-open last project on mount
  const reopenMutation = useOpenProjectByPath()
  const openRemoteSync = useOpenRemoteProjectSync()

  useEffect(() => {
    // On mount, if we have a stored project path, try to re-open it.
    // Use mutateAsync (promise-based) instead of mutate(callbacks) so that the
    // resolution is not tied to the observer instance — React 18 StrictMode
    // destroys and recreates observers between the two effect invocations,
    // silently dropping any inline callbacks passed to mutate().
    if (projectPath && !hasAttemptedReopen.current) {
      hasAttemptedReopen.current = true
      setIsReopening(true)

      // Get persisted remote context (set before the reopen mutation runs).
      const { remoteProjectId: persistedRemoteId, remoteConnectionId: persistedConnId } =
        useProjectStore.getState()

      reopenMutation.mutateAsync(projectPath)
        .then(async (result) => {
          setProject(result.id, result.path, result.name)

          // If this is a remote project, open sync before data loads.
          if (persistedRemoteId && persistedConnId) {
            await openRemoteSync(persistedConnId, persistedRemoteId)
          }

          setIsReopening(false)
          // Story 8.10 AC4: Check for crashed operations after project opens
          return crashRecoveryQuery.refetch()
        })
        .then((response) => {
          if (response.data && response.data.crashedOperations.length > 0) {
            setCrashRecoveryData({
              crashedOperations: response.data.crashedOperations,
              summary: response.data.summary,
            })
            setShowCrashRecovery(true)
          }
        })
        .catch((err) => {
          // If no .tinsu/config.yaml — path exists but not yet set up
          if (err.message.includes('"NotFound"') || err.message.includes('config.yaml')) {
            setOnboardingProjectPath(projectPath)
            setShowOnboarding(true)
          } else {
            // Path gone or unreadable — clear and show welcome
            clearProject()
          }
          setIsReopening(false)
        })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run on mount - intentionally omit dependencies

  const handleProjectOpened = useCallback(
    (info: {
      path: string
      projectId: string
      projectName: string
      needsOnboarding?: boolean
      remoteProjectId?: string | null
      remoteConnectionId?: string | null
    }): void => {
      if (info.needsOnboarding) {
        setOnboardingProjectPath(info.path)
        setShowOnboarding(true)
        return
      }
      setProject(info.projectId, info.path, info.projectName, info.remoteProjectId, info.remoteConnectionId)

      // Phase 4: If this is a remote project opened via Welcome screen (not via
      // useOpenRemoteProject hook), kick off sync open now.
      // useOpenRemoteProject already handles sync internally; this covers the
      // Welcome.tsx handleOpenRecent path that calls openRemoteProject directly.
      if (info.remoteProjectId && info.remoteConnectionId) {
        void openRemoteSync(info.remoteConnectionId, info.remoteProjectId)
      }

      // Story 8.10 AC4: Check for crashed operations after project opens
      crashRecoveryQuery.refetch().then((response) => {
        if (response.data && response.data.crashedOperations.length > 0) {
          setCrashRecoveryData({
            crashedOperations: response.data.crashedOperations,
            summary: response.data.summary,
          })
          setShowCrashRecovery(true)
        }
      })
    },
    [setProject, crashRecoveryQuery, openRemoteSync]
  )

  // Background health check: re-verify critical tools on window focus
  const { refetch: recheckHealth } = trpc.project.checkToolHealth.useQuery(undefined, {
    enabled: false
  })

  useEffect(() => {
    if (!projectPath || !projectName) return

    const handleFocus = (): void => {
      recheckHealth().then((response) => {
        if (response.data) {
          const anyMissing = response.data.some(
            (t) => t.critical && t.status !== 'installed'
          )
          if (anyMissing) {
            setOnboardingProjectPath(projectPath)
            setShowOnboarding(true)
          }
        }
      })
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectPath, projectName])

  const handleOnboardingComplete = useCallback(
    (info: { path: string; projectId: string; projectName: string }): void => {
      setShowOnboarding(false)
      setOnboardingProjectPath(null)
      setProject(info.projectId, info.path, info.projectName)
      crashRecoveryQuery.refetch().then((response) => {
        if (response.data && response.data.crashedOperations.length > 0) {
          setCrashRecoveryData({
            crashedOperations: response.data.crashedOperations,
            summary: response.data.summary,
          })
          setShowCrashRecovery(true)
        }
      })
    },
    [setProject, crashRecoveryQuery]
  )

  // Show loading state while attempting to reopen persisted project
  if (isReopening) {
    return (
      <>
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="text-center">
            <h1 className="text-2xl font-semibold text-foreground">TinSu</h1>
            <p className="mt-2 text-muted-foreground">Opening project...</p>
          </div>
        </div>
        <Toaster />
      </>
    )
  }

  // Show onboarding wizard if triggered
  if (showOnboarding && onboardingProjectPath) {
    return (
      <>
        <div className="flex min-h-screen items-center justify-center bg-background">
          <ProjectSetupDialog
            open={true}
            onOpenChange={(open) => {
              if (!open) {
                setShowOnboarding(false)
                setOnboardingProjectPath(null)
                clearProject()
              }
            }}
            onProjectCreated={handleOnboardingComplete}
            mode="onboard"
            projectPath={onboardingProjectPath}
          />
        </div>
        <Toaster />
      </>
    )
  }

  // Show Welcome screen if no project is loaded
  if (!projectPath || !projectName) {
    return (
      <>
        <Welcome onProjectOpened={handleProjectOpened} />
        <Toaster />
      </>
    )
  }

  // Keep AppShell mounted but hidden when viewing tasks/stories to preserve scroll positions
  // TES-3.1: TaskWorkspacePage renders as full-screen workspace when a task is active
  // StoryFullView renders as full-screen overlay when viewing story content
  const isViewingTask = !!activeTaskId
  const isViewingStory = !!activeStoryId
  const isFullScreen = isViewingTask || isViewingStory || isPlanningOpen

  return (
    <>
      <div
        className={isFullScreen ? 'hidden' : undefined}
        aria-hidden={isFullScreen}
        inert={isFullScreen ? true : undefined}
      >
        <AppShell>
          <KanbanBoardContainer />
        </AppShell>
      </div>
      {isViewingTask && <TaskWorkspacePage />}
      {isViewingStory && !isViewingTask && <StoryFullView />}
      {isPlanningOpen && !isViewingTask && !isViewingStory && <PlanningWorkspacePage />}
      <Toaster />
      {/* Story 8.10 AC4: Crash recovery dialog */}
      {crashRecoveryData && (
        <CrashRecoveryDialog
          open={showCrashRecovery}
          onOpenChange={setShowCrashRecovery}
          crashedOperations={crashRecoveryData.crashedOperations}
          summary={crashRecoveryData.summary}
          onRecoveryComplete={() => {
            setCrashRecoveryData(null)
            setShowCrashRecovery(false)
          }}
        />
      )}
    </>
  )
}

export default App

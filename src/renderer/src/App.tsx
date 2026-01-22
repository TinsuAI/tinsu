import { useEffect, useRef, useCallback, useState } from 'react'
import { AppShell } from './components/layout/AppShell'
import { Welcome } from './components/Welcome'
import { KanbanBoardContainer } from './components/board'
import { StoryFullView } from './components/story'
import { TaskWorkspacePage } from './pages/TaskWorkspacePage'
import { CrashRecoveryDialog } from './components/dialogs/CrashRecoveryDialog'
import { Toaster } from './components/ui/sonner'
import { useProjectStore } from './stores/project.store'
import { useStoryViewStore, useTaskWorkspaceStore } from './stores'
import { trpc } from './lib/trpc'
import { useFileWatcher } from './hooks/useFileWatcher'

function App(): React.JSX.Element {
  const { projectPath, projectName, setProject, clearProject } = useProjectStore()
  const activeStoryId = useStoryViewStore((state) => state.activeStoryId)
  // TES-3.1: Full-screen task workspace navigation
  const activeTaskId = useTaskWorkspaceStore((state) => state.activeTaskId)

  // Story 3.9: Start file watching when project is opened
  useFileWatcher(projectPath)
  const hasAttemptedReopen = useRef(false)
  // Track whether we're attempting to reopen a persisted project
  const [isReopening, setIsReopening] = useState(() => {
    // If there's a persisted path but no projectName yet, we need to reopen
    return !!projectPath && !projectName
  })

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
  const openPathMutation = trpc.project.openPath.useMutation({
    onSuccess: (result) => {
      setProject(result.path, result.config.projectName)
      setIsReopening(false)
      // Story 8.10 AC4: Check for crashed operations after project opens
      crashRecoveryQuery.refetch().then((response) => {
        if (response.data && response.data.crashedOperations.length > 0) {
          setCrashRecoveryData({
            crashedOperations: response.data.crashedOperations,
            summary: response.data.summary
          })
          setShowCrashRecovery(true)
        }
      })
    },
    onError: () => {
      // Failed to open last project, clear stored path
      clearProject()
      setIsReopening(false)
    }
  })

  useEffect(() => {
    // On mount, if we have a stored project path, try to re-open it
    if (projectPath && !hasAttemptedReopen.current) {
      hasAttemptedReopen.current = true
      setIsReopening(true)
      openPathMutation.mutate({ path: projectPath })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run on mount - intentionally omit dependencies

  const handleProjectOpened = useCallback(
    (info: { path: string; projectName: string }): void => {
      setProject(info.path, info.projectName)
      // Story 8.10 AC4: Check for crashed operations after project opens
      crashRecoveryQuery.refetch().then((response) => {
        if (response.data && response.data.crashedOperations.length > 0) {
          setCrashRecoveryData({
            crashedOperations: response.data.crashedOperations,
            summary: response.data.summary
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

  return (
    <>
      <div
        className={isViewingTask || isViewingStory ? 'hidden' : undefined}
        aria-hidden={isViewingTask || isViewingStory}
        inert={isViewingTask || isViewingStory ? ('' as any) : undefined}
      >
        <AppShell>
          <KanbanBoardContainer />
        </AppShell>
      </div>
      {isViewingTask && <TaskWorkspacePage />}
      {isViewingStory && !isViewingTask && <StoryFullView />}
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

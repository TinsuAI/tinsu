import { useEffect, useRef, useCallback, useState } from 'react'
import { AppShell } from './components/layout/AppShell'
import { Welcome } from './components/Welcome'
import { KanbanBoardContainer } from './components/board'
import { StoryFullView } from './components/story'
import { Toaster } from './components/ui/sonner'
import { useProjectStore } from './stores/project.store'
import { useStoryViewStore } from './stores'
import { trpc } from './lib/trpc'
import { useFileWatcher } from './hooks/useFileWatcher'

function App(): React.JSX.Element {
  const { projectPath, projectName, setProject, clearProject } = useProjectStore()
  const activeStoryId = useStoryViewStore((state) => state.activeStoryId)

  // Story 3.9: Start file watching when project is opened
  useFileWatcher(projectPath)
  const hasAttemptedReopen = useRef(false)
  // Track whether we're attempting to reopen a persisted project
  const [isReopening, setIsReopening] = useState(() => {
    // If there's a persisted path but no projectName yet, we need to reopen
    return !!projectPath && !projectName
  })

  // Try to re-open last project on mount
  const openPathMutation = trpc.project.openPath.useMutation({
    onSuccess: (result) => {
      setProject(result.path, result.config.projectName)
      setIsReopening(false)
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
    },
    [setProject]
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

  // Keep AppShell mounted but hidden when viewing stories to preserve scroll positions
  // StoryFullView renders as full-screen overlay when active
  return (
    <>
      <div className={activeStoryId ? 'hidden' : undefined}>
        <AppShell>
          <KanbanBoardContainer />
        </AppShell>
      </div>
      {activeStoryId && <StoryFullView />}
      <Toaster />
    </>
  )
}

export default App

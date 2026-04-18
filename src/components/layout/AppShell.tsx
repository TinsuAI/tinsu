import { useEffect, useState, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { MainContent } from './MainContent'
import { MobileBottomNav } from './MobileBottomNav'
import { TerminalDock } from '@renderer/components/terminal'
import { ImportStoriesDialog } from '@renderer/components/dialogs/ImportStoriesDialog'
import { DeleteAllTasksDialog } from '@renderer/components/dialogs/DeleteAllTasksDialog'
import { SettingsDialog } from '@renderer/components/dialogs/SettingsDialog'
import { useTerminalStore } from '@renderer/stores'
import { useProjectStore } from '@renderer/stores/project.store'
import { useUIStore } from '@renderer/stores/ui.store'
import { useStorySync } from '@renderer/hooks/useStorySync'

const MIN_SIZE = 80

interface AppShellProps {
  children?: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const { isVisible, isExpanded, height, width, dockPosition } = useTerminalStore()
  const projectPath = useProjectStore((state) => state.projectPath)
  const { syncProjectPath, selectedSprintId } = useUIStore()

  // Story 3.9: Story sync hook for Sync All button
  const { syncAllFromFiles, isSyncingAll } = useStorySync()

  // Story 3.7: Import Stories dialog state
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  // Delete All Tasks dialog state
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false)
  // Story 5.1: Settings dialog state
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false)

  // Track keyboard height via visualViewport (works on both iOS and Android adjustNothing mode).
  // window.innerHeight stays fixed; visualViewport.height shrinks by keyboard height.
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => {
      const kbh = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      setKeyboardHeight(kbh)
    }
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])
  const isKeyboardOpen = keyboardHeight > 100

  const handleImportStories = useCallback(() => {
    setImportDialogOpen(true)
  }, [])

  const handleDeleteAllTasks = useCallback(() => {
    setDeleteAllDialogOpen(true)
  }, [])

  // Story 5.1: Open settings dialog
  const handleOpenSettings = useCallback(() => {
    setSettingsDialogOpen(true)
  }, [])

  // Story 3.9: Handle Sync All button click (syncs existing + imports new)
  // Respects selected sprint - only syncs tasks in current sprint
  const handleSyncAll = useCallback(() => {
    syncAllFromFiles(projectPath || undefined, selectedSprintId || undefined)
  }, [syncAllFromFiles, projectPath, selectedSprintId])

  // Story 2.6: Sync filter state with project - clear filters when project changes
  useEffect(() => {
    syncProjectPath(projectPath)
  }, [projectPath, syncProjectPath])

  // Calculate content area padding based on terminal dock position and state
  const contentPadding = useMemo(() => {
    // No padding needed when terminal is hidden
    if (!isVisible) {
      return {}
    }
    const size = isExpanded ? (dockPosition === 'left' || dockPosition === 'right' ? width : height) : MIN_SIZE
    switch (dockPosition) {
      case 'bottom':
        return { paddingBottom: size }
      case 'top':
        return { paddingTop: size }
      case 'left':
        return { paddingLeft: size }
      case 'right':
        return { paddingRight: size }
    }
  }, [isVisible, isExpanded, dockPosition, height, width])

  return (
    <div
      className="flex flex-col overflow-hidden bg-background"
      style={{
        height: `calc(100dvh - ${keyboardHeight}px)`,
        paddingTop: 'env(safe-area-inset-top, 0px)',
      }}
    >
      <Header
        onImportStories={handleImportStories}
        onDeleteAllTasks={handleDeleteAllTasks}
        onSyncAll={handleSyncAll}
        isSyncingAll={isSyncingAll}
        onOpenSettings={handleOpenSettings}
      />
      <div className="flex min-h-0 flex-1 overflow-hidden" style={contentPadding}>
        <Sidebar className="hidden lg:flex" />
        <MainContent>{children}</MainContent>
      </div>
      <div className="hidden lg:block">
        {isVisible && <TerminalDock />}
      </div>
      {/* Spacer reserves document-flow space so content doesn't hide behind the portal-rendered bottom nav */}
      {!isKeyboardOpen && (
        <div className="shrink-0 lg:hidden" style={{ height: 'calc(4rem + env(safe-area-inset-bottom, 0px))' }} />
      )}

      {/* Story 3.7: Import Stories dialog - accessible from header */}
      <ImportStoriesDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        projectId=""
        defaultPath=""
        sprintId={selectedSprintId}
        onSuccess={(result) => {
          toast.success('Import completed', {
            description: `Imported ${result.storiesCreated} stories from ${result.epicsCreated} epics`
          })
        }}
      />

      {/* Delete All Tasks confirmation dialog */}
      <DeleteAllTasksDialog
        open={deleteAllDialogOpen}
        onOpenChange={setDeleteAllDialogOpen}
        onSuccess={(count) => {
          toast.success('Tasks deleted', {
            description: `Deleted ${count} task${count === 1 ? '' : 's'} from the project`
          })
        }}
      />

      {/* Story 5.1: Settings dialog */}
      <SettingsDialog
        open={settingsDialogOpen}
        onOpenChange={setSettingsDialogOpen}
      />

      {/* Portal: bottom nav rendered on document.body to bypass overflow:hidden clipping */}
      {createPortal(
        <div className={`fixed bottom-0 left-0 right-0 z-[60] lg:hidden transition-transform duration-150 ${isKeyboardOpen ? 'translate-y-full' : 'translate-y-0'}`}>
          <MobileBottomNav onOpenSettings={handleOpenSettings} />
        </div>,
        document.body
      )}
    </div>
  )
}

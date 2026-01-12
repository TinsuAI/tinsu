import { useEffect, useState, useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { MainContent } from './MainContent'
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
  const { isExpanded, height, width, dockPosition } = useTerminalStore()
  const projectPath = useProjectStore((state) => state.projectPath)
  const syncProjectPath = useUIStore((state) => state.syncProjectPath)

  // Story 3.9: Story sync hook for Sync All button
  const { syncAllFromFiles, isSyncingAll } = useStorySync()

  // Story 3.7: Import Stories dialog state
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  // Delete All Tasks dialog state
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false)
  // Story 5.1: Settings dialog state
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false)

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
  const handleSyncAll = useCallback(() => {
    syncAllFromFiles(projectPath || undefined)
  }, [syncAllFromFiles, projectPath])

  // Story 2.6: Sync filter state with project - clear filters when project changes
  useEffect(() => {
    syncProjectPath(projectPath)
  }, [projectPath, syncProjectPath])

  // Calculate content area padding based on terminal dock position and state
  const contentPadding = useMemo(() => {
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
  }, [isExpanded, dockPosition, height, width])

  return (
    <div className="flex h-screen min-w-[1024px] flex-col overflow-hidden bg-background">
      <Header
        onImportStories={handleImportStories}
        onDeleteAllTasks={handleDeleteAllTasks}
        onSyncAll={handleSyncAll}
        isSyncingAll={isSyncingAll}
        onOpenSettings={handleOpenSettings}
      />
      <div className="flex min-h-0 flex-1 overflow-hidden" style={contentPadding}>
        <Sidebar />
        <MainContent>{children}</MainContent>
      </div>
      <TerminalDock />

      {/* Story 3.7: Import Stories dialog - accessible from header */}
      <ImportStoriesDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        projectId=""
        defaultPath=""
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
    </div>
  )
}

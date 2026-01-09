import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { MainContent } from './MainContent'
import { TerminalDock } from '@renderer/components/terminal'
import { ImportStoriesDialog } from '@renderer/components/dialogs/ImportStoriesDialog'
import { DeleteAllTasksDialog } from '@renderer/components/dialogs/DeleteAllTasksDialog'
import { useTerminalStore } from '@renderer/stores'
import { useProjectStore } from '@renderer/stores/project.store'
import { useUIStore } from '@renderer/stores/ui.store'
import { useStorySync } from '@renderer/hooks/useStorySync'

interface AppShellProps {
  children?: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const { isExpanded, height } = useTerminalStore()
  const projectPath = useProjectStore((state) => state.projectPath)
  const syncProjectPath = useUIStore((state) => state.syncProjectPath)

  // Story 3.9: Story sync hook for Sync All button
  const { syncAllFromFiles, isSyncingAll } = useStorySync()

  // Story 3.7: Import Stories dialog state
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  // Delete All Tasks dialog state
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false)

  const handleImportStories = useCallback(() => {
    setImportDialogOpen(true)
  }, [])

  const handleDeleteAllTasks = useCallback(() => {
    setDeleteAllDialogOpen(true)
  }, [])

  // Story 3.9: Handle Sync All button click (syncs existing + imports new)
  const handleSyncAll = useCallback(() => {
    syncAllFromFiles(projectPath || undefined)
  }, [syncAllFromFiles, projectPath])

  // Story 2.6: Sync filter state with project - clear filters when project changes
  useEffect(() => {
    syncProjectPath(projectPath)
  }, [projectPath, syncProjectPath])
  // Calculate bottom padding based on terminal dock state
  const terminalHeight = isExpanded ? height : 80

  return (
    <div className="flex min-h-screen min-w-[1024px] flex-col bg-background">
      <Header
        onImportStories={handleImportStories}
        onDeleteAllTasks={handleDeleteAllTasks}
        onSyncAll={handleSyncAll}
        isSyncingAll={isSyncingAll}
      />
      <div className="flex flex-1" style={{ paddingBottom: terminalHeight }}>
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
    </div>
  )
}

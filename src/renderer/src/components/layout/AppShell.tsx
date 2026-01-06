import { useEffect } from 'react'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { MainContent } from './MainContent'
import { TerminalDock } from '@renderer/components/terminal'
import { useTerminalStore } from '@renderer/stores'
import { useProjectStore } from '@renderer/stores/project.store'
import { useUIStore } from '@renderer/stores/ui.store'

interface AppShellProps {
  children?: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const { isExpanded, height } = useTerminalStore()
  const projectPath = useProjectStore((state) => state.projectPath)
  const syncProjectPath = useUIStore((state) => state.syncProjectPath)

  // Story 2.6: Sync filter state with project - clear filters when project changes
  useEffect(() => {
    syncProjectPath(projectPath)
  }, [projectPath, syncProjectPath])
  // Calculate bottom padding based on terminal dock state
  const terminalHeight = isExpanded ? height : 80

  return (
    <div className="flex min-h-screen min-w-[1024px] flex-col bg-background">
      <Header />
      <div className="flex flex-1" style={{ paddingBottom: terminalHeight }}>
        <Sidebar />
        <MainContent>{children}</MainContent>
      </div>
      <TerminalDock />
    </div>
  )
}

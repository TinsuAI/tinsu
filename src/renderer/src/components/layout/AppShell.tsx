import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { MainContent } from './MainContent'
import { TerminalDock } from '@renderer/components/terminal'
import { useTerminalStore } from '@renderer/stores'

interface AppShellProps {
  children?: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const { isExpanded, height } = useTerminalStore()
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

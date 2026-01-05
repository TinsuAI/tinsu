import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { MainContent } from './MainContent'

interface AppShellProps {
  children?: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex min-h-screen min-w-[1024px] flex-col bg-background">
      <Header />
      <div className="flex flex-1">
        <Sidebar />
        <MainContent>{children}</MainContent>
      </div>
    </div>
  )
}

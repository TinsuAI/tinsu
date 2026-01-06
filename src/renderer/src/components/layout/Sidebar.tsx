import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { useUIStore } from '@renderer/stores/ui.store'
import { SprintList } from '@renderer/components/sidebar/SprintList'

interface SidebarProps {
  className?: string
}

export function Sidebar({ className }: SidebarProps) {
  const { sidebarCollapsed, toggleSidebar } = useUIStore()

  return (
    <aside
      className={cn(
        'relative flex flex-col border-r border-border bg-card transition-[width] duration-150 ease-in-out motion-reduce:transition-none',
        sidebarCollapsed ? 'w-16' : 'w-60',
        className
      )}
    >
      {/* Toggle button */}
      <button
        type="button"
        onClick={toggleSidebar}
        aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-expanded={!sidebarCollapsed}
        className={cn(
          'absolute -right-3 top-4 z-10 flex h-6 w-6 items-center justify-center rounded-full',
          'border border-border bg-background text-muted-foreground',
          'hover:bg-accent hover:text-accent-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'
        )}
      >
        {sidebarCollapsed ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
      </button>

      {/* Sprint list navigation */}
      <nav className="flex-1 overflow-y-auto p-2">
        {sidebarCollapsed ? (
          <div className="flex items-center justify-center py-1.5">
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </div>
        ) : (
          <SprintList />
        )}
      </nav>
    </aside>
  )
}

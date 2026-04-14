import { Compass, LayoutDashboard, Settings } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { usePlanningWorkspaceStore } from '@renderer/stores'

interface MobileBottomNavProps {
  onOpenSettings: () => void
  className?: string
}

export function MobileBottomNav({ onOpenSettings, className }: MobileBottomNavProps) {
  const isPlanningOpen = usePlanningWorkspaceStore((s) => s.isOpen)
  const openWorkspace = usePlanningWorkspaceStore((s) => s.openWorkspace)
  const closeWorkspace = usePlanningWorkspaceStore((s) => s.closeWorkspace)

  return (
    <nav
      className={cn(
        'flex h-16 w-full items-center justify-around border-t border-border bg-card px-4 pb-safe',
        className
      )}
    >
      <button
        type="button"
        onClick={() => closeWorkspace()}
        className={cn(
          'flex flex-col items-center gap-1 transition-colors',
          !isPlanningOpen ? 'text-primary' : 'text-muted-foreground'
        )}
      >
        <LayoutDashboard className="h-6 w-6" />
        <span className="text-[10px] font-medium uppercase tracking-wider">Board</span>
      </button>

      <button
        type="button"
        onClick={() => openWorkspace()}
        className={cn(
          'flex flex-col items-center gap-1 transition-colors',
          isPlanningOpen ? 'text-primary' : 'text-muted-foreground'
        )}
      >
        <Compass className="h-6 w-6" />
        <span className="text-[10px] font-medium uppercase tracking-wider">Planning</span>
      </button>

      <button
        type="button"
        onClick={onOpenSettings}
        className="flex flex-col items-center gap-1 text-muted-foreground transition-colors active:text-primary"
      >
        <Settings className="h-6 w-6" />
        <span className="text-[10px] font-medium uppercase tracking-wider">Settings</span>
      </button>
    </nav>
  )
}

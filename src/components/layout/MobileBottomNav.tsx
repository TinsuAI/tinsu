import { Compass, LayoutDashboard, Settings } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { usePlanningWorkspaceStore } from '@renderer/stores'

interface MobileBottomNavProps {
  onOpenSettings: () => void
}

interface NavItemProps {
  icon: React.ReactNode
  label: string
  isActive: boolean
  onClick: () => void
  testId?: string
}

function NavItem({ icon, label, isActive, onClick, testId }: NavItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className={cn(
        'relative flex flex-1 flex-col items-center justify-center gap-1 h-16 py-2 transition-all duration-200',
        isActive ? 'text-primary' : 'text-muted-foreground active:text-foreground'
      )}
    >
      {/* Active top indicator bar */}
      <span
        className={cn(
          'absolute top-0 left-1/2 -translate-x-1/2 h-0.5 rounded-b-full bg-primary transition-all duration-200',
          isActive ? 'w-8 opacity-100' : 'w-0 opacity-0'
        )}
      />

      {/* Icon + label pill chip for active state */}
      <span
        className={cn(
          'flex flex-col items-center gap-1 rounded-xl px-4 py-1 transition-all duration-200',
          isActive ? 'bg-primary/10' : 'bg-transparent'
        )}
      >
        <span className="h-6 w-6 flex items-center justify-center">{icon}</span>
        <span
          className={cn(
            'text-[10px] uppercase tracking-wider transition-all duration-200',
            isActive ? 'font-semibold' : 'font-medium'
          )}
        >
          {label}
        </span>
      </span>
    </button>
  )
}

export function MobileBottomNav({ onOpenSettings }: MobileBottomNavProps) {
  const isPlanningOpen = usePlanningWorkspaceStore((s) => s.isOpen)
  const openWorkspace = usePlanningWorkspaceStore((s) => s.openWorkspace)
  const closeWorkspace = usePlanningWorkspaceStore((s) => s.closeWorkspace)

  const isBoardActive = !isPlanningOpen

  return (
    <nav
      className="flex w-full items-stretch border-t border-border/60 bg-card/95 backdrop-blur-md"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <NavItem
        icon={<LayoutDashboard className="h-5 w-5" />}
        label="Board"
        isActive={isBoardActive}
        onClick={() => closeWorkspace()}
        testId="mobile-nav-board"
      />

      <NavItem
        icon={<Compass className="h-5 w-5" />}
        label="Planning"
        isActive={isPlanningOpen}
        onClick={() => openWorkspace()}
        testId="mobile-nav-planning"
      />

      <NavItem
        icon={<Settings className="h-5 w-5" />}
        label="Settings"
        isActive={false}
        onClick={onOpenSettings}
        testId="mobile-nav-settings"
      />
    </nav>
  )
}

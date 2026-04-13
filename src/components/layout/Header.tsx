import { useState } from 'react'
import { X, Download, Trash2, RefreshCw, Settings, Terminal, WifiOff } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { useProjectStore } from '@renderer/stores/project.store'
import { useUIStore } from '@renderer/stores/ui.store'
import { useTerminalStore } from '@renderer/stores/terminal.store'
import { FilterButton, FilterPanel, FilterSummary } from '@renderer/components/filter'
import { VelocityWidget } from '@renderer/components/velocity'
import { ProjectSwitcher } from '@renderer/components/project'
import { Button } from '@renderer/components/ui/button'
import { ThemeToggle } from '@renderer/components/ui/theme-toggle'
import {
  useRemoteConnectionStatus,
  useReconnectRemoteProject,
} from '@renderer/hooks/useRemoteProjectSwitcher'

interface HeaderProps {
  className?: string
  /** Story 3.7: Callback to open the Import Stories dialog */
  onImportStories?: () => void
  /** Callback to open the Delete All Tasks dialog */
  onDeleteAllTasks?: () => void
  /** Story 3.9: Callback to sync all stories from files */
  onSyncAll?: () => void
  /** Story 3.9: Whether sync all is in progress */
  isSyncingAll?: boolean
  /** Story 5.1: Callback to open the Settings dialog */
  onOpenSettings?: () => void
}

export function Header({ className, onImportStories, onDeleteAllTasks, onSyncAll, isSyncingAll = false, onOpenSettings }: HeaderProps) {
  const projectName = useProjectStore((state) => state.projectName)
  const remoteProjectId = useProjectStore((state) => state.remoteProjectId)
  const remoteConnectionId = useProjectStore((state) => state.remoteConnectionId)
  const { clearAllFilters, hasActiveFilters } = useUIStore()
  const { isVisible: isTerminalVisible, toggleVisible: toggleTerminalVisible } = useTerminalStore()
  const [filterPanelOpen, setFilterPanelOpen] = useState(false)

  const { data: hookStatus } = useRemoteConnectionStatus(remoteConnectionId, !!remoteProjectId)
  const reconnect = useReconnectRemoteProject()

  const showClearAll = hasActiveFilters()
  const showReconnect = !!remoteProjectId && !!hookStatus && !hookStatus.is_active

  return (
    <div className={cn('sticky top-0 z-50 flex flex-col border-b border-border bg-background', className)}>
      <header className="flex h-12 w-full items-center px-4">
        <div className="flex items-center gap-1">
          <h1 className="text-lg font-semibold text-foreground">TinSu</h1>
          {projectName && (
            <>
              <span className="text-muted-foreground">-</span>
              <ProjectSwitcher />
            </>
          )}
        </div>
        {/* File menu with Open Project option and filter controls */}
        <div className="ml-auto flex items-center gap-2">
          {/* Velocity widget - shows task completion metrics (Story 2.7) */}
          <VelocityWidget />

          {/* Reconnect button — visible when remote project is active but SSH tunnel is down */}
          {showReconnect && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => reconnect.mutate()}
              disabled={reconnect.isPending}
              data-testid="reconnect-remote-button"
            >
              <WifiOff className="mr-1 h-3 w-3" />
              {reconnect.isPending ? 'Reconnecting...' : 'Reconnect'}
            </Button>
          )}

          {/* Terminal toggle button */}
          <Button
            variant={isTerminalVisible ? 'secondary' : 'ghost'}
            size="sm"
            onClick={toggleTerminalVisible}
            data-testid="header-terminal-toggle"
            aria-label={isTerminalVisible ? 'Hide terminal' : 'Show terminal'}
          >
            <Terminal className="mr-1 h-3 w-3" />
            Terminal
          </Button>

          {/* Clear all filters button - only visible when filters active */}
          {showClearAll && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Clear all filters"
              data-testid="header-clear-filters"
            >
              <X className="mr-1 h-3 w-3" />
              Clear filters
            </Button>
          )}

          {/* Filter button with popover panel */}
          <FilterPanel
            open={filterPanelOpen}
            onOpenChange={setFilterPanelOpen}
            trigger={<FilterButton onClick={() => setFilterPanelOpen(!filterPanelOpen)} />}
          />

          {/* Story 3.9: Sync All button */}
          {onSyncAll && (
            <Button
              variant="outline"
              size="sm"
              onClick={onSyncAll}
              disabled={isSyncingAll}
              data-testid="header-sync-all"
            >
              <RefreshCw className={cn('mr-1 h-3 w-3', isSyncingAll && 'animate-spin')} />
              {isSyncingAll ? 'Syncing...' : 'Sync All'}
            </Button>
          )}

          {/* Story 3.7: Import Stories button - always available */}
          {onImportStories && (
            <Button
              variant="outline"
              size="sm"
              onClick={onImportStories}
              data-testid="header-import-stories"
            >
              <Download className="mr-1 h-3 w-3" />
              Import Stories
            </Button>
          )}

          {/* Delete All Tasks button */}
          {onDeleteAllTasks && (
            <Button
              variant="outline"
              size="sm"
              onClick={onDeleteAllTasks}
              className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
              data-testid="header-delete-all-tasks"
            >
              <Trash2 className="mr-1 h-3 w-3" />
              Delete All
            </Button>
          )}

          {/* Story 5.1: Settings button */}
          {onOpenSettings && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenSettings}
              data-testid="header-settings"
            >
              <Settings className="mr-1 h-3 w-3" />
              Settings
            </Button>
          )}

          {/* Theme toggle - light/dark mode switch */}
          <ThemeToggle />

        </div>
      </header>

      {/* Filter summary chips - only visible when filters active (Story 2.6) */}
      {showClearAll && <FilterSummary className="px-4 pb-2" />}
    </div>
  )
}

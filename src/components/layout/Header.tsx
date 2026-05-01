import { useState } from 'react'
import { X, Download, Trash2, RefreshCw, Settings, Terminal } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { useProjectStore } from '@renderer/stores/project.store'
import { useUIStore } from '@renderer/stores/ui.store'
import { useTerminalStore } from '@renderer/stores/terminal.store'
import { FilterButton, FilterPanel, FilterSummary } from '@renderer/components/filter'
import { VelocityWidget } from '@renderer/components/velocity'
import { ProjectSwitcher, RemoteConnectionBadge } from '@renderer/components/project'
import { Button } from '@renderer/components/ui/button'
import { ThemeToggle } from '@renderer/components/ui/theme-toggle'
import { SyncStatusIndicator } from '@renderer/components/sync/SyncStatusIndicator'

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
  const { clearAllFilters, hasActiveFilters } = useUIStore()
  const { isVisible: isTerminalVisible, toggleVisible: toggleTerminalVisible } = useTerminalStore()
  const [filterPanelOpen, setFilterPanelOpen] = useState(false)

  const showClearAll = hasActiveFilters()

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
          {/* Velocity widget - desktop only */}
          <span className="hidden lg:flex items-center">
            <VelocityWidget />
          </span>

          {/* Remote sync status indicator — visible when remote project is active */}
          <SyncStatusIndicator />

          {/* Remote connection status — always visible when a remote project is active */}
          <RemoteConnectionBadge />

          {/* Terminal toggle button - desktop only */}
          <span className="hidden lg:flex items-center">
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
          </span>

          {/* Clear all filters button - visible on all sizes when filters active */}
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
              <span className="hidden sm:inline">Clear filters</span>
            </Button>
          )}

          {/* Filter button with popover panel */}
          <FilterPanel
            open={filterPanelOpen}
            onOpenChange={setFilterPanelOpen}
            trigger={<FilterButton onClick={() => setFilterPanelOpen(!filterPanelOpen)} />}
          />

          {/* Story 3.9: Sync All button - desktop only */}
          {onSyncAll && (
            <span className="hidden lg:flex items-center">
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
            </span>
          )}

          {/* Story 3.7: Import Stories button - desktop only */}
          {onImportStories && (
            <span className="hidden lg:flex items-center">
              <Button
                variant="outline"
                size="sm"
                onClick={onImportStories}
                data-testid="header-import-stories"
              >
                <Download className="mr-1 h-3 w-3" />
                Import Stories
              </Button>
            </span>
          )}

          {/* Delete All Tasks button - desktop only */}
          {onDeleteAllTasks && (
            <span className="hidden lg:flex items-center">
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
            </span>
          )}

          {/* Story 5.1: Settings button - desktop only (mobile uses bottom nav) */}
          {onOpenSettings && (
            <span className="hidden lg:flex items-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={onOpenSettings}
                data-testid="header-settings"
              >
                <Settings className="mr-1 h-3 w-3" />
                Settings
              </Button>
            </span>
          )}

          {/* Theme toggle - always visible */}
          <ThemeToggle />

        </div>
      </header>

      {/* Filter summary chips - only visible when filters active (Story 2.6) */}
      {showClearAll && <FilterSummary className="px-4 pb-2" />}
    </div>
  )
}

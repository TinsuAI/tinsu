import { useState } from 'react'
import { X, Download, Trash2, RefreshCw } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { useProjectStore } from '@renderer/stores/project.store'
import { useUIStore } from '@renderer/stores/ui.store'
import { FilterButton, FilterPanel, FilterSummary } from '@renderer/components/filter'
import { VelocityWidget } from '@renderer/components/velocity'
import { Button } from '@renderer/components/ui/button'

interface HeaderProps {
  className?: string
  onOpenProject?: () => void
  /** Story 3.7: Callback to open the Import Stories dialog */
  onImportStories?: () => void
  /** Callback to open the Delete All Tasks dialog */
  onDeleteAllTasks?: () => void
  /** Story 3.9: Callback to sync all stories from files */
  onSyncAll?: () => void
  /** Story 3.9: Whether sync all is in progress */
  isSyncingAll?: boolean
}

export function Header({ className, onOpenProject, onImportStories, onDeleteAllTasks, onSyncAll, isSyncingAll = false }: HeaderProps) {
  const projectName = useProjectStore((state) => state.projectName)
  const { clearAllFilters, hasActiveFilters } = useUIStore()
  const [filterPanelOpen, setFilterPanelOpen] = useState(false)

  const showClearAll = hasActiveFilters()

  return (
    <div className={cn('sticky top-0 z-50 flex flex-col border-b border-border bg-background', className)}>
      <header className="flex h-12 w-full items-center px-4">
        <h1 className="text-lg font-semibold text-foreground">
          TinSu{projectName && <span className="text-muted-foreground"> - {projectName}</span>}
        </h1>
        {/* File menu with Open Project option and filter controls */}
        <div className="ml-auto flex items-center gap-2">
          {/* Velocity widget - shows task completion metrics (Story 2.7) */}
          <VelocityWidget />

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

          {onOpenProject && (
            <button
              onClick={onOpenProject}
              className="rounded px-2 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              Open Project...
            </button>
          )}
        </div>
      </header>

      {/* Filter summary chips - only visible when filters active (Story 2.6) */}
      {showClearAll && <FilterSummary className="px-4 pb-2" />}
    </div>
  )
}

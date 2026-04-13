import { X } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@renderer/components/ui/popover'
import { Checkbox } from '@renderer/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@renderer/components/ui/radio-group'
import { EpicBadge } from '@renderer/components/task/EpicBadge'
import { useUIStore } from '@renderer/stores/ui.store'
import { useProjectStore } from '@renderer/stores/project.store'
import { TASK_STATUS, type TaskStatus } from '@shared/types/task.types'
import { COLUMN_CONFIG } from '../board/KanbanColumn'
import { useListEpics } from '@renderer/hooks/useEpicCommands'
import { useListSprints } from '@renderer/hooks/useSprintCommands'

interface FilterPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  trigger: React.ReactNode
}

export function FilterPanel({ open, onOpenChange, trigger }: FilterPanelProps) {
  const activeProjectId = useProjectStore((state) => state.activeProjectId) ?? ''
  const { data: epics } = useListEpics(activeProjectId)
  const { data: sprints } = useListSprints(activeProjectId)

  const {
    selectedSprintId,
    selectedEpicIds,
    selectedStatuses,
    setSelectedSprint,
    toggleEpicFilter,
    toggleStatusFilter,
    clearAllFilters,
    hasActiveFilters
  } = useUIStore()

  const showClearAll = hasActiveFilters()

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-80" align="end" data-testid="filter-panel">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Filters</h4>
            {showClearAll && (
              <button
                onClick={clearAllFilters}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                data-testid="clear-all-filters"
              >
                <X className="h-3 w-3" />
                Clear all
              </button>
            )}
          </div>

          {/* Sprint Section - Radio buttons for single-select */}
          <div>
            <h5 className="mb-2 text-xs font-medium text-muted-foreground">Sprint</h5>
            {sprints && sprints.length > 0 ? (
              <RadioGroup
                value={selectedSprintId || 'all'}
                onValueChange={(value) => setSelectedSprint(value === 'all' ? null : value)}
              >
                <label
                  className="flex cursor-pointer items-center gap-2"
                  data-testid="filter-sprint-all"
                >
                  <RadioGroupItem value="all" />
                  <span className="text-sm">All Sprints</span>
                </label>
                {sprints.map((sprint) => (
                  <label
                    key={sprint.id}
                    className="flex cursor-pointer items-center gap-2"
                    data-testid={`filter-sprint-${sprint.id}`}
                  >
                    <RadioGroupItem value={sprint.id} />
                    <span className="text-sm">
                      {sprint.name}
                      {sprint.status === 'active' && (
                        <span className="ml-1 text-xs text-green-500">(Active)</span>
                      )}
                    </span>
                  </label>
                ))}
              </RadioGroup>
            ) : (
              <p className="text-xs text-muted-foreground">No sprints available</p>
            )}
          </div>

          {/* Epic Section */}
          <div>
            <h5 className="mb-2 text-xs font-medium text-muted-foreground">
              Epic{selectedEpicIds.length > 0 && ` (${selectedEpicIds.length})`}
            </h5>
            <div className="space-y-2">
              {epics && epics.length > 0 ? (
                epics.map((epic) => (
                  <label
                    key={epic.id}
                    className="flex cursor-pointer items-center gap-2"
                    data-testid={`filter-epic-${epic.id}`}
                  >
                    <Checkbox
                      checked={selectedEpicIds.includes(epic.id)}
                      onCheckedChange={() => toggleEpicFilter(epic.id)}
                    />
                    <EpicBadge title={epic.title} color={epic.color} className="text-xs" />
                  </label>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">No epics available</p>
              )}
            </div>
          </div>

          {/* Status Section */}
          <div>
            <h5 className="mb-2 text-xs font-medium text-muted-foreground">
              Status{selectedStatuses.length > 0 && ` (${selectedStatuses.length})`}
            </h5>
            <div className="space-y-2">
              {TASK_STATUS.map((status) => (
                <label
                  key={status}
                  className="flex cursor-pointer items-center gap-2"
                  data-testid={`filter-status-${status}`}
                >
                  <Checkbox
                    checked={selectedStatuses.includes(status as TaskStatus)}
                    onCheckedChange={() => toggleStatusFilter(status as TaskStatus)}
                  />
                  <span className="text-sm">{COLUMN_CONFIG[status].title}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

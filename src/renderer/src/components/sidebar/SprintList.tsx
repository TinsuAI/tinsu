import { format } from 'date-fns'
import { Calendar, X } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { trpc } from '@renderer/lib/trpc'
import { useUIStore } from '@renderer/stores/ui.store'

export function SprintList() {
  const { data: sprints, isLoading } = trpc.sprints.getAll.useQuery()
  const { selectedSprintId, setSelectedSprint, clearSprintFilter } = useUIStore()

  if (isLoading) {
    return (
      <div className="px-2 py-1">
        <p className="text-xs text-muted-foreground">Loading sprints...</p>
      </div>
    )
  }

  if (!sprints || sprints.length === 0) {
    return (
      <div className="px-2 py-1">
        <p className="text-xs text-muted-foreground">No sprints yet</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1" data-testid="sprint-list">
      <div className="flex items-center justify-between px-2 py-1">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Sprints
        </h3>
        {selectedSprintId && (
          <button
            onClick={clearSprintFilter}
            className="text-xs text-muted-foreground hover:text-foreground"
            aria-label="Clear sprint filter"
            data-testid="clear-sprint-filter"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {sprints.map((sprint) => {
        const isSelected = selectedSprintId === sprint.id
        const dateRange = formatDateRange(sprint.start_date, sprint.end_date)

        return (
          <button
            key={sprint.id}
            onClick={() => setSelectedSprint(isSelected ? null : sprint.id)}
            className={cn(
              'flex flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-left transition-colors',
              'hover:bg-accent hover:text-accent-foreground',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              isSelected && 'bg-accent text-accent-foreground',
              sprint.is_active && !isSelected && 'border-l-2 border-primary'
            )}
            data-testid={`sprint-item-${sprint.id}`}
            aria-selected={isSelected}
            aria-current={sprint.is_active ? 'true' : undefined}
          >
            <div className="flex w-full items-center gap-2">
              {sprint.is_active && (
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" aria-label="Active sprint" />
              )}
              <span className="flex-1 truncate text-sm font-medium">{sprint.name}</span>
            </div>
            {dateRange && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>{dateRange}</span>
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}

// Format date range for sprint display
function formatDateRange(start: Date | string | null, end: Date | string | null): string {
  if (!start) return ''
  const startDate = typeof start === 'string' ? new Date(start) : start
  const endDate = end ? (typeof end === 'string' ? new Date(end) : end) : null

  if (!endDate) return `Starts ${format(startDate, 'MMM d')}`
  return `${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d')}`
}

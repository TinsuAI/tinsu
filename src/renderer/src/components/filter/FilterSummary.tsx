import { X } from 'lucide-react'
import { trpc } from '@renderer/lib/trpc'
import { useUIStore } from '@renderer/stores/ui.store'
import { cn } from '@renderer/lib/utils'
import { COLUMN_CONFIG } from '../board/KanbanColumn'
import type { TaskStatus } from '@shared/types/task.types'

interface FilterSummaryProps {
  className?: string
}

export function FilterSummary({ className }: FilterSummaryProps) {
  const { data: epics } = trpc.epics.getAll.useQuery()
  const { data: sprints } = trpc.sprints.getAll.useQuery()

  const {
    selectedSprintId,
    selectedEpicIds,
    selectedStatuses,
    setSelectedSprint,
    setSelectedEpics,
    setSelectedStatuses,
    hasActiveFilters
  } = useUIStore()

  if (!hasActiveFilters()) {
    return null
  }

  // Find sprint name
  const selectedSprint = sprints?.find((s) => s.id === selectedSprintId)

  return (
    <div
      className={cn('flex flex-wrap items-center gap-2', className)}
      data-testid="filter-summary"
    >
      <span className="text-xs text-muted-foreground">Filtered by:</span>

      {/* Sprint chip */}
      {selectedSprint && (
        <FilterChip
          label={`Sprint: ${selectedSprint.name}`}
          onRemove={() => setSelectedSprint(null)}
          testId="filter-chip-sprint"
        />
      )}

      {/* Epic chips - use ID directly for removal to avoid title collision issues */}
      {selectedEpicIds.map((epicId) => {
        const epic = epics?.find((e) => e.id === epicId)
        if (!epic) return null
        return (
          <FilterChip
            key={`epic-${epicId}`}
            label={`Epic: ${epic.title}`}
            onRemove={() => {
              setSelectedEpics(selectedEpicIds.filter((id) => id !== epicId))
            }}
            testId={`filter-chip-epic-${epicId}`}
          />
        )
      })}

      {/* Status chips - use status key directly for removal */}
      {selectedStatuses.map((status) => (
        <FilterChip
          key={`status-${status}`}
          label={`Status: ${COLUMN_CONFIG[status as TaskStatus]?.title || status}`}
          onRemove={() => {
            setSelectedStatuses(selectedStatuses.filter((s) => s !== status))
          }}
          testId={`filter-chip-status-${status}`}
        />
      ))}
    </div>
  )
}

interface FilterChipProps {
  label: string
  onRemove: () => void
  testId: string
}

function FilterChip({ label, onRemove, testId }: FilterChipProps) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground"
      data-testid={testId}
    >
      {label}
      <button
        onClick={onRemove}
        className="rounded-full p-0.5 hover:bg-foreground/10"
        aria-label={`Remove ${label} filter`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  )
}

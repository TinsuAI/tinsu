import { Filter } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { useUIStore } from '@renderer/stores/ui.store'
import { cn } from '@renderer/lib/utils'

interface FilterButtonProps {
  onClick?: () => void
  className?: string
}

export function FilterButton({ onClick, className }: FilterButtonProps) {
  const { selectedSprintId, selectedEpicIds, selectedStatuses } = useUIStore()

  // Count active filters
  // Sprint: 1 if selected
  // Epics: count of selected
  // Status: count only if not all 4 are selected (if all selected = no filter)
  const activeCount =
    (selectedSprintId ? 1 : 0) +
    selectedEpicIds.length +
    (selectedStatuses.length > 0 && selectedStatuses.length < 4 ? selectedStatuses.length : 0)

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className={cn('relative', className)}
      aria-label={`Filter tasks${activeCount > 0 ? `, ${activeCount} active` : ''}`}
      data-testid="filter-button"
    >
      <Filter className="h-4 w-4" />
      {activeCount > 0 && (
        <span
          className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground"
          data-testid="filter-badge"
        >
          {activeCount}
        </span>
      )}
    </Button>
  )
}

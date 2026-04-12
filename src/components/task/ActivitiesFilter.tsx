/**
 * ActivitiesFilter Component
 *
 * Filter chip component for filtering activity log events by category.
 *
 * @see TES-2.12: Activity Log Filtering (Task 1)
 * @see AC: #1, #2, #4
 */

import { Filter, ArrowRight, Bot, Terminal, AlertCircle } from 'lucide-react'
import { cn } from '@renderer/lib/utils'

/**
 * Filter category type.
 * 'all' shows all events, other categories filter to specific event types.
 */
export type FilterCategory = 'all' | 'status' | 'agent' | 'user' | 'error'

interface ActivitiesFilterProps {
  /** Currently selected filter categories */
  selectedFilters: FilterCategory[]
  /** Callback when filter selection changes */
  onFilterChange: (filters: FilterCategory[]) => void
}

/**
 * Filter chip configuration.
 * Maps categories to display labels, icons, and colors.
 */
const FILTER_CHIPS: {
  id: FilterCategory
  label: string
  icon: React.ComponentType<{ className?: string }>
}[] = [
  { id: 'all', label: 'All', icon: Filter },
  { id: 'status', label: 'Status', icon: ArrowRight },
  { id: 'agent', label: 'Agent', icon: Bot },
  { id: 'user', label: 'User', icon: Terminal },
  { id: 'error', label: 'Error', icon: AlertCircle }
]

/**
 * Color class mappings for filter chips.
 * Theme-aware: uses semantic colors that work in both light and dark modes.
 */
const COLOR_CLASSES: Record<FilterCategory, { selected: string; unselected: string }> = {
  all: {
    selected: 'bg-muted text-foreground border-border',
    unselected: 'bg-secondary/50 text-muted-foreground border-transparent hover:bg-secondary'
  },
  status: {
    selected: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
    unselected: 'bg-secondary/50 text-muted-foreground border-transparent hover:bg-secondary'
  },
  agent: {
    selected: 'bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30',
    unselected: 'bg-secondary/50 text-muted-foreground border-transparent hover:bg-secondary'
  },
  user: {
    selected: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30',
    unselected: 'bg-secondary/50 text-muted-foreground border-transparent hover:bg-secondary'
  },
  error: {
    selected: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30',
    unselected: 'bg-secondary/50 text-muted-foreground border-transparent hover:bg-secondary'
  }
}

/**
 * ActivitiesFilter component - displays filter chips for activity categories.
 *
 * Features:
 * - Toggle individual filter categories on/off
 * - Multiple filters can be selected (OR logic)
 * - Clicking "All" resets to show all events
 * - When last filter is removed, defaults back to "All"
 *
 * @see TES-2.12: Activity Log Filtering
 */
export function ActivitiesFilter({
  selectedFilters,
  onFilterChange
}: ActivitiesFilterProps): React.ReactNode {
  /**
   * Handle filter chip click.
   * - Clicking "All" resets to show all events
   * - Clicking a specific filter toggles it
   * - If no filters remain after toggle, default to "all"
   */
  const handleChipClick = (category: FilterCategory): void => {
    if (category === 'all') {
      // Reset to all
      onFilterChange(['all'])
      return
    }

    // Toggle category
    let newFilters: FilterCategory[] = selectedFilters.filter((f) => f !== 'all')

    if (newFilters.includes(category)) {
      // Remove the category
      newFilters = newFilters.filter((f) => f !== category)
    } else {
      // Add the category
      newFilters = [...newFilters, category]
    }

    // If no filters selected, default to all
    if (newFilters.length === 0) {
      newFilters = ['all']
    }

    onFilterChange(newFilters)
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/30">
      <span className="text-xs text-muted-foreground mr-1">Filter:</span>
      {FILTER_CHIPS.map((chip) => {
        const isSelected = selectedFilters.includes(chip.id)
        const Icon = chip.icon
        const colorClasses = COLOR_CLASSES[chip.id]

        return (
          <button
            key={chip.id}
            onClick={() => handleChipClick(chip.id)}
            className={cn(
              'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors border',
              isSelected ? colorClasses.selected : colorClasses.unselected
            )}
            aria-pressed={isSelected}
          >
            <Icon className="w-3 h-3" />
            {chip.label}
          </button>
        )
      })}
    </div>
  )
}

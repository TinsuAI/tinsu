import { format } from 'date-fns'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { trpc } from '@renderer/lib/trpc'

interface SprintSelectProps {
  value: string | undefined
  onValueChange: (value: string | undefined) => void
  placeholder?: string
}

export function SprintSelect({
  value,
  onValueChange,
  placeholder = 'Select sprint...'
}: SprintSelectProps) {
  const { data: sprints, isLoading } = trpc.sprints.getAll.useQuery()

  return (
    <Select
      value={value ?? ''}
      onValueChange={(val) => onValueChange(val === 'none' ? undefined : val)}
    >
      <SelectTrigger data-testid="sprint-select">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">None</SelectItem>
        {isLoading && <SelectItem value="loading" disabled>Loading...</SelectItem>}
        {sprints?.map((sprint) => (
          <SelectItem key={sprint.id} value={sprint.id}>
            <span className="flex items-center gap-2">
              {sprint.status === 'active' && (
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              )}
              <span>{sprint.name}</span>
              {sprint.start_date && sprint.end_date && (
                <span className="text-xs text-muted-foreground">
                  ({formatDateRange(new Date(sprint.start_date), new Date(sprint.end_date))})
                </span>
              )}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

// Format date range for sprint display
function formatDateRange(start: Date | null, end: Date | null): string {
  if (!start) return 'No dates'
  if (!end) return `Starts ${format(start, 'MMM d')}`
  return `${format(start, 'MMM d')} - ${format(end, 'MMM d')}`
}

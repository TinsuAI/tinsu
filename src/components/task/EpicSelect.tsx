import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { useListEpics } from '@renderer/hooks/useEpicCommands'

interface EpicSelectProps {
  value: string | undefined
  onValueChange: (value: string | undefined) => void
  placeholder?: string
  projectId?: string
}

export function EpicSelect({
  value,
  onValueChange,
  placeholder = 'Select epic...',
  projectId = ''
}: EpicSelectProps) {
  const { data: epics, isLoading } = useListEpics(projectId)

  return (
    <Select
      value={value ?? ''}
      onValueChange={(val) => onValueChange(val === 'none' ? undefined : val)}
    >
      <SelectTrigger data-testid="epic-select">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">None</SelectItem>
        {isLoading && <SelectItem value="loading" disabled>Loading...</SelectItem>}
        {epics?.map((epic) => (
          <SelectItem key={epic.id} value={epic.id}>
            <span className="flex items-center gap-2">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: getEpicColorValue(epic.color) }}
              />
              {epic.title}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

// Map color names to CSS color values for the indicator dot
function getEpicColorValue(color: string): string {
  const colorMap: Record<string, string> = {
    blue: '#3b82f6',
    green: '#22c55e',
    yellow: '#eab308',
    red: '#ef4444',
    purple: '#a855f7',
    orange: '#f97316',
    pink: '#ec4899',
    cyan: '#06b6d4',
    indigo: '#6366f1',
    teal: '#14b8a6'
  }
  return colorMap[color] || colorMap.blue
}

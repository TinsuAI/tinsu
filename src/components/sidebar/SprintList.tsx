import { useState } from 'react'
import { format } from 'date-fns'
import { Calendar, X, Plus, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { useUIStore } from '@renderer/stores/ui.store'
import { useProjectStore } from '@renderer/stores/project.store'
import { SprintStatusBadge } from '@renderer/components/sprint/SprintStatusBadge'
import { SprintForm } from '@renderer/components/sprint/SprintForm'
import { Button } from '@renderer/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@renderer/components/ui/popover'
import { toast } from 'sonner'
import { useListSprints, useDeleteSprint } from '@renderer/hooks/useSprintCommands'

type SprintStatus = 'planning' | 'active' | 'completed'

interface Sprint {
  id: string
  name: string
  status: string
  goal: string | null
  start_date: string | null
  end_date: string | null
}

export function SprintList() {
  const activeProjectId = useProjectStore((state) => state.activeProjectId) ?? ''
  const { data: sprints, isLoading } = useListSprints(activeProjectId)
  const { selectedSprintId, setSelectedSprint, clearSprintFilter } = useUIStore()

  const [formOpen, setFormOpen] = useState(false)
  const [editingSprint, setEditingSprint] = useState<Sprint | null>(null)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)

  const deleteMutation = useDeleteSprint()

  const handleCreate = () => {
    setEditingSprint(null)
    setFormOpen(true)
  }

  const handleEdit = (sprint: Sprint) => {
    setEditingSprint(sprint)
    setFormOpen(true)
    setMenuOpenId(null)
  }

  const handleDelete = async (sprint: Sprint) => {
    if (confirm(`Delete sprint "${sprint.name}"? This will also delete all associated epics and tasks.`)) {
      deleteMutation.mutate(
        { id: sprint.id },
        {
          onSuccess: () => {
            toast.success('Sprint deleted')
            if (selectedSprintId === sprint.id) {
              clearSprintFilter()
            }
          },
          onError: (error) => {
            toast.error(`Failed to delete sprint: ${error.message}`)
          },
        }
      )
    }
    setMenuOpenId(null)
  }

  if (isLoading) {
    return (
      <div className="px-2 py-1">
        <p className="text-xs text-muted-foreground">Loading sprints...</p>
      </div>
    )
  }

  // Sort sprints: active first, then planning, then completed
  const sortedSprints = sprints ? [...sprints].sort((a, b) => {
    const statusOrder: Record<SprintStatus, number> = { active: 0, planning: 1, completed: 2 }
    const aOrder = statusOrder[(a.status as SprintStatus) || 'planning']
    const bOrder = statusOrder[(b.status as SprintStatus) || 'planning']
    return aOrder - bOrder
  }) : []

  return (
    <>
      <div className="flex flex-col gap-1" data-testid="sprint-list">
        <div className="flex items-center justify-between px-2 py-1">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Sprints
          </h3>
          <div className="flex items-center gap-1">
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
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={handleCreate}
              aria-label="Create sprint"
              data-testid="create-sprint-btn"
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {sortedSprints.length === 0 ? (
          <div className="px-2 py-1">
            <p className="text-xs text-muted-foreground">No sprints yet</p>
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs"
              onClick={handleCreate}
            >
              Create your first sprint
            </Button>
          </div>
        ) : (
          sortedSprints.map((sprint) => {
            const isSelected = selectedSprintId === sprint.id
            const dateRange = formatDateRange(sprint.start_date, sprint.end_date)
            const status = (sprint.status as SprintStatus) || 'planning'
            const isActive = status === 'active'

            return (
              <div
                key={sprint.id}
                className={cn(
                  'group flex items-start gap-1 rounded-md px-2 py-1.5 transition-colors',
                  'hover:bg-accent hover:text-accent-foreground',
                  isSelected && 'bg-accent text-accent-foreground',
                  isActive && !isSelected && 'border-l-2 border-green-500'
                )}
                data-testid={`sprint-item-${sprint.id}`}
              >
                <button
                  onClick={() => setSelectedSprint(isSelected ? null : sprint.id)}
                  className="flex flex-1 flex-col items-start gap-1 text-left focus-visible:outline-none"
                  aria-selected={isSelected}
                  aria-current={isActive ? 'true' : undefined}
                >
                  <div className="flex w-full items-center gap-2">
                    <span className="flex-1 truncate text-sm font-medium">{sprint.name}</span>
                    <SprintStatusBadge status={status} className="shrink-0" />
                  </div>
                  {dateRange && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>{dateRange}</span>
                    </div>
                  )}
                  {sprint.goal && (
                    <p className="line-clamp-2 text-xs text-muted-foreground">{sprint.goal}</p>
                  )}
                </button>

                {/* Actions menu */}
                <Popover
                  open={menuOpenId === sprint.id}
                  onOpenChange={(open) => setMenuOpenId(open ? sprint.id : null)}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100"
                      data-testid={`sprint-menu-${sprint.id}`}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-32 p-1" align="end">
                    <button
                      onClick={() => handleEdit(sprint)}
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent"
                      data-testid={`sprint-edit-${sprint.id}`}
                    >
                      <Pencil className="h-3 w-3" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(sprint)}
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10"
                      data-testid={`sprint-delete-${sprint.id}`}
                    >
                      <Trash2 className="h-3 w-3" />
                      Delete
                    </button>
                  </PopoverContent>
                </Popover>
              </div>
            )
          })
        )}
      </div>

      <SprintForm
        open={formOpen}
        onOpenChange={setFormOpen}
        sprint={editingSprint}
      />
    </>
  )
}

// Format date range for sprint display
function formatDateRange(start: string | null, end: string | null): string {
  if (!start) return ''
  const startDate = new Date(start)
  const endDate = end ? new Date(end) : null

  if (!endDate) return `Starts ${format(startDate, 'MMM d')}`
  return `${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d')}`
}

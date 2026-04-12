import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@renderer/components/ui/dialog'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import { Textarea } from '@renderer/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { trpc } from '@renderer/lib/trpc'
import { toast } from 'sonner'

type SprintStatus = 'planning' | 'active' | 'completed'

interface SprintFormData {
  name: string
  goal: string
  status: SprintStatus
  start_date: string
  end_date: string
}

interface SprintFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sprint?: {
    id: string
    name: string
    goal: string | null
    status: string
    start_date: Date | string | null
    end_date: Date | string | null
  } | null
}

export function SprintForm({ open, onOpenChange, sprint }: SprintFormProps) {
  const isEdit = !!sprint
  const utils = trpc.useUtils()

  const [formData, setFormData] = useState<SprintFormData>({
    name: '',
    goal: '',
    status: 'planning',
    start_date: '',
    end_date: ''
  })

  // Reset form when sprint changes or dialog opens
  useEffect(() => {
    if (open) {
      if (sprint) {
        setFormData({
          name: sprint.name,
          goal: sprint.goal || '',
          status: (sprint.status as SprintStatus) || 'planning',
          start_date: sprint.start_date
            ? format(new Date(sprint.start_date), 'yyyy-MM-dd')
            : '',
          end_date: sprint.end_date ? format(new Date(sprint.end_date), 'yyyy-MM-dd') : ''
        })
      } else {
        setFormData({
          name: '',
          goal: '',
          status: 'planning',
          start_date: '',
          end_date: ''
        })
      }
    }
  }, [open, sprint])

  const createMutation = trpc.sprints.create.useMutation({
    onSuccess: () => {
      utils.sprints.getAll.invalidate()
      toast.success('Sprint created')
      onOpenChange(false)
    },
    onError: (error) => {
      toast.error(`Failed to create sprint: ${error.message}`)
    }
  })

  const updateMutation = trpc.sprints.update.useMutation({
    onSuccess: () => {
      utils.sprints.getAll.invalidate()
      toast.success('Sprint updated')
      onOpenChange(false)
    },
    onError: (error) => {
      toast.error(`Failed to update sprint: ${error.message}`)
    }
  })

  const updateStatusMutation = trpc.sprints.updateStatus.useMutation({
    onSuccess: () => {
      utils.sprints.getAll.invalidate()
      utils.sprints.getActive.invalidate()
    },
    onError: (error) => {
      toast.error(`Failed to update status: ${error.message}`)
    }
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim()) {
      toast.error('Name is required')
      return
    }

    const startDate = formData.start_date ? new Date(formData.start_date) : undefined
    const endDate = formData.end_date ? new Date(formData.end_date) : undefined

    if (isEdit && sprint) {
      // Update sprint
      await updateMutation.mutateAsync({
        id: sprint.id,
        name: formData.name,
        goal: formData.goal || null,
        start_date: startDate ?? null,
        end_date: endDate ?? null
      })

      // Update status separately if changed
      if (formData.status !== sprint.status) {
        await updateStatusMutation.mutateAsync({
          id: sprint.id,
          status: formData.status
        })
      }
    } else {
      // Create sprint
      await createMutation.mutateAsync({
        name: formData.name,
        goal: formData.goal || undefined,
        status: formData.status,
        start_date: startDate,
        end_date: endDate
      })
    }
  }

  const isLoading = createMutation.isPending || updateMutation.isPending
  const isCompleted = sprint?.status === 'completed'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]" data-testid="sprint-form-dialog">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Sprint' : 'Create Sprint'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isCompleted && (
            <div className="rounded-md bg-yellow-50 p-3 text-sm text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200">
              Completed sprints cannot be modified.
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Sprint 1"
              disabled={isCompleted}
              data-testid="sprint-name-input"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="goal">Goal</Label>
            <Textarea
              id="goal"
              value={formData.goal}
              onChange={(e) => setFormData({ ...formData, goal: e.target.value })}
              placeholder="What do you want to achieve?"
              rows={2}
              disabled={isCompleted}
              data-testid="sprint-goal-input"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => setFormData({ ...formData, status: value as SprintStatus })}
              disabled={isCompleted}
            >
              <SelectTrigger data-testid="sprint-status-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="planning">Planning</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_date">Start Date</Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                disabled={isCompleted}
                data-testid="sprint-start-date-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_date">End Date</Label>
              <Input
                id="end_date"
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                disabled={isCompleted}
                data-testid="sprint-end-date-input"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || isCompleted} data-testid="sprint-submit-btn">
              {isLoading ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Sprint'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

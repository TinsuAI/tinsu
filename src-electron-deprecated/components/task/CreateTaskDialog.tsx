import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@renderer/components/ui/dialog'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Textarea } from '@renderer/components/ui/textarea'
import { Label } from '@renderer/components/ui/label'
import { useCreateTask } from '@renderer/hooks/useTaskCommands'
import { EpicSelect } from './EpicSelect'
import { SprintSelect } from './SprintSelect'
import type { TaskStatus } from '@shared/types/task.types'

interface CreateTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialStatus: TaskStatus
  /** Optional sprint ID to pre-select (from current filter) */
  initialSprintId?: string | null
  /** Project ID for new tasks */
  projectId: string
}

export function CreateTaskDialog({ open, onOpenChange, initialStatus, initialSprintId, projectId }: CreateTaskDialogProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [acceptanceCriteria, setAcceptanceCriteria] = useState('')
  const [titleError, setTitleError] = useState('')
  const [selectedEpicId, setSelectedEpicId] = useState<string | undefined>()
  const [selectedSprintId, setSelectedSprintId] = useState<string | undefined>(initialSprintId ?? undefined)

  const createTask = useCreateTask(projectId)

  const resetForm = () => {
    setTitle('')
    setDescription('')
    setAcceptanceCriteria('')
    setTitleError('')
    setSelectedEpicId(undefined)
    setSelectedSprintId(initialSprintId ?? undefined)
  }

  useEffect(() => {
    if (open) {
      // Set initial sprint when dialog opens
      setSelectedSprintId(initialSprintId ?? undefined)
    } else {
      resetForm()
    }
  }, [open, initialSprintId])

  const handleSubmit = () => {
    if (!title.trim()) {
      setTitleError('Title is required')
      return
    }

    createTask.mutate(
      { title: title.trim(), project_id: projectId },
      {
        onSuccess: () => {
          resetForm()
          onOpenChange(false)
        },
        onError: (error) => {
          toast.error('Failed to create task', {
            description: error.message
          })
        },
      }
    )
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]" onKeyDown={handleKeyDown}>
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
          <DialogDescription>
            Add a new task with title, description, and acceptance criteria.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value)
                setTitleError('')
              }}
              placeholder="Enter task title"
              autoFocus
              className={titleError ? 'border-destructive' : ''}
              data-testid="task-title-input"
            />
            {titleError && (
              <span className="text-sm text-destructive" data-testid="title-error">
                {titleError}
              </span>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter task description (optional)"
              rows={3}
              data-testid="task-description-input"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="acceptance-criteria">Acceptance Criteria</Label>
            <Textarea
              id="acceptance-criteria"
              value={acceptanceCriteria}
              onChange={(e) => setAcceptanceCriteria(e.target.value)}
              placeholder="- Given X, When Y, Then Z (optional, markdown supported)"
              rows={5}
              className="font-mono text-sm"
              data-testid="task-acceptance-criteria-input"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="epic">Epic</Label>
              <EpicSelect value={selectedEpicId} onValueChange={setSelectedEpicId} projectId={projectId} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sprint">Sprint</Label>
              <SprintSelect value={selectedSprintId} onValueChange={setSelectedSprintId} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            data-testid="cancel-button"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createTask.isPending}
            data-testid="create-button"
          >
            {createTask.isPending ? 'Creating...' : 'Create'}
            <span className="ml-2 text-xs text-muted-foreground">
              {navigator.platform.includes('Mac') ? '⌘↵' : 'Ctrl+Enter'}
            </span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

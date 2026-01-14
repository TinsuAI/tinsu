import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
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
import { trpc } from '@renderer/lib/trpc'
import { EpicSelect } from './EpicSelect'
import { SprintSelect } from './SprintSelect'
import type { Task, TaskStatus } from '@shared/types/task.types'

interface CreateTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialStatus: TaskStatus
  /** Optional sprint ID to pre-select (from current filter) */
  initialSprintId?: string | null
}

export function CreateTaskDialog({ open, onOpenChange, initialStatus, initialSprintId }: CreateTaskDialogProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [acceptanceCriteria, setAcceptanceCriteria] = useState('')
  const [titleError, setTitleError] = useState('')
  const [selectedEpicId, setSelectedEpicId] = useState<string | undefined>()
  const [selectedSprintId, setSelectedSprintId] = useState<string | undefined>(initialSprintId ?? undefined)

  const queryClient = useQueryClient()
  const utils = trpc.useUtils()
  const createTask = trpc.tasks.create.useMutation({
    // Optimistic update: immediately show new task in UI
    onMutate: async (newTask) => {
      // Cancel outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: [['tasks', 'getAll']] })

      // Snapshot current state for rollback
      const previousTasks = queryClient.getQueryData([['tasks', 'getAll']])

      // Optimistically add the new task to cache
      queryClient.setQueryData([['tasks', 'getAll']], (old: Task[] | undefined) => {
        if (!old) return old
        const optimisticTask: Task = {
          id: `temp-${Date.now()}`, // Temporary ID until server responds
          title: newTask.title,
          description: newTask.description ?? null,
          status: newTask.status ?? 'backlog',
          sort_order: 0, // New tasks go to top
          epic_id: newTask.epic_id ?? null,
          sprint_id: newTask.sprint_id ?? null,
          task_type: 'story',
          phase_number: null,
          phase_name: null,
          bmad_agent: null,
          bmad_workflow: null,
          is_start_here: null,
          artifact_path: null,
          story_number: null,
          story_file_path: null,
          story_file_status: null,
          full_content: null,
          project_id: null,
          created_at: new Date(),
          updated_at: new Date()
        }
        return [optimisticTask, ...old]
      })

      // Close dialog immediately for snappy UX
      resetForm()
      onOpenChange(false)

      return { previousTasks }
    },
    onSuccess: () => {
      // Refetch to get actual server data (with real ID)
      utils.tasks.getAll.invalidate()
    },
    onError: (error, _variables, context) => {
      // Rollback on error
      if (context?.previousTasks) {
        queryClient.setQueryData([['tasks', 'getAll']], context.previousTasks)
      }
      toast.error('Failed to create task', {
        description: error.message
      })
    },
    onSettled: () => {
      // Always refetch after mutation settles
      queryClient.invalidateQueries({ queryKey: [['tasks', 'getAll']] })
    }
  })

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

    // Combine description and acceptance criteria
    const fullDescription = acceptanceCriteria
      ? `${description}\n\n## Acceptance Criteria\n${acceptanceCriteria}`
      : description

    createTask.mutate({
      title: title.trim(),
      description: fullDescription || undefined,
      status: initialStatus,
      epic_id: selectedEpicId,
      sprint_id: selectedSprintId
    })
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
              <EpicSelect value={selectedEpicId} onValueChange={setSelectedEpicId} />
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

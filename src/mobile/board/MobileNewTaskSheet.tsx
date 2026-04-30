/**
 * MobileNewTaskSheet — bottom sheet for creating a new task.
 *
 * Uses MobileSheet at snapPoint='fit' with a title input and create action.
 * Title trimming + required-field validation matches CreateTaskDialog.tsx semantics.
 *
 * Note: initialStatus is captured but does NOT propagate to commands.createTask —
 * the Rust command signature is { title, project_id } only; new tasks always land
 * in 'backlog'. This is a documented v1 limitation (see story Dev Notes §initialStatus).
 * The pager scrolls back to backlog on success.
 *
 * Token contract: bg-background input surface, text-destructive inline errors.
 * No inline color classes.
 *
 * @param open          Controlled open state.
 * @param onOpenChange  Fired when sheet should open/close.
 * @param initialStatus Status of the column that triggered the sheet (v1: informational only).
 * @param projectId     Active project ID passed to useCreateTask.
 *
 * @example
 * <MobileNewTaskSheet
 *   open={sheetOpen}
 *   onOpenChange={setSheetOpen}
 *   initialStatus="in_progress"
 *   projectId={activeProjectId}
 * />
 */

import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { MobileSheet } from '../primitives/MobileSheet'
import { MobileBottomActionBar } from '../primitives/MobileBottomActionBar'
import { useCreateTask } from '@renderer/hooks/useTaskCommands'
import type { TaskStatus } from '@shared/types/task.types'

interface MobileNewTaskSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialStatus: TaskStatus
  projectId: string
}

export function MobileNewTaskSheet({
  open,
  onOpenChange,
  initialStatus: _initialStatus, // captured but not passed to Rust (v1 limitation)
  projectId,
}: MobileNewTaskSheetProps) {
  const [title, setTitle] = useState('')
  const [touched, setTouched] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const createTask = useCreateTask(projectId)

  // Reset form when sheet closes
  useEffect(() => {
    if (!open) {
      setTitle('')
      setTouched(false)
    } else {
      // Auto-focus input when sheet opens
      const timer = setTimeout(() => {
        inputRef.current?.focus()
      }, 150)
      return () => clearTimeout(timer)
    }
  }, [open])

  const trimmedTitle = title.trim()
  const showError = touched && !trimmedTitle
  // Button is disabled only during submission, not for empty input
  // (empty input shows inline error on submit attempt instead)
  const isDisabled = createTask.isPending

  const handleSubmit = () => {
    setTouched(true)
    if (!trimmedTitle) return

    createTask.mutate(
      { title: trimmedTitle, project_id: projectId },
      {
        onSuccess: () => {
          setTitle('')
          setTouched(false)
          onOpenChange(false)
        },
        onError: (err) => {
          toast.error('Failed to create task', {
            description: err.message,
          })
        },
      },
    )
  }

  return (
    <MobileSheet
      open={open}
      onOpenChange={onOpenChange}
      snapPoint="fit"
      title="New Task"
    >
      <div className="flex flex-col gap-3 pt-2 pb-2">
        {/* Title input */}
        <div className="flex flex-col gap-1">
          <label
            htmlFor="mobile-new-task-title"
            className="text-xs font-medium text-muted-foreground uppercase tracking-wide"
          >
            Title
          </label>
          <input
            ref={inputRef}
            id="mobile-new-task-title"
            data-testid="mobile-new-task-title-input"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => setTouched(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmit()
            }}
            placeholder="What needs to be done?"
            className="text-sm rounded-xl border border-border/40 bg-background px-3 py-2.5 w-full outline-none focus:ring-2 focus:ring-primary/50 text-foreground placeholder:text-muted-foreground"
            aria-invalid={showError}
            aria-describedby={showError ? 'mobile-new-task-title-error' : undefined}
            disabled={createTask.isPending}
          />
          {showError && (
            <p
              id="mobile-new-task-title-error"
              role="alert"
              data-testid="mobile-new-task-title-error"
              className="text-destructive text-xs mt-1"
            >
              Title is required
            </p>
          )}
        </div>
      </div>

      {/* Sticky action bar inside sheet body */}
      <MobileBottomActionBar
        primary={{
          label: createTask.isPending ? 'Creating…' : 'Create',
          onPress: handleSubmit,
          variant: 'primary',
          disabled: isDisabled,
        }}
      />
    </MobileSheet>
  )
}

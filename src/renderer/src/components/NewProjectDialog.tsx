import { useState } from 'react'
import { FolderOpen, Loader2 } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from './ui/dialog'
import { trpc } from '@renderer/lib/trpc'

const INVALID_CHARS_TEST = /[/\\:*?"<>|]/
const INVALID_CHARS_REPLACE = /[/\\:*?"<>|]/g

interface NewProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onProjectCreated: (info: { path: string; projectName: string }) => void
}

export function NewProjectDialog({ open, onOpenChange, onProjectCreated }: NewProjectDialogProps) {
  const [projectName, setProjectName] = useState('')
  const [parentDir, setParentDir] = useState<string | null>(null)
  const [nameError, setNameError] = useState<string | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)

  const selectDirMutation = trpc.project.selectParentDirectory.useMutation({
    onSuccess: (result) => {
      if (!result.canceled && result.path) {
        setParentDir(result.path)
        setCreateError(null)
      }
    }
  })

  const createMutation = trpc.project.create.useMutation({
    onSuccess: (result) => {
      onProjectCreated({ path: result.path, projectName: result.config.projectName })
      onOpenChange(false)
    },
    onError: (err) => {
      setCreateError(err.message || 'Failed to create project')
    }
  })

  const handleNameChange = (value: string) => {
    if (INVALID_CHARS_TEST.test(value)) {
      setNameError('Project name contains invalid characters')
    } else {
      setNameError(null)
    }
    setProjectName(value.replace(INVALID_CHARS_REPLACE, ''))
    setCreateError(null)
  }

  const handleCreate = () => {
    if (!parentDir || !projectName.trim()) return
    setCreateError(null)
    createMutation.mutate({ parentDir, projectName: projectName.trim() })
  }

  const isValid = projectName.trim().length > 0 && parentDir !== null && !nameError
  const isPending = createMutation.isPending
  const isLoading = isPending || selectDirMutation.isPending
  const fullPath = parentDir && projectName.trim() ? `${parentDir}/${projectName.trim()}` : null

  // Reset form state when dialog closes
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setProjectName('')
      setParentDir(null)
      setNameError(null)
      setCreateError(null)
    }
    onOpenChange(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
          <DialogDescription>
            Set up a new project folder with git initialized.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-1">
          {/* Project Name */}
          <div className="space-y-2">
            <Label htmlFor="project-name">Project Name</Label>
            <Input
              id="project-name"
              placeholder="my-project"
              value={projectName}
              onChange={(e) => handleNameChange(e.target.value)}
              disabled={isLoading}
              autoFocus
            />
            {nameError && (
              <p className="text-xs text-destructive">{nameError}</p>
            )}
          </div>

          {/* Parent Directory */}
          <div className="space-y-2">
            <Label>Location</Label>
            <div className="flex items-center gap-2">
              <div className="flex-1 truncate rounded-md border border-input bg-muted/50 px-3 py-2 font-mono text-sm text-muted-foreground">
                {parentDir ?? 'No folder selected'}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => selectDirMutation.mutate()}
                disabled={isLoading}
              >
                <FolderOpen className="mr-1.5 h-4 w-4" />
                Choose Folder
              </Button>
            </div>
          </div>

          {/* Path Preview */}
          {fullPath && (
            <div className="rounded-md border border-border/50 bg-muted/30 px-3 py-2">
              <p className="text-xs text-muted-foreground">
                Will be created at:
              </p>
              <code className="mt-0.5 block truncate font-mono text-sm text-foreground/80">
                {fullPath}
              </code>
            </div>
          )}

          {/* Create Error */}
          {createError && (
            <div className="rounded-md border-l-2 border-destructive bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              {createError}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="ghost"
            onClick={() => handleOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!isValid || isLoading}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Project'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

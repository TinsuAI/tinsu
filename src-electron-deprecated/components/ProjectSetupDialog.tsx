import React, { useState, useCallback } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from './ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from './ui/dialog'
import { ProjectBasicsStep } from './setup/ProjectBasicsStep'
import { ToolVerificationStep } from './setup/ToolVerificationStep'
import { useSelectParentDirectory, useCreateProject } from '@renderer/hooks/useProjectCommands'

interface ProjectSetupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onProjectCreated: (info: { path: string; projectId: string; projectName: string }) => void
  mode: 'create' | 'onboard'
  projectPath?: string // Required for onboard mode
}

export function ProjectSetupDialog({
  open,
  onOpenChange,
  onProjectCreated,
  mode,
  projectPath: initialProjectPath
}: ProjectSetupDialogProps): React.JSX.Element {
  const [step, setStep] = useState(1)

  // Step 1 state (create mode)
  const [projectName, setProjectName] = useState('')
  const [parentDir, setParentDir] = useState<string | null>(null)
  const [nameError, setNameError] = useState<string | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)

  // Step 2 state
  const [allCriticalPassed, setAllCriticalPassed] = useState(false)
  const [createdProjectPath, setCreatedProjectPath] = useState<string | null>(null)
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null)

  const effectiveProjectPath = initialProjectPath ?? createdProjectPath

  const selectDirMutation = useSelectParentDirectory()
  const createMutation = useCreateProject()

  const handleSelectDirectory = async (): Promise<void> => {
    selectDirMutation.mutate(undefined, {
      onSuccess: (result) => {
        if (result) {
          setParentDir(result)
          setCreateError(null)
        }
      },
    })
  }

  const handleCreateAndNext = async (): Promise<void> => {
    if (!parentDir || !projectName.trim()) return
    setCreateError(null)
    try {
      const result = await createMutation.mutateAsync({
        parentDir,
        projectName: projectName.trim(),
      })
      setCreatedProjectPath(result.path)
      setCreatedProjectId(result.id)
      setStep(2)
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create project')
    }
  }

  const handleContinue = (): void => {
    if (!effectiveProjectPath) return
    const name =
      mode === 'onboard'
        ? effectiveProjectPath.split('/').pop() ?? 'Project'
        : projectName.trim()
    onProjectCreated({
      path: effectiveProjectPath,
      projectId: createdProjectId ?? '',
      projectName: name,
    })
  }

  const handleOpenChange = useCallback(
    (nextOpen: boolean): void => {
      if (!nextOpen) {
        setStep(1)
        setProjectName('')
        setParentDir(null)
        setNameError(null)
        setCreateError(null)
        setAllCriticalPassed(false)
        setCreatedProjectPath(null)
        setCreatedProjectId(null)
      }
      onOpenChange(nextOpen)
    },
    [onOpenChange]
  )

  const isStep1Valid = projectName.trim().length > 0 && parentDir !== null && !nameError
  const isCreating = createMutation.isPending || selectDirMutation.isPending

  // Determine header content based on step and mode
  let dialogTitle: string
  let dialogDescription: string
  if (mode === 'create' && step === 1) {
    dialogTitle = 'Create New Project'
    dialogDescription = 'Set up a new project folder with git initialized.'
  } else if (mode === 'create' && step === 2) {
    dialogTitle = 'Tool Verification'
    dialogDescription = 'Verify tools and configure your project.'
  } else {
    // onboard mode — always step 2
    dialogTitle = 'Project Setup'
    dialogDescription = 'Verify required tools are installed before continuing.'
  }

  // In onboard mode, always show step 2
  const effectiveStep = mode === 'onboard' ? 2 : step

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          {mode === 'create' && (
            <p className="text-xs text-muted-foreground mt-1">
              <span className={step === 1 ? 'font-semibold text-foreground' : ''}>
                1. Project
              </span>
              {' → '}
              <span className={step === 2 ? 'font-semibold text-foreground' : ''}>2. Tools</span>
            </p>
          )}
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>

        <div className="py-1">
          {effectiveStep === 1 && (
            <>
              <ProjectBasicsStep
                projectName={projectName}
                onProjectNameChange={setProjectName}
                parentDir={parentDir}
                onSelectDirectory={handleSelectDirectory}
                nameError={nameError}
                onNameErrorChange={setNameError}
                disabled={isCreating}
              />

              {createError && (
                <div className="mt-4 rounded-md border-l-2 border-destructive bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                  {createError}
                </div>
              )}
            </>
          )}

          {effectiveStep === 2 && effectiveProjectPath && (
            <ToolVerificationStep
              projectPath={effectiveProjectPath}
              onAllCriticalPassed={setAllCriticalPassed}
            />
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {effectiveStep === 1 && (
            <>
              <Button
                variant="ghost"
                onClick={() => handleOpenChange(false)}
                disabled={isCreating}
              >
                Cancel
              </Button>
              <Button onClick={handleCreateAndNext} disabled={!isStep1Valid || isCreating}>
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Next'
                )}
              </Button>
            </>
          )}

          {effectiveStep === 2 && (
            <>
              {mode === 'create' ? (
                <Button variant="ghost" onClick={() => setStep(1)}>
                  Back
                </Button>
              ) : (
                <Button variant="ghost" onClick={() => handleOpenChange(false)}>
                  Cancel
                </Button>
              )}
              <Button onClick={handleContinue} disabled={!allCriticalPassed}>
                Continue
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

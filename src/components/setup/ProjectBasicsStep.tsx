/**
 * ProjectBasicsStep
 *
 * Extracted project name + directory selector form step.
 * Handles project name validation (strips invalid filesystem chars) and
 * renders a location picker with a path preview.
 */

import React from 'react'
import { FolderOpen } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'

export const INVALID_CHARS_TEST = /[/\\:*?"<>|]/
export const INVALID_CHARS_REPLACE = /[/\\:*?"<>|]/g

export interface ProjectBasicsStepProps {
  projectName: string
  onProjectNameChange: (value: string) => void
  parentDir: string | null
  onSelectDirectory: () => void
  nameError: string | null
  onNameErrorChange: (error: string | null) => void
  disabled: boolean
}

export function ProjectBasicsStep({
  projectName,
  onProjectNameChange,
  parentDir,
  onSelectDirectory,
  nameError,
  onNameErrorChange,
  disabled
}: ProjectBasicsStepProps): React.JSX.Element {
  const fullPath = parentDir && projectName.trim() ? `${parentDir}/${projectName.trim()}` : null

  const handleNameChange = (value: string): void => {
    if (INVALID_CHARS_TEST.test(value)) {
      onNameErrorChange('Project name contains invalid characters')
    } else {
      onNameErrorChange(null)
    }
    onProjectNameChange(value.replace(INVALID_CHARS_REPLACE, ''))
  }

  return (
    <div className="space-y-5">
      {/* Project Name */}
      <div className="space-y-2">
        <Label htmlFor="project-name">Project Name</Label>
        <Input
          id="project-name"
          placeholder="my-project"
          value={projectName}
          onChange={(e) => handleNameChange(e.target.value)}
          disabled={disabled}
          autoFocus
        />
        {nameError && <p className="text-xs text-destructive">{nameError}</p>}
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
            onClick={onSelectDirectory}
            disabled={disabled}
          >
            <FolderOpen className="mr-1.5 h-4 w-4" />
            Choose Folder
          </Button>
        </div>
      </div>

      {/* Path Preview */}
      {fullPath && (
        <div className="rounded-md border border-border/50 bg-muted/30 px-3 py-2">
          <p className="text-xs text-muted-foreground">Will be created at:</p>
          <code className="mt-0.5 block truncate font-mono text-sm text-foreground/80">
            {fullPath}
          </code>
        </div>
      )}
    </div>
  )
}

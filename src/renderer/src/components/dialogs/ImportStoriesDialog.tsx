import { useState, useEffect } from 'react'
import { Loader2, FolderOpen, CheckCircle2, AlertCircle } from 'lucide-react'
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
import { Label } from '@renderer/components/ui/label'
import { trpc } from '@renderer/lib/trpc'
import { useStoryImport } from '@renderer/hooks/useStoryImport'

/**
 * Props for ImportStoriesDialog component.
 */
interface ImportStoriesDialogProps {
  /** Whether the dialog is open */
  open: boolean
  /** Callback when the open state changes */
  onOpenChange: (open: boolean) => void
  /** Project ID to import stories into */
  projectId: string
  /** Default path for the epics.md file (usually from planning artifacts) */
  defaultPath?: string
  /** Callback when import succeeds */
  onSuccess?: (result: { epicsCreated: number; storiesCreated: number }) => void
}

/**
 * Dialog for importing stories from an epics.md file.
 *
 * Provides a file path input with browse button to select an epics.md file
 * and import its contents as epics and story tasks.
 *
 * Story 3.7: Story Import After Epics Phase (AC: 6)
 *
 * @example
 * ```tsx
 * <ImportStoriesDialog
 *   open={dialogOpen}
 *   onOpenChange={setDialogOpen}
 *   projectId="project-123"
 *   defaultPath="/project/_bmad-output/planning-artifacts/epics.md"
 *   onSuccess={(result) => console.log(`Imported ${result.storiesCreated} stories`)}
 * />
 * ```
 */
export function ImportStoriesDialog({
  open,
  onOpenChange,
  projectId,
  defaultPath = '',
  onSuccess
}: ImportStoriesDialogProps) {
  const [filePath, setFilePath] = useState(defaultPath)
  const [statusFilePath, setStatusFilePath] = useState('')
  const [pathError, setPathError] = useState('')
  const [isAutoDetected, setIsAutoDetected] = useState({ epics: false, status: false })

  const { importStoriesAsync, isImporting, reset } = useStoryImport()

  // Auto-detect import files
  const { data: detectedFiles, isLoading: isDetecting } = trpc.config.detectImportFiles.useQuery(
    undefined,
    { enabled: open }
  )

  const openEpicsFilePicker = trpc.config.showOpenDialog.useMutation({
    onSuccess: (path) => {
      if (path) {
        setFilePath(path)
        setPathError('')
        setIsAutoDetected((prev) => ({ ...prev, epics: false }))
      }
    }
  })

  const openStatusFilePicker = trpc.config.showOpenDialog.useMutation({
    onSuccess: (path) => {
      if (path) {
        setStatusFilePath(path)
        setIsAutoDetected((prev) => ({ ...prev, status: false }))
      }
    }
  })

  // Reset state and apply auto-detected paths when dialog opens
  useEffect(() => {
    if (open) {
      setPathError('')
      reset()

      // Apply auto-detected paths if available
      if (detectedFiles) {
        if (detectedFiles.epicsPath) {
          setFilePath(detectedFiles.epicsPath)
          setIsAutoDetected((prev) => ({ ...prev, epics: true }))
        } else {
          setFilePath(defaultPath)
          setIsAutoDetected((prev) => ({ ...prev, epics: false }))
        }

        if (detectedFiles.statusPath) {
          setStatusFilePath(detectedFiles.statusPath)
          setIsAutoDetected((prev) => ({ ...prev, status: true }))
        } else {
          setStatusFilePath('')
          setIsAutoDetected((prev) => ({ ...prev, status: false }))
        }
      }
    }
  }, [open, defaultPath, reset, detectedFiles])

  const handleImport = async () => {
    if (!filePath.trim()) {
      setPathError('Please select an epics.md file')
      return
    }

    try {
      const result = await importStoriesAsync(
        projectId,
        filePath,
        statusFilePath.trim() || undefined
      )
      onSuccess?.(result)
      onOpenChange(false)
    } catch {
      // Error is handled by the hook via toast
    }
  }

  const handleBrowseEpics = () => {
    openEpicsFilePicker.mutate({
      filters: [{ name: 'Markdown', extensions: ['md'] }],
      title: 'Select epics.md File'
    })
  }

  const handleBrowseStatus = () => {
    openStatusFilePicker.mutate({
      filters: [{ name: 'YAML', extensions: ['yaml', 'yml'] }],
      title: 'Select sprint-status.yaml File'
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handleImport()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" onKeyDown={handleKeyDown}>
        <DialogHeader>
          <DialogTitle>Import Stories from epics.md</DialogTitle>
          <DialogDescription>
            Select your epics.md file to import all epics and stories to the Kanban board.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {/* Auto-detection status banner */}
          {isDetecting ? (
            <div className="flex items-center gap-2 rounded-md bg-muted p-3 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Detecting BMAD files...</span>
            </div>
          ) : (
            <div className="flex flex-col gap-1 rounded-md bg-muted p-3 text-sm">
              <div className="flex items-center gap-2">
                {detectedFiles?.epicsPath ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-yellow-500" />
                )}
                <span>
                  epics.md:{' '}
                  {detectedFiles?.epicsPath ? (
                    <span className="text-green-500">Found</span>
                  ) : (
                    <span className="text-yellow-500">Not found (please select manually)</span>
                  )}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {detectedFiles?.statusPath ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                )}
                <span>
                  sprint-status.yaml:{' '}
                  {detectedFiles?.statusPath ? (
                    <span className="text-green-500">Found</span>
                  ) : (
                    <span className="text-muted-foreground">
                      Not found (stories will import to Backlog)
                    </span>
                  )}
                </span>
              </div>
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="epicsPath" className="flex items-center gap-2">
              Epics File Path
              {isAutoDetected.epics && (
                <span className="rounded bg-green-500/20 px-1.5 py-0.5 text-xs text-green-500">
                  Auto-detected
                </span>
              )}
            </Label>
            <div className="flex gap-2">
              <Input
                id="epicsPath"
                value={filePath}
                onChange={(e) => {
                  setFilePath(e.target.value)
                  setPathError('')
                  setIsAutoDetected((prev) => ({ ...prev, epics: false }))
                }}
                placeholder="_bmad-output/planning-artifacts/epics.md"
                className={pathError ? 'border-destructive flex-1' : 'flex-1'}
                data-testid="epics-path-input"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleBrowseEpics}
                disabled={openEpicsFilePicker.isPending}
                title="Browse for file"
                data-testid="browse-epics-button"
              >
                <FolderOpen className="h-4 w-4" />
              </Button>
            </div>
            {pathError && (
              <span className="text-sm text-destructive" data-testid="path-error">
                {pathError}
              </span>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="statusPath" className="flex items-center gap-2">
              Status File Path{' '}
              <span className="text-muted-foreground font-normal">(optional)</span>
              {isAutoDetected.status && (
                <span className="rounded bg-green-500/20 px-1.5 py-0.5 text-xs text-green-500">
                  Auto-detected
                </span>
              )}
            </Label>
            <div className="flex gap-2">
              <Input
                id="statusPath"
                value={statusFilePath}
                onChange={(e) => {
                  setStatusFilePath(e.target.value)
                  setIsAutoDetected((prev) => ({ ...prev, status: false }))
                }}
                placeholder="_bmad-output/implementation-artifacts/sprint-status.yaml"
                className="flex-1"
                data-testid="status-path-input"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleBrowseStatus}
                disabled={openStatusFilePicker.isPending}
                title="Browse for status file"
                data-testid="browse-status-button"
              >
                <FolderOpen className="h-4 w-4" />
              </Button>
            </div>
            <span className="text-xs text-muted-foreground">
              Maps story statuses from sprint-status.yaml to Kanban columns.
            </span>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isImporting}
            data-testid="cancel-button"
          >
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={isImporting}
            data-testid="import-button"
          >
            {isImporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isImporting ? 'Importing...' : 'Import'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

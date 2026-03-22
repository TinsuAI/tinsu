import { useState } from 'react'
import { FolderOpen, Loader2, AlertTriangle, Package } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Checkbox } from './ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
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

export function NewProjectDialog({
  open,
  onOpenChange,
  onProjectCreated
}: NewProjectDialogProps): JSX.Element {
  const [projectName, setProjectName] = useState('')
  const [parentDir, setParentDir] = useState<string | null>(null)
  const [nameError, setNameError] = useState<string | null>(null)
  const [createError, setCreateError] = useState<string | null>(null)

  // BMAD state
  const [installBmad, setInstallBmad] = useState(true)
  const [bmadModules, setBmadModules] = useState<string[]>(['core', 'bmm'])
  const [bmadTools, setBmadTools] = useState<string[]>([])
  const [userName, setUserName] = useState('')
  const [language, setLanguage] = useState('English')

  // BMAD queries
  const { data: nodeStatus } = trpc.bmad.checkNodejs.useQuery()
  const { data: available } = trpc.bmad.availableModules.useQuery()

  const selectDirMutation = trpc.project.selectParentDirectory.useMutation({
    onSuccess: (result) => {
      if (!result.canceled && result.path) {
        setParentDir(result.path)
        setCreateError(null)
      }
    }
  })

  const createMutation = trpc.project.create.useMutation()
  const bmadInstallMutation = trpc.bmad.installToPath.useMutation()

  const handleNameChange = (value: string): void => {
    if (INVALID_CHARS_TEST.test(value)) {
      setNameError('Project name contains invalid characters')
    } else {
      setNameError(null)
    }
    setProjectName(value.replace(INVALID_CHARS_REPLACE, ''))
    setCreateError(null)
  }

  const handleCreate = async (): Promise<void> => {
    if (!parentDir || !projectName.trim()) return
    setCreateError(null)
    try {
      const result = await createMutation.mutateAsync({
        parentDir,
        projectName: projectName.trim()
      })
      if (installBmad) {
        try {
          await bmadInstallMutation.mutateAsync({
            projectPath: result.path,
            modules: bmadModules,
            tools: bmadTools,
            userName: userName || projectName.trim(),
            communicationLanguage: language,
            documentOutputLanguage: language,
            outputFolder: '_bmad-output'
          })
        } catch {
          toast.error('BMAD setup failed — you can retry from Settings')
        }
      }
      onProjectCreated({ path: result.path, projectName: result.config.projectName })
      onOpenChange(false)
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create project')
    }
  }

  // Module/tool toggle helpers
  const toggleModule = (moduleId: string): void => {
    setBmadModules((prev) =>
      prev.includes(moduleId) ? prev.filter((m) => m !== moduleId) : [...prev, moduleId]
    )
  }

  const toggleTool = (toolId: string): void => {
    setBmadTools((prev) =>
      prev.includes(toolId) ? prev.filter((t) => t !== toolId) : [...prev, toolId]
    )
  }

  const isValid = projectName.trim().length > 0 && parentDir !== null && !nameError
  const isPending = createMutation.isPending || bmadInstallMutation.isPending
  const isLoading = isPending || selectDirMutation.isPending
  const fullPath = parentDir && projectName.trim() ? `${parentDir}/${projectName.trim()}` : null

  const nodeInstalled = nodeStatus?.installed ?? true
  const modules = available?.modules ?? []
  const tools = available?.tools ?? []
  const languages = available?.languages ?? ['English']

  // Reset form state when dialog closes
  const handleOpenChange = (nextOpen: boolean): void => {
    if (!nextOpen) {
      setProjectName('')
      setParentDir(null)
      setNameError(null)
      setCreateError(null)
      setInstallBmad(true)
      setBmadModules(['core', 'bmm'])
      setBmadTools([])
      setUserName('')
      setLanguage('English')
    }
    onOpenChange(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
          <DialogDescription>Set up a new project folder with git initialized.</DialogDescription>
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
              <p className="text-xs text-muted-foreground">Will be created at:</p>
              <code className="mt-0.5 block truncate font-mono text-sm text-foreground/80">
                {fullPath}
              </code>
            </div>
          )}

          {/* BMAD Setup Section */}
          <div className="space-y-4">
            <hr className="border-border/40" />

            <div className="flex items-center gap-3">
              <Checkbox
                id="install-bmad"
                checked={installBmad}
                onCheckedChange={(checked) => setInstallBmad(checked === true)}
                data-testid="install-bmad-checkbox"
              />
              <label
                htmlFor="install-bmad"
                className="flex items-center gap-2 text-sm font-medium cursor-pointer select-none"
              >
                <Package className="h-4 w-4 text-muted-foreground" />
                Initialize BMAD Framework
              </label>
            </div>

            {installBmad && (
              <>
                {!nodeInstalled ? (
                  /* Node.js not installed warning */
                  <div
                    className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3"
                    data-testid="node-warning"
                  >
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
                    <p className="text-sm text-amber-300">
                      Node.js is required to install BMAD. Install it from project settings after
                      creation.
                    </p>
                  </div>
                ) : (
                  /* BMAD configuration form */
                  <fieldset
                    disabled={isPending}
                    className="space-y-4 rounded-lg border border-border/30 bg-muted/20 p-4"
                    data-testid="bmad-config-section"
                  >
                    {/* User Name */}
                    <div className="space-y-1.5">
                      <Label htmlFor="bmad-username" className="text-sm font-medium">
                        User Name
                      </Label>
                      <Input
                        id="bmad-username"
                        placeholder="Your name (used in BMAD templates)"
                        value={userName}
                        onChange={(e) => setUserName(e.target.value)}
                        data-testid="bmad-username-input"
                      />
                    </div>

                    {/* Modules */}
                    {modules.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Modules</Label>
                        <div className="grid grid-cols-2 gap-2">
                          {modules.map((mod) => (
                            <label
                              key={mod.id}
                              className="flex items-center gap-2 rounded-md border border-input px-3 py-2 text-sm cursor-pointer transition-colors hover:bg-accent/50"
                            >
                              <Checkbox
                                checked={bmadModules.includes(mod.id)}
                                onCheckedChange={() => toggleModule(mod.id)}
                                data-testid={`module-checkbox-${mod.id}`}
                              />
                              <span>{mod.name}</span>
                              {mod.builtIn && (
                                <span className="ml-auto text-[10px] text-muted-foreground uppercase tracking-wider">
                                  built-in
                                </span>
                              )}
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Tools / IDE */}
                    {tools.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Tools / IDE</Label>
                        <div className="grid grid-cols-2 gap-2">
                          {tools.map((tool) => (
                            <label
                              key={tool.id}
                              className="flex items-center gap-2 rounded-md border border-input px-3 py-2 text-sm cursor-pointer transition-colors hover:bg-accent/50"
                            >
                              <Checkbox
                                checked={bmadTools.includes(tool.id)}
                                onCheckedChange={() => toggleTool(tool.id)}
                                data-testid={`tool-checkbox-${tool.id}`}
                              />
                              <span>{tool.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Language */}
                    <div className="space-y-1.5">
                      <Label htmlFor="bmad-language" className="text-sm font-medium">
                        Language
                      </Label>
                      <Select value={language} onValueChange={setLanguage}>
                        <SelectTrigger id="bmad-language" data-testid="bmad-language-select">
                          <SelectValue placeholder="Select language" />
                        </SelectTrigger>
                        <SelectContent>
                          {languages.map((lang) => (
                            <SelectItem key={lang} value={lang}>
                              {lang}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </fieldset>
                )}
              </>
            )}
          </div>

          {/* Create Error */}
          {createError && (
            <div className="rounded-md border-l-2 border-destructive bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              {createError}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => handleOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!isValid || isLoading}>
            {bmadInstallMutation.isPending ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                Installing BMAD...
              </>
            ) : createMutation.isPending ? (
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

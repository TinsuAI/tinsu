import { useState } from 'react'
import { ChevronDown, FolderOpen, AlertTriangle, Trash2, MoreHorizontal } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { trpc } from '@renderer/lib/trpc'
import { useProjectStore } from '@renderer/stores/project.store'
import { Button } from '@renderer/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@renderer/components/ui/popover'
import { toast } from 'sonner'
// NewProjectDialog import removed - component not currently used

export function ProjectSwitcher() {
  const [open, setOpen] = useState(false)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const projectName = useProjectStore((state) => state.projectName)
  const projectPath = useProjectStore((state) => state.projectPath)
  const setProject = useProjectStore((state) => state.setProject)

  const utils = trpc.useUtils()

  // Fetch recent projects (only when popover is open)
  const { data: recentProjects, isLoading } = trpc.project.getRecent.useQuery(
    { limit: 10 },
    { enabled: open }
  )

  // Validate paths for recent projects
  const paths = recentProjects?.map((p) => p.path) ?? []
  const validationQueries = trpc.useQueries((t) =>
    paths.map((path) =>
      t.project.validatePath(
        { path },
        {
          enabled: open && paths.length > 0,
          staleTime: 60000 // Cache for 1 minute
        }
      )
    )
  )

  // Create a map of path -> isValid
  const pathValidation = new Map<string, boolean>()
  paths.forEach((path, index) => {
    pathValidation.set(path, validationQueries[index]?.data ?? true)
  })

  // Open project mutation
  const openProjectMutation = trpc.project.openPath.useMutation({
    onSuccess: (result) => {
      setProject(result.path, result.config.projectName)
      setOpen(false)
      utils.invalidate()
      toast.success(`Opened ${result.config.projectName}`)
    },
    onError: (err) => {
      toast.error(`Failed to open project: ${err.message}`)
    }
  })

  // Remove project mutation
  const removeProjectMutation = trpc.project.remove.useMutation({
    onSuccess: () => {
      utils.project.getRecent.invalidate()
      toast.success('Project removed from recent list')
    },
    onError: (err) => {
      toast.error(`Failed to remove project: ${err.message}`)
    }
  })

  // Open file dialog mutation
  const openDialogMutation = trpc.project.open.useMutation({
    onSuccess: (result) => {
      if (result) {
        setProject(result.path, result.config.projectName)
        setOpen(false)
        utils.invalidate()
        toast.success(`Opened ${result.config.projectName}`)
      }
      // If result is null, dialog was cancelled - do nothing
    },
    onError: (err) => {
      toast.error(`Failed to open project: ${err.message}`)
    }
  })

  const handleOpenAnotherProject = () => {
    openDialogMutation.mutate()
  }

  const handleSwitchProject = (path: string) => {
    if (path === projectPath) {
      setOpen(false)
      return
    }

    // Check if path is valid
    if (!pathValidation.get(path)) {
      toast.error('Project folder not found. It may have been moved or deleted.')
      return
    }

    openProjectMutation.mutate({ path })
  }

  const handleRemoveProject = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    removeProjectMutation.mutate({ id })
    setMenuOpenId(null)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className="flex items-center gap-1 px-2 h-auto py-1"
          data-testid="project-switcher-trigger"
        >
          <span className="font-medium text-muted-foreground">{projectName || 'No Project'}</span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-2" align="start">
        <div className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Recent Projects
        </div>

        {isLoading ? (
          <div className="px-2 py-4 text-sm text-muted-foreground">Loading...</div>
        ) : recentProjects?.length === 0 ? (
          <div className="px-2 py-4 text-sm text-muted-foreground">No recent projects</div>
        ) : (
          <div className="flex flex-col gap-1">
            {recentProjects?.map((project) => {
              const isCurrent = project.path === projectPath
              const isValid = pathValidation.get(project.path) ?? true

              return (
                <div
                  key={project.id}
                  className={cn(
                    'group flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors',
                    'hover:bg-accent hover:text-accent-foreground',
                    isCurrent && 'bg-accent/50'
                  )}
                >
                  <button
                    onClick={() => handleSwitchProject(project.path)}
                    className="flex flex-1 items-center gap-2 text-left"
                    disabled={openProjectMutation.isPending || isCurrent}
                  >
                    <FolderOpen className="h-4 w-4 shrink-0" />
                    <div className="flex-1 overflow-hidden">
                      <div className="truncate text-sm font-medium">{project.name}</div>
                      <div className="truncate text-xs text-muted-foreground">{project.path}</div>
                    </div>
                    {!isValid && (
                      <span title="Project folder not found">
                        <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />
                      </span>
                    )}
                    {isCurrent && (
                      <span className="text-xs text-muted-foreground shrink-0">(current)</span>
                    )}
                  </button>

                  {/* Actions menu */}
                  <Popover
                    open={menuOpenId === project.id}
                    onOpenChange={(isOpen) => setMenuOpenId(isOpen ? project.id : null)}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-32 p-1" align="end">
                      <button
                        onClick={(e) => handleRemoveProject(e, project.id)}
                        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3 w-3" />
                        Remove
                      </button>
                    </PopoverContent>
                  </Popover>
                </div>
              )
            })}
          </div>
        )}

        <div className="mt-2 border-t pt-2">
          <button
            onClick={handleOpenAnotherProject}
            disabled={openDialogMutation.isPending}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
          >
            <FolderOpen className="h-4 w-4" />
            {openDialogMutation.isPending ? 'Opening...' : 'Open Another Project...'}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

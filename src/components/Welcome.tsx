import { useState } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { FolderOpen, Clock, AlertTriangle, Trash2, Plus, Server } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { Button } from './ui/button'
import { ThemeToggle } from './ui/theme-toggle'
import { ProjectSetupDialog } from './ProjectSetupDialog'
import { OpenRemoteProjectDialog } from './project/OpenRemoteProjectDialog'
import { commands } from '@renderer/lib/rspc'
import { cn } from '@renderer/lib/utils'
import {
  useListRecentProjects,
  useOpenProjectByPath,
  useRemoveProject,
  useSelectParentDirectory,
  projectQueryKeys,
} from '@renderer/hooks/useProjectCommands'

interface ProjectOpenedInfo {
  path: string
  projectId: string
  projectName: string
  needsOnboarding?: boolean
  remoteProjectId?: string | null
  remoteConnectionId?: string | null
}

interface WelcomeProps {
  onProjectOpened: (info: ProjectOpenedInfo) => void
  className?: string
}

/**
 * Welcome screen displayed when no project is loaded.
 * Allows user to open an existing git repository.
 */
export function Welcome({ onProjectOpened, className }: WelcomeProps) {
  const [error, setError] = useState<string | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isRemoteDialogOpen, setIsRemoteDialogOpen] = useState(false)

  // Query for recent projects
  const { data: recentProjects } = useListRecentProjects(5)

  // Fetch remote project profiles to resolve connection_id → ssh label
  const { data: remoteProfiles } = useQuery({
    queryKey: ['remoteProjects'],
    queryFn: async () => {
      const result = await commands.listRemoteProjects()
      if (result.status === 'error') return []
      return result.data
    },
    staleTime: 60000,
  })

  // Fetch SSH connections to resolve host/username
  const { data: sshConnections } = useQuery({
    queryKey: ['sshConnections'],
    queryFn: async () => {
      const result = await commands.listSshConnections()
      if (result.status === 'error') return []
      return result.data
    },
    staleTime: 60000,
  })

  // Build lookup: remote_project_id → "user@host" (or "user@host:port" if non-22)
  const sshLabelByRemoteProjectId = new Map<string, string>()
  if (remoteProfiles && sshConnections) {
    const connById = new Map(sshConnections.map((c) => [c.id, c]))
    for (const rp of remoteProfiles) {
      const conn = connById.get(rp.connection_id)
      if (conn) {
        const label =
          conn.port === 22
            ? `${conn.username}@${conn.host}`
            : `${conn.username}@${conn.host}:${conn.port}`
        sshLabelByRemoteProjectId.set(rp.id, label)
      }
    }
  }

  // Only validate local project paths (remote paths live on the SSH host)
  const localProjects = (recentProjects ?? []).filter((p) => !p.remote_project_id)
  const localPaths = localProjects.map((p) => p.path)

  const validationQueries = useQueries({
    queries: localPaths.map((path) => ({
      queryKey: projectQueryKeys.validate(path),
      queryFn: async () => {
        const result = await commands.validateProjectPath(path)
        if (result.status === 'error') return true
        return result.data
      },
      enabled: localPaths.length > 0,
      staleTime: 60000,
    })),
  })

  // Map of local path → isValid
  const pathValidation = new Map<string, boolean>()
  localPaths.forEach((path, index) => {
    pathValidation.set(path, validationQueries[index]?.data ?? true)
  })

  const selectDirMutation = useSelectParentDirectory()
  const openByPathMutation = useOpenProjectByPath()
  const removeProjectMutation = useRemoveProject()

  const isLoading =
    selectDirMutation.isPending || openByPathMutation.isPending

  const handleOpenProject = async () => {
    setError(null)
    try {
      const path = await selectDirMutation.mutateAsync(undefined)
      if (!path) return // user cancelled

      // Check if this folder has a .tinsu/config.yaml
      const validateResult = await commands.validateProjectPath(path)
      const hasConfig = validateResult.status === 'ok' && validateResult.data

      if (!hasConfig) {
        // No config — needs onboarding / first-time setup
        onProjectOpened({ path, projectId: '', projectName: '', needsOnboarding: true })
        return
      }

      const project = await openByPathMutation.mutateAsync(path)
      onProjectOpened({ path: project.path, projectId: project.id, projectName: project.name })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open project')
    }
  }

  const handleOpenRecent = async (projectId: string, path: string, remoteProjectId: string | null) => {
    setError(null)
    try {
      if (remoteProjectId) {
        // Remote project: open via remote_project_id (no local path check)
        const result = await commands.openRemoteProject(remoteProjectId)
        if (result.status === 'error') throw new Error(JSON.stringify(result.error))
        const project = result.data
        const remoteProfile = remoteProfiles?.find((p) => p.id === remoteProjectId)
        onProjectOpened({
          path: project.path,
          projectId: project.id,
          projectName: project.name,
          remoteProjectId,
          remoteConnectionId: remoteProfile?.connection_id ?? null,
        })
      } else {
        // Local project: validate path first
        const isValid = pathValidation.get(path) ?? true
        if (!isValid) {
          setError('Project folder not found. It may have been moved or deleted.')
          return
        }
        const project = await openByPathMutation.mutateAsync(path)
        onProjectOpened({ path: project.path, projectId: project.id, projectName: project.name })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open project')
    }
  }

  const handleRemoveProject = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    removeProjectMutation.mutate(id)
  }

  return (
    <div
      className={cn(
        'relative flex min-h-screen flex-col items-center justify-center bg-background p-8',
        className
      )}
    >
      {/* Theme toggle - top right corner */}
      <div className="absolute right-6 top-6">
        <ThemeToggle />
      </div>

      {/* Logo/Title */}
      <div className="mb-8 text-center">
        <h1 className="text-5xl font-bold text-foreground">TinSu</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          AI-Powered Development Workflow Manager
        </p>
      </div>

      {/* Action Card */}
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 shadow-lg">
        <h2 className="mb-4 text-xl font-semibold text-card-foreground">Get Started</h2>

        <div className="flex flex-col gap-2.5">
          <Button
            onClick={handleOpenProject}
            disabled={isLoading}
            className="w-full"
            size="lg"
          >
            {isLoading ? 'Opening...' : 'Open Existing Project'}
          </Button>

          <Button
            variant="outline"
            onClick={() => setIsCreateDialogOpen(true)}
            disabled={isLoading}
            className="w-full"
            size="lg"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Create New Project
          </Button>

          <Button
            variant="outline"
            onClick={() => setIsRemoteDialogOpen(true)}
            disabled={isLoading}
            className="w-full"
            size="lg"
          >
            <Server className="mr-1.5 h-4 w-4" />
            Open Remote Project
          </Button>
        </div>

        {/* Hint text */}
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Open an existing git repository or create a new project
        </p>

        {/* Error display */}
        {error && (
          <div className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
      </div>

      {/* Recent Projects Section */}
      {recentProjects && recentProjects.length > 0 && (
        <div className="mt-6 w-full max-w-md">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Clock className="h-4 w-4" />
            Recent Projects
          </h3>
          <div className="divide-y divide-border rounded-lg border border-border bg-card">
            {recentProjects.map((project) => {
              const isRemote = !!project.remote_project_id
              const isValid = isRemote ? true : (pathValidation.get(project.path) ?? true)
              const sshLabel = isRemote && project.remote_project_id
                ? sshLabelByRemoteProjectId.get(project.remote_project_id)
                : undefined

              return (
                <div
                  key={project.id}
                  className="group flex items-center gap-3 px-4 py-3 transition-colors first:rounded-t-lg last:rounded-b-lg hover:bg-accent"
                >
                  <button
                    onClick={() => handleOpenRecent(project.id, project.path, project.remote_project_id)}
                    disabled={isLoading}
                    className="flex flex-1 items-center gap-3 text-left disabled:opacity-50"
                  >
                    {isRemote ? (
                      <Server className="h-5 w-5 shrink-0 text-blue-500" />
                    ) : (
                      <FolderOpen className="h-5 w-5 shrink-0 text-muted-foreground" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{project.name}</div>
                      <div className="truncate text-xs text-muted-foreground">{project.path}</div>
                      {sshLabel && (
                        <div className="mt-0.5 flex items-center gap-1 text-xs text-blue-500">
                          <Server className="h-3 w-3 shrink-0" />
                          <span className="truncate">{sshLabel}</span>
                        </div>
                      )}
                    </div>
                    {!isValid && (
                      <span title="Project folder not found">
                        <AlertTriangle className="h-4 w-4 shrink-0 text-yellow-500" />
                      </span>
                    )}
                    {project.last_opened_at && (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(project.last_opened_at * 1000), {
                          addSuffix: true,
                        })}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={(e) => handleRemoveProject(e, project.id)}
                    className="shrink-0 rounded p-1 opacity-0 transition-opacity hover:bg-destructive/10 group-hover:opacity-100"
                    title="Remove from recent list"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Footer hint */}
      <p className="mt-8 max-w-md text-center text-xs text-muted-foreground">
        Select a folder containing a .git directory to initialize TinSu in your project.
      </p>

      {/* Create New Project Dialog */}
      <ProjectSetupDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onProjectCreated={onProjectOpened}
        mode="create"
      />

      {/* Open Remote Project Dialog */}
      <OpenRemoteProjectDialog
        open={isRemoteDialogOpen}
        onOpenChange={setIsRemoteDialogOpen}
      />
    </div>
  )
}

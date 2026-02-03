import { useState } from 'react'
import { FolderOpen, Clock, AlertTriangle, Trash2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { Button } from './ui/button'
import { ThemeToggle } from './ui/theme-toggle'
import { trpc } from '@renderer/lib/trpc'
import { cn } from '@renderer/lib/utils'

interface ProjectOpenedInfo {
  path: string
  projectName: string
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
  const utils = trpc.useUtils()

  // Query for recent projects
  const { data: recentProjects } = trpc.project.getRecent.useQuery(
    { limit: 5 },
    { staleTime: 30000 }
  )

  // Validate paths for recent projects
  const paths = recentProjects?.map((p) => p.path) ?? []
  const validationQueries = trpc.useQueries((t) =>
    paths.map((path) =>
      t.project.validatePath(
        { path },
        {
          enabled: paths.length > 0,
          staleTime: 60000
        }
      )
    )
  )

  // Create a map of path -> isValid
  const pathValidation = new Map<string, boolean>()
  paths.forEach((path, index) => {
    pathValidation.set(path, validationQueries[index]?.data ?? true)
  })

  const openProjectMutation = trpc.project.open.useMutation({
    onSuccess: (result) => {
      if (result) {
        // Project successfully opened
        onProjectOpened({
          path: result.path,
          projectName: result.config.projectName
        })
      }
      // If result is null, dialog was cancelled - do nothing
    },
    onError: (err) => {
      setError(err.message || 'Failed to open project')
    }
  })

  const openPathMutation = trpc.project.openPath.useMutation({
    onSuccess: (result) => {
      onProjectOpened({
        path: result.path,
        projectName: result.config.projectName
      })
    },
    onError: (err) => {
      setError(err.message || 'Failed to open project')
    }
  })

  const removeProjectMutation = trpc.project.remove.useMutation({
    onSuccess: () => {
      utils.project.getRecent.invalidate()
    }
  })

  const handleOpenProject = () => {
    setError(null)
    openProjectMutation.mutate()
  }

  const handleOpenRecent = (path: string) => {
    const isValid = pathValidation.get(path) ?? true
    if (!isValid) {
      setError('Project folder not found. It may have been moved or deleted.')
      return
    }
    setError(null)
    openPathMutation.mutate({ path })
  }

  const handleRemoveProject = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    removeProjectMutation.mutate({ id })
  }

  const isLoading = openProjectMutation.isPending || openPathMutation.isPending

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

        <Button
          onClick={handleOpenProject}
          disabled={isLoading}
          className="w-full"
          size="lg"
        >
          {isLoading ? 'Opening...' : 'Open Existing Project'}
        </Button>

        {/* Git requirement hint */}
        <p className="mt-4 text-center text-sm text-muted-foreground">
          TinSu works with existing git repositories
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
              const isValid = pathValidation.get(project.path) ?? true
              return (
                <div
                  key={project.id}
                  className="group flex items-center gap-3 px-4 py-3 transition-colors first:rounded-t-lg last:rounded-b-lg hover:bg-accent"
                >
                  <button
                    onClick={() => handleOpenRecent(project.path)}
                    disabled={isLoading}
                    className="flex flex-1 items-center gap-3 text-left disabled:opacity-50"
                  >
                    <FolderOpen className="h-5 w-5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{project.name}</div>
                      <div className="truncate text-xs text-muted-foreground">{project.path}</div>
                    </div>
                    {!isValid && (
                      <span title="Project folder not found">
                        <AlertTriangle className="h-4 w-4 shrink-0 text-yellow-500" />
                      </span>
                    )}
                    {project.last_opened_at && (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(project.last_opened_at), { addSuffix: true })}
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
    </div>
  )
}

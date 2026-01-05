import { useState } from 'react'
import { Button } from './ui/button'
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

  const handleOpenProject = () => {
    setError(null)
    openProjectMutation.mutate()
  }

  return (
    <div
      className={cn(
        'flex min-h-screen flex-col items-center justify-center bg-background p-8',
        className
      )}
    >
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
          disabled={openProjectMutation.isPending}
          className="w-full"
          size="lg"
        >
          {openProjectMutation.isPending ? 'Opening...' : 'Open Existing Project'}
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

      {/* Footer hint */}
      <p className="mt-8 max-w-md text-center text-xs text-muted-foreground">
        Select a folder containing a .git directory to initialize TinSu in your project.
      </p>
    </div>
  )
}

import { cn } from '@renderer/lib/utils'
import { useProjectStore } from '@renderer/stores/project.store'

interface HeaderProps {
  className?: string
  onOpenProject?: () => void
}

export function Header({ className, onOpenProject }: HeaderProps) {
  const projectName = useProjectStore((state) => state.projectName)

  return (
    <header
      className={cn(
        'sticky top-0 z-50 flex h-12 w-full items-center border-b border-border bg-background px-4',
        className
      )}
    >
      <h1 className="text-lg font-semibold text-foreground">
        TinSu{projectName && <span className="text-muted-foreground"> - {projectName}</span>}
      </h1>
      {/* File menu with Open Project option */}
      <div className="ml-auto flex items-center gap-2">
        {onOpenProject && (
          <button
            onClick={onOpenProject}
            className="rounded px-2 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            Open Project...
          </button>
        )}
      </div>
    </header>
  )
}

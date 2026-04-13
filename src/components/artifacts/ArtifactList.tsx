import { FileText, Building, Palette, BookOpen, File, AlertTriangle, ExternalLink, Loader2 } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { useTaskArtifacts, type ArtifactWithStatus } from '@renderer/hooks/useTaskArtifacts'

interface ArtifactListProps {
  taskId: string | null
  className?: string
}

// Artifact type configuration with icons and color schemes
const ARTIFACT_CONFIG: Record<
  ArtifactWithStatus['artifact_type'],
  {
    icon: typeof FileText
    label: string
    badgeClasses: string
    iconClasses: string
  }
> = {
  prd: {
    icon: FileText,
    label: 'PRD',
    badgeClasses: 'bg-gradient-to-r from-amber-500/25 to-amber-600/15 text-amber-300 border-amber-500/40 shadow-[inset_0_1px_0_rgba(251,191,36,0.2)]',
    iconClasses: 'text-amber-400'
  },
  architecture: {
    icon: Building,
    label: 'Architecture',
    badgeClasses: 'bg-gradient-to-r from-sky-500/25 to-sky-600/15 text-sky-300 border-sky-500/40 shadow-[inset_0_1px_0_rgba(56,189,248,0.2)]',
    iconClasses: 'text-sky-400'
  },
  ux_design: {
    icon: Palette,
    label: 'UX Design',
    badgeClasses: 'bg-gradient-to-r from-fuchsia-500/25 to-fuchsia-600/15 text-fuchsia-300 border-fuchsia-500/40 shadow-[inset_0_1px_0_rgba(232,121,249,0.2)]',
    iconClasses: 'text-fuchsia-400'
  },
  epics: {
    icon: BookOpen,
    label: 'Epics',
    badgeClasses: 'bg-gradient-to-r from-emerald-500/25 to-emerald-600/15 text-emerald-300 border-emerald-500/40 shadow-[inset_0_1px_0_rgba(52,211,153,0.2)]',
    iconClasses: 'text-emerald-400'
  },
  custom: {
    icon: File,
    label: 'Custom',
    badgeClasses: 'bg-gradient-to-r from-slate-500/25 to-slate-600/15 text-slate-300 border-slate-500/40 shadow-[inset_0_1px_0_rgba(148,163,184,0.2)]',
    iconClasses: 'text-slate-400'
  }
}

function ArtifactTypeBadge({ type }: { type: ArtifactWithStatus['artifact_type'] }) {
  const config = ARTIFACT_CONFIG[type]

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider',
        config.badgeClasses
      )}
    >
      {config.label}
    </span>
  )
}

interface ArtifactItemProps {
  artifact: ArtifactWithStatus
  onOpen: (path: string) => void
  isOpening: boolean
}

function ArtifactItem({ artifact, onOpen, isOpening }: ArtifactItemProps) {
  const config = ARTIFACT_CONFIG[artifact.artifact_type]
  const Icon = config.icon

  const handleClick = () => {
    if (artifact.exists && !isOpening) {
      onOpen(artifact.artifact_path)
    }
  }

  return (
    <div
      className={cn(
        'group relative flex items-center gap-3 rounded-lg border px-3 py-2.5',
        'bg-gradient-to-b from-card/80 to-card/40',
        'border-border/50 hover:border-border',
        'transition-all duration-150 ease-out',
        artifact.exists
          ? 'cursor-pointer hover:bg-accent/30 hover:shadow-sm hover:shadow-accent/10'
          : 'cursor-not-allowed opacity-60'
      )}
      onClick={handleClick}
      role="button"
      tabIndex={artifact.exists ? 0 : -1}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleClick()
        }
      }}
      aria-disabled={!artifact.exists}
      title={artifact.artifact_path}
    >
      {/* Icon */}
      <div
        className={cn(
          'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md',
          'bg-gradient-to-br from-background/80 to-background/40',
          'border border-border/30',
          config.iconClasses
        )}
      >
        <Icon className="h-4 w-4" />
      </div>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground/90">
            {artifact.fileName}
          </span>
          {artifact.section_ref && (
            <span className="flex-shrink-0 text-[10px] text-muted-foreground/60">
              #{artifact.section_ref}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ArtifactTypeBadge type={artifact.artifact_type} />
          {!artifact.exists && (
            <span className="inline-flex items-center gap-1 text-[10px] text-destructive/80">
              <AlertTriangle className="h-3 w-3" />
              Missing
            </span>
          )}
        </div>
      </div>

      {/* Action indicator */}
      {artifact.exists && (
        <div
          className={cn(
            'flex-shrink-0 text-muted-foreground/40',
            'opacity-0 transition-opacity duration-150',
            'group-hover:opacity-100'
          )}
        >
          {isOpening ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ExternalLink className="h-4 w-4" />
          )}
        </div>
      )}
    </div>
  )
}

export function ArtifactList({ taskId, className }: ArtifactListProps) {
  const { artifacts, isLoading, openInEditor, isOpening } = useTaskArtifacts(taskId)

  if (!taskId) {
    return null
  }

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center py-8', className)}>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (artifacts.length === 0) {
    return (
      <div className={cn('py-6 text-center', className)}>
        <div className="mb-2 text-muted-foreground/40">
          <File className="mx-auto h-8 w-8" />
        </div>
        <p className="text-sm text-muted-foreground/60">No artifacts linked</p>
      </div>
    )
  }

  return (
    <div className={cn('space-y-2', className)}>
      {artifacts.map((artifact) => (
        <ArtifactItem
          key={artifact.id}
          artifact={artifact}
          onOpen={openInEditor}
          isOpening={isOpening}
        />
      ))}
    </div>
  )
}

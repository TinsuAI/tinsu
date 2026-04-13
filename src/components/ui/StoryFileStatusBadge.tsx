import { FileText, CheckCircle } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import type { StoryFileStatus } from '@shared/types/story-file-status.types'

interface StoryFileStatusBadgeProps {
  status: StoryFileStatus | null
  storyFilePath?: string | null
  onPathClick?: () => void
  className?: string
}

// Status configuration with icons, colors, and labels
const STATUS_CONFIG = {
  summary_only: {
    icon: FileText,
    colorClass: 'text-amber-500',
    label: 'Summary Only',
    tooltip: 'Needs full story creation before development'
  },
  story_ready: {
    icon: CheckCircle,
    colorClass: 'text-green-500',
    label: 'Story Ready',
    tooltip: 'Story file ready for development'
  }
} as const

/**
 * Story 5.2c: Badge component showing story file status for imported story tasks
 * - summary_only: FileText icon (amber) - needs story creation
 * - story_ready: CheckCircle icon (green) - ready for development
 */
export function StoryFileStatusBadge({
  status,
  storyFilePath,
  onPathClick,
  className
}: StoryFileStatusBadgeProps) {
  // Don't render for null status (basic tasks)
  if (!status) {
    return null
  }

  const config = STATUS_CONFIG[status]
  const Icon = config.icon

  // Extract filename from path for display
  const fileName = storyFilePath ? storyFilePath.split('/').pop() : null

  return (
    <div className={cn('flex items-center gap-1.5', className)} data-testid="story-file-status-badge" title={config.tooltip}>
      <span
        className={cn('inline-flex items-center gap-1', config.colorClass)}
      >
        <Icon className="size-3.5" />
        <span className="text-xs">{config.label}</span>
      </span>

      {/* Show clickable file link when story_ready and path exists */}
      {status === 'story_ready' && fileName && (
        <button
          type="button"
          onClick={onPathClick}
          className="text-xs text-blue-400 hover:text-blue-300 hover:underline"
          data-testid="story-file-link"
        >
          {fileName}
        </button>
      )}
    </div>
  )
}

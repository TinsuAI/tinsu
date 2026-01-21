import { useMemo, useRef, useEffect, useState, useCallback } from 'react'
import { Plus, Circle, Minus, ArrowRight, FileCode, Edit2 } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@renderer/components/ui/tooltip'
import type { GitDiffFile } from '@main/services/git.service'

/**
 * Props for FileTree component
 */
export interface FileTreeProps {
  /** Array of changed files from git diff */
  files: GitDiffFile[]
  /** Currently selected file path (for highlighting) */
  selectedFile: string | null
  /** Callback when a file is clicked */
  onFileSelect: (path: string) => void
  /** Optional additional CSS classes */
  className?: string
  /** Compact mode - shows only icons with tooltips (for limited space) */
  compact?: boolean
}

/** Sort order: modified (most common) → added → deleted → renamed */
const statusSortOrder: Record<GitDiffFile['status'], number> = {
  modified: 0,
  added: 1,
  deleted: 2,
  renamed: 3
}

/** Status icons mapping */
const statusIcons: Record<GitDiffFile['status'], React.JSX.Element> = {
  added: <Plus className="h-3.5 w-3.5 text-green-500" />,
  modified: <Circle className="h-3.5 w-3.5 text-yellow-500" fill="currentColor" />,
  deleted: <Minus className="h-3.5 w-3.5 text-red-500" />,
  renamed: <ArrowRight className="h-3.5 w-3.5 text-blue-500" />
}

/** Compact mode status icons with larger hit area */
const compactStatusIcons: Record<GitDiffFile['status'], React.ComponentType<{ className?: string }>> = {
  added: Plus,
  modified: Edit2,
  deleted: Minus,
  renamed: ArrowRight
}

/** Status color classes for compact mode icons */
const statusColorClasses: Record<GitDiffFile['status'], string> = {
  added: 'text-green-500',
  modified: 'text-yellow-500',
  deleted: 'text-red-500',
  renamed: 'text-blue-500'
}

/**
 * Props for FileIconOnly component (compact mode)
 */
interface FileIconOnlyProps {
  /** File data */
  file: GitDiffFile
  /** Whether this file is currently selected */
  isSelected: boolean
  /** Callback when file is clicked */
  onSelect: () => void
}

/**
 * FileIconOnly - Compact mode file display showing only icon with tooltip.
 *
 * Used when the FileTree is in compact mode for limited space scenarios.
 * Displays status icon with full file info available via tooltip.
 */
function FileIconOnly({ file, isSelected, onSelect }: FileIconOnlyProps): React.JSX.Element {
  const Icon = compactStatusIcons[file.status]
  const filename = file.path?.split('/').pop() || file.path || 'Unknown'

  // Build tooltip content with file details
  const tooltipContent = (
    <div className="space-y-1">
      <div className="font-medium">{filename}</div>
      <div className="text-xs text-muted-foreground">{file.path}</div>
      <div className="flex items-center gap-2 text-xs">
        <span className={cn('capitalize', statusColorClasses[file.status])}>
          {file.status}
        </span>
        {file.additions > 0 && <span className="text-green-500">+{file.additions}</span>}
        {file.deletions > 0 && <span className="text-red-500">-{file.deletions}</span>}
      </div>
    </div>
  )

  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onSelect}
          className={cn(
            'flex items-center justify-center',
            'p-2 rounded transition-all duration-150',
            'hover:bg-muted/30 hover:scale-105',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
            isSelected && 'bg-muted/50 ring-1 ring-primary/30'
          )}
          aria-label={`${filename}, ${file.status}, ${file.additions} additions, ${file.deletions} deletions`}
        >
          <Icon
            className={cn(
              'h-4 w-4 transition-colors',
              statusColorClasses[file.status]
            )}
          />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-[200px]">
        {tooltipContent}
      </TooltipContent>
    </Tooltip>
  )
}

/**
 * Props for FileTreeItem component
 */
interface FileTreeItemProps {
  /** File data */
  file: GitDiffFile
  /** Whether this file is currently selected */
  isSelected: boolean
  /** Callback when file is clicked */
  onSelect: () => void
  /** Callback for keyboard navigation (focus next/previous) */
  onNavigate?: (direction: 'up' | 'down') => void
}

/**
 * FileTreeItem - Individual file entry in the tree.
 *
 * Displays filename with status icon, labels for added/deleted,
 * and line statistics. Automatically scrolls into view when selected.
 */
function FileTreeItem({
  file,
  isSelected,
  onSelect,
  onNavigate
}: FileTreeItemProps): React.JSX.Element {
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Extract filename from path for display (with defensive null checks)
  const filename = file.path?.split('/').pop() || file.path || 'Unknown'

  // Scroll into view when selected
  useEffect(() => {
    if (isSelected && buttonRef.current) {
      buttonRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [isSelected])

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        onNavigate?.('up')
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        onNavigate?.('down')
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onSelect()
      }
    },
    [onNavigate, onSelect]
  )

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      className={cn(
        'flex w-full items-center justify-between gap-2 px-3 py-1.5',
        'cursor-pointer transition-colors',
        'hover:bg-muted/20',
        isSelected && 'bg-muted/40'
      )}
      title={file.oldPath ? `${file.oldPath} → ${file.path}` : file.path || 'Unknown'}
      aria-label={`${filename}, ${file.status}, ${file.additions} additions, ${file.deletions} deletions`}
    >
      {/* Left side: icon + filename + label */}
      <div className="flex min-w-0 items-center gap-2">
        {/* Status icon */}
        <span className="shrink-0" aria-hidden="true">
          {statusIcons[file.status]}
        </span>

        {/* Filename (truncated) */}
        <span className="truncate text-sm text-foreground/80">{filename}</span>

        {/* Status label for added/deleted */}
        {file.status === 'added' && (
          <span className="shrink-0 text-xs text-green-500/70">(new)</span>
        )}
        {file.status === 'deleted' && (
          <span className="shrink-0 text-xs text-red-500/70">(deleted)</span>
        )}
      </div>

      {/* Right side: line stats */}
      <div className="flex shrink-0 items-center gap-1.5 text-xs">
        {file.additions > 0 && <span className="text-green-500">+{file.additions}</span>}
        {file.deletions > 0 && <span className="text-red-500">-{file.deletions}</span>}
        {file.additions === 0 && file.deletions === 0 && (
          <span className="text-muted-foreground/50">±0</span>
        )}
      </div>
    </button>
  )
}

/**
 * FileTree - Displays a list of changed files for navigation.
 *
 * Files are sorted by status (modified first, then added, then deleted, then renamed).
 * Each file shows its status icon, filename, labels, and line statistics.
 * Clicking a file calls the onFileSelect callback with the file path.
 * Supports keyboard navigation with arrow keys.
 *
 * Story TES-4.3: File Tree Component
 * Story TES-4.6: Added compact mode for limited space scenarios
 */
export function FileTree({
  files,
  selectedFile,
  onFileSelect,
  className,
  compact = false
}: FileTreeProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scrollIndicators, setScrollIndicators] = useState({ top: false, bottom: false })

  // Sort files by status: modified → added → deleted → renamed
  // useMemo ensures we only re-sort when files array changes (performance optimized)
  const sortedFiles = useMemo(() => {
    return [...files].sort((a, b) => statusSortOrder[a.status] - statusSortOrder[b.status])
  }, [files])

  // Handle keyboard navigation between files
  const handleNavigate = useCallback(
    (currentPath: string, direction: 'up' | 'down') => {
      const currentIndex = sortedFiles.findIndex((f) => f.path === currentPath)
      if (currentIndex === -1) return

      const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
      if (nextIndex >= 0 && nextIndex < sortedFiles.length) {
        onFileSelect(sortedFiles[nextIndex].path)
      }
    },
    [sortedFiles, onFileSelect]
  )

  // Update scroll indicators when content scrolls
  const updateScrollIndicators = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    const { scrollTop, scrollHeight, clientHeight } = container
    setScrollIndicators({
      top: scrollTop > 10,
      bottom: scrollTop < scrollHeight - clientHeight - 10
    })
  }, [])

  // Set up scroll listener
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    updateScrollIndicators()
    container.addEventListener('scroll', updateScrollIndicators)
    return () => container.removeEventListener('scroll', updateScrollIndicators)
  }, [updateScrollIndicators])

  // Update indicators when files change
  useEffect(() => {
    updateScrollIndicators()
  }, [files, updateScrollIndicators])

  // Empty state
  if (files.length === 0) {
    return (
      <div
        className={cn(
          'flex h-full flex-col items-center justify-center p-4',
          'text-muted-foreground/50',
          className
        )}
        data-testid="file-tree-empty"
      >
        <FileCode className="mb-2 h-6 w-6" />
        <span className="text-sm">No files changed</span>
      </div>
    )
  }

  // Compact mode: horizontal row of icons
  if (compact) {
    return (
      <TooltipProvider>
        <div
          className={cn(
            'flex flex-wrap items-center gap-1 p-2',
            'transition-all duration-200 ease-out',
            className
          )}
          data-testid="file-tree"
          data-compact="true"
          role="list"
          aria-label="Changed files (compact view)"
        >
          {sortedFiles.map((file) => (
            <FileIconOnly
              key={file.path}
              file={file}
              isSelected={selectedFile === file.path}
              onSelect={() => onFileSelect(file.path)}
            />
          ))}
        </div>
      </TooltipProvider>
    )
  }

  // Normal mode: vertical list with full details
  return (
    <div className={cn('relative transition-all duration-200 ease-out', className)}>
      {/* Top scroll indicator */}
      {scrollIndicators.top && (
        <div className="pointer-events-none absolute left-0 right-0 top-0 z-10 h-6 bg-gradient-to-b from-background to-transparent" />
      )}

      {/* File list container */}
      <div
        ref={containerRef}
        className={cn('kanban-scroll flex flex-col overflow-auto', className)}
        data-testid="file-tree"
        data-compact="false"
        role="list"
        aria-label="Changed files"
      >
        {sortedFiles.map((file) => (
          <FileTreeItem
            key={file.path}
            file={file}
            isSelected={selectedFile === file.path}
            onSelect={() => onFileSelect(file.path)}
            onNavigate={(direction) => handleNavigate(file.path, direction)}
          />
        ))}
      </div>

      {/* Bottom scroll indicator */}
      {scrollIndicators.bottom && (
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 h-6 bg-gradient-to-t from-background to-transparent" />
      )}
    </div>
  )
}

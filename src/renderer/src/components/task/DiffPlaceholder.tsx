import { useState, useRef, useCallback, useMemo, useLayoutEffect } from 'react'
import { GitCompareArrows, RefreshCw, AlertCircle, ChevronDown, ChevronRight, ChevronsDown, ChevronsUp } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { useDiff } from '@renderer/hooks/useDiff'
import { Button } from '@renderer/components/ui/button'
import { Skeleton } from '@renderer/components/ui/skeleton'
import {
  DiffSummaryBar,
  FileTree,
  MonacoDiffEditor,
  ViewModeToggle,
  getLanguageFromPath,
  reconstructFileContent
} from '@renderer/components/diff'
import { useDiffStore } from '@renderer/stores/diff.store'
import type { GitDiffHunk } from '@main/services/git.service'

/** Threshold width (px) below which compact mode is enabled */
const COMPACT_WIDTH_THRESHOLD = 400

/**
 * Custom hook for observing container width changes.
 * Uses ResizeObserver for efficient size detection with debouncing.
 *
 * Story TES-4.6: Dynamic compact/expanded mode switching
 * Debouncing prevents excessive re-renders during window resize.
 */
function useContainerWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return

    // Set initial width immediately
    setWidth(element.getBoundingClientRect().width)

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        // Clear previous timeout
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
        }

        // Debounce width updates (100ms delay)
        timeoutRef.current = setTimeout(() => {
          setWidth(entry.contentRect.width)
        }, 100)
      }
    })

    observer.observe(element)
    return () => {
      observer.disconnect()
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return { ref, width }
}

/**
 * Props for DiffPlaceholder component
 */
export interface DiffPlaceholderProps {
  /** Task ID to fetch diff for */
  taskId?: string | null
}

/**
 * DiffPlaceholder - Displays git diff data for a task.
 *
 * Shows loading skeleton while fetching, "No changes yet" when empty,
 * error state with retry option when failed, and diff summary when available.
 *
 * Story TES-4.1: Git Diff Data Fetching
 * Story TES-4.6: Added dynamic compact mode based on container width
 */
export function DiffPlaceholder({ taskId }: DiffPlaceholderProps): React.JSX.Element {
  const { diff, isLoading, isRefreshing, error, refresh, hasChanges, summary } = useDiff(
    taskId ?? null
  )

  // Get view mode from store (TES-4.5)
  const { viewMode, toggleViewMode } = useDiffStore()

  // State for expanded/collapsed files - all expanded by default (GitHub-style)
  const [expandedFiles, setExpandedFiles] = useState<Map<string, boolean>>(new Map())

  // Initialize all files as expanded when diff changes
  useMemo(() => {
    if (diff?.files) {
      const newExpandedState = new Map<string, boolean>()
      diff.files.forEach(file => {
        newExpandedState.set(file.path, true) // All files expanded by default
      })
      setExpandedFiles(newExpandedState)
    }
  }, [diff?.files])

  // Refs for scroll-into-view functionality
  const fileRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  // Ref for the container to enable keyboard shortcut focus (TES-4.5)
  const containerRef = useRef<HTMLDivElement>(null)

  // Track container width for dynamic compact mode (TES-4.6)
  const { ref: sizeRef, width: containerWidth } = useContainerWidth()

  // Determine if we should use compact mode based on container width
  const isCompactMode = containerWidth > 0 && containerWidth < COMPACT_WIDTH_THRESHOLD

  // Toggle file expansion (collapse/expand like GitHub)
  const toggleFileExpand = useCallback((path: string) => {
    setExpandedFiles(prev => {
      const next = new Map(prev)
      next.set(path, !prev.get(path))
      return next
    })

    // Scroll the file's diff section into view - use setTimeout to ensure DOM is updated
    setTimeout(() => {
      const fileRef = fileRefs.current.get(path)
      if (fileRef) {
        fileRef.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    }, 0)
  }, [])

  // Collapse all files
  const collapseAll = useCallback(() => {
    setExpandedFiles(prev => {
      const next = new Map(prev)
      next.forEach((_, path) => next.set(path, false))
      return next
    })
  }, [])

  // Expand all files
  const expandAll = useCallback(() => {
    setExpandedFiles(prev => {
      const next = new Map(prev)
      next.forEach((_, path) => next.set(path, true))
      return next
    })
  }, [])

  // Handle file selection from tree - now just scrolls to the file
  const handleFileSelect = useCallback((path: string) => {
    // Ensure file is expanded when selected from tree
    setExpandedFiles(prev => {
      const next = new Map(prev)
      next.set(path, true)
      return next
    })

    // Scroll the file's diff section into view
    setTimeout(() => {
      const fileRef = fileRefs.current.get(path)
      if (fileRef) {
        fileRef.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    }, 0)
  }, [])

  /**
   * Handle keyboard shortcuts for the diff section
   * - V: Toggle between unified and split view modes (TES-4.5)
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Skip if modifier keys are pressed or target is input/textarea
      const isModifierPressed = e.metaKey || e.ctrlKey || e.altKey
      const isInputFocused =
        e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement

      if (isModifierPressed || isInputFocused) return

      // V: Toggle view mode (TES-4.5)
      if (e.key === 'v' || e.key === 'V') {
        e.preventDefault()
        toggleViewMode()
        return
      }
    },
    [toggleViewMode]
  )

  // GitHub-style loading skeleton
  if (isLoading) {
    return (
      <div
        className={cn(
          'flex h-full flex-col',
          'p-5',
          'bg-background'
        )}
        data-testid="diff-loading"
      >
        <div className="mb-5 flex items-center justify-between">
          <Skeleton className="h-6 w-40 bg-muted/10" />
          <Skeleton className="h-8 w-8 rounded-md bg-muted/10" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-full bg-muted/10" />
          <Skeleton className="h-4 w-[85%] bg-muted/10" />
          <Skeleton className="h-4 w-[92%] bg-muted/10" />
          <Skeleton className="h-4 w-[78%] bg-muted/10" />
          <Skeleton className="h-4 w-[88%] bg-muted/10" />
        </div>
      </div>
    )
  }

  // GitHub-style error state
  if (error) {
    return (
      <div
        className={cn(
          'flex h-full flex-col items-center justify-center',
          'p-8',
          'bg-background'
        )}
        data-testid="diff-error"
      >
        <div
          className={cn(
            'mb-4 rounded-lg p-5',
            'bg-[#f85149]/5',
            'border border-[#f85149]/20'
          )}
        >
          <AlertCircle className="h-10 w-10 text-[#f85149]" />
        </div>

        <h4 className="mb-2 text-base font-semibold text-foreground/80">Unable to load diff</h4>

        <p className="mb-5 max-w-[280px] text-center text-sm text-muted-foreground/60 leading-relaxed">{error}</p>

        <Button
          variant="outline"
          size="sm"
          onClick={refresh}
          disabled={isRefreshing}
          className="gap-2 rounded-md border-border/40 hover:bg-muted/40 transition-colors"
        >
          <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
          {isRefreshing ? 'Retrying...' : 'Retry'}
        </Button>
      </div>
    )
  }

  // GitHub-style empty state
  if (!hasChanges) {
    return (
      <div
        className={cn(
          'flex h-full flex-col items-center justify-center',
          'p-8',
          'bg-background'
        )}
        data-testid="diff-empty"
      >
        <div className={cn(
          'mb-4 rounded-lg p-5',
          'bg-muted/10',
          'border border-border/10'
        )}>
          <GitCompareArrows className="h-10 w-10 text-muted-foreground/40" />
        </div>

        <h4 className="mb-2 text-base font-semibold text-foreground/80">No changes yet</h4>

        <p className="mb-5 max-w-[280px] text-center text-sm text-muted-foreground/60 leading-relaxed">
          Changes will appear here once the task modifies files
        </p>

        <Button
          variant="ghost"
          size="sm"
          onClick={refresh}
          disabled={isRefreshing}
          className="gap-2 rounded-md text-sm font-medium text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors"
        >
          <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
          {isRefreshing ? 'Checking...' : 'Check for changes'}
        </Button>
      </div>
    )
  }

  // Has changes - show GitHub-style diff view
  return (
    <div
      ref={(el) => {
        // Merge refs: containerRef for keyboard focus, sizeRef for resize detection
        if (containerRef) (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = el
        if (sizeRef) (sizeRef as React.MutableRefObject<HTMLDivElement | null>).current = el
      }}
      className={cn(
        'flex h-full flex-col overflow-hidden',
        'bg-background',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#58a6ff]/30 focus-visible:ring-offset-1'
      )}
      data-testid="diff-content"
      data-compact={isCompactMode}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-label="Diff viewer. Press V to toggle between unified and split view."
    >
      {/* GitHub-style header with refined controls */}
      <div className="flex items-center justify-between gap-3 border-b border-border/10 bg-background px-5 py-3.5">
        <DiffSummaryBar
          summary={summary}
          onRefresh={refresh}
          isRefreshing={isRefreshing}
          className="flex-1"
        />
        <div className="flex items-center gap-1.5">
          {/* Collapse/Expand All buttons - GitHub style */}
          <Button
            variant="ghost"
            size="sm"
            onClick={collapseAll}
            className="h-8 gap-1.5 rounded-md px-3 text-xs font-medium text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors"
            title="Collapse all files"
          >
            <ChevronsUp className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Collapse</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={expandAll}
            className="h-8 gap-1.5 rounded-md px-3 text-xs font-medium text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors"
            title="Expand all files"
          >
            <ChevronsDown className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Expand</span>
          </Button>
          <div className="mx-1 h-5 w-px bg-border/40" />
          <ViewModeToggle />
        </div>
      </div>

      {/* File tree navigation - GitHub style with refined borders */}
      <div className={cn(
        'shrink-0 border-b border-border/[0.08] bg-background transition-all duration-200',
        isCompactMode ? 'py-0' : ''
      )}>
        <FileTree
          files={diff?.files ?? []}
          selectedFile={null}
          onFileSelect={handleFileSelect}
          compact={isCompactMode}
          className={cn(
            'transition-all duration-200',
            isCompactMode ? 'max-h-[100px]' : 'max-h-[180px]'
          )}
        />
      </div>

      {/* File diff content - GitHub-style refined layout */}
      <div className="kanban-scroll flex-1 overflow-auto bg-background">
        <div className="divide-y divide-border/[0.08]">
          {diff?.files.map((file) => {
            const isExpanded = expandedFiles.get(file.path) ?? true

            return (
              <div
                key={file.path}
                ref={(el) => {
                  if (el) {
                    fileRefs.current.set(file.path, el)
                  }
                }}
                className="group"
              >
                {/* GitHub-style file header with refined spacing */}
                <div className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-muted/[0.02] transition-colors">
                  <div className="flex min-w-0 flex-1 items-center gap-2.5">
                    {/* Collapse/Expand button */}
                    <button
                      onClick={() => toggleFileExpand(file.path)}
                      className="flex-shrink-0 rounded-md p-1 text-muted-foreground transition-all hover:bg-muted/40 hover:text-foreground active:scale-95"
                      aria-label={isExpanded ? 'Collapse diff' : 'Expand diff'}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>

                    {/* File path with refined typography */}
                    <span
                      className="min-w-0 truncate font-mono text-sm font-medium text-foreground"
                      title={file.oldPath ? `${file.oldPath} → ${file.path}` : file.path}
                    >
                      {file.oldPath ? (
                        <>
                          <span className="text-muted-foreground/40 line-through">
                            {file.oldPath}
                          </span>
                          <span className="mx-2 text-muted-foreground/30">→</span>
                          <span>{file.path}</span>
                        </>
                      ) : (
                        file.path
                      )}
                    </span>
                  </div>

                  {/* Status badge and stats - GitHub style */}
                  <div className="flex shrink-0 items-center gap-2.5">
                    {/* Status badge with refined colors */}
                    <span
                      className={cn(
                        'rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
                        file.status === 'added' && 'bg-[#3fb950]/10 text-[#3fb950]',
                        file.status === 'modified' && 'bg-[#d29922]/10 text-[#d29922]',
                        file.status === 'deleted' && 'bg-[#f85149]/10 text-[#f85149]',
                        file.status === 'renamed' && 'bg-[#58a6ff]/10 text-[#58a6ff]'
                      )}
                    >
                      {file.status}
                    </span>

                    {/* Line count with refined styling */}
                    <div className="flex items-center gap-1.5 text-xs font-medium tabular-nums">
                      {file.additions > 0 && (
                        <span className="text-[#3fb950]">+{file.additions}</span>
                      )}
                      {file.deletions > 0 && (
                        <span className="text-[#f85149]">−{file.deletions}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Diff content - shown when expanded */}
                {file.hunks.length > 0 && isExpanded && (
                  <div className="px-5 pb-4">
                    <FileDiffViewer hunks={file.hunks} filePath={file.path} viewMode={viewMode} />
                  </div>
                )}

                {/* Collapsed preview with GitHub-style compact view */}
                {file.hunks.length > 0 && !isExpanded && (
                  <div className="mx-5 mb-3 overflow-hidden rounded-md border border-border/20 bg-[#0d1117]">
                    <div className="max-h-[100px] overflow-hidden">
                      {(() => {
                        const allChangedLines = file.hunks.flatMap(hunk =>
                          hunk.lines.filter(line => line.type === 'add' || line.type === 'remove')
                        )
                        const previewLines = allChangedLines.slice(0, 4)
                        const totalChangedLines = allChangedLines.length

                        return (
                          <>
                            {previewLines.map((line, idx) => (
                              <div
                                key={idx}
                                className={cn(
                                  'px-3 py-1 font-mono text-xs leading-5 transition-colors',
                                  line.type === 'add' && 'bg-[#3fb950]/5 text-[#aff5b4] hover:bg-[#3fb950]/8',
                                  line.type === 'remove' && 'bg-[#f85149]/5 text-[#ffdcd7] hover:bg-[#f85149]/8'
                                )}
                              >
                                <span className="mr-3 select-none text-muted-foreground/40">
                                  {line.type === 'add' ? '+' : '−'}
                                </span>
                                <span>{line.content}</span>
                              </div>
                            ))}
                            {totalChangedLines > 4 && (
                              <div className="px-3 py-1.5 text-xs text-muted-foreground/50">
                                {totalChangedLines - 4} more {totalChangedLines - 4 === 1 ? 'change' : 'changes'}
                              </div>
                            )}
                          </>
                        )
                      })()}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/**
 * Props for FileDiffViewer internal component
 */
interface FileDiffViewerProps {
  hunks: GitDiffHunk[]
  filePath: string
  /** View mode for the diff display (TES-4.5) */
  viewMode: 'unified' | 'split'
}

/**
 * FileDiffViewer - Memoized Monaco diff viewer for a single file.
 *
 * Wraps MonacoDiffEditor with useMemo for performance optimization.
 * Reconstructs file content from hunks and detects language from path.
 *
 * Story TES-4.4: Monaco Diff Viewer Integration
 * Story TES-4.5: Added viewMode prop for unified/split toggle
 */
function FileDiffViewer({ hunks, filePath, viewMode }: FileDiffViewerProps): React.JSX.Element {
  // Memoize content reconstruction - expensive operation
  const { original, modified } = useMemo(() => reconstructFileContent(hunks), [hunks])

  // Memoize language detection
  const language = useMemo(() => getLanguageFromPath(filePath), [filePath])

  // If no content, show a message instead of blank Monaco editor
  if (!original && !modified) {
    return (
      <div className="mt-2 rounded border border-border/20 bg-muted/10 p-4 text-center text-sm text-muted-foreground">
        No diff content available
      </div>
    )
  }

  return (
    <div className="mt-2">
      <MonacoDiffEditor
        original={original}
        modified={modified}
        language={language}
        filePath={filePath}
        height={300}
        viewMode={viewMode}
      />
    </div>
  )
}

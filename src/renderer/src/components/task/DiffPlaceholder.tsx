import { useState, useRef, useCallback, useMemo } from 'react'
import { GitCompareArrows, RefreshCw, AlertCircle } from 'lucide-react'
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
 */
export function DiffPlaceholder({ taskId }: DiffPlaceholderProps): React.JSX.Element {
  const { diff, isLoading, isRefreshing, error, refresh, hasChanges, summary } = useDiff(
    taskId ?? null
  )

  // Get view mode from store (TES-4.5)
  const { viewMode, toggleViewMode } = useDiffStore()

  // State for selected file in file tree
  const [selectedFile, setSelectedFile] = useState<string | null>(null)

  // Refs for scroll-into-view functionality
  const fileRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  // Ref for the container to enable keyboard shortcut focus (TES-4.5)
  const containerRef = useRef<HTMLDivElement>(null)

  // Handle file selection from tree
  const handleFileSelect = useCallback((path: string) => {
    setSelectedFile(path)

    // Scroll the file's diff section into view - use setTimeout to ensure DOM is updated
    setTimeout(() => {
      const fileRef = fileRefs.current.get(path)
      if (fileRef) {
        fileRef.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    }, 0)
  }, [])

  /**
   * Handle keyboard shortcuts for the diff section (TES-4.5)
   * - V: Toggle between unified and split view modes
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Only handle 'V' key when no modifier keys are pressed
      // and the target is not an input/textarea
      if (
        (e.key === 'v' || e.key === 'V') &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault()
        toggleViewMode()
      }
    },
    [toggleViewMode]
  )

  // Loading state - show skeleton
  if (isLoading) {
    return (
      <div
        className={cn(
          'flex h-full flex-col',
          'p-4',
          'bg-gradient-to-br from-muted/5 to-transparent'
        )}
        data-testid="diff-loading"
      >
        <div className="mb-4 flex items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-8 w-8 rounded" />
        </div>
        <Skeleton className="mb-2 h-4 w-full" />
        <Skeleton className="mb-2 h-4 w-3/4" />
        <Skeleton className="mb-2 h-4 w-5/6" />
        <Skeleton className="mb-2 h-4 w-2/3" />
        <Skeleton className="h-4 w-4/5" />
      </div>
    )
  }

  // Error state - show error with retry
  if (error) {
    return (
      <div
        className={cn(
          'flex h-full flex-col items-center justify-center',
          'p-6',
          'bg-gradient-to-br from-destructive/5 to-transparent'
        )}
        data-testid="diff-error"
      >
        <div
          className={cn('mb-4 rounded-xl p-4', 'bg-destructive/10', 'border border-destructive/20')}
        >
          <AlertCircle className="h-8 w-8 text-destructive/70" />
        </div>

        <h4 className="mb-1.5 text-sm font-medium text-destructive/80">Unable to load diff</h4>

        <p className="mb-4 max-w-[200px] text-center text-xs text-muted-foreground/60">{error}</p>

        <Button
          variant="outline"
          size="sm"
          onClick={refresh}
          disabled={isRefreshing}
          className="gap-2"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')} />
          {isRefreshing ? 'Retrying...' : 'Retry'}
        </Button>
      </div>
    )
  }

  // Empty state - no changes yet
  if (!hasChanges) {
    return (
      <div
        className={cn(
          'flex h-full flex-col items-center justify-center',
          'p-6',
          'bg-gradient-to-br from-muted/5 to-transparent'
        )}
        data-testid="diff-empty"
      >
        <div className={cn('mb-4 rounded-xl p-4', 'bg-muted/20', 'border border-border/20')}>
          <GitCompareArrows className="h-8 w-8 text-muted-foreground/50" />
        </div>

        <h4 className="mb-1.5 text-sm font-medium text-muted-foreground/70">No changes yet</h4>

        <p className="mb-4 max-w-[200px] text-center text-xs text-muted-foreground/50">
          Changes will appear here once the task modifies files
        </p>

        <Button
          variant="ghost"
          size="sm"
          onClick={refresh}
          disabled={isRefreshing}
          className="gap-2 text-xs text-muted-foreground/60"
        >
          <RefreshCw className={cn('h-3 w-3', isRefreshing && 'animate-spin')} />
          {isRefreshing ? 'Checking...' : 'Check for changes'}
        </Button>
      </div>
    )
  }

  // Has changes - show diff summary, file tree, and diff content
  return (
    <div
      ref={containerRef}
      className={cn(
        'flex h-full flex-col overflow-hidden',
        'bg-gradient-to-br from-muted/5 to-transparent',
        'focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/30'
      )}
      data-testid="diff-content"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-label="Diff viewer. Press V to toggle between unified and split view."
    >
      {/* Summary header with view mode toggle (TES-4.5) */}
      <div className="flex items-center justify-between gap-2 border-b border-border/20 px-4 py-2">
        <DiffSummaryBar
          summary={summary}
          onRefresh={refresh}
          isRefreshing={isRefreshing}
          className="flex-1"
        />
        {selectedFile && <ViewModeToggle />}
      </div>

      {/* File tree for navigation */}
      <div className="shrink-0 border-b border-border/20">
        <FileTree
          files={diff?.files ?? []}
          selectedFile={selectedFile}
          onFileSelect={handleFileSelect}
          className="max-h-[200px]"
        />
      </div>

      {/* File diff content */}
      <div className="kanban-scroll flex-1 overflow-auto">
        <div className="divide-y divide-border/10">
          {diff?.files.map((file) => (
            <div
              key={file.path}
              ref={(el) => {
                if (el) {
                  fileRefs.current.set(file.path, el)
                }
              }}
              className={cn('px-4 py-2.5', selectedFile === file.path && 'bg-muted/30')}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 overflow-hidden">
                  <span
                    className="truncate text-sm font-medium text-foreground/80"
                    title={file.oldPath ? `${file.oldPath} → ${file.path}` : file.path}
                  >
                    {file.oldPath ? (
                      <>
                        <span className="text-muted-foreground/50 line-through">
                          {file.oldPath}
                        </span>
                        <span className="mx-1 text-muted-foreground/30">→</span>
                        {file.path}
                      </>
                    ) : (
                      file.path
                    )}
                  </span>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {/* Status badge */}
                  <span
                    className={cn(
                      'rounded px-1.5 py-0.5 text-[10px] font-medium uppercase',
                      file.status === 'added' && 'bg-green-500/20 text-green-500',
                      file.status === 'modified' && 'bg-yellow-500/20 text-yellow-500',
                      file.status === 'deleted' && 'bg-red-500/20 text-red-500',
                      file.status === 'renamed' && 'bg-blue-500/20 text-blue-500'
                    )}
                  >
                    {file.status}
                  </span>

                  {/* Line count */}
                  <div className="flex items-center gap-1 text-xs">
                    {file.additions > 0 && (
                      <span className="text-green-500">+{file.additions}</span>
                    )}
                    {file.deletions > 0 && <span className="text-red-500">-{file.deletions}</span>}
                  </div>
                </div>
              </div>

              {/* Monaco Diff Viewer - TES-4.4, TES-4.5 */}
              {file.hunks.length > 0 && selectedFile === file.path && (
                <FileDiffViewer hunks={file.hunks} filePath={file.path} viewMode={viewMode} />
              )}

              {/* Compact preview when file is not selected */}
              {file.hunks.length > 0 && selectedFile !== file.path && (
                <div
                  className="mt-1.5 cursor-pointer overflow-hidden rounded border border-border/20 bg-black/20 transition-colors hover:border-border/40"
                  onClick={() => handleFileSelect(file.path)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      handleFileSelect(file.path)
                    }
                  }}
                  aria-label={`View diff for ${file.path}`}
                >
                  <div className="max-h-[80px] overflow-hidden">
                    {file.hunks[0].lines.slice(0, 4).map((line, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          'px-2 py-0.5 font-mono text-[10px] leading-4',
                          line.type === 'add' && 'bg-green-500/10 text-green-400',
                          line.type === 'remove' && 'bg-red-500/10 text-red-400',
                          line.type === 'context' && 'text-muted-foreground/60'
                        )}
                      >
                        <span className="mr-2 select-none opacity-50">
                          {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
                        </span>
                        {line.content}
                      </div>
                    ))}
                    {file.hunks[0].lines.length > 4 && (
                      <div className="px-2 py-0.5 text-[10px] text-muted-foreground/40">
                        Click to view full diff ({file.hunks[0].lines.length - 4} more lines)
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
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

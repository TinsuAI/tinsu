/**
 * Compare With HEAD Dialog - Story 8.11
 *
 * Dialog for comparing a task's merge commit with the current HEAD.
 * Shows what changed since the task was completed.
 *
 * @see Story 8.11: AC 5, Task 4.3, 4.4
 */

import { useState, useMemo, useEffect } from 'react'
import { GitCompareArrows, X, Info, ChevronDown, ChevronRight } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@renderer/components/ui/dialog'
import { Button } from '@renderer/components/ui/button'
import { Skeleton } from '@renderer/components/ui/skeleton'
import { cn } from '@renderer/lib/utils'
import { trpc } from '@renderer/lib/trpc'
import {
  DiffSummaryBar,
  MonacoDiffEditor,
  getLanguageFromPath,
  reconstructFileContent
} from '@renderer/components/diff'
import { useDiffStore } from '@renderer/stores/diff.store'
import type { GitDiffHunk } from '@shared/types/git-diff.types'

export interface CompareWithHeadDialogProps {
  /** Whether the dialog is open */
  open: boolean
  /** Callback when the open state changes */
  onOpenChange: (open: boolean) => void
  /** The commit SHA to compare against HEAD */
  commitSha: string
}

/**
 * Dialog for comparing a commit with current HEAD.
 *
 * Shows:
 * - Whether the commit is an ancestor of HEAD
 * - Files that have changed since the commit
 * - Diff viewer for each changed file
 *
 * @see Story 8.11: Task 4.3, 4.4
 */
export function CompareWithHeadDialog({
  open,
  onOpenChange,
  commitSha
}: CompareWithHeadDialogProps) {
  // Fetch comparison data
  const { data, isLoading, error } = trpc.git.compareWithHead.useQuery(
    { commitSha },
    {
      enabled: open && !!commitSha,
      staleTime: 30 * 1000 // Cache for 30 seconds
    }
  )

  // Get view mode from store
  const { viewMode } = useDiffStore()

  // State for expanded files
  const [expandedFiles, setExpandedFiles] = useState<Map<string, boolean>>(new Map())

  // Initialize all files as collapsed by default
  useEffect(() => {
    if (data?.files) {
      const newExpandedState = new Map<string, boolean>()
      data.files.forEach((file) => {
        newExpandedState.set(file.path, false)
      })
      setExpandedFiles(newExpandedState)
    }
  }, [data?.files])

  const toggleFileExpand = (path: string) => {
    setExpandedFiles((prev) => {
      const next = new Map(prev)
      next.set(path, !prev.get(path))
      return next
    })
  }

  const summary = data?.summary ?? null
  const hasChanges = (data?.files?.length ?? 0) > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] sm:max-w-[900px] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <GitCompareArrows className="h-5 w-5 text-cyan-400" />
            Compare with Current
          </DialogTitle>
          <DialogDescription>
            Changes between commit{' '}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
              {commitSha.substring(0, 7)}
            </code>{' '}
            and current HEAD
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-hidden">
          {/* Loading state */}
          {isLoading && (
            <div className="space-y-3 p-4">
              <Skeleton className="h-6 w-48 bg-muted/20" />
              <Skeleton className="h-4 w-full bg-muted/20" />
              <Skeleton className="h-4 w-[85%] bg-muted/20" />
              <Skeleton className="h-4 w-[92%] bg-muted/20" />
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="flex flex-col items-center justify-center p-8">
              <div className="rounded-lg bg-destructive/10 p-4 text-destructive">
                <p className="text-sm font-medium">Failed to compare commits</p>
                <p className="mt-1 text-xs opacity-80">{error.message}</p>
              </div>
            </div>
          )}

          {/* Loaded state */}
          {data && !isLoading && (
            <div className="flex h-full flex-col">
              {/* Ancestor info banner */}
              {data.isAncestor && !hasChanges && (
                <div className="flex items-center gap-2 border-b border-border/10 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-400">
                  <Info className="h-4 w-4" />
                  <span>
                    This commit is an ancestor of HEAD with no subsequent changes to these
                    files.
                  </span>
                </div>
              )}

              {!data.isAncestor && (
                <div className="flex items-center gap-2 border-b border-border/10 bg-amber-500/5 px-4 py-3 text-sm text-amber-400">
                  <Info className="h-4 w-4" />
                  <span>
                    This commit may have been rebased or is on a different branch lineage.
                  </span>
                </div>
              )}

              {/* No changes state */}
              {!hasChanges && (
                <div className="flex flex-1 flex-col items-center justify-center p-8">
                  <div className="mb-4 rounded-lg border border-border/10 bg-muted/10 p-5">
                    <GitCompareArrows className="h-10 w-10 text-muted-foreground/40" />
                  </div>
                  <h4 className="mb-2 text-base font-semibold text-foreground/80">
                    No changes detected
                  </h4>
                  <p className="max-w-[280px] text-center text-sm leading-relaxed text-muted-foreground/60">
                    The files from this task haven't been modified since the commit.
                  </p>
                </div>
              )}

              {/* Has changes - show diff */}
              {hasChanges && (
                <>
                  {/* Summary bar */}
                  <div className="shrink-0 border-b border-border/10 px-4 py-3">
                    <DiffSummaryBar summary={summary} isRefreshing={false} onRefresh={() => {}} />
                  </div>

                  {/* File list */}
                  <div className="kanban-scroll flex-1 overflow-auto">
                    <div className="divide-y divide-border/[0.08]">
                      {data.files.map((file) => {
                        const isExpanded = expandedFiles.get(file.path) ?? false

                        return (
                          <div key={file.path} className="group">
                            {/* File header */}
                            <div className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-muted/[0.02]">
                              <div className="flex min-w-0 flex-1 items-center gap-2">
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

                                <div className="min-w-0 flex-1">
                                  <div
                                    className="truncate font-mono text-sm text-foreground"
                                    title={file.path}
                                  >
                                    {file.path}
                                  </div>
                                </div>
                              </div>

                              <div className="flex shrink-0 items-center gap-2.5">
                                <span
                                  className={cn(
                                    'rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
                                    file.status === 'added' && 'bg-[#3fb950]/10 text-[#3fb950]',
                                    file.status === 'modified' &&
                                      'bg-[#d29922]/10 text-[#d29922]',
                                    file.status === 'deleted' && 'bg-[#f85149]/10 text-[#f85149]',
                                    file.status === 'renamed' && 'bg-[#58a6ff]/10 text-[#58a6ff]'
                                  )}
                                >
                                  {file.status}
                                </span>

                                <div className="flex items-center gap-1.5 text-xs font-medium tabular-nums">
                                  {file.additions > 0 && (
                                    <span className="text-[#3fb950]">+{file.additions}</span>
                                  )}
                                  {file.deletions > 0 && (
                                    <span className="text-[#f85149]">-{file.deletions}</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* File diff (expanded) */}
                            {isExpanded && file.hunks.length > 0 && (
                              <div className="px-4 pb-3">
                                <CompareFileDiffViewer
                                  hunks={file.hunks}
                                  filePath={file.path}
                                  viewMode={viewMode}
                                />
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Close button */}
        <div className="flex shrink-0 justify-end border-t border-border/10 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="mr-2 h-4 w-4" />
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Internal component for rendering a file diff in the compare dialog.
 */
interface CompareFileDiffViewerProps {
  hunks: GitDiffHunk[]
  filePath: string
  viewMode: 'unified' | 'split'
}

function CompareFileDiffViewer({
  hunks,
  filePath,
  viewMode
}: CompareFileDiffViewerProps): React.JSX.Element {
  const { original, modified } = useMemo(() => reconstructFileContent(hunks), [hunks])
  const language = useMemo(() => getLanguageFromPath(filePath), [filePath])

  const estimatedHeight = useMemo(() => {
    const modifiedLines = modified.split('\n').length
    const originalLines = original.split('\n').length
    const maxLines = Math.max(modifiedLines, originalLines)
    return Math.min(400, Math.max(100, maxLines * 19 + 50))
  }, [original, modified])

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
        height={estimatedHeight}
        viewMode={viewMode}
      />
    </div>
  )
}

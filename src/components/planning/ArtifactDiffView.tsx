/**
 * ArtifactDiffView - Monaco diff wrapper for comparing artifact versions.
 *
 * Wraps the existing MonacoDiffEditor with a header bar showing commit
 * metadata and a view mode toggle (split/unified).
 *
 * Story 9.7: Artifact Version Diff View (AC: 2, 3)
 */

import { useMemo } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { ArrowLeft, X, Columns2, Rows2, AlertTriangle, RotateCw } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Skeleton } from '@renderer/components/ui/skeleton'
import { cn } from '@renderer/lib/utils'
import { trpc } from '@renderer/lib/trpc'
import { useDiffStore } from '@renderer/stores/diff.store'
import { MonacoDiffEditor } from '@renderer/components/diff/MonacoDiffEditor'
import { BMAD_WORKFLOWS } from '@renderer/constants/planning-workspace'
import type { ArtifactVersionEntry } from './ArtifactVersionHistory'

/* ── Props ── */

interface ArtifactDiffViewProps {
  workflowKey: string
  fromCommit: ArtifactVersionEntry | null
  toCommit: ArtifactVersionEntry
  onClose: () => void
}

/* ── Component ── */

export function ArtifactDiffView({
  workflowKey,
  fromCommit,
  toCommit,
  onClose
}: ArtifactDiffViewProps) {
  const { data: project } = trpc.project.getCurrent.useQuery()
  const projectId = project?.id ?? ''

  const viewMode = useDiffStore((s) => s.viewMode)
  const toggleViewMode = useDiffStore((s) => s.toggleViewMode)

  const workflow = useMemo(
    () => BMAD_WORKFLOWS.find((w) => w.key === workflowKey),
    [workflowKey]
  )

  const {
    data: diffData,
    isLoading,
    isError,
    refetch
  } = trpc.planning.getArtifactVersionDiff.useQuery(
    {
      projectId,
      workflowKey,
      fromCommitSha: fromCommit?.commitSha ?? '',
      toCommitSha: toCommit.commitSha
    },
    { enabled: !!projectId }
  )

  /* ── Loading ── */
  // P9: Also show loading skeleton when projectId is not yet resolved
  if (isLoading || !projectId) {
    return (
      <div className="flex h-full flex-col" data-testid="diff-view-loading">
        {/* Header skeleton */}
        <div className="flex items-center gap-3 border-b border-border/50 px-5 py-2.5">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-4 w-32 rounded" />
          <div className="flex-1" />
          <Skeleton className="h-4 w-32 rounded" />
          <Skeleton className="h-6 w-16 rounded" />
        </div>
        {/* Diff skeleton */}
        <div className="flex min-h-0 flex-1 p-4">
          <div className="flex-1 space-y-1.5">
            {Array.from({ length: 20 }).map((_, i) => (
              <Skeleton
                key={i}
                className="h-4 rounded bg-muted/30"
                style={{ width: `${40 + Math.random() * 55}%`, animationDelay: `${i * 30}ms` }}
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  /* ── Error ── */
  if (isError) {
    return (
      <div className="flex h-full flex-col" data-testid="diff-view-error">
        <div className="flex items-center gap-3 border-b border-border/50 px-5 py-2.5">
          <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium text-foreground">Version Diff</span>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <p className="text-sm text-muted-foreground">Could not load diff data.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="gap-1.5 text-xs"
            >
              <RotateCw className="h-3 w-3" />
              Retry
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (!diffData) return null

  const fromLabel = fromCommit
    ? `${fromCommit.message.length > 40 ? `${fromCommit.message.slice(0, 40)}...` : fromCommit.message}`
    : 'Initial (empty)'

  const toLabel = toCommit.message.length > 40
    ? `${toCommit.message.slice(0, 40)}...`
    : toCommit.message

  return (
    <div className="flex h-full flex-col" data-testid="diff-view">
      {/* ── Header bar ── */}
      <div className="shrink-0 border-b border-border/50 bg-card/30">
        <div className="flex items-center gap-3 px-5 py-2">
          {/* Back */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-7 w-7 shrink-0 p-0 text-muted-foreground hover:text-foreground"
            data-testid="diff-back-btn"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>

          {/* From label */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="shrink-0 font-semibold text-muted-foreground/60">From:</span>
              <span className="truncate text-muted-foreground" title={fromCommit?.message ?? 'Initial'}>
                {fromLabel}
              </span>
              {fromCommit && (
                <span className="shrink-0 text-[10px] text-muted-foreground/40">
                  {formatDistanceToNow(new Date(fromCommit.timestamp * 1000), { addSuffix: true })}
                </span>
              )}
            </div>
          </div>

          {/* Separator */}
          <span className="text-muted-foreground/20">&rarr;</span>

          {/* To label */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="shrink-0 font-semibold text-muted-foreground/60">To:</span>
              <span className="truncate text-foreground" title={toCommit.message}>
                {toLabel}
              </span>
              <span className="shrink-0 text-[10px] text-muted-foreground/40">
                {formatDistanceToNow(new Date(toCommit.timestamp * 1000), { addSuffix: true })}
              </span>
            </div>
          </div>

          {/* View mode toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleViewMode}
            className={cn(
              'h-7 shrink-0 gap-1.5 px-2 text-[10px] font-medium',
              'text-muted-foreground hover:text-foreground'
            )}
            title={viewMode === 'split' ? 'Switch to unified view' : 'Switch to split view'}
            data-testid="view-mode-toggle"
          >
            {viewMode === 'split' ? (
              <>
                <Rows2 className="h-3 w-3" />
                Unified
              </>
            ) : (
              <>
                <Columns2 className="h-3 w-3" />
                Split
              </>
            )}
          </Button>

          {/* Close */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-7 w-7 shrink-0 p-0 text-muted-foreground hover:text-foreground"
            data-testid="diff-close-btn"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ── Diff body ── */}
      <div className="flex min-h-0 flex-1 overflow-auto">
        <MonacoDiffEditor
          original={diffData.original}
          modified={diffData.modified}
          language="markdown"
          filePath={workflow?.outputFilename ?? workflowKey}
          viewMode={viewMode}
          className="w-full"
          height="100%"
        />
      </div>
    </div>
  )
}

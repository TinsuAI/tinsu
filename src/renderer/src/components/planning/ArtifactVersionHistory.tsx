/**
 * ArtifactVersionHistory - Compact vertical timeline of artifact git versions.
 *
 * Displays commit history for a planning artifact file with radio-button
 * selectors for choosing two versions to compare in the diff view.
 *
 * Story 9.7: Artifact Version Diff View (AC: 1, 4)
 */

import { useState, useMemo } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { ArrowLeft, GitCommitHorizontal, Clock, User } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Skeleton } from '@renderer/components/ui/skeleton'
import { cn } from '@renderer/lib/utils'
import { trpc } from '@renderer/lib/trpc'

/* ── Types ── */

export interface ArtifactVersionEntry {
  commitSha: string
  author: string
  timestamp: number // Unix timestamp in seconds
  message: string
}

interface ArtifactVersionHistoryProps {
  workflowKey: string
  onSelectVersions: (from: ArtifactVersionEntry | null, to: ArtifactVersionEntry) => void
  onClose: () => void
}

/* ── Component ── */

export function ArtifactVersionHistory({
  workflowKey,
  onSelectVersions,
  onClose
}: ArtifactVersionHistoryProps) {
  const { data: project } = trpc.project.getCurrent.useQuery()
  const projectId = project?.id ?? ''

  const {
    data: versions,
    isLoading,
    isError
  } = trpc.planning.getArtifactVersionHistory.useQuery(
    { projectId, workflowKey },
    { enabled: !!projectId }
  )

  // Default selection: from = second most recent, to = most recent
  const [fromIndex, setFromIndex] = useState<number | null>(null)
  const [toIndex, setToIndex] = useState<number>(0)

  // Initialize defaults when data loads
  const resolvedFromIndex = useMemo(() => {
    if (fromIndex !== null) return fromIndex
    if (versions && versions.length >= 2) return 1
    return null
  }, [fromIndex, versions])

  // P5: Also require from !== to (comparing a commit to itself produces no diff)
  const canCompare =
    versions &&
    versions.length >= 2 &&
    resolvedFromIndex !== null &&
    resolvedFromIndex !== toIndex

  const handleCompare = () => {
    if (!versions || resolvedFromIndex === null) return
    const from = versions[resolvedFromIndex] ?? null
    // P7: Bounds-check toIndex in case versions array shrinks after a refetch
    const safeToIndex = toIndex < versions.length ? toIndex : 0
    const to = versions[safeToIndex]
    if (!to) return
    onSelectVersions(from, to)
  }

  /* ── Loading ── */
  if (isLoading) {
    return (
      <div className="flex h-full flex-col" data-testid="version-history-loading">
        {/* Header skeleton */}
        <div className="flex items-center gap-3 border-b border-border/50 px-5 py-3">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-5 w-36 rounded" />
        </div>
        {/* Timeline skeleton */}
        <div className="flex-1 overflow-y-auto p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="mb-3 flex items-start gap-3">
              <Skeleton className="mt-1 h-4 w-4 shrink-0 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 rounded" style={{ width: `${60 + Math.random() * 30}%` }} />
                <Skeleton className="h-3 w-24 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  /* ── Error ── */
  if (isError) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-3 border-b border-border/50 px-5 py-3">
          <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium text-foreground">Version History</span>
        </div>
        <div className="flex flex-1 items-center justify-center p-6">
          <p className="text-sm text-muted-foreground">Failed to load version history.</p>
        </div>
      </div>
    )
  }

  /* ── Empty state ── */
  if (!versions || versions.length === 0) {
    return (
      <div className="flex h-full flex-col" data-testid="version-history">
        <div className="flex items-center gap-3 border-b border-border/50 px-5 py-3">
          <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium text-foreground">Version History</span>
        </div>
        <div className="flex flex-1 items-center justify-center p-6">
          <p className="text-sm text-muted-foreground">
            No git history available for this artifact.
          </p>
        </div>
      </div>
    )
  }

  /* ── Single version ── */
  if (versions.length === 1) {
    return (
      <div className="flex h-full flex-col" data-testid="version-history">
        <div className="flex items-center gap-3 border-b border-border/50 px-5 py-3">
          <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium text-foreground">Version History</span>
        </div>
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="text-center">
            <GitCommitHorizontal className="mx-auto mb-2 h-6 w-6 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              Only one version exists. Make changes and commit to see version history.
            </p>
          </div>
        </div>
      </div>
    )
  }

  /* ── Timeline ── */
  return (
    <div className="flex h-full flex-col" data-testid="version-history">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border/50 px-5 py-3">
        <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium text-foreground">Version History</span>
        <span className="text-xs text-muted-foreground/60">
          {versions.length} version{versions.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Column labels */}
      <div className="flex items-center gap-2 border-b border-border/30 px-5 py-1.5">
        <div className="w-8 text-center text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/50">
          From
        </div>
        <div className="w-8 text-center text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/50">
          To
        </div>
        <div className="flex-1" />
      </div>

      {/* Version entries */}
      <div className="flex-1 overflow-y-auto">
        {versions.map((version, idx) => {
          const isCurrent = idx === 0
          const isFromSelected = resolvedFromIndex === idx
          const isToSelected = toIndex === idx

          return (
            <div
              key={version.commitSha}
              className={cn(
                'group relative flex items-start gap-2 border-b border-border/20 px-5 py-2.5 transition-colors',
                'hover:bg-muted/50',
                (isFromSelected || isToSelected) && 'bg-muted/30'
              )}
              data-testid="version-entry"
            >
              {/* From radio */}
              <button
                type="button"
                onClick={() => setFromIndex(idx)}
                className={cn(
                  'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors',
                  isFromSelected
                    ? 'border-cyan-500 bg-cyan-500/20'
                    : 'border-border/60 hover:border-muted-foreground/60'
                )}
                aria-label={`Select version ${idx + 1} as from`}
                data-testid={`from-selector-${idx}`}
              >
                {isFromSelected && (
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                )}
              </button>

              {/* To radio */}
              <button
                type="button"
                onClick={() => setToIndex(idx)}
                className={cn(
                  'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors',
                  isToSelected
                    ? 'border-cyan-500 bg-cyan-500/20'
                    : 'border-border/60 hover:border-muted-foreground/60'
                )}
                aria-label={`Select version ${idx + 1} as to`}
                data-testid={`to-selector-${idx}`}
              >
                {isToSelected && (
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                )}
              </button>

              {/* Timeline connector dot */}
              <div className="relative mt-1 flex flex-col items-center">
                <div
                  className={cn(
                    'h-2 w-2 shrink-0 rounded-full',
                    isCurrent ? 'bg-cyan-500' : 'bg-muted-foreground/30'
                  )}
                />
                {idx < versions.length - 1 && (
                  <div className="mt-0.5 h-full w-px bg-border/40" />
                )}
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1 pl-1">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'truncate text-xs font-medium',
                      isCurrent ? 'text-foreground' : 'text-muted-foreground'
                    )}
                    title={version.message}
                  >
                    {version.message.length > 60
                      ? `${version.message.slice(0, 60)}...`
                      : version.message}
                  </span>
                  {isCurrent && (
                    <span className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider bg-cyan-500/20 text-cyan-400">
                      Current
                    </span>
                  )}
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground/50">
                  <span className="flex items-center gap-0.5">
                    <Clock className="h-2.5 w-2.5" />
                    {formatDistanceToNow(new Date(version.timestamp * 1000), { addSuffix: true })}
                  </span>
                  <span className="flex items-center gap-0.5">
                    <User className="h-2.5 w-2.5" />
                    {version.author}
                  </span>
                  <span className="font-mono text-muted-foreground/30">
                    {version.commitSha.slice(0, 7)}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Compare button */}
      <div className="shrink-0 border-t border-border/50 px-5 py-3">
        <Button
          variant="outline"
          size="sm"
          onClick={handleCompare}
          disabled={!canCompare}
          className="w-full gap-2 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="compare-selected-btn"
        >
          Compare Selected
        </Button>
      </div>
    </div>
  )
}

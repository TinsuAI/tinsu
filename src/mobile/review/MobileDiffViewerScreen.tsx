/**
 * MobileDiffViewerScreen — full-screen mobile review screen.
 *
 * Replaces the old placeholder `if (route === 'diff')` in MobileApp.tsx.
 * Mounted as a full-screen push by MobileRouteRenderer when route starts with
 * `review:`. Owns: header chrome, unified diff renderer, file tree sheet,
 * three-button action bar, three sheets (approve confirm / feedback / rejection),
 * and conflict banner.
 *
 * Cross-tree imports (allowed per AC 18):
 *   @renderer/hooks/useApprovalMutation  — approve flow + GitConflict detection
 *   @renderer/hooks/useRejectionMutation — reject + request-changes flow
 *   @renderer/hooks/useDiff              — diff fetch (pure data, mobile-safe)
 *   @renderer/lib/trpc                   — task fetch via getById
 *   @renderer/lib/utils                  — cn, hapticFeedback
 *   @shared/types/git-diff.types         — GitDiffFile, GitDiffHunk, GitDiffResult
 *   @shared/types/task.types             — Task
 *
 * Forbidden imports (AC 18): nothing from @renderer/components/review/**,
 *   @renderer/components/ui/(dialog|textarea|button), or any desktop review store.
 *
 * Token discipline (AC 21):
 *   - LINE_COLOR_CONFIG: AC-21 exception #1 — emerald/red for diff add/remove
 *     (mirrors UX-DR10 diff colors with +/- prefix for a11y per UX-DR19).
 *   - All other surfaces use Calm Command tokens only (bg-card, bg-muted/40,
 *     text-foreground, text-muted-foreground, border-border/40, bg-primary,
 *     bg-destructive).
 *
 * Windowing strategy (AC 15):
 *   For diffs >500 total lines: renders only lines within
 *   [scrollTop - viewport, scrollTop + 2*viewport] (50% overscan top, 100% bottom).
 *   Uses a fixed 20 px line-height assumption (matches text-xs leading-5 in Tailwind).
 *   A ResizeObserver on the scroll container recomputes the visible range on resize.
 *   Spacer divs above/below the rendered window preserve total scroll height.
 *   Trade-off: simple and dependency-free vs. more accurate virtual list (react-virtual).
 *   Threshold of 500 lines chosen empirically; T3.5-9 may revisit on real device profiling.
 *   For diffs ≤500 lines: no windowing — all lines rendered directly.
 *
 * @see Story T3.5-6 — all ACs
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { AlertCircle } from 'lucide-react'
import { cn, hapticFeedback } from '@renderer/lib/utils'
import { trpc } from '@renderer/lib/trpc'
import { useApprovalMutation } from '@renderer/hooks/useApprovalMutation'
import { useRejectionMutation } from '@renderer/hooks/useRejectionMutation'
import { useDiff } from '@renderer/hooks/useDiff'
import type { GitDiffFile, GitDiffHunk, GitDiffLine } from '@shared/types/git-diff.types'
import { useMobileNavStore } from '../shell/mobile-nav.store'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { MobileEmptyState } from '../primitives/MobileEmptyState'
import { MobileLoadingSkeleton } from '../primitives/MobileLoadingSkeleton'
import { MobileSheet } from '../primitives/MobileSheet'
import { MobileFileTreeSheet } from './MobileFileTreeSheet'
import { MobileReviewActionBar } from './MobileReviewActionBar'
import { MobileFeedbackSheet } from './MobileFeedbackSheet'
import { MobileRejectionSheet } from './MobileRejectionSheet'

/* ─── Title helper ──────────────────────────────────────────────────── */

/**
 * Truncate title to 32 chars with ellipsis, fallback to Task #<short-id>.
 * Intentionally copied from MobileTaskWorkspaceScreen.tsx — do NOT import
 * that local helper across files (AC 3 requirement).
 */
function buildTitle(title: string | undefined | null, id: string | undefined | null): string {
  const raw = title?.trim() || `Task #${(id ?? '?').slice(0, 6)}`
  return raw.length > 32 ? raw.slice(0, 32) + '…' : raw
}

/* ─── Diff line color config ────────────────────────────────────────── */

/**
 * LINE_COLOR_CONFIG — AC-21 exception #1.
 * Emerald/red diff colors mirror UX-DR10. The +/- prefix provides the
 * text-based accessibility cue mandated by UX-DR19. No hex literals.
 */
const LINE_COLOR_CONFIG = {
  add:     'bg-emerald-500/10 text-emerald-200',
  remove:  'bg-red-500/10 text-red-200',
  context: 'text-muted-foreground/80',
} as const

/* ─── Status pill config ────────────────────────────────────────────── */

const STATUS_PILL_CONFIG: Record<GitDiffFile['status'], { bg: string; text: string; label: string }> = {
  added:    { bg: 'bg-emerald-500/15', text: 'text-emerald-400', label: 'added' },
  modified: { bg: 'bg-sky-500/15',     text: 'text-sky-400',     label: 'modified' },
  deleted:  { bg: 'bg-red-500/15',     text: 'text-red-400',     label: 'deleted' },
  renamed:  { bg: 'bg-amber-500/15',   text: 'text-amber-400',   label: 'renamed' },
}

/* ─── Line height constant (windowing) ─────────────────────────────── */

/** Fixed line height assumption for windowing math (AC 15). Matches text-xs leading-5. */
const LINE_HEIGHT_PX = 20

/* ─── Windowing helpers ─────────────────────────────────────────────── */

function countTotalLines(files: GitDiffFile[]): number {
  return files.reduce(
    (s, f) => s + f.hunks.reduce((sh, h) => sh + h.lines.length, 0),
    0,
  )
}

/* ─── Local diff renderer components ───────────────────────────────── */

/** Single unified diff line row. data-testid="diff-line" for windowing test (AC 20r). */
function DiffLine({ line }: { line: GitDiffLine }) {
  const prefix = line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '
  const colorClass = LINE_COLOR_CONFIG[line.type === 'add' ? 'add' : line.type === 'remove' ? 'remove' : 'context']

  return (
    <div
      data-testid="diff-line"
      className={cn('flex min-w-0 font-mono text-xs leading-5 select-text', colorClass)}
      style={{ height: LINE_HEIGHT_PX }}
    >
      {/* Line number gutter — old/new */}
      <span className="w-8 shrink-0 text-[10px] text-muted-foreground/30 text-right pr-1 select-none">
        {line.oldLineNo ?? line.newLineNo ?? ''}
      </span>
      {/* Prefix gutter */}
      <span className="w-4 shrink-0 text-center select-none" aria-hidden>
        {prefix}
      </span>
      {/* Line content — horizontal scroll for long lines */}
      <pre className="flex-1 min-w-0 overflow-x-auto whitespace-pre">
        <code>{line.content}</code>
      </pre>
    </div>
  )
}

/** Diff hunk with header row and lines. */
function DiffHunkBlock({ hunk }: { hunk: GitDiffHunk }) {
  return (
    <div>
      {/* Hunk header */}
      <div className="font-mono text-[10px] text-muted-foreground/60 bg-muted/20 px-4 py-0.5 select-none">
        {hunk.header}
      </div>
      {hunk.lines.map((line, i) => (
        <DiffLine key={i} line={line} />
      ))}
    </div>
  )
}

/* ─── Main component ────────────────────────────────────────────────── */

interface MobileDiffViewerScreenProps {
  taskId: string
}

export function MobileDiffViewerScreen({ taskId }: MobileDiffViewerScreenProps) {
  /* ── Task query ───────────────────────────────────────────────────── */
  const { data: task, isLoading: taskLoading, error: taskError } = trpc.tasks.getById.useQuery(
    { id: taskId },
    { enabled: !!taskId },
  )

  /* ── Diff query (cross-tree hook — AC 5, 18) ─────────────────────── */
  const { diff, isLoading: diffLoading } = useDiff({
    taskId,
    mode: task?.status === 'done' ? 'historical' : 'worktree',
    worktreePath: task?.worktree_path ?? null,
    mergeCommitSha: task?.merge_commit_sha ?? null,
    baselineCommit: task?.last_review_commit ?? null,
  })

  /* ── Navigation ───────────────────────────────────────────────────── */
  const reduced = useReducedMotion()

  /* ── Local state ──────────────────────────────────────────────────── */
  const [conflictMessage, setConflictMessage] = useState<string | null>(null)
  const [approveSheetOpen, setApproveSheetOpen] = useState(false)
  const [feedbackSheetOpen, setFeedbackSheetOpen] = useState(false)
  const [rejectionSheetOpen, setRejectionSheetOpen] = useState(false)
  const [fileTreeOpen, setFileTreeOpen] = useState(false)

  /* ── Windowing state ──────────────────────────────────────────────── */
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [clientHeight, setClientHeight] = useState(600)

  /* ── File refs for scrollToFile ───────────────────────────────────── */
  const fileRefs = useRef<Record<string, HTMLDivElement | null>>({})

  /* ── Approval mutation (AC 12) ────────────────────────────────────── */
  const { approve, isPending: isApproving } = useApprovalMutation({
    taskId,
    storyNumber: task?.story_number ? Number(task.story_number) : null,
    projectId: task?.project_id ?? '',
    onSuccess: () => {
      setApproveSheetOpen(false)
      useMobileNavStore.getState().popRoute()
    },
    onConflict: (msg) => {
      setApproveSheetOpen(false)
      setConflictMessage(msg)
    },
    onError: () => {
      setApproveSheetOpen(false)
    },
  })

  /* ── Rejection mutation (AC 14) — handles both Reject and Request Changes ── */
  const { reject, isPending: isRejecting } = useRejectionMutation({
    taskId,
    storyNumber: task?.story_number ?? null,
    projectId: task?.project_id ?? '',
    onSuccess: () => {
      setFeedbackSheetOpen(false)
      setRejectionSheetOpen(false)
      useMobileNavStore.getState().popRoute()
    },
  })

  /* ── ResizeObserver for windowing (AC 15, 17) ────────────────────── */
  useEffect(() => {
    const el = scrollContainerRef.current
    if (!el) return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) setClientHeight(entry.contentRect.height)
    })

    observer.observe(el)
    setClientHeight(el.clientHeight)

    return () => observer.disconnect()
  }, [])

  /* ── Scroll handler for windowing ─────────────────────────────────── */
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current
    if (el) setScrollTop(el.scrollTop)
  }, [])

  /* ── scrollToFile helper (AC 6) ───────────────────────────────────── */
  const scrollToFile = useCallback(
    (path: string) => {
      // Wait for file tree sheet close animation before scrolling (150 ms + rAF)
      setTimeout(() => {
        requestAnimationFrame(() => {
          const el = fileRefs.current[path]
          if (el) {
            el.scrollIntoView({
              behavior: reduced ? 'auto' : 'smooth',
              block: 'start',
            })
          }
        })
      }, 150)
    },
    [reduced],
  )

  /* ── Loading / error / status guard ──────────────────────────────── */
  const isLoading = taskLoading || diffLoading

  if (isLoading) {
    return (
      <div
        className="flex flex-col h-[100dvh] bg-background"
        data-testid="mobile-review-screen"
      >
        <ReviewHeader title="Loading…" fileCount={0} onBack={() => useMobileNavStore.getState().popRoute()} onFilesPress={() => {}} />
        <div className="flex-1 p-4 flex flex-col gap-4">
          <MobileLoadingSkeleton variant="card" />
          <MobileLoadingSkeleton variant="card" />
          <MobileLoadingSkeleton variant="card" />
        </div>
      </div>
    )
  }

  if (taskError || !task) {
    return (
      <div
        className="flex flex-col h-[100dvh] bg-background"
        data-testid="mobile-review-screen"
      >
        <ReviewHeader title="Error" fileCount={0} onBack={() => useMobileNavStore.getState().popRoute()} onFilesPress={() => {}} />
        <div className="flex-1 flex items-center justify-center">
          <MobileEmptyState
            title="Couldn't load task"
            subtitle={taskError instanceof Error ? taskError.message : 'An error occurred loading this task.'}
          />
        </div>
      </div>
    )
  }

  if (task.status !== 'review') {
    return (
      <div
        className="flex flex-col h-[100dvh] bg-background"
        data-testid="mobile-review-screen"
      >
        <ReviewHeader
          title={buildTitle(task.title, task.id)}
          fileCount={0}
          onBack={() => useMobileNavStore.getState().popRoute()}
          onFilesPress={() => {}}
        />
        <div className="flex-1 flex items-center justify-center">
          <MobileEmptyState
            title="Not in review"
            subtitle="This task is no longer awaiting review."
            action={
              <button
                type="button"
                onClick={() => useMobileNavStore.getState().popRoute()}
                className="min-h-[2.75rem] px-6 rounded-xl bg-muted/50 text-foreground border border-border/40 text-sm font-semibold"
              >
                Go back
              </button>
            }
          />
        </div>
      </div>
    )
  }

  const files = diff?.files ?? []
  const fileCount = files.length
  const displayTitle = buildTitle(task.title, task.id)

  if (!diffLoading && diff && files.length === 0) {
    return (
      <div
        className="flex flex-col h-[100dvh] bg-background"
        data-testid="mobile-review-screen"
      >
        <ReviewHeader
          title={displayTitle}
          fileCount={0}
          onBack={() => useMobileNavStore.getState().popRoute()}
          onFilesPress={() => {}}
        />
        <div className="flex-1 flex items-center justify-center">
          <MobileEmptyState
            title="No changes detected"
            subtitle="No file changes found for this task."
          />
        </div>
        <MobileReviewActionBar
          onApprove={() => setApproveSheetOpen(true)}
          onReject={() => setRejectionSheetOpen(true)}
          onRequestChanges={() => setFeedbackSheetOpen(true)}
          isApproving={isApproving}
          isRejecting={isRejecting}
          hasConflict={!!conflictMessage}
        />
      </div>
    )
  }

  /* ── Windowing computation (AC 15) ───────────────────────────────── */
  const totalLines = countTotalLines(files)
  const useWindowing = totalLines > 500

  const viewport = Math.ceil(clientHeight / LINE_HEIGHT_PX)
  const visibleStart = useWindowing
    ? Math.max(0, Math.floor(scrollTop / LINE_HEIGHT_PX) - viewport)
    : 0
  const visibleEnd = useWindowing
    ? Math.floor(scrollTop / LINE_HEIGHT_PX) + 2 * viewport
    : Infinity

  /* ── Render diff with optional windowing ─────────────────────────── */
  let lineIndex = 0
  const topSpacerLines: number[] = []
  const bottomSpacerLines: number[] = []
  let lastRenderedEnd = 0

  // Pre-compute per-file line ranges for windowing
  const fileLineRanges: { start: number; end: number }[] = []
  let runningIdx = 0
  for (const file of files) {
    const fileStart = runningIdx
    for (const hunk of file.hunks) {
      runningIdx += hunk.lines.length
    }
    fileLineRanges.push({ start: fileStart, end: runningIdx })
  }

  /* ─── Main render ─────────────────────────────────────────────────── */
  return (
    <div
      className="flex flex-col h-[100dvh] bg-background"
      data-testid="mobile-review-screen"
    >
      {/* ── Header ────────────────────────────────────────────────── */}
      <ReviewHeader
        title={displayTitle}
        fileCount={fileCount}
        onBack={() => useMobileNavStore.getState().popRoute()}
        onFilesPress={() => setFileTreeOpen(true)}
      />

      {/* ── Main scroll area ──────────────────────────────────────── */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
      >
        {/* Conflict banner (AC 13) — non-dismissible, role="alert" for SR */}
        {conflictMessage && (
          <div
            data-testid="mobile-review-conflict-banner"
            role="alert"
            className="bg-destructive/10 border border-destructive/40 text-destructive p-3 rounded-lg flex items-start gap-2 m-4"
          >
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" aria-hidden />
            <div>
              <p className="font-semibold text-sm">Merge conflict</p>
              <p className="text-sm opacity-80 mt-0.5">{conflictMessage}</p>
              <p className="text-sm mt-1">Resolve conflicts on desktop to approve.</p>
            </div>
          </div>
        )}

        {/* Diff renderer (AC 7) */}
        {(() => {
          lineIndex = 0
          const fileNodes: React.ReactNode[] = []

          for (let fi = 0; fi < files.length; fi++) {
            const file = files[fi]
            const fileLinesStart = fileLineRanges[fi]?.start ?? 0
            const fileLinesEnd = fileLineRanges[fi]?.end ?? 0

            // Skip entire file if windowing and file is out of range
            if (useWindowing && fileLinesEnd <= visibleStart) {
              lineIndex = fileLinesEnd
              continue
            }
            if (useWindowing && fileLinesStart >= visibleEnd) {
              lineIndex = fileLinesEnd
              continue
            }

            const pill = STATUS_PILL_CONFIG[file.status]

            const hunkNodes: React.ReactNode[] = []
            for (const hunk of file.hunks) {
              if (useWindowing) {
                const hunkStart = lineIndex
                const hunkEnd = lineIndex + hunk.lines.length

                if (hunkEnd <= visibleStart || hunkStart >= visibleEnd) {
                  lineIndex += hunk.lines.length
                  continue
                }

                const visibleLines = hunk.lines.filter((_, li) => {
                  const absIdx = hunkStart + li
                  return absIdx >= visibleStart && absIdx < visibleEnd
                })

                const skippedTop = Math.max(0, visibleStart - hunkStart)
                const skippedBottom = Math.max(0, hunkEnd - Math.min(visibleEnd, hunkEnd))

                hunkNodes.push(
                  <div key={hunk.header + hunkStart}>
                    <div className="font-mono text-[10px] text-muted-foreground/60 bg-muted/20 px-4 py-0.5 select-none">
                      {hunk.header}
                    </div>
                    {skippedTop > 0 && (
                      <div
                        style={{ height: skippedTop * LINE_HEIGHT_PX }}
                        aria-hidden
                      />
                    )}
                    {visibleLines.map((line, i) => (
                      <DiffLine key={i} line={line} />
                    ))}
                    {skippedBottom > 0 && (
                      <div
                        style={{ height: skippedBottom * LINE_HEIGHT_PX }}
                        aria-hidden
                      />
                    )}
                  </div>,
                )
                lineIndex = hunkEnd
              } else {
                hunkNodes.push(
                  <DiffHunkBlock key={hunk.header + lineIndex} hunk={hunk} />,
                )
                lineIndex += hunk.lines.length
              }
            }

            fileNodes.push(
              <div
                key={file.path}
                ref={(el) => { fileRefs.current[file.path] = el }}
              >
                {/* Sticky file header (AC 7a) */}
                <div className="sticky top-0 z-10 flex items-center gap-2 px-3 py-2 bg-card/95 backdrop-blur-sm border-b border-border/40">
                  <span
                    className={cn(
                      'rounded px-1.5 py-0.5 text-[10px] uppercase font-semibold shrink-0',
                      pill.bg,
                      pill.text,
                    )}
                  >
                    {pill.label}
                  </span>
                  <span className="flex-1 font-mono text-xs text-foreground truncate">
                    {file.path.split('/').pop() ?? file.path}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                    +{file.additions} -{file.deletions}
                  </span>
                </div>

                {/* Diff hunks */}
                {hunkNodes}
              </div>,
            )
          }

          void topSpacerLines
          void bottomSpacerLines
          void lastRenderedEnd

          return fileNodes
        })()}
      </div>

      {/* ── Action bar ────────────────────────────────────────────── */}
      <MobileReviewActionBar
        onApprove={() => setApproveSheetOpen(true)}
        onReject={() => setRejectionSheetOpen(true)}
        onRequestChanges={() => setFeedbackSheetOpen(true)}
        isApproving={isApproving}
        isRejecting={isRejecting}
        hasConflict={!!conflictMessage}
      />

      {/* ── File tree sheet (AC 6) ─────────────────────────────────── */}
      <MobileFileTreeSheet
        open={fileTreeOpen}
        onOpenChange={setFileTreeOpen}
        files={files}
        onFileSelect={scrollToFile}
      />

      {/* ── Approve confirmation sheet (AC 9) ─────────────────────── */}
      <MobileSheet
        open={approveSheetOpen}
        onOpenChange={setApproveSheetOpen}
        snapPoint="fit"
        title="Approve & merge"
        description="This will merge the changes into main and complete the task."
      >
        <div data-testid="mobile-review-approve-confirm-sheet" className="flex items-center gap-3 pb-2">
          <button
            type="button"
            onClick={() => setApproveSheetOpen(false)}
            disabled={isApproving}
            className={cn(
              'flex-1 min-h-[2.75rem] rounded-xl',
              'flex items-center justify-center',
              'text-sm font-semibold',
              'bg-muted/50 text-foreground border border-border/40',
              'transition-opacity duration-150',
              'disabled:opacity-50 disabled:pointer-events-none',
            )}
          >
            Cancel
          </button>
          <button
            type="button"
            data-testid="mobile-review-approve-confirm-btn"
            aria-label="Confirm approval"
            onClick={() => {
              hapticFeedback([10, 30, 10])
              approve()
            }}
            disabled={isApproving}
            className={cn(
              'flex-1 min-h-[2.75rem] rounded-xl',
              'flex items-center justify-center',
              'text-sm font-semibold',
              'bg-primary text-primary-foreground',
              'transition-opacity duration-150',
              'disabled:opacity-50 disabled:pointer-events-none',
            )}
          >
            {isApproving ? 'Approving…' : 'Confirm approval'}
          </button>
        </div>
      </MobileSheet>

      {/* ── Feedback (Request Changes) sheet (AC 10) ──────────────── */}
      <MobileFeedbackSheet
        open={feedbackSheetOpen}
        onOpenChange={setFeedbackSheetOpen}
        onSubmit={(feedback) => {
          hapticFeedback([10, 30, 10])
          reject(feedback)
        }}
        isSubmitting={isRejecting}
      />

      {/* ── Rejection sheet (AC 11) ────────────────────────────────── */}
      <MobileRejectionSheet
        open={rejectionSheetOpen}
        onOpenChange={setRejectionSheetOpen}
        onSubmit={(feedback) => {
          hapticFeedback([10, 30, 10])
          reject(feedback)
        }}
        isSubmitting={isRejecting}
      />
    </div>
  )
}

/* ─── Inline header component ───────────────────────────────────────── */

/**
 * ReviewHeader — inline chrome mirroring MobileTopAppBar's shape.
 * Not extracted to a separate file per AC 3 (self-contained screen header).
 */
interface ReviewHeaderProps {
  title: string
  fileCount: number
  onBack: () => void
  onFilesPress: () => void
}

function ReviewHeader({ title, fileCount, onBack, onFilesPress }: ReviewHeaderProps) {
  return (
    <div
      className="w-full bg-card/95 backdrop-blur-xl border-b border-border/40 shrink-0"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="flex items-center h-[52px] px-2 gap-2">
        {/* Back button */}
        <button
          type="button"
          data-testid="mobile-review-back-button"
          aria-label="Back"
          onClick={onBack}
          className={cn(
            'flex items-center justify-center rounded-lg shrink-0',
            'min-h-[2.75rem] min-w-[2.75rem]',
            'text-foreground',
            'transition-opacity duration-150 active:opacity-60',
          )}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Centered title */}
        <span
          data-testid="mobile-review-title"
          className="flex-1 text-sm font-semibold text-foreground truncate text-center px-1 leading-none"
        >
          {title}
        </span>

        {/* Files pill */}
        {fileCount > 0 ? (
          <button
            type="button"
            data-testid="mobile-review-files-pill"
            aria-label="Show file tree"
            onClick={onFilesPress}
            className={cn(
              'shrink-0',
              'bg-card/60 border border-border/40 rounded-full px-2.5 py-1',
              'text-xs text-muted-foreground',
              'transition-opacity duration-150 active:opacity-70',
            )}
          >
            📄 {fileCount} {fileCount === 1 ? 'file' : 'files'}
          </button>
        ) : (
          // Placeholder to keep layout balanced when no files
          <div className="min-w-[2.75rem]" />
        )}
      </div>
    </div>
  )
}

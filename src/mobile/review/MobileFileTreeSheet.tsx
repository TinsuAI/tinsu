/**
 * MobileFileTreeSheet — bottom sheet listing diff files for the review screen.
 *
 * Renders inside a MobileSheet (snapPoint="half") with sorted file rows using
 * MobileListItem. Files sort by: modified → added → deleted → renamed (AC 6).
 *
 * AC-21 token-discipline exception (documented here):
 *   STATUS_COLOR map uses named Tailwind colors (emerald/red/amber/sky) for
 *   file status icons and +/- stats. This is a deliberate exception matching
 *   UX-DR10 semantic status colors. All other surfaces use Calm Command tokens.
 *
 * Cross-tree imports: none. All dependencies are mobile-tree or shared types.
 *
 * @see Story T3.5-6 — AC 6, Task 2
 */

import { Plus, Circle, Minus, ArrowRight } from 'lucide-react'
import { MobileSheet } from '../primitives/MobileSheet'
import { MobileListItem } from '../primitives/MobileListItem'
import type { GitDiffFile } from '@shared/types/git-diff.types'

/* ─── Status configuration ─────────────────────────────────────────── */

/**
 * STATUS_COLOR: AC-21 exception — named Tailwind colors for file status icons.
 * Mirrors UX-DR10 semantic diff colors. Only used inside this component.
 */
const STATUS_COLOR: Record<GitDiffFile['status'], string> = {
  added:    'text-emerald-400',
  modified: 'text-sky-400',
  deleted:  'text-red-400',
  renamed:  'text-amber-400',
}

const STATUS_ORDER: Record<GitDiffFile['status'], number> = {
  modified: 0,
  added:    1,
  deleted:  2,
  renamed:  3,
}

/* ─── Local helpers ─────────────────────────────────────────────────── */

function StatusIcon({ status }: { status: GitDiffFile['status'] }) {
  const cls = `h-4 w-4 ${STATUS_COLOR[status]}`
  switch (status) {
    case 'added':    return <Plus className={cls} aria-hidden />
    case 'deleted':  return <Minus className={cls} aria-hidden />
    case 'renamed':  return <ArrowRight className={cls} aria-hidden />
    default:         return <Circle className={cls} aria-hidden />
  }
}

function ChangeStat({
  additions,
  deletions,
}: {
  additions: number
  deletions: number
}) {
  return (
    <span className="font-mono text-[10px] flex gap-1 shrink-0">
      {/* AC-21 exception: emerald/red for addition/deletion counts */}
      <span className="text-emerald-400">+{additions}</span>
      <span className="text-red-400">-{deletions}</span>
    </span>
  )
}

/* ─── Props ─────────────────────────────────────────────────────────── */

interface MobileFileTreeSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  files: GitDiffFile[]
  onFileSelect: (path: string) => void
}

/* ─── Component ─────────────────────────────────────────────────────── */

export function MobileFileTreeSheet({
  open,
  onOpenChange,
  files,
  onFileSelect,
}: MobileFileTreeSheetProps) {
  // Sort files: modified first, then added, deleted, renamed (AC 6, Task 2.3)
  const sorted = [...files].sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status],
  )

  return (
    <MobileSheet
      open={open}
      onOpenChange={onOpenChange}
      snapPoint="half"
      title="Files changed"
      description={`${files.length} file${files.length === 1 ? '' : 's'} modified`}
    >
      <div data-testid="mobile-review-file-tree-sheet">
        {sorted.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            No file changes
          </p>
        ) : (
          <div role="list" aria-label="Changed files">
            {sorted.map((file) => {
              const filename = file.path.split('/').pop() ?? file.path
              return (
                <MobileListItem
                  key={file.path}
                  leadingIcon={<StatusIcon status={file.status} />}
                  title={filename}
                  subtitle={file.path}
                  trailing={
                    <ChangeStat
                      additions={file.additions}
                      deletions={file.deletions}
                    />
                  }
                  onPress={() => {
                    onFileSelect(file.path)
                    onOpenChange(false)
                  }}
                />
              )
            })}
          </div>
        )}
      </div>
    </MobileSheet>
  )
}

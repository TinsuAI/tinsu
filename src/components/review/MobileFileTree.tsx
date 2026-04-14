import { useMemo, useCallback } from 'react'
import { Plus, Circle, Minus, ArrowRight, ChevronRight } from 'lucide-react'
import { cn, hapticFeedback } from '@renderer/lib/utils'
import type { GitDiffFile } from '@shared/types/git-diff.types'

export interface MobileFileTreeProps {
  files: GitDiffFile[]
  onFileSelect: (path: string) => void
  selectedFile?: string | null
  className?: string
}

const statusIcons: Record<GitDiffFile['status'], React.JSX.Element> = {
  added: <Plus className="h-4 w-4 text-[#3fb950]" />,
  modified: <Circle className="h-3.5 w-3.5 text-[#d29922]" fill="currentColor" />,
  deleted: <Minus className="h-4 w-4 text-[#f85149]" />,
  renamed: <ArrowRight className="h-4 w-4 text-[#58a6ff]" />
}

const statusColors: Record<GitDiffFile['status'], string> = {
  added: 'text-[#3fb950]',
  modified: 'text-[#d29922]',
  deleted: 'text-[#f85149]',
  renamed: 'text-[#58a6ff]'
}

/**
 * MobileFileTree - Touch-friendly file tree for mobile review.
 * AC: 2, 6
 */
export function MobileFileTree({
  files,
  onFileSelect,
  selectedFile,
  className
}: MobileFileTreeProps) {
  const sortedFiles = useMemo(() => {
    const order: Record<GitDiffFile['status'], number> = {
      modified: 0,
      added: 1,
      deleted: 2,
      renamed: 3
    }
    return [...files].sort((a, b) => order[a.status] - order[b.status])
  }, [files])

  const handleSelect = useCallback((path: string) => {
    hapticFeedback(10)
    onFileSelect(path)
  }, [onFileSelect])

  return (
    <div className={cn('flex flex-col overflow-y-auto bg-[#0a0a0b]', className)}>
      <div className="divide-y divide-border/20">
        {sortedFiles.map((file) => {
          const filename = file.path.split('/').pop() || file.path
          const isSelected = selectedFile === file.path

          return (
            <button
              key={file.path}
              onClick={() => handleSelect(file.path)}
              className={cn(
                'flex w-full items-center justify-between gap-4 px-6 py-4 text-left transition-colors active:bg-white/5',
                isSelected && 'bg-white/10'
              )}
              style={{ minHeight: '64px' }} // Ensure 44px+ touch target
            >
              <div className="flex min-w-0 items-center gap-4">
                <div className="shrink-0">
                  {statusIcons[file.status]}
                </div>
                <div className="min-w-0">
                  <div className="truncate font-mono text-sm font-medium text-foreground">
                    {filename}
                  </div>
                  <div className="truncate font-mono text-[10px] text-muted-foreground/60">
                    {file.path}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <div className="flex items-center gap-1.5 font-mono text-xs tabular-nums">
                  {file.additions > 0 && (
                    <span className="text-[#3fb950]">+{file.additions}</span>
                  )}
                  {file.deletions > 0 && (
                    <span className="text-[#f85149]">−{file.deletions}</span>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/30" />
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

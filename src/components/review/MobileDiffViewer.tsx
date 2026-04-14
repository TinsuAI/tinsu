import { useState, useCallback, useRef, useMemo } from 'react'
import { ChevronDown, ChevronRight, FileCode, AlertCircle, RefreshCw } from 'lucide-react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { cn, hapticFeedback } from '@renderer/lib/utils'
import { useDiff } from '@renderer/hooks/useDiff'
import { Button } from '@renderer/components/ui/button'
import { Skeleton } from '@renderer/components/ui/skeleton'
import { MobileFileTree } from './MobileFileTree'
import { getLanguageFromPath } from '@renderer/components/diff/utils'
import type { GitDiffFile, GitDiffHunk, GitDiffLine } from '@shared/types/git-diff.types'

export interface MobileDiffViewerProps {
  taskId: string
  task?: any
  versionComparison?: any
  className?: string
}

/**
 * MobileDiffViewer - Mobile-optimized unified diff viewer.
 * AC: 1, 2, 6
 */
export function MobileDiffViewer({
  taskId,
  task,
  versionComparison,
  className
}: MobileDiffViewerProps) {
  const [showFileTree, setShowFileTree] = useState(false)
  const [expandedFiles, setExpandedFiles] = useState<Record<string, boolean>>({})
  const fileRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const {
    diff,
    isLoading,
    error,
    refresh,
    isRefreshing
  } = useDiff({
    taskId,
    mode: versionComparison ? 'version' : (task?.status === 'done' ? 'historical' : 'worktree'),
    worktreePath: task?.worktree_path,
    mergeCommitSha: task?.merge_commit_sha,
    baselineCommit: task?.last_review_commit,
    versionComparison
  })

  const toggleFile = useCallback((path: string) => {
    setExpandedFiles(prev => ({ ...prev, [path]: !prev[path] }))
  }, [])

  const handleFileSelect = useCallback((path: string) => {
    setShowFileTree(false)
    setExpandedFiles(prev => ({ ...prev, [path]: true }))
    
    setTimeout(() => {
      fileRefs.current[path]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
  }, [])

  if (isLoading) {
    return (
      <div className="flex h-full flex-col gap-4 p-6 bg-[#0a0a0b]">
        <Skeleton className="h-10 w-full rounded-lg bg-white/5" />
        <Skeleton className="h-40 w-full rounded-lg bg-white/5" />
        <Skeleton className="h-40 w-full rounded-lg bg-white/5" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center bg-[#0a0a0b]">
        <AlertCircle className="mb-4 h-12 w-12 text-red-500/50" />
        <h3 className="mb-2 text-lg font-semibold">Failed to load diff</h3>
        <p className="mb-6 text-sm text-muted-foreground">{error}</p>
        <Button onClick={refresh} className="gap-2">
          <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
          Retry
        </Button>
      </div>
    )
  }

  if (!diff || diff.files.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center bg-[#0a0a0b]">
        <FileCode className="mb-4 h-12 w-12 text-muted-foreground/30" />
        <h3 className="mb-2 text-lg font-semibold">No changes detected</h3>
        <p className="text-sm text-muted-foreground">The agent hasn't made any modifications yet.</p>
      </div>
    )
  }

  return (
    <div data-testid="mobile-diff-viewer" className={cn('flex h-full flex-col bg-[#0a0a0b]', className)}>
      {/* Sticky File Tree Header */}
      <div className="sticky top-0 z-30 border-b border-border/40 bg-[#0a0a0b]/95 backdrop-blur-md">
        <button
          onClick={() => {
            hapticFeedback(10)
            setShowFileTree(!showFileTree)
          }}
          className="flex w-full items-center justify-between px-6 py-4 active:bg-white/5"
        >
          <div className="flex items-center gap-3">
            <FileCode className="h-5 w-5 text-cyan-400" />
            <span className="text-sm font-semibold">
              Files Changed ({diff.files.length})
            </span>
          </div>
          {showFileTree ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
        </button>
        
        {showFileTree && (
          <MobileFileTree
            files={diff.files}
            onFileSelect={handleFileSelect}
            className="max-h-[60vh] border-t border-border/20"
          />
        )}
      </div>

      {/* Diff Content List */}
      <div className="flex-1 overflow-y-auto pb-32">
        {diff.files.map((file) => (
          <div
            key={file.path}
            ref={el => fileRefs.current[file.path] = el}
            className="border-b border-border/10"
          >
            <button
              onClick={() => toggleFile(file.path)}
              className="flex w-full items-center justify-between px-6 py-4 hover:bg-white/5 active:bg-white/10"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className={cn(
                  'rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                  file.status === 'added' && 'bg-[#3fb950]/20 text-[#3fb950]',
                  file.status === 'modified' && 'bg-[#d29922]/20 text-[#d29922]',
                  file.status === 'deleted' && 'bg-[#f85149]/20 text-[#f85149]',
                  file.status === 'renamed' && 'bg-[#58a6ff]/20 text-[#58a6ff]'
                )}>
                  {file.status}
                </span>
                <span className="truncate font-mono text-sm font-medium">
                  {file.path.split('/').pop()}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 font-mono text-xs">
                  <span className="text-[#3fb950]">+{file.additions}</span>
                  <span className="text-[#f85149]">−{file.deletions}</span>
                </div>
                {expandedFiles[file.path] === false ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </button>

            {expandedFiles[file.path] !== false && (
              <div className="px-2 pb-4">
                {file.hunks.map((hunk, idx) => (
                  <MobileDiffHunk key={idx} hunk={hunk} filePath={file.path} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function MobileDiffHunk({ hunk, filePath }: { hunk: GitDiffHunk; filePath: string }) {
  const language = getLanguageFromPath(filePath)
  
  return (
    <div className="my-2 overflow-hidden rounded-lg border border-border/20 bg-[#0d1117]">
      <div className="bg-white/5 px-3 py-1.5 font-mono text-[10px] text-muted-foreground/60 border-b border-border/10">
        {hunk.header}
      </div>
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          {hunk.lines.map((line, idx) => (
            <div
              key={idx}
              className={cn(
                'flex font-mono text-xs leading-5',
                line.type === 'add' && 'bg-[#2ea043]/15 text-[#aff5b4]',
                line.type === 'remove' && 'bg-[#f85149]/15 text-[#ffdcd7]',
                line.type === 'context' && 'text-muted-foreground/80'
              )}
            >
              <div className="w-10 shrink-0 select-none border-r border-border/5 px-2 text-right text-[10px] text-muted-foreground/30">
                {line.type === 'add' ? line.newLineNo : line.oldLineNo}
              </div>
              <div className="w-6 shrink-0 select-none px-2 text-center text-muted-foreground/40">
                {line.type === 'add' ? '+' : line.type === 'remove' ? '−' : ' '}
              </div>
              <pre className="m-0 flex-1 whitespace-pre px-1">
                <code>{line.content}</code>
              </pre>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

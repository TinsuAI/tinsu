/**
 * ConflictResolutionView - Full-screen conflict resolution interface
 *
 * Displays a file list sidebar with conflict status indicators and
 * a Monaco editor for resolving conflicts one file at a time.
 *
 * Story 8.8: Conflict Resolution UI - Task 1
 */

import { useState, useCallback, useEffect, useMemo } from 'react'
import {
  X,
  FileCode2,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  GitMerge,
  Loader2
} from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { Button } from '@renderer/components/ui/button'
import { trpc } from '@renderer/lib/trpc'
import { toast } from 'sonner'
import { ConflictFileEditor } from './ConflictFileEditor'
import { hasUnresolvedConflicts } from './utils'

/**
 * Props for ConflictResolutionView component.
 */
export interface ConflictResolutionViewProps {
  /** Task ID for database updates */
  taskId: string
  /** List of conflicting file paths (relative to worktree) */
  conflictFiles: string[]
  /** Path to the task's worktree */
  worktreePath: string
  /** Branch name being merged */
  branchName: string
  /** Callback when view is closed */
  onClose: () => void
  /** Callback when all conflicts are resolved and merge is complete */
  onResolved: () => void
}

/**
 * Track resolution status per file.
 */
interface FileStatus {
  path: string
  content: string
  originalContent: string
  isResolved: boolean
  isLoading: boolean
  error: string | null
}

/**
 * ConflictResolutionView component.
 *
 * Features:
 * - AC 1: Full-width/height view with file list sidebar (250px) + editor area
 * - AC 2: Monaco Editor shows conflict markers with editing capability
 * - AC 3: Resolution via inline buttons (handled by ConflictFileEditor)
 * - AC 4: "Complete Merge" commits and updates task status
 * - AC 5: "Open in Editor" opens worktree in system editor
 */
export function ConflictResolutionView({
  taskId,
  conflictFiles,
  worktreePath,
  branchName,
  onClose,
  onResolved
}: ConflictResolutionViewProps): React.JSX.Element {
  // Track file statuses
  const [fileStatuses, setFileStatuses] = useState<Map<string, FileStatus>>(new Map())
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [isCompletingMerge, setIsCompletingMerge] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // tRPC utilities
  const utils = trpc.useUtils()

  // Get file content query
  const getFileContent = trpc.git.getConflictFileContent.useQuery(
    {
      worktreePath,
      filePath: selectedFile ?? ''
    },
    {
      enabled: !!selectedFile && !fileStatuses.get(selectedFile)?.content,
      retry: false,
      staleTime: 0
    }
  )

  // Save file content mutation
  const saveFileMutation = trpc.git.saveConflictFileContent.useMutation({
    onError: (error) => {
      toast.error('Failed to save file', {
        description: error.message
      })
    }
  })

  // Stage file mutation
  const stageFileMutation = trpc.git.stageResolvedFile.useMutation({
    onError: (error) => {
      toast.error('Failed to stage file', {
        description: error.message
      })
    }
  })

  // Complete merge mutation
  const completeMergeMutation = trpc.git.completeConflictResolution.useMutation({
    onSuccess: () => {
      toast.success('Merge complete', {
        description: 'All conflicts resolved and merge committed successfully.'
      })
      // Invalidate task data
      utils.tasks.getById.invalidate({ id: taskId })
      utils.tasks.getAllWithEpics.invalidate()
      onResolved()
    },
    onError: (error) => {
      toast.error('Failed to complete merge', {
        description: error.message
      })
      setIsCompletingMerge(false)
    }
  })

  // Open in system editor mutation
  const openInEditorMutation = trpc.git.openInSystemEditor.useMutation({
    onSuccess: () => {
      toast.success('Opening in external editor', {
        description: 'After resolving externally, click Refresh to reload changes.'
      })
    },
    onError: (error) => {
      toast.error('Failed to open editor', {
        description: error.message
      })
    }
  })

  // Initialize file statuses
  useEffect(() => {
    const initialStatuses = new Map<string, FileStatus>()
    for (const path of conflictFiles) {
      initialStatuses.set(path, {
        path,
        content: '',
        originalContent: '',
        isResolved: false,
        isLoading: false,
        error: null
      })
    }
    setFileStatuses(initialStatuses)

    // Select first file
    if (conflictFiles.length > 0) {
      setSelectedFile(conflictFiles[0])
    }
  }, [conflictFiles])

  // Update file status when content is fetched
  useEffect(() => {
    if (selectedFile && getFileContent.data !== undefined) {
      setFileStatuses((prev) => {
        const newMap = new Map(prev)
        const existing = newMap.get(selectedFile)
        if (existing) {
          const isResolved = !hasUnresolvedConflicts(getFileContent.data)
          newMap.set(selectedFile, {
            ...existing,
            content: getFileContent.data,
            originalContent: existing.originalContent || getFileContent.data,
            isResolved,
            isLoading: false,
            error: null
          })
        }
        return newMap
      })
    }
  }, [selectedFile, getFileContent.data])

  // Update loading state
  useEffect(() => {
    if (selectedFile) {
      setFileStatuses((prev) => {
        const newMap = new Map(prev)
        const existing = newMap.get(selectedFile)
        if (existing) {
          newMap.set(selectedFile, {
            ...existing,
            isLoading: getFileContent.isLoading,
            error: getFileContent.error?.message ?? null
          })
        }
        return newMap
      })
    }
  }, [selectedFile, getFileContent.isLoading, getFileContent.error])

  // Calculate progress
  const progress = useMemo(() => {
    const total = fileStatuses.size
    let resolved = 0
    fileStatuses.forEach((status) => {
      if (status.isResolved) resolved++
    })
    return { resolved, total }
  }, [fileStatuses])

  // Check if all files are resolved
  const allResolved = progress.resolved === progress.total && progress.total > 0

  // Get current file status
  const currentFileStatus = selectedFile ? fileStatuses.get(selectedFile) : null

  /**
   * Handle file selection.
   */
  const handleFileSelect = useCallback((filePath: string) => {
    setSelectedFile(filePath)
  }, [])

  /**
   * Handle content change in editor.
   */
  const handleContentChange = useCallback(
    async (newContent: string) => {
      if (!selectedFile) return

      // Update local state
      setFileStatuses((prev) => {
        const newMap = new Map(prev)
        const existing = newMap.get(selectedFile)
        if (existing) {
          newMap.set(selectedFile, {
            ...existing,
            content: newContent,
            isResolved: !hasUnresolvedConflicts(newContent)
          })
        }
        return newMap
      })

      // Save to file system
      try {
        await saveFileMutation.mutateAsync({
          worktreePath,
          filePath: selectedFile,
          content: newContent
        })
      } catch {
        // Error handled by mutation
      }
    },
    [selectedFile, worktreePath, saveFileMutation]
  )

  /**
   * Handle file fully resolved (no more conflict markers).
   */
  const handleFileResolved = useCallback(() => {
    if (!selectedFile) return

    setFileStatuses((prev) => {
      const newMap = new Map(prev)
      const existing = newMap.get(selectedFile)
      if (existing) {
        newMap.set(selectedFile, {
          ...existing,
          isResolved: true
        })
      }
      return newMap
    })

    toast.success('File resolved', {
      description: `${selectedFile.split('/').pop()} has no more conflicts.`
    })
  }, [selectedFile])

  /**
   * Handle "Complete Merge" action.
   */
  const handleCompleteMerge = useCallback(async () => {
    if (!allResolved) {
      toast.error('Cannot complete merge', {
        description: 'Please resolve all conflicting files first.'
      })
      return
    }

    setIsCompletingMerge(true)

    try {
      // Stage all resolved files
      for (const [filePath] of fileStatuses) {
        await stageFileMutation.mutateAsync({
          worktreePath,
          filePath
        })
      }

      // Complete the merge commit
      await completeMergeMutation.mutateAsync({
        worktreePath,
        taskId
      })
    } catch {
      // Errors handled by mutations
      setIsCompletingMerge(false)
    }
  }, [allResolved, fileStatuses, worktreePath, taskId, stageFileMutation, completeMergeMutation])

  /**
   * Handle "Open in Editor" action.
   */
  const handleOpenInEditor = useCallback(() => {
    openInEditorMutation.mutate({ path: worktreePath })
  }, [worktreePath, openInEditorMutation])

  /**
   * Handle "Refresh" action to reload file content from disk.
   */
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)

    // Clear cached file contents to force refetch
    setFileStatuses((prev) => {
      const newMap = new Map(prev)
      for (const [path, status] of newMap) {
        newMap.set(path, {
          ...status,
          content: '',
          isLoading: true,
          error: null
        })
      }
      return newMap
    })

    // Invalidate query cache
    await utils.git.getConflictFileContent.invalidate()

    // Small delay to ensure state updates propagate
    setTimeout(() => {
      setIsRefreshing(false)
    }, 500)
  }, [utils])

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-[#0a0a0a]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="conflict-resolution-title"
      data-testid="conflict-resolution-view"
    >
      {/* Header */}
      <header className="flex items-center justify-between border-b border-amber-500/30 bg-gradient-to-r from-[#141414] to-[#1a1812] px-6 py-4">
        <div className="flex items-center gap-4">
          {/* Icon and title */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/20">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <h1
                id="conflict-resolution-title"
                className="text-lg font-semibold tracking-tight text-foreground"
              >
                Resolve Merge Conflicts
              </h1>
              <p className="text-sm text-muted-foreground">
                <span className="font-mono text-amber-400/80">{branchName}</span>
              </p>
            </div>
          </div>

          {/* Progress indicator */}
          <div className="ml-6 flex items-center gap-2 rounded-full bg-[#1a1a1f] px-4 py-2 border border-border/30">
            <span
              className={cn(
                'text-sm font-medium',
                allResolved ? 'text-emerald-400' : 'text-amber-400'
              )}
            >
              {progress.resolved} of {progress.total}
            </span>
            <span className="text-sm text-muted-foreground">files resolved</span>
            {allResolved && <CheckCircle2 className="h-4 w-4 text-emerald-400 ml-1" />}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          {/* Refresh button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="gap-2 text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
            Refresh
          </Button>

          {/* Open in Editor */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenInEditor}
            disabled={openInEditorMutation.isPending}
            className="gap-2 border-border/50 text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="h-4 w-4" />
            Open in Editor
          </Button>

          {/* Complete Merge */}
          <Button
            size="sm"
            onClick={handleCompleteMerge}
            disabled={!allResolved || isCompletingMerge}
            className={cn(
              'gap-2 transition-all duration-200',
              allResolved
                ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-500/20'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            )}
          >
            {isCompletingMerge ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <GitMerge className="h-4 w-4" />
            )}
            Complete Merge
          </Button>

          {/* Close button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-white/5"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* File list sidebar */}
        <aside
          className="w-[250px] flex-shrink-0 border-r border-border/30 bg-[#111114] overflow-y-auto"
          aria-label="Conflicting files"
        >
          <div className="p-3">
            <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              <FileCode2 className="h-3.5 w-3.5" />
              Conflicting Files
            </h2>
            <ul className="space-y-1">
              {conflictFiles.map((filePath) => {
                const status = fileStatuses.get(filePath)
                const isSelected = filePath === selectedFile
                const isResolved = status?.isResolved ?? false

                return (
                  <li key={filePath}>
                    <button
                      type="button"
                      onClick={() => handleFileSelect(filePath)}
                      className={cn(
                        'w-full flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-all duration-150',
                        isSelected
                          ? 'bg-amber-500/15 text-amber-200 border border-amber-500/30'
                          : 'text-muted-foreground hover:bg-white/5 hover:text-foreground border border-transparent',
                        isResolved && !isSelected && 'text-emerald-400/80'
                      )}
                    >
                      {/* Status icon */}
                      <span className="flex-shrink-0">
                        {isResolved ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-amber-400" />
                        )}
                      </span>

                      {/* File name */}
                      <span className="flex-1 truncate font-mono text-xs" title={filePath}>
                        {filePath.split('/').pop()}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        </aside>

        {/* Editor area */}
        <main className="flex-1 flex flex-col overflow-hidden p-4">
          {selectedFile && currentFileStatus ? (
            <>
              {/* File path header */}
              <div className="flex items-center gap-2 mb-3">
                <code className="text-sm font-mono text-muted-foreground bg-[#1a1a1f] px-3 py-1.5 rounded-md border border-border/30">
                  {selectedFile}
                </code>
                {currentFileStatus.isResolved && (
                  <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Resolved
                  </span>
                )}
              </div>

              {/* Editor */}
              {currentFileStatus.isLoading || isRefreshing ? (
                <div className="flex-1 flex items-center justify-center bg-[#0d1117] rounded-md border border-border/30">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
                    <span className="text-sm text-muted-foreground">Loading file content...</span>
                  </div>
                </div>
              ) : currentFileStatus.error ? (
                <div className="flex-1 flex items-center justify-center bg-[#0d1117] rounded-md border border-destructive/30">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <AlertTriangle className="h-8 w-8 text-destructive" />
                    <p className="text-sm text-foreground font-medium">Failed to load file</p>
                    <p className="text-xs text-muted-foreground max-w-md">
                      {currentFileStatus.error}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRefresh}
                      className="mt-2 gap-2"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Retry
                    </Button>
                  </div>
                </div>
              ) : (
                <ConflictFileEditor
                  filePath={selectedFile}
                  content={currentFileStatus.content}
                  onChange={handleContentChange}
                  onResolved={handleFileResolved}
                  className="flex-1"
                />
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-[#0d1117] rounded-md border border-border/30">
              <div className="flex flex-col items-center gap-3 text-center">
                <FileCode2 className="h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">Select a file to start resolving</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

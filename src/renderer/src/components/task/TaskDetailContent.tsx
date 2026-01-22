import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  ArrowLeft,
  X,
  BookOpen,
  CheckCircle2,
  Eye,
  Terminal,
  Activity,
  GitCompareArrows,
  Pencil,
  Save,
  GitBranch,
  Copy,
  Check
} from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { Button } from '@renderer/components/ui/button'
import { EpicBadge } from '@renderer/components/task/EpicBadge'
import { TaskTerminal, type TaskTerminalRef } from '@renderer/components/task/TaskTerminal'
import { ActivitiesTab } from '@renderer/components/task/ActivitiesTab'
import { NotionEditor } from '@renderer/components/editor'
import { QuadPaneSection } from '@renderer/components/task/QuadPaneSection'
import { DiffPlaceholder } from '@renderer/components/task/DiffPlaceholder'
import { ResizableWorkspace } from '@renderer/components/workspace'
import { ConflictWarningBanner, ConflictResolutionView } from '@renderer/components/conflict'
import { useQuadPaneLayout } from '@renderer/hooks/useQuadPaneLayout'
import { trpc } from '@renderer/lib/trpc'
import { toast } from 'sonner'
import { markdownComponents } from '@renderer/components/task/MarkdownComponents'

export interface TaskDetailContentProps {
  taskId: string
  task?: {
    id: string
    title: string
    description: string | null
    status: string
    epic_id: string | null
    story_number: number | null
    full_content: string | null
    // Story 8.3: Branch name for git worktree
    branch_name?: string | null
    worktree_path?: string | null
    // Story 8.7: Merge conflict tracking
    has_merge_conflict?: number | null
    conflict_files?: string | null
    created_at: Date
    updated_at: Date
  } | null
  onClose: () => void
}

/**
 * Task detail content component with responsive layout.
 *
 * Implements Story TES-3.2 (Three-Column Task Workspace) with resizable panels.
 *
 * Layouts:
 * - Desktop (>=1024px): 3-column resizable layout (Content, Terminal+Activities, Diff)
 * - Mobile (<1024px): Tabbed Interface
 */
export function TaskDetailContent({ taskId, task: taskProp, onClose }: TaskDetailContentProps) {
  // Layout mode detection (uses media query)
  const layoutMode = useQuadPaneLayout()
  const isDesktop = layoutMode === 'quad' // 'quad' means desktop (>= 1024px)

  // Tab state for mobile layout
  const [activeTab, setActiveTab] = useState<'content' | 'activities' | 'terminal' | 'diff'>(
    'content'
  )
  const [isEditing, setEditing] = useState(true)

  // Story 8.3: Branch name copy feedback state
  const [branchCopied, setBranchCopied] = useState(false)

  // Story 8.7: Conflict banner dismissed state (resets when task changes)
  const [conflictBannerDismissed, setConflictBannerDismissed] = useState(false)

  // Story 8.8: Conflict resolution view state
  const [showConflictResolution, setShowConflictResolution] = useState(false)

  // Ref for TaskTerminal to enable focus control
  const terminalRef = useRef<TaskTerminalRef>(null)

  // Fetch task data only if not provided via props
  const { data: fetchedTask, isLoading } = trpc.tasks.getById.useQuery(
    { id: taskId },
    { enabled: !!taskId && !taskProp }
  )

  // Use provided task or fetched task
  const task = taskProp || fetchedTask

  // Fetch all epics to find the matching one
  const { data: epics } = trpc.epics.getAll.useQuery()

  // Check if task has an active terminal session
  const { data: taskSession } = trpc.agent.getTaskSession.useQuery(
    { taskId: taskId ?? '' },
    { enabled: !!taskId }
  )

  const hasActiveSession = !!taskSession

  // Find the epic for this story
  const epic = useMemo(() => {
    if (!task?.epic_id || !epics) return null
    return epics.find((e) => e.id === task.epic_id) ?? null
  }, [task?.epic_id, epics])

  // Local edit state
  const [editContent, setEditContent] = useState('')
  const [hasChanges, setHasChanges] = useState(false)

  // Update full content mutation
  const utils = trpc.useUtils()
  const updateMutation = trpc.tasks.updateFullContent.useMutation({
    onSuccess: () => {
      utils.tasks.getById.invalidate({ id: taskId })
      utils.tasks.getAllWithEpics.invalidate()
      setEditing(false)
      setHasChanges(false)
      toast.success('Story saved', {
        description: 'Your changes have been saved successfully.'
      })
    },
    onError: (error) => {
      toast.error('Failed to save', {
        description: error.message
      })
    }
  })

  // Initialize edit content when entering edit mode
  useEffect(() => {
    if (isEditing && task) {
      setEditContent(task.full_content ?? task.description ?? '')
      setHasChanges(false)
    }
  }, [isEditing, task])

  // Reset state when taskId changes
  useEffect(() => {
    setActiveTab('content')
    setEditing(true)
    setHasChanges(false)
    setConflictBannerDismissed(false) // Story 8.7: Reset dismissed state when task changes
    setShowConflictResolution(false) // Story 8.8: Close resolution view on task change
  }, [taskId])

  // Handle content changes
  const handleContentChange = useCallback((value: string) => {
    setEditContent(value)
    setHasChanges(true)
  }, [])

  // Save changes
  const handleSave = useCallback(() => {
    if (!taskId) return
    updateMutation.mutate({
      id: taskId,
      fullContent: editContent
    })
  }, [taskId, editContent, updateMutation])

  // Cancel editing
  const handleCancel = useCallback(() => {
    setEditing(false)
    setHasChanges(false)
  }, [])

  // Story 8.3: Copy branch name to clipboard
  const handleCopyBranchName = useCallback(async () => {
    if (!task?.branch_name) return
    try {
      await navigator.clipboard.writeText(task.branch_name)
      setBranchCopied(true)
      toast.success('Branch name copied', {
        description: task.branch_name,
        duration: 2000
      })
      // Reset copied state after animation
      setTimeout(() => setBranchCopied(false), 2000)
    } catch {
      toast.error('Failed to copy branch name')
    }
  }, [task?.branch_name])

  // Keyboard shortcuts (scoped to panel)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement
      const isTyping =
        activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA'

      // Cmd/Ctrl+S to save when editing
      if ((e.metaKey || e.ctrlKey) && e.key === 's' && isEditing) {
        e.preventDefault()
        handleSave()
      }
      // Cmd/Ctrl+E to toggle edit mode
      if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
        e.preventDefault()
        if (isEditing) {
          handleCancel()
        } else {
          setEditing(true)
        }
      }

      // Number key shortcuts for tab switching (mobile only)
      if (!isDesktop && !isTyping && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.key === '1') {
          e.preventDefault()
          setActiveTab('content')
          return
        }
        if (e.key === '2') {
          e.preventDefault()
          setActiveTab('activities')
          return
        }
        if (e.key === '3') {
          e.preventDefault()
          setActiveTab('terminal')
          return
        }
        if (e.key === '4') {
          e.preventDefault()
          setActiveTab('diff')
          return
        }
      }

      // "/" key to focus terminal input
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey && !isTyping) {
        // Only focus if terminal is visible
        const terminalVisible = isDesktop || activeTab === 'terminal'
        if (terminalVisible && hasActiveSession) {
          e.preventDefault()
          terminalRef.current?.focusInput()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isEditing, handleCancel, handleSave, hasActiveSession, activeTab, isDesktop])

  if (isLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
          <span className="text-sm text-muted-foreground">Loading task...</span>
        </div>
      </div>
    )
  }

  if (!task) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-medium text-foreground">Task not found</h2>
          <Button variant="ghost" onClick={onClose} className="mt-4">
            Close
          </Button>
        </div>
      </div>
    )
  }

  const displayContent = task.full_content ?? task.description ?? ''
  const statusLabel = task.status.replace('_', ' ')

  // Helper to determine visibility of a section (mobile only)
  const isVisible = (tab: typeof activeTab) => activeTab === tab

  // Content section rendering (shared between desktop and mobile)
  const contentSection = (
    <>
      {isEditing ? (
        <div className="p-4">
          <NotionEditor
            content={editContent}
            onChange={handleContentChange}
            placeholder="Start writing your story..."
            autoFocus
            className="min-h-[200px] rounded-lg border border-border/50 bg-card/30 p-4"
          />
          {hasChanges && (
            <div className="mt-3 flex items-center gap-2 text-sm text-amber-400">
              <div className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
              Unsaved changes
            </div>
          )}
        </div>
      ) : (
        <div className="p-4">
          {displayContent ? (
            <article className="story-content">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {displayContent}
              </ReactMarkdown>
            </article>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <BookOpen className="mb-3 h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">No content yet</p>
              <Button
                variant="outline"
                onClick={() => setEditing(true)}
                className="mt-4 gap-2 border-cyan-500/30 text-cyan-400"
              >
                <Pencil className="h-4 w-4" />
                Add Content
              </Button>
            </div>
          )}
        </div>
      )}
    </>
  )

  return (
    <div className="flex h-full flex-col">
      {/* Header with back button */}
      <header className="task-detail-panel-header flex items-center gap-4 border-b border-border/40 px-6 py-4">
        {/* TES-3.1: Back button on left side (AC: #1) */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="shrink-0 gap-2 text-muted-foreground hover:bg-white/5 hover:text-foreground"
          aria-label="Back to board"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Back</span>
        </Button>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Story indicator */}
            <div className="flex items-center gap-1.5 rounded-full bg-cyan-500/10 px-2.5 py-1 text-xs font-medium text-cyan-400">
              <BookOpen className="h-3 w-3" />
              {task.story_number ? `Story #${task.story_number}` : 'Task'}
            </div>

            {/* Epic badge */}
            {epic && <EpicBadge title={epic.title} color={epic.color} />}

            {/* Status badge */}
            <div
              className={cn(
                'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium capitalize',
                task.status === 'done' && 'bg-emerald-500/10 text-emerald-400',
                task.status === 'in_progress' && 'bg-amber-500/10 text-amber-400',
                task.status === 'review' && 'bg-violet-500/10 text-violet-400',
                task.status === 'backlog' && 'bg-muted text-muted-foreground',
                task.status === 'create_story' && 'bg-cyan-500/10 text-cyan-400'
              )}
            >
              {statusLabel === 'create story' && <Pencil className="h-3 w-3" />}
              {task.status === 'done' && <CheckCircle2 className="h-3 w-3" />}
              {statusLabel}
            </div>

            {/* Story 8.3: Branch name display with copy button */}
            {task.branch_name && (
              <div className="group flex items-center gap-1.5">
                <GitBranch className="h-3.5 w-3.5 text-orange-400/70" />
                <code
                  className="max-w-[200px] truncate rounded bg-orange-500/10 px-2 py-0.5 font-mono text-[11px] text-orange-300/90 transition-colors group-hover:bg-orange-500/15"
                  title={task.branch_name}
                >
                  {task.branch_name}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleCopyBranchName}
                  className="h-6 w-6 text-muted-foreground opacity-0 transition-opacity hover:bg-orange-500/10 hover:text-orange-400 group-hover:opacity-100"
                  aria-label="Copy branch name"
                >
                  {branchCopied ? (
                    <Check className="h-3 w-3 text-emerald-400" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>
            )}
          </div>

          {/* Title */}
          <h2
            id="task-detail-title"
            className="truncate text-lg font-semibold tracking-tight text-foreground"
          >
            {task.title}
          </h2>
        </div>

        {/* Action buttons */}
        <div className="flex shrink-0 items-center gap-2">
          {isEditing ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditing(false)}
                className="gap-2 text-muted-foreground"
              >
                <Eye className="h-4 w-4" />
                Preview
              </Button>
              {hasChanges && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancel}
                  className="gap-2 text-muted-foreground hover:text-red-400"
                >
                  <X className="h-4 w-4" />
                  Discard
                </Button>
              )}
              <Button
                size="sm"
                onClick={handleSave}
                disabled={updateMutation.isPending || !hasChanges}
                className="gap-2 bg-cyan-600 text-white hover:bg-cyan-700 disabled:opacity-50"
              >
                {updateMutation.isPending ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditing(true)}
              className="gap-2 border-cyan-500/30 text-cyan-400 hover:border-cyan-500/50 hover:bg-cyan-500/10"
            >
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
          )}
        </div>
      </header>

      {/* Story 8.7: Merge conflict warning banner */}
      {task.has_merge_conflict === 1 && !conflictBannerDismissed && (
        <div className="px-6 pt-4">
          <ConflictWarningBanner
            conflictFiles={(() => {
              try {
                return task.conflict_files ? JSON.parse(task.conflict_files) : []
              } catch {
                return []
              }
            })()}
            onDismiss={() => setConflictBannerDismissed(true)}
            onResolveClick={() => setShowConflictResolution(true)}
          />
        </div>
      )}

      {/* Story 8.8: Conflict Resolution View */}
      {showConflictResolution && task.has_merge_conflict === 1 && task.worktree_path && task.branch_name && (
        <ConflictResolutionView
          taskId={task.id}
          conflictFiles={(() => {
            try {
              return task.conflict_files ? JSON.parse(task.conflict_files) : []
            } catch {
              return []
            }
          })()}
          worktreePath={task.worktree_path}
          branchName={task.branch_name}
          onClose={() => setShowConflictResolution(false)}
          onResolved={() => {
            setShowConflictResolution(false)
            setConflictBannerDismissed(true)
            // Task query will be invalidated by the mutation
          }}
        />
      )}

      {/* Desktop: 3-Column Resizable Layout */}
      {isDesktop && (
        <div className="min-h-0 flex-1 p-4">
          <ResizableWorkspace
            task={task}
            contentSection={contentSection}
            terminalRef={terminalRef}
          />
        </div>
      )}

      {/* Mobile: Tabbed Interface */}
      {!isDesktop && (
        <>
          {/* Tab bar */}
          <div
            className="task-detail-panel-tabs flex gap-1 border-b border-border/30 px-6 py-2"
            role="tablist"
            aria-label="Task Detail Tabs"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'content'}
              onClick={() => setActiveTab('content')}
              className={cn(
                'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                activeTab === 'content'
                  ? 'bg-cyan-500/20 text-cyan-400'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <span className="text-xs text-muted-foreground/60">1</span>
              <BookOpen className="h-4 w-4" />
              Content
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'activities'}
              onClick={() => setActiveTab('activities')}
              className={cn(
                'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                activeTab === 'activities'
                  ? 'bg-cyan-500/20 text-cyan-400'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <span className="text-xs text-muted-foreground/60">2</span>
              <Activity className="h-4 w-4" />
              Activities
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'terminal'}
              onClick={() => setActiveTab('terminal')}
              className={cn(
                'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                activeTab === 'terminal'
                  ? 'bg-cyan-500/20 text-cyan-400'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <span className="text-xs text-muted-foreground/60">3</span>
              <Terminal className="h-4 w-4" />
              Terminal
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'diff'}
              onClick={() => setActiveTab('diff')}
              className={cn(
                'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                activeTab === 'diff'
                  ? 'bg-cyan-500/20 text-cyan-400'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <span className="text-xs text-muted-foreground/60">4</span>
              <GitCompareArrows className="h-4 w-4" />
              Diff
            </button>
          </div>

          {/* Tab content */}
          <div className="min-h-0 flex-1 p-4">
            {/* Content Tab */}
            <QuadPaneSection
              title="Content"
              icon={BookOpen}
              showHeader={false}
              className={cn('h-full', !isVisible('content') && 'hidden')}
            >
              {contentSection}
            </QuadPaneSection>

            {/* Activities Tab */}
            <QuadPaneSection
              title="Activities"
              icon={Activity}
              showHeader={false}
              className={cn('h-full', !isVisible('activities') && 'hidden')}
            >
              <ActivitiesTab taskId={taskId} />
            </QuadPaneSection>

            {/* Terminal Tab */}
            <QuadPaneSection
              title="Terminal"
              icon={Terminal}
              showHeader={false}
              className={cn('h-full', !isVisible('terminal') && 'hidden')}
            >
              <TaskTerminal ref={terminalRef} taskId={taskId} />
            </QuadPaneSection>

            {/* Diff Tab */}
            <QuadPaneSection
              title="Diff"
              icon={GitCompareArrows}
              showHeader={false}
              className={cn('h-full', !isVisible('diff') && 'hidden')}
            >
              <DiffPlaceholder taskId={taskId} />
            </QuadPaneSection>
          </div>
        </>
      )}
    </div>
  )
}

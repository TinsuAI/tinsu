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
  Check,
  Keyboard
} from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { Button } from '@renderer/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@renderer/components/ui/tooltip'
import { EpicBadge } from '@renderer/components/task/EpicBadge'
import { TaskTerminal, type TaskTerminalRef } from '@renderer/components/task/TaskTerminal'
import { ActivitiesTab } from '@renderer/components/task/ActivitiesTab'
import { NotionEditor } from '@renderer/components/editor'
import { QuadPaneSection } from '@renderer/components/task/QuadPaneSection'
import { DiffPlaceholder } from '@renderer/components/task/DiffPlaceholder'
import { ResizableWorkspace } from '@renderer/components/workspace'
import { ConflictWarningBanner, ConflictResolutionView } from '@renderer/components/conflict'
import {
  ApproveButton,
  RejectButton,
  RequestChangesButton,
  VersionSelector,
  ReviewTimeline,
  FeedbackHistory,
  type RejectButtonHandle
} from '@renderer/components/review'
import type { VersionComparisonParams } from '@renderer/hooks/useDiff'
import { useQuadPaneLayout } from '@renderer/hooks/useQuadPaneLayout'
import { useApprovalMutation } from '@renderer/hooks/useApprovalMutation'
import { useRejectionMutation } from '@renderer/hooks/useRejectionMutation'
import { useRequestChangesMutation } from '@renderer/hooks/useRequestChangesMutation'
import { useInlineCommentsStore } from '@renderer/stores/inline-comments.store'
import { useTaskDetailPanelStore } from '@renderer/stores/task-detail-panel.store'
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
    story_number: number | string | null
    full_content: string | null
    // Story 8.3: Branch name for git worktree
    branch_name?: string | null
    worktree_path?: string | null
    // Story 8.7: Merge conflict tracking
    has_merge_conflict?: number | null
    conflict_files?: string | null
    // Story 8.11: Merge commit SHA for historical diffs
    merge_commit_sha?: string | null
    // Story 7.5: Inline comments
    inline_comments?: unknown[] | null
    // Story 7.6: Last review commit for baseline diff
    last_review_commit?: string | null
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
  const [isEditing, setEditing] = useState(false)

  // Ref for TaskTerminal to enable focus control
  const terminalRef = useRef<TaskTerminalRef>(null)

  // Ref for mobile tabs content container to enable swipe and sync
  const tabsContentRef = useRef<HTMLDivElement>(null)
  // Ref to prevent jitter during manual tab click scroll
  const isManualScrollingRef = useRef(false)
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Handle manual tab navigation with smooth scroll
  const handleTabClick = useCallback((tab: typeof activeTab) => {
    if (activeTab === tab) return
    setActiveTab(tab)

    const container = tabsContentRef.current
    if (container) {
      const tabs: Array<typeof activeTab> = ['content', 'activities', 'terminal', 'diff']
      const index = tabs.indexOf(tab)
      if (index !== -1) {
        // Set manual scroll flag to prevent handleTabsScroll from fighting
        isManualScrollingRef.current = true
        if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current)

        container.scrollTo({
          left: index * container.clientWidth,
          behavior: 'smooth'
        })

        // Reset manual scroll flag after animation completes
        scrollTimeoutRef.current = setTimeout(() => {
          isManualScrollingRef.current = false
        }, 600) // Slightly longer than typical smooth scroll
      }
    }
  }, [activeTab])

  // Sync activeTab state with scroll position for swiping
  const handleTabsScroll = useCallback(() => {
    const container = tabsContentRef.current
    if (!container || isDesktop || isManualScrollingRef.current) return

    const scrollLeft = container.scrollLeft
    const width = container.clientWidth
    if (width === 0) return

    const index = Math.round(scrollLeft / width)
    const tabs: Array<typeof activeTab> = ['content', 'activities', 'terminal', 'diff']
    const newTab = tabs[index]

    if (newTab && newTab !== activeTab) {
      setActiveTab(newTab)
    }
  }, [isDesktop, activeTab])

  // Story 8.3: Branch name copy feedback state
  const [branchCopied, setBranchCopied] = useState(false)

  // Story 8.7: Conflict banner dismissed state (resets when task changes)
  const [conflictBannerDismissed, setConflictBannerDismissed] = useState(false)

  // Story 8.8: Conflict resolution view state
  const [showConflictResolution, setShowConflictResolution] = useState(false)

  // Story 7.7: Version comparison state
  const [showFeedbackHistory, setShowFeedbackHistory] = useState(false)
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null)
  const [compareVersion, setCompareVersion] = useState<number | null>(null)

  // Story 7.4 AC 1: Ref for RejectButton to enable keyboard shortcut
  const rejectButtonRef = useRef<RejectButtonHandle>(null)

  // Fetch task data only if not provided via props
  const { data: fetchedTaskData, isLoading } = trpc.tasks.getById.useQuery(
    { id: taskId },
    { enabled: !!taskId && !taskProp }
  )
  const fetchedTask = fetchedTaskData as TaskDetailContentProps['task'] | undefined

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

  // Story 7.3: Fetch all tasks to find next review task after approval
  const { data: allTasks } = trpc.tasks.getAllWithEpics.useQuery()

  // Story 7.3: Get store actions for task navigation
  const { switchTask } = useTaskDetailPanelStore()

  // Story 7.3: Approval mutation hook for the 60-Second Velocity Loop
  const { approve, isPending: isApproving } = useApprovalMutation({
    taskId,
    storyNumber: typeof task?.story_number === 'number' ? task.story_number : null,
    onSuccess: () => {
      // Story 7.3 AC 4: Auto-focus next review task if available
      try {
        const nextReviewTask = allTasks?.find((t) => t.status === 'review' && t.id !== taskId)
        if (nextReviewTask) {
          // Navigate to next review task using switchTask (instant, no animation)
          toast.info('Next task ready', {
            description: 'Navigating to next review task...'
          })
          switchTask(nextReviewTask.id)
        } else {
          // No more review tasks, close panel and return to board
          toast.info('All tasks reviewed', {
            description: 'No more tasks awaiting review'
          })
          onClose()
        }
      } catch (error) {
        // MEDIUM-3: Handle navigation errors gracefully
        console.error('Failed to navigate to next task:', error)
        toast.error('Navigation failed', {
          description: 'Could not open next task. Please select manually.'
        })
        onClose()
      }
    },
    onConflict: () => {
      // Story 7.3 AC 3: Show conflict resolution view on conflict
      setShowConflictResolution(true)
    }
  })

  // Story 7.4: Rejection mutation hook for the 60-Second Velocity Loop
  const { reject, isPending: isRejecting } = useRejectionMutation({
    taskId,
    storyNumber: task?.story_number?.toString(),
    onSuccess: () => {
      // Story 7.4 AC 2: On success, task moves back to In Progress
      // The task query will be invalidated by the mutation, so the UI will update
      // No need to navigate elsewhere - user stays on the same task
    }
  })

  // Story 7.5: Inline comments store and mutation for request changes
  const { getCommentsForTask, clearComments, loadComments } = useInlineCommentsStore()
  const inlineComments = getCommentsForTask(taskId)
  const { requestChanges, isPending: isRequestingChanges } = useRequestChangesMutation({
    taskId,
    storyNumber: task?.story_number?.toString(),
    onSuccess: () => {
      // Clear comments from store after successful request
      clearComments(taskId)
    }
  })

  // Story 7.5 Fix Issue #2: Load inline comments from database into store when task loads
  useEffect(() => {
    if (task?.inline_comments && Array.isArray(task.inline_comments)) {
      loadComments(taskId, task.inline_comments as Parameters<typeof loadComments>[1])
    }
  }, [task?.inline_comments, taskId, loadComments])

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
    setEditing(false)
    setHasChanges(false)
    setConflictBannerDismissed(false) // Story 8.7: Reset dismissed state when task changes
    setShowConflictResolution(false) // Story 8.8: Close resolution view on task change
    setShowFeedbackHistory(false) // Story 7.7: Close feedback history panel
    setSelectedVersion(null) // Story 7.7: Reset selected version
    setCompareVersion(null) // Story 7.7: Reset compare version (versionComparison derived via useMemo)
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

  // Story 7.7: Fetch task versions for version comparison
  const { data: taskVersions } = trpc.tasks.getTaskVersions.useQuery(
    { taskId },
    { enabled: !!taskId && task?.status === 'review' }
  )

  // Story 7.7: Derive versionComparison from selectedVersion and compareVersion
  // This ensures state is always synchronized and prevents stale data
  const versionComparison = useMemo<VersionComparisonParams | null>(() => {
    // Only build comparison if compareVersion is set
    if (compareVersion === null || !taskVersions) {
      return null
    }

    // Determine the effective selected version (default to latest if not explicitly set)
    const effectiveSelected = selectedVersion ?? Math.max(...taskVersions.map((v) => v.version_number))

    // Find the version objects
    const fromVersion = taskVersions.find((v) => v.version_number === compareVersion)
    const toVersion = taskVersions.find((v) => v.version_number === effectiveSelected)

    // Build comparison params if both versions exist
    if (fromVersion && toVersion && toVersion.commit_sha) {
      return {
        taskId,
        fromCommitSha: fromVersion.commit_sha,
        toCommitSha: toVersion.commit_sha,
        fromVersionNumber: compareVersion,
        toVersionNumber: effectiveSelected
      }
    }

    return null
  }, [taskId, selectedVersion, compareVersion, taskVersions])

  // Story 7.7: Handle version selection
  const handleVersionSelect = useCallback((versionNumber: number) => {
    setSelectedVersion(versionNumber)
    // versionComparison is derived via useMemo, no manual sync needed
  }, [])

  // Story 7.7: Handle comparison version selection
  const handleCompareSelect = useCallback((versionNumber: number | null) => {
    setCompareVersion(versionNumber)
    // versionComparison is derived via useMemo, no manual sync needed
  }, [])

  // Story 7.7: Handle version navigate from timeline/feedback history
  const handleVersionNavigate = useCallback((versionNumber: number) => {
    // Select the version and clear any comparison
    setSelectedVersion(versionNumber)
    setCompareVersion(null)
    // versionComparison will be automatically null when compareVersion is null (via useMemo)
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

      // Story 7.3 AC 5: "A" key to approve (only when task is in review status)
      // MEDIUM-2: Check modifiers first to avoid interfering with Cmd/Ctrl+A (select all)
      if ((e.key === 'a' || e.key === 'A') && !isTyping && task?.status === 'review' && !isApproving) {
        // Only trigger if NO modifier keys are pressed (allow Cmd+A, Ctrl+A to work normally)
        if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
          e.preventDefault()
          approve()
        }
      }

      // Story 7.4 AC 1: "R" key to open reject dialog (only when task is in review status)
      if ((e.key === 'r' || e.key === 'R') && !isTyping && task?.status === 'review') {
        // Only trigger if NO modifier keys are pressed
        if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
          e.preventDefault()
          rejectButtonRef.current?.openDialog()
        }
      }

      // Story 7.5 Task 12.5: "C" key to request changes (only when has comments and in review)
      if ((e.key === 'c' || e.key === 'C') && !isTyping && task?.status === 'review' && inlineComments.length > 0) {
        // Only trigger if NO modifier keys are pressed
        if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
          e.preventDefault()
          requestChanges(inlineComments)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isEditing, handleCancel, handleSave, hasActiveSession, activeTab, isDesktop, task?.status, isApproving, approve, inlineComments, requestChanges])

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
          {/* Story 7.7: Version selector and comparison (only visible when status is 'review') */}
          {task.status === 'review' && (
            <>
              <VersionSelector
                taskId={taskId}
                taskStatus={task.status}
                selectedVersion={selectedVersion}
                compareVersion={compareVersion}
                onVersionSelect={handleVersionSelect}
                onCompareSelect={handleCompareSelect}
                className="mr-1"
              />
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowFeedbackHistory(true)}
                      className="h-8 gap-1.5 text-muted-foreground hover:text-foreground"
                    >
                      <Activity className="h-4 w-4" />
                      <span className="hidden sm:inline">History</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    View feedback history
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <div className="mx-2 h-6 w-px bg-border/40" />
            </>
          )}
          {/* Story 7.3, 7.4, 7.5: Approve/Reject/RequestChanges buttons (only visible when status is 'review') */}
          {task.status === 'review' && (
            <>
              <RejectButton
                ref={rejectButtonRef}
                onReject={reject}
                isPending={isRejecting}
                disabled={isApproving || isRequestingChanges}
              />
              {/* Story 7.5: Request Changes button between Reject and Approve */}
              <RequestChangesButton
                onClick={() => requestChanges(inlineComments)}
                isPending={isRequestingChanges}
                commentCount={inlineComments.length}
                disabled={isApproving || isRejecting}
              />
              <ApproveButton
                onClick={approve}
                isPending={isApproving}
                disabled={task.has_merge_conflict === 1 || isRejecting || isRequestingChanges}
                hasConflict={task.has_merge_conflict === 1}
              />
              {/* Story 7.5 Fix Issue #5: Keyboard shortcuts help */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground"
                    >
                      <Keyboard className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    <div className="flex flex-col gap-1">
                      <div className="font-semibold mb-1">Keyboard Shortcuts</div>
                      <div className="flex justify-between gap-4">
                        <span>Approve</span>
                        <kbd className="rounded bg-muted px-1.5 py-0.5">A</kbd>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span>Reject</span>
                        <kbd className="rounded bg-muted px-1.5 py-0.5">R</kbd>
                      </div>
                      {inlineComments.length > 0 && (
                        <div className="flex justify-between gap-4">
                          <span>Request Changes</span>
                          <kbd className="rounded bg-muted px-1.5 py-0.5">C</kbd>
                        </div>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </>
          )}

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

      {/* Story 7.7: Review Timeline (collapsible, shown when in review status) */}
      {task.status === 'review' && (
        <div className="border-b border-border/30 px-6 py-3">
          <ReviewTimeline
            taskId={taskId}
            selectedVersion={null}
            onVersionClick={handleVersionNavigate}
          />
        </div>
      )}

      {/* Story 7.7: Feedback History Panel (overlay when open) */}
      {showFeedbackHistory && (
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md border-l border-border/40 bg-background shadow-xl">
          <div className="flex items-center justify-between border-b border-border/30 px-6 py-4">
            <h3 className="text-lg font-semibold">Feedback History</h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowFeedbackHistory(false)}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="overflow-y-auto p-6" style={{ maxHeight: 'calc(100vh - 80px)' }}>
            <FeedbackHistory
              taskId={taskId}
              onVersionNavigate={handleVersionNavigate}
            />
          </div>
        </div>
      )}

      {/* Desktop: 3-Column Resizable Layout */}
      {isDesktop && (
        <div className="min-h-0 flex-1 p-4">
          <ResizableWorkspace
            task={task}
            contentSection={contentSection}
            terminalRef={terminalRef}
            versionComparison={versionComparison}
          />
        </div>
      )}

      {/* Mobile: Tabbed Interface */}
      {!isDesktop && (
        <>
          {/* Tab bar */}
          <div
            className="task-detail-panel-tabs flex gap-1 border-b border-border/30 px-6 py-2 overflow-x-auto hide-scrollbar"
            role="tablist"
            aria-label="Task Detail Tabs"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'content'}
              onClick={() => handleTabClick('content')}
              className={cn(
                'flex items-center gap-2 rounded-md px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap',
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
              onClick={() => handleTabClick('activities')}
              className={cn(
                'flex items-center gap-2 rounded-md px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap',
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
              onClick={() => handleTabClick('terminal')}
              className={cn(
                'flex items-center gap-2 rounded-md px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap',
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
              onClick={() => handleTabClick('diff')}
              className={cn(
                'flex items-center gap-2 rounded-md px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap',
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

          {/* Tab content - Swipeable container */}
          <div
            ref={tabsContentRef}
            onScroll={handleTabsScroll}
            className="flex min-h-0 flex-1 overflow-x-auto snap-x snap-mandatory kanban-scroll scroll-smooth"
          >
            {/* Content Tab */}
            <div className="h-full w-full shrink-0 snap-center p-4">
              <QuadPaneSection
                title="Content"
                icon={BookOpen}
                showHeader={false}
                className="h-full"
              >
                {contentSection}
              </QuadPaneSection>
            </div>

            {/* Activities Tab */}
            <div className="h-full w-full shrink-0 snap-center p-4">
              <QuadPaneSection
                title="Activities"
                icon={Activity}
                showHeader={false}
                className="h-full"
              >
                <ActivitiesTab taskId={taskId} />
              </QuadPaneSection>
            </div>

            {/* Terminal Tab */}
            <div className="h-full w-full shrink-0 snap-center p-4">
              <QuadPaneSection
                title="Terminal"
                icon={Terminal}
                showHeader={false}
                className="h-full"
              >
                <TaskTerminal ref={terminalRef} taskId={taskId} />
              </QuadPaneSection>
            </div>

            {/* Diff Tab */}
            <div className="h-full w-full shrink-0 snap-center p-4">
              <QuadPaneSection
                title="Diff"
                icon={GitCompareArrows}
                showHeader={false}
                className="h-full"
              >
                {/* Story 8.11 Task 5.2: Pass task for mobile layout diff mode determination */}
                {/* Story 7.7: Pass versionComparison for version comparison mode */}
                <DiffPlaceholder task={task ?? undefined} versionComparison={versionComparison} />
              </QuadPaneSection>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

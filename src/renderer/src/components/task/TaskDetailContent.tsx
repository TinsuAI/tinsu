import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import {
  X,
  BookOpen,
  CheckCircle2,
  Copy,
  Check,
  Eye,
  Terminal,
  Activity,
  Pencil,
  Save
} from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { Button } from '@renderer/components/ui/button'
import { EpicBadge } from '@renderer/components/task/EpicBadge'
import { TaskTerminal, type TaskTerminalRef } from '@renderer/components/task/TaskTerminal'
import { ActivitiesTab } from '@renderer/components/task/ActivitiesTab'
import { NotionEditor } from '@renderer/components/editor'
import { trpc } from '@renderer/lib/trpc'
import { toast } from 'sonner'

/**
 * Code block component with syntax highlighting and copy button.
 */
function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [code])

  const customStyle = {
    ...oneDark,
    'pre[class*="language-"]': {
      ...oneDark['pre[class*="language-"]'],
      background: 'transparent',
      margin: 0,
      padding: 0
    },
    'code[class*="language-"]': {
      ...oneDark['code[class*="language-"]'],
      background: 'transparent'
    }
  }

  return (
    <div className="group relative my-4 overflow-hidden rounded-lg border border-border/30 bg-[#1a1b26]">
      <div className="flex items-center justify-between border-b border-border/20 bg-[#1a1b26] px-4 py-2">
        <span className="text-xs font-medium text-muted-foreground">{language || 'plaintext'}</span>
        <button
          onClick={handleCopy}
          className={cn(
            'flex items-center gap-1.5 rounded px-2 py-1 text-xs transition-colors',
            copied
              ? 'text-emerald-400'
              : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
          )}
          aria-label={copied ? 'Copied!' : 'Copy code'}
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              Copy
            </>
          )}
        </button>
      </div>
      <div className="overflow-x-auto p-4">
        <SyntaxHighlighter
          style={customStyle}
          language={language || 'text'}
          PreTag="div"
          customStyle={{
            margin: 0,
            padding: 0,
            background: 'transparent',
            fontSize: '0.875rem',
            lineHeight: '1.7'
          }}
          codeTagProps={{
            style: {
              fontFamily:
                'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace'
            }
          }}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  )
}

export interface TaskDetailContentProps {
  taskId: string
  onClose: () => void
}

/**
 * Task detail content component with tabs for Content, Activities, and Terminal.
 *
 * Extracted from StoryFullView.tsx for use in the slide-over panel.
 * Preserves all keyboard shortcuts and functionality.
 *
 * Story TES-3.1: Task Detail Panel Container
 */
export function TaskDetailContent({ taskId, onClose }: TaskDetailContentProps) {
  // Tab state for switching between content, activities, and terminal
  const [activeTab, setActiveTab] = useState<'content' | 'activities' | 'terminal'>('content')
  const [isEditing, setEditing] = useState(false)

  // Ref for TaskTerminal to enable focus control
  const terminalRef = useRef<TaskTerminalRef>(null)

  // Fetch task data
  const { data: task, isLoading } = trpc.tasks.getById.useQuery({ id: taskId }, { enabled: !!taskId })

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
    setEditing(false)
    setHasChanges(false)
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

      // Number key shortcuts for tab switching
      if (!isTyping && !e.ctrlKey && !e.metaKey && !e.altKey) {
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
      }

      // "/" key to focus terminal input
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey && !isTyping) {
        if (activeTab === 'terminal' && hasActiveSession) {
          e.preventDefault()
          terminalRef.current?.focusInput()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isEditing, handleCancel, handleSave, hasActiveSession, activeTab])

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

  return (
    <div className="flex h-full flex-col">
      {/* Header with close button */}
      <header className="task-detail-panel-header flex items-center justify-between gap-4 border-b border-border/40 px-6 py-4">
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
              {task.status === 'done' && <CheckCircle2 className="h-3 w-3" />}
              {statusLabel}
            </div>
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
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="ml-2 h-8 w-8 rounded-full text-muted-foreground hover:bg-white/5 hover:text-foreground"
            aria-label="Close panel"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </header>

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
          aria-controls="panel-content"
          id="tab-content"
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
          aria-controls="panel-activities"
          id="tab-activities"
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
          aria-controls="panel-terminal"
          id="tab-terminal"
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
      </div>

      {/* Tab content */}
      <div className="min-h-0 flex-1 overflow-auto px-6 py-4">
        {/* Content tab */}
        {activeTab === 'content' &&
          (isEditing ? (
            <div className="relative">
              {/* Keyboard shortcuts hint */}
              <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground/60">
                <kbd className="rounded border border-border px-1.5 py-0.5">⌘S</kbd>
                <span>save</span>
                <span className="mx-1">·</span>
                <kbd className="rounded border border-border px-1.5 py-0.5">/</kbd>
                <span>commands</span>
              </div>

              {/* Notion-like rich text editor */}
              <NotionEditor
                content={editContent}
                onChange={handleContentChange}
                placeholder="Start writing your story..."
                autoFocus
                className="min-h-[50vh] rounded-lg border border-border/50 bg-card/30 p-6"
              />

              {/* Change indicator */}
              {hasChanges && (
                <div className="mt-3 flex items-center gap-2 text-sm text-amber-400">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
                  Unsaved changes
                </div>
              )}
            </div>
          ) : (
            <article className="story-content">
              {displayContent ? (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: ({ children }) => (
                      <h1 className="mb-6 mt-10 text-2xl font-bold tracking-tight text-foreground first:mt-0">
                        {children}
                      </h1>
                    ),
                    h2: ({ children }) => (
                      <h2 className="mb-4 mt-8 text-xl font-semibold tracking-tight text-foreground">
                        {children}
                      </h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className="mb-3 mt-6 text-lg font-semibold text-foreground">
                        {children}
                      </h3>
                    ),
                    h4: ({ children }) => (
                      <h4 className="mb-2 mt-4 text-base font-medium text-foreground">
                        {children}
                      </h4>
                    ),
                    p: ({ children }) => (
                      <p className="mb-4 leading-7 text-foreground/90">{children}</p>
                    ),
                    ul: ({ children }) => (
                      <ul className="mb-4 ml-6 list-disc space-y-2 text-foreground/90">
                        {children}
                      </ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="mb-4 ml-6 list-decimal space-y-2 text-foreground/90">
                        {children}
                      </ol>
                    ),
                    li: ({ children }) => <li className="leading-7">{children}</li>,
                    input: ({ type, checked }) =>
                      type === 'checkbox' ? (
                        <span
                          className={cn(
                            'mr-2 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                            checked
                              ? 'border-cyan-500 bg-cyan-500 text-white'
                              : 'border-muted-foreground/50 bg-transparent'
                          )}
                          aria-checked={checked}
                          role="checkbox"
                        >
                          {checked && (
                            <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
                              <path
                                d="M2 6L5 9L10 3"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          )}
                        </span>
                      ) : null,
                    blockquote: ({ children }) => (
                      <blockquote className="my-4 border-l-4 border-cyan-500/50 pl-4 italic text-foreground/70">
                        {children}
                      </blockquote>
                    ),
                    code: ({ className, children }) => {
                      const match = /language-(\w+)/.exec(className || '')
                      const language = match ? match[1] : ''
                      const codeString = String(children).replace(/\n$/, '')
                      const isInline = !className && !codeString.includes('\n')

                      if (isInline) {
                        return (
                          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm text-cyan-400">
                            {children}
                          </code>
                        )
                      }

                      return <CodeBlock language={language} code={codeString} />
                    },
                    pre: ({ children }) => <>{children}</>,
                    hr: () => <hr className="my-8 border-border/30" />,
                    table: ({ children }) => (
                      <div className="my-4 overflow-x-auto">
                        <table className="w-full border-collapse text-sm">{children}</table>
                      </div>
                    ),
                    thead: ({ children }) => (
                      <thead className="border-b border-border bg-muted/30">{children}</thead>
                    ),
                    th: ({ children }) => (
                      <th className="px-4 py-2 text-left font-semibold text-foreground">
                        {children}
                      </th>
                    ),
                    td: ({ children }) => (
                      <td className="border-b border-border/30 px-4 py-2 text-foreground/90">
                        {children}
                      </td>
                    ),
                    a: ({ href, children }) => (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cyan-400 underline decoration-cyan-400/30 underline-offset-2 transition-colors hover:text-cyan-300 hover:decoration-cyan-300/50"
                      >
                        {children}
                      </a>
                    ),
                    strong: ({ children }) => (
                      <strong className="font-semibold text-foreground">{children}</strong>
                    ),
                    em: ({ children }) => (
                      <em className="italic text-foreground/90">{children}</em>
                    )
                  }}
                >
                  {displayContent}
                </ReactMarkdown>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="mb-4 rounded-full bg-muted p-4">
                    <BookOpen className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="mb-2 text-lg font-medium text-foreground">No content yet</h3>
                  <p className="mb-6 text-sm text-muted-foreground">
                    This task doesn&apos;t have any detailed content.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => setEditing(true)}
                    className="gap-2 border-cyan-500/30 text-cyan-400"
                  >
                    <Pencil className="h-4 w-4" />
                    Add Content
                  </Button>
                </div>
              )}
            </article>
          ))}

        {/* Activities tab */}
        {activeTab === 'activities' && (
          <div
            id="panel-activities"
            role="tabpanel"
            aria-labelledby="tab-activities"
            className="min-h-[400px]"
          >
            <ActivitiesTab taskId={taskId} />
          </div>
        )}

        {/* Terminal tab */}
        {activeTab === 'terminal' && (
          <div
            id="panel-terminal"
            role="tabpanel"
            aria-labelledby="tab-terminal"
            className="min-h-[400px]"
          >
            <TaskTerminal ref={terminalRef} taskId={taskId} />
          </div>
        )}
      </div>
    </div>
  )
}

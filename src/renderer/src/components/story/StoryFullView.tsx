import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { ArrowLeft, Pencil, Save, X, BookOpen, CheckCircle2, Copy, Check, Eye, Terminal, Activity, GitCompareArrows } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { Button } from '@renderer/components/ui/button'
import { EpicBadge } from '@renderer/components/task/EpicBadge'
import { TaskTerminal, type TaskTerminalRef } from '@renderer/components/task/TaskTerminal'
import { ActivitiesTab } from '@renderer/components/task/ActivitiesTab'
import { DiffPlaceholder } from '@renderer/components/task/DiffPlaceholder'
import { NotionEditor } from '@renderer/components/editor'
import { useStoryViewStore, useThemeStore } from '@renderer/stores'
import { trpc } from '@renderer/lib/trpc'
import { toast } from 'sonner'

/**
 * Code block component with syntax highlighting and copy button.
 * Theme-aware: adapts to light/dark mode.
 */
function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false)
  const theme = useThemeStore((state) => state.theme)
  const isDark = theme === 'dark'

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [code])

  // Select base theme based on current mode
  const baseTheme = isDark ? oneDark : oneLight

  // Custom theme with transparent background
  const customStyle = {
    ...baseTheme,
    'pre[class*="language-"]': {
      ...baseTheme['pre[class*="language-"]'],
      background: 'transparent',
      margin: 0,
      padding: 0
    },
    'code[class*="language-"]': {
      ...baseTheme['code[class*="language-"]'],
      background: 'transparent'
    }
  }

  return (
    <div className={cn(
      "group relative my-4 overflow-hidden rounded-lg border border-border/30",
      isDark ? "bg-[#1a1b26]" : "bg-[#fdfcfa]"
    )}>
      {/* Header with language label and copy button */}
      <div className={cn(
        "flex items-center justify-between border-b border-border/20 px-4 py-2",
        isDark ? "bg-[#1a1b26]" : "bg-[#f6f5f3]"
      )}>
        <span className="text-xs font-medium text-muted-foreground">
          {language || 'plaintext'}
        </span>
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
      {/* Code content */}
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
              fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace'
            }
          }}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  )
}

/**
 * Full-page story view with markdown rendering and inline editing.
 *
 * Design aesthetic: Editorial/magazine style with refined typography,
 * generous spacing, and a calm reading experience. Dark mode optimized
 * with subtle warm undertones.
 *
 * Story 3.7: Story Import After Epics Phase
 */
export function StoryFullView() {
  const { activeStoryId, isEditing, closeStory, setEditing } = useStoryViewStore()

  // Tab state for switching between content, activities, terminal, and diff
  const [activeTab, setActiveTab] = useState<'content' | 'activities' | 'terminal' | 'diff'>('content')

  // Ref for TaskTerminal to enable focus control
  const terminalRef = useRef<TaskTerminalRef>(null)

  // Fetch story data
  const { data: task, isLoading } = trpc.tasks.getById.useQuery(
    { id: activeStoryId! },
    { enabled: !!activeStoryId }
  )

  // Fetch all epics to find the matching one
  const { data: epics } = trpc.epics.getAll.useQuery()

  // Check if task has an active terminal session
  const { data: taskSession } = trpc.agent.getTaskSession.useQuery(
    { taskId: activeStoryId ?? '' },
    { enabled: !!activeStoryId }
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
      utils.tasks.getById.invalidate({ id: activeStoryId! })
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

  // Handle content changes
  const handleContentChange = useCallback((value: string) => {
    setEditContent(value)
    setHasChanges(true)
  }, [])

  // Save changes
  const handleSave = useCallback(() => {
    if (!activeStoryId) return
    updateMutation.mutate({
      id: activeStoryId,
      fullContent: editContent
    })
  }, [activeStoryId, editContent, updateMutation])

  // Cancel editing
  const handleCancel = useCallback(() => {
    setEditing(false)
    setHasChanges(false)
  }, [setEditing])

  // Handle back navigation
  const handleBack = useCallback(() => {
    if (hasChanges) {
      if (window.confirm('You have unsaved changes. Are you sure you want to leave?')) {
        closeStory()
      }
    } else {
      closeStory()
    }
  }, [closeStory, hasChanges])

  // Scroll to top when opening a story
  useEffect(() => {
    if (activeStoryId) {
      window.scrollTo(0, 0)
    }
  }, [activeStoryId])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger tab shortcuts if typing in an input field
      const activeElement = document.activeElement
      const isTyping = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA'

      // Escape to close or cancel edit
      if (e.key === 'Escape') {
        if (isEditing) {
          handleCancel()
        } else {
          handleBack()
        }
      }
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

      // Number key shortcuts for tab switching (1=Content, 2=Activities, 3=Terminal, 4=Diff)
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
        if (e.key === '4') {
          e.preventDefault()
          setActiveTab('diff')
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
  }, [isEditing, handleCancel, handleBack, handleSave, setEditing, hasActiveSession, activeTab])

  if (!activeStoryId) return null

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-sm text-muted-foreground">Loading story...</span>
        </div>
      </div>
    )
  }

  if (!task) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <h2 className="text-lg font-medium text-foreground">Story not found</h2>
          <Button variant="ghost" onClick={closeStory} className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Board
          </Button>
        </div>
      </div>
    )
  }

  const displayContent = task.full_content ?? task.description ?? ''
  const statusLabel = task.status.replace('_', ' ')

  return (
    <div className="min-h-screen bg-background">
      {/* Decorative gradient overlay for visual depth */}
      <div className="pointer-events-none fixed inset-0 bg-gradient-to-b from-cyan-500/[0.02] via-transparent to-transparent" />

      {/* Header bar - sticky with blur effect */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-6">
          {/* Back button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="gap-2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back to Board</span>
          </Button>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
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
        </div>
      </header>

      {/* Main content area */}
      <main className="mx-auto max-w-4xl px-6 py-8 pb-24">
        {/* Story header */}
        <div className="mb-8 border-b border-border/30 pb-8">
          {/* Meta info row */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            {/* Story indicator */}
            <div className="flex items-center gap-1.5 rounded-full bg-cyan-500/10 px-2.5 py-1 text-xs font-medium text-cyan-400">
              <BookOpen className="h-3 w-3" />
              Story {task.story_number ? `#${task.story_number}` : ''}
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
                task.status === 'backlog' && 'bg-muted text-muted-foreground'
              )}
            >
              {task.status === 'done' && <CheckCircle2 className="h-3 w-3" />}
              {statusLabel}
            </div>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {task.title}
          </h1>
        </div>

        {/* Tab buttons - Content, Activities, Terminal, and Diff */}
        <div className="mb-6 flex gap-2 border-b border-border/30 pb-4" role="tablist" aria-label="Story Detail Tabs">
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
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'diff'}
            aria-controls="panel-diff"
            id="tab-diff"
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

        {/* Content tab */}
        {activeTab === 'content' && (isEditing ? (
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
              className="min-h-[60vh] rounded-lg border border-border/50 bg-card/30 p-6"
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
                  // Custom heading styles
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
                    <h3 className="mb-3 mt-6 text-lg font-semibold text-foreground">{children}</h3>
                  ),
                  h4: ({ children }) => (
                    <h4 className="mb-2 mt-4 text-base font-medium text-foreground">{children}</h4>
                  ),
                  // Paragraph styling
                  p: ({ children }) => (
                    <p className="mb-4 leading-7 text-foreground/90">{children}</p>
                  ),
                  // List styling
                  ul: ({ children }) => (
                    <ul className="mb-4 ml-6 list-disc space-y-2 text-foreground/90">{children}</ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="mb-4 ml-6 list-decimal space-y-2 text-foreground/90">
                      {children}
                    </ol>
                  ),
                  li: ({ children }) => <li className="leading-7">{children}</li>,
                  // Checkbox list items (GitHub-style task lists)
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
                  // Blockquote styling
                  blockquote: ({ children }) => (
                    <blockquote className="my-4 border-l-4 border-cyan-500/50 pl-4 italic text-foreground/70">
                      {children}
                    </blockquote>
                  ),
                  // Code block styling
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

                    return (
                      <CodeBlock language={language} code={codeString} />
                    )
                  },
                  pre: ({ children }) => <>{children}</>,
                  // Horizontal rule
                  hr: () => <hr className="my-8 border-border/30" />,
                  // Table styling
                  table: ({ children }) => (
                    <div className="my-4 overflow-x-auto">
                      <table className="w-full border-collapse text-sm">{children}</table>
                    </div>
                  ),
                  thead: ({ children }) => (
                    <thead className="border-b border-border bg-muted/30">{children}</thead>
                  ),
                  th: ({ children }) => (
                    <th className="px-4 py-2 text-left font-semibold text-foreground">{children}</th>
                  ),
                  td: ({ children }) => (
                    <td className="border-b border-border/30 px-4 py-2 text-foreground/90">
                      {children}
                    </td>
                  ),
                  // Link styling
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
                  // Strong/bold
                  strong: ({ children }) => (
                    <strong className="font-semibold text-foreground">{children}</strong>
                  ),
                  // Emphasis/italic
                  em: ({ children }) => <em className="italic text-foreground/90">{children}</em>
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
                  This story doesn&apos;t have any detailed content.
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

        {/* Activities tab - always available */}
        {activeTab === 'activities' && (
          <div
            id="panel-activities"
            role="tabpanel"
            aria-labelledby="tab-activities"
            className="min-h-[500px]"
          >
            <ActivitiesTab taskId={activeStoryId!} />
          </div>
        )}

        {/* Terminal tab - always available for manual work */}
        {activeTab === 'terminal' && (
          <div
            id="panel-terminal"
            role="tabpanel"
            aria-labelledby="tab-terminal"
            className="min-h-[500px]"
          >
            <TaskTerminal ref={terminalRef} taskId={activeStoryId!} />
          </div>
        )}

        {/* Diff tab - GitHub-style git diff viewer */}
        {activeTab === 'diff' && (
          <div
            id="panel-diff"
            role="tabpanel"
            aria-labelledby="tab-diff"
            className="min-h-[500px] rounded-lg border border-border/10 bg-background shadow-sm"
          >
            <DiffPlaceholder taskId={activeStoryId!} />
          </div>
        )}
      </main>
    </div>
  )
}

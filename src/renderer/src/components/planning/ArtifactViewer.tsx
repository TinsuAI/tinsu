import { useMemo, useCallback, useRef, useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { format } from 'date-fns'
import {
  FileText,
  Check,
  Circle,
  Terminal,
  AlertTriangle,
  RotateCw,
  Hash,
  GitCompare,
  MessageSquare
} from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'
import { trpc } from '@renderer/lib/trpc'
import { usePlanningWorkspaceStore } from '@renderer/stores'
import { BMAD_WORKFLOWS, AGENT_PERSONA_CONFIG } from '@renderer/constants/planning-workspace'
import { markdownComponents } from '@renderer/components/task/MarkdownComponents'
import { ArtifactVersionHistory } from './ArtifactVersionHistory'
import { ArtifactDiffView } from './ArtifactDiffView'
import type { ArtifactVersionEntry } from './ArtifactVersionHistory'

/* ── Types ── */

type ArtifactStatus = 'draft' | 'in-review' | 'approved'
type DiffViewMode = 'viewer' | 'history' | 'diff'

interface HeadingEntry {
  level: number
  text: string
  slug: string
}

/* ── Heading extraction ── */

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w]+/g, '-')
    .replace(/^-|-$/g, '')
}

function extractHeadings(markdown: string): HeadingEntry[] {
  const headings: HeadingEntry[] = []
  const regex = /^(#{1,3})\s+(.+)$/gm
  let match
  while ((match = regex.exec(markdown)) !== null) {
    const text = match[2].replace(/[*_`~\[\]]/g, '').replace(/\(.*?\)/g, '').trim()
    const slug = slugify(text)
    if (!slug) continue
    headings.push({ level: match[1].length, text, slug })
  }
  return headings
}

/* ── Extended markdown components with id attributes ── */

function extractTextFromChildren(children: React.ReactNode): string {
  if (typeof children === 'string') return children
  if (typeof children === 'number') return String(children)
  if (Array.isArray(children)) return children.map(extractTextFromChildren).join('')
  if (children && typeof children === 'object' && 'props' in (children as object)) {
    return extractTextFromChildren((children as React.ReactElement).props.children)
  }
  return ''
}

function createHeadingComponent(
  Tag: 'h1' | 'h2' | 'h3',
  baseClassName: string
) {
  return function HeadingWithId({ children }: { children?: React.ReactNode }) {
    const text = extractTextFromChildren(children)
    const id = slugify(text)
    return (
      <Tag id={id || undefined} className={baseClassName} data-heading-level={Tag}>
        {children}
      </Tag>
    )
  }
}

const artifactMarkdownComponents = {
  ...markdownComponents,
  h1: createHeadingComponent(
    'h1',
    'mb-6 mt-10 text-2xl font-bold tracking-tight text-foreground first:mt-0 scroll-mt-4'
  ),
  h2: createHeadingComponent(
    'h2',
    'mb-4 mt-8 text-xl font-semibold tracking-tight text-foreground scroll-mt-4'
  ),
  h3: createHeadingComponent(
    'h3',
    'mb-3 mt-6 text-lg font-semibold text-foreground scroll-mt-4'
  )
}

/* ── Status config ── */

const STATUS_CONFIG: Record<
  ArtifactStatus,
  { label: string; className: string; icon: typeof Check }
> = {
  draft: {
    label: 'Draft',
    className:
      'border-amber-500/20 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20',
    icon: FileText
  },
  'in-review': {
    label: 'In Review',
    className:
      'border-yellow-500/20 bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20',
    icon: Circle
  },
  approved: {
    label: 'Approved',
    className:
      'border-emerald-500/20 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20',
    icon: Check
  }
}

const STATUS_CYCLE: Record<ArtifactStatus, ArtifactStatus> = {
  draft: 'in-review',
  'in-review': 'approved',
  approved: 'draft'
}

/* ── ArtifactViewer ── */

export function ArtifactViewer({ workflowKey }: { workflowKey: string }) {
  const { data: project } = trpc.project.getCurrent.useQuery()
  const projectId = project?.id ?? ''

  const {
    data: artifactContent,
    isError: isContentError,
    refetch: refetchContent
  } = trpc.planning.getArtifactContent.useQuery(
    { projectId, workflowKey },
    { enabled: !!projectId }
  )

  const { data: artifacts } = trpc.planning.scanArtifacts.useQuery(
    { projectId },
    { enabled: !!projectId, refetchOnWindowFocus: true }
  )

  // Story 10.7: Query artifact provenance — which chat session produced this artifact (AC: 2)
  const artifactFilename = useMemo(() => {
    const wf = BMAD_WORKFLOWS.find((w) => w.key === workflowKey)
    return wf?.outputFilename ?? null
  }, [workflowKey])

  const { data: artifactProvenance } = trpc.chatSession.getSessionForArtifact.useQuery(
    { projectId, filename: artifactFilename! },
    { enabled: !!projectId && !!artifactFilename }
  )

  const openChatToSession = usePlanningWorkspaceStore((s) => s.openChatToSession)

  // Story 9.7: Prefetch version history to enable/disable Compare Versions button
  const { data: versionHistory } = trpc.planning.getArtifactVersionHistory.useQuery(
    { projectId, workflowKey },
    { enabled: !!projectId }
  )

  const trpcUtils = trpc.useUtils()
  const closeWorkspace = usePlanningWorkspaceStore((s) => s.closeWorkspace)

  const updateStatus = trpc.planning.updateArtifactStatus.useMutation({
    onSuccess: () => {
      trpcUtils.planning.scanArtifacts.invalidate()
    }
  })

  // Story 9.7: Diff view state
  const [diffViewMode, setDiffViewMode] = useState<DiffViewMode>('viewer')
  const [selectedFromCommit, setSelectedFromCommit] = useState<ArtifactVersionEntry | null>(null)
  const [selectedToCommit, setSelectedToCommit] = useState<ArtifactVersionEntry | null>(null)

  const hasMultipleVersions = (versionHistory?.length ?? 0) >= 2

  // Resolve workflow metadata
  const workflow = useMemo(
    () => BMAD_WORKFLOWS.find((w) => w.key === workflowKey),
    [workflowKey]
  )

  // Resolve current status from scan data
  const currentStatus: ArtifactStatus = useMemo(() => {
    if (!artifacts) return 'draft'
    const artifact = artifacts.find((a) => a.workflowKey === workflowKey)
    if (!artifact || artifact.status === 'missing') return 'draft'
    return artifact.status as ArtifactStatus
  }, [artifacts, workflowKey])

  // Extract headings from raw markdown
  const headings = useMemo(
    () => (artifactContent ? extractHeadings(artifactContent.content) : []),
    [artifactContent]
  )

  // Scroll-spy: track active heading
  const contentRef = useRef<HTMLDivElement>(null)
  const [activeSlug, setActiveSlug] = useState<string | null>(null)

  useEffect(() => {
    const container = contentRef.current
    if (!container || headings.length === 0) return

    const handleScroll = () => {
      const scrollTop = container.scrollTop
      let current: string | null = null

      for (const heading of headings) {
        const el = container.querySelector(`#${CSS.escape(heading.slug)}`)
        if (el) {
          const rect = el.getBoundingClientRect()
          const containerRect = container.getBoundingClientRect()
          if (rect.top - containerRect.top <= 80) {
            current = heading.slug
          }
        }
      }
      setActiveSlug(current)
    }

    container.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => container.removeEventListener('scroll', handleScroll)
  }, [headings])

  // Status toggle
  const handleStatusToggle = useCallback(() => {
    if (!projectId) return
    const next = STATUS_CYCLE[currentStatus]
    updateStatus.mutate({ projectId, artifactKey: workflowKey, status: next })
  }, [projectId, workflowKey, currentStatus, updateStatus])

  // Section click → scroll
  const handleHeadingClick = useCallback((slug: string) => {
    const container = contentRef.current
    if (!container) return
    const el = container.querySelector(`#${CSS.escape(slug)}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  // Edit with Agent → close workspace (navigate to board)
  const handleEditWithAgent = useCallback(() => {
    closeWorkspace()
  }, [closeWorkspace])

  // Story 9.7: Compare Versions handlers
  const handleCompareVersions = useCallback(() => {
    setDiffViewMode('history')
  }, [])

  const handleSelectVersions = useCallback(
    (from: ArtifactVersionEntry | null, to: ArtifactVersionEntry) => {
      setSelectedFromCommit(from)
      setSelectedToCommit(to)
      setDiffViewMode('diff')
    },
    []
  )

  const handleCloseDiffView = useCallback(() => {
    setDiffViewMode('viewer')
    setSelectedFromCommit(null)
    setSelectedToCommit(null)
  }, [])

  /* ── Loading state ── */
  if (!artifactContent && !isContentError) {
    return (
      <div className="flex h-full w-full flex-col">
        {/* Skeleton header */}
        <div className="shrink-0 border-b border-border/50 px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="h-5 w-48 animate-pulse rounded bg-muted" />
            <div className="h-5 w-20 animate-pulse rounded bg-muted" />
            <div className="ml-auto h-5 w-28 animate-pulse rounded bg-muted" />
          </div>
          <div className="mt-2 flex items-center gap-3">
            <div className="h-3 w-64 animate-pulse rounded bg-muted/60" />
          </div>
        </div>
        {/* Skeleton body */}
        <div className="flex min-h-0 flex-1">
          <div className="w-52 shrink-0 border-r border-border/30 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="mb-2.5 h-3 animate-pulse rounded bg-muted/50"
                style={{ width: `${60 + Math.random() * 40}%`, animationDelay: `${i * 60}ms` }}
              />
            ))}
          </div>
          <div className="flex-1 p-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="mb-3 h-3 animate-pulse rounded bg-muted/40"
                style={{ width: `${40 + Math.random() * 55}%`, animationDelay: `${i * 40}ms` }}
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  /* ── Error state ── */
  if (isContentError) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <p className="text-sm text-muted-foreground">
            Could not load artifact content.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchContent()}
            className="gap-1.5 text-xs"
          >
            <RotateCw className="h-3 w-3" />
            Retry
          </Button>
        </div>
      </div>
    )
  }

  const statusCfg = STATUS_CONFIG[currentStatus]
  const StatusIcon = statusCfg.icon

  return (
    <div className="flex h-full w-full flex-col" data-testid="artifact-viewer">
      {/* ── Header bar ── */}
      <div className="shrink-0 border-b border-border/50 bg-card/30">
        <div className="flex items-center gap-3 px-5 py-2.5">
          {/* Artifact name */}
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Hash className="h-3.5 w-3.5 text-cyan-500/70" />
            {workflow?.name ?? workflowKey}
          </div>

          {/* Status badge (clickable cycle) */}
          <button
            type="button"
            onClick={handleStatusToggle}
            disabled={updateStatus.isPending}
            className={cn(
              'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
              statusCfg.className
            )}
            data-testid="status-badge"
          >
            <StatusIcon className="h-2.5 w-2.5" />
            {statusCfg.label}
          </button>

          {/* Story 9.7: Compare Versions button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleCompareVersions}
            disabled={!hasMultipleVersions}
            className={cn(
              'gap-1.5 text-xs',
              !hasMultipleVersions && 'opacity-50 cursor-not-allowed'
            )}
            title={hasMultipleVersions ? 'Compare artifact versions' : 'Needs at least 2 committed versions'}
            data-testid="compare-versions-btn"
          >
            <GitCompare className="h-3 w-3" />
            Compare Versions
          </Button>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Edit with Agent */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleEditWithAgent}
            className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            data-testid="edit-with-agent"
          >
            <Terminal className="h-3 w-3" />
            Edit with Agent
          </Button>
        </div>

        {/* ── Metadata bar ── */}
        <div className="flex items-center gap-1.5 px-5 pb-2 text-[11px] text-muted-foreground/60">
          <span className="font-mono text-[10px]">
            {artifactContent.filePath}
          </span>
          <span className="text-muted-foreground/30">&middot;</span>
          <span>
            {format(new Date(artifactContent.lastModified), "MMM d, yyyy 'at' h:mm a")}
          </span>
          <span className="text-muted-foreground/30">&middot;</span>
          <span>
            {artifactContent.wordCount.toLocaleString()} words
          </span>
          <span className="text-muted-foreground/30">&middot;</span>
          <span>{workflow?.name ?? workflowKey}</span>

          {/* Story 10.7: Artifact provenance badge (AC: 2) */}
          {artifactProvenance && (() => {
            const personaCfg = AGENT_PERSONA_CONFIG[artifactProvenance.agentPersona]
            return (
              <>
                <span className="text-muted-foreground/30">&middot;</span>
                <span
                  className="inline-flex items-center gap-1"
                  data-testid="artifact-provenance-badge"
                >
                  <span className={cn('inline-block h-2 w-2 rounded-full', personaCfg?.dot ?? 'bg-muted-foreground')} />
                  <span>{personaCfg?.displayName ?? 'Agent'}</span>
                  <button
                    type="button"
                    onClick={() => openChatToSession(artifactProvenance.sessionId)}
                    className="inline-flex items-center gap-0.5 text-cyan-400 transition-colors hover:text-cyan-300"
                    data-testid="artifact-view-chat-link"
                  >
                    <MessageSquare className="h-3 w-3" />
                    View Chat
                  </button>
                </span>
              </>
            )
          })()}
        </div>
      </div>

      {/* ── Body: Conditional based on diffViewMode ── */}
      {diffViewMode === 'history' && (
        <div className="flex min-h-0 flex-1">
          <ArtifactVersionHistory
            workflowKey={workflowKey}
            onSelectVersions={handleSelectVersions}
            onClose={handleCloseDiffView}
          />
        </div>
      )}

      {diffViewMode === 'diff' && selectedToCommit && (
        <div className="flex min-h-0 flex-1">
          <ArtifactDiffView
            workflowKey={workflowKey}
            fromCommit={selectedFromCommit}
            toCommit={selectedToCommit}
            onClose={handleCloseDiffView}
          />
        </div>
      )}

      {diffViewMode === 'viewer' && (
        <div className="flex min-h-0 flex-1">
          {/* Section outline */}
          <nav
            className="w-52 shrink-0 overflow-y-auto border-r border-border/30 bg-card/20 py-3"
            aria-label="Document outline"
            data-testid="section-outline"
          >
            {/* Outline header */}
            <div className="mb-2 px-4 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
              On this page
            </div>

            <div className="relative">
              {headings.map((heading) => {
                const isActive = activeSlug === heading.slug
                const indent =
                  heading.level === 1 ? 'pl-4' : heading.level === 2 ? 'pl-7' : 'pl-10'

                return (
                  <button
                    key={heading.slug}
                    type="button"
                    onClick={() => handleHeadingClick(heading.slug)}
                    className={cn(
                      'group relative block w-full py-1 pr-3 text-left text-[11px] leading-snug transition-colors',
                      indent,
                      isActive
                        ? 'text-cyan-400 font-medium'
                        : 'text-muted-foreground/60 hover:text-muted-foreground'
                    )}
                    title={heading.text}
                  >
                    {/* Active indicator line */}
                    {isActive && (
                      <span className="absolute left-0 top-0 h-full w-0.5 rounded-full bg-cyan-500" />
                    )}
                    <span className="line-clamp-2">{heading.text}</span>
                  </button>
                )
              })}

              {headings.length === 0 && (
                <div className="px-4 text-[11px] italic text-muted-foreground/40">
                  No headings found
                </div>
              )}
            </div>
          </nav>

          {/* Markdown content */}
          <div
            ref={contentRef}
            className="flex-1 overflow-y-auto"
            data-testid="markdown-content"
          >
            <div className="mx-auto max-w-4xl px-8 py-6">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={artifactMarkdownComponents}
              >
                {artifactContent.content}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * ArtifactViewer — T1.10 implementation.
 * Renders markdown artifact content with section TOC, status lifecycle, and metadata.
 *
 * Story T1.10 AC: 9
 */

import { useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { X, FileText, ChevronDown } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { commands } from '@renderer/lib/rspc'
import { useProjectStore } from '@renderer/stores'
import { BMAD_WORKFLOWS } from '@renderer/constants/planning-workspace'
import { markdownComponents } from '@renderer/components/task/MarkdownComponents'
import { format } from 'date-fns'

interface ArtifactViewerProps {
  workflowKey: string
  filePath: string
  onCloseFile: () => void
}

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'in-review', label: 'In Review' },
  { value: 'approved', label: 'Approved' },
] as const

type ArtifactStatus = 'draft' | 'in-review' | 'approved' | 'missing'

const STATUS_COLORS: Record<string, string> = {
  draft: 'text-amber-400 border-amber-500/30 bg-amber-950/20',
  'in-review': 'text-blue-400 border-blue-500/30 bg-blue-950/20',
  approved: 'text-emerald-400 border-emerald-500/30 bg-emerald-950/20',
  missing: 'text-muted-foreground border-border/30 bg-muted/10',
}

/** Slugify a heading text for use as an id attribute */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

/** Parse headings from markdown content */
function parseHeadings(content: string): Array<{ level: number; text: string; id: string }> {
  const headings: Array<{ level: number; text: string; id: string }> = []
  const regex = /^(#{1,3})\s+(.+)$/gm
  let match
  while ((match = regex.exec(content)) !== null) {
    headings.push({
      level: match[1].length,
      text: match[2],
      id: slugify(match[2]),
    })
  }
  return headings
}

/** Extract plain text from React children (handles strings, arrays, and elements) */
function extractTextFromChildren(children: React.ReactNode): string {
  if (typeof children === 'string') return children
  if (typeof children === 'number') return String(children)
  if (Array.isArray(children)) return children.map(extractTextFromChildren).join('')
  if (children !== null && children !== undefined && typeof children === 'object') {
    const el = children as { props?: { children?: React.ReactNode } }
    if (el.props?.children !== undefined) {
      return extractTextFromChildren(el.props.children)
    }
  }
  return ''
}

/** Extended markdown components with id attrs on headings for scroll targeting */
function makeMarkdownComponents(baseComponents: typeof markdownComponents) {
  return {
    ...baseComponents,
    h1: ({ children }: { children?: React.ReactNode }) => {
      const id = slugify(extractTextFromChildren(children))
      return (
        <h1 id={id} className="mb-6 mt-10 text-2xl font-bold tracking-tight text-foreground first:mt-0">
          {children}
        </h1>
      )
    },
    h2: ({ children }: { children?: React.ReactNode }) => {
      const id = slugify(extractTextFromChildren(children))
      return (
        <h2 id={id} className="mb-4 mt-8 text-xl font-semibold tracking-tight text-foreground">
          {children}
        </h2>
      )
    },
    h3: ({ children }: { children?: React.ReactNode }) => {
      const id = slugify(extractTextFromChildren(children))
      return (
        <h3 id={id} className="mb-3 mt-6 text-lg font-semibold text-foreground">
          {children}
        </h3>
      )
    },
  }
}

export function ArtifactViewer({ workflowKey, filePath: _filePath, onCloseFile }: ArtifactViewerProps) {
  const activeProjectId = useProjectStore((s) => s.activeProjectId)
  const queryClient = useQueryClient()
  const contentRef = useRef<HTMLDivElement>(null)

  const workflow = BMAD_WORKFLOWS.find((w) => w.key === workflowKey)

  const contentQuery = useQuery({
    queryKey: ['artifact-content', activeProjectId, workflowKey],
    queryFn: async () => {
      if (!activeProjectId) return null
      const r = await commands.getArtifactContent(activeProjectId, workflowKey)
      if (r.status === 'error') throw new Error(JSON.stringify(r.error))
      return r.data
    },
    enabled: !!activeProjectId,
  })

  const scanQuery = useQuery({
    queryKey: ['scan-artifacts', activeProjectId],
    queryFn: async () => {
      if (!activeProjectId) return []
      const r = await commands.scanArtifacts(activeProjectId)
      if (r.status === 'error') throw new Error(JSON.stringify(r.error))
      return r.data
    },
    enabled: !!activeProjectId,
  })

  const statusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      if (!activeProjectId) throw new Error('No project')
      const r = await commands.updateArtifactStatus(activeProjectId, workflowKey, newStatus)
      if (r.status === 'error') throw new Error(JSON.stringify(r.error))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scan-artifacts', activeProjectId] })
      queryClient.invalidateQueries({ queryKey: ['artifact-content', activeProjectId, workflowKey] })
    },
  })

  const currentStatus: ArtifactStatus =
    (scanQuery.data?.find((a) => a.workflow_key === workflowKey)?.status as ArtifactStatus) ?? 'draft'

  const headings = contentQuery.data ? parseHeadings(contentQuery.data.content) : []
  const extendedComponents = makeMarkdownComponents(markdownComponents)

  const scrollToSection = (id: string) => {
    const el = contentRef.current?.querySelector(`#${id}`)
    el?.scrollIntoView({ behavior: 'smooth' })
  }

  // Loading state
  if (contentQuery.isLoading) {
    return (
      <div data-testid="artifact-viewer" className="flex h-full flex-col">
        {/* Header skeleton */}
        <div className="flex h-10 items-center gap-3 border-b border-border/40 px-4">
          <div className="h-4 w-32 animate-pulse rounded bg-muted/50" />
          <div className="ml-auto h-5 w-20 animate-pulse rounded bg-muted/40" />
          <div className="h-6 w-6 animate-pulse rounded bg-muted/40" />
        </div>
        <div className="flex flex-1 overflow-hidden">
          <div className="w-[20%] border-r border-border/30 p-3 space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className={cn('h-3 animate-pulse rounded bg-muted/40', i % 2 === 0 ? 'w-3/4' : 'w-1/2')} />
            ))}
          </div>
          <div className="flex-1 p-6 space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-4 animate-pulse rounded bg-muted/30" style={{ width: `${70 + i * 5}%` }} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Not found
  if (contentQuery.isError || !contentQuery.data) {
    return (
      <div data-testid="artifact-viewer" className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <FileText className="h-10 w-10 text-muted-foreground/30" />
        <p className="text-sm font-medium text-muted-foreground">Artifact not found</p>
        <p className="text-xs text-muted-foreground/60">{workflowKey}</p>
        <button onClick={onCloseFile} className="mt-2 rounded border border-border/40 px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/20">
          Close
        </button>
      </div>
    )
  }

  const artifact = contentQuery.data

  return (
    <div data-testid="artifact-viewer" className="flex h-full flex-col">
      {/* Header bar */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border/40 bg-card/30 px-4 py-2">
        <FileText className="h-4 w-4 shrink-0 text-muted-foreground/60" />
        <span className="flex-1 truncate text-sm font-medium text-foreground">
          {workflow?.name ?? workflowKey}
        </span>

        {/* Status dropdown */}
        <div className="relative">
          <select
            value={currentStatus === 'missing' ? 'draft' : currentStatus}
            onChange={(e) => statusMutation.mutate(e.target.value)}
            className={cn(
              'appearance-none rounded border py-0.5 pl-2 pr-6 text-xs font-medium cursor-pointer focus:outline-none bg-transparent',
              STATUS_COLORS[currentStatus] ?? STATUS_COLORS.draft
            )}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-background text-foreground">
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 h-3 w-3 text-current opacity-60" />
        </div>

        <button
          onClick={onCloseFile}
          className="rounded p-1 text-muted-foreground hover:bg-muted/30 hover:text-foreground transition-colors"
          aria-label="Close artifact"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Body: TOC + Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Section outline */}
        {headings.length > 0 && (
          <aside className="w-[20%] shrink-0 overflow-y-auto border-r border-border/30 bg-card/10 px-3 py-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
              Sections
            </p>
            <nav className="space-y-0.5">
              {headings.map((h, i) => (
                <button
                  key={i}
                  onClick={() => scrollToSection(h.id)}
                  className={cn(
                    'block w-full truncate rounded px-2 py-1 text-left text-xs text-muted-foreground hover:bg-muted/20 hover:text-foreground transition-colors',
                    h.level === 1 && 'font-medium text-foreground/80',
                    h.level === 2 && 'pl-4',
                    h.level === 3 && 'pl-6 text-[11px]'
                  )}
                  title={h.text}
                >
                  {h.text}
                </button>
              ))}
            </nav>
          </aside>
        )}

        {/* Markdown content */}
        <main
          ref={contentRef}
          className="flex-1 overflow-y-auto px-6 py-4 prose prose-invert prose-sm max-w-none"
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={extendedComponents}>
            {artifact.content}
          </ReactMarkdown>
        </main>
      </div>

      {/* Metadata footer */}
      <div className="shrink-0 flex items-center gap-4 border-t border-border/30 bg-card/10 px-4 py-1.5">
        <span className="truncate font-mono text-[10px] text-muted-foreground/50" title={artifact.file_path}>
          {artifact.file_path.split('/').slice(-3).join('/')}
        </span>
        <span className="shrink-0 text-[10px] text-muted-foreground/40">
          {format(new Date(artifact.last_modified), 'MMM d, yyyy')}
        </span>
        <span className="shrink-0 text-[10px] text-muted-foreground/40">
          {artifact.word_count.toLocaleString()} words
        </span>
        <span className="shrink-0 text-[10px] text-muted-foreground/40">
          {workflow?.name ?? workflowKey}
        </span>
      </div>
    </div>
  )
}

/**
 * SessionDocumentViewer - Displays a markdown file from the project by relative path.
 *
 * Used when a document is selected from the SessionDocumentsBar.
 * Shows markdown content with a section outline sidebar, matching ArtifactViewer layout.
 */

import { useMemo, useCallback } from 'react'
import { X } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { trpc } from '@renderer/lib/trpc'

interface SessionDocumentViewerProps {
  relativePath: string
  onClose: () => void
}

interface HeadingEntry {
  id: string
  text: string
  level: number
}

/** Extract headings from markdown content for the outline sidebar */
function extractHeadings(content: string): HeadingEntry[] {
  const headings: HeadingEntry[] = []
  const lines = content.split('\n')
  for (const line of lines) {
    const match = line.match(/^(#{1,3})\s+(.+)$/)
    if (match) {
      const level = match[1].length
      const text = match[2].replace(/\*\*/g, '').trim()
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      headings.push({ id, text, level })
    }
  }
  return headings
}

export function SessionDocumentViewer({ relativePath, onClose }: SessionDocumentViewerProps) {
  const { data, isLoading, error } = trpc.planning.getFileByPath.useQuery(
    { relativePath },
    { retry: false }
  )

  const filename = relativePath.split('/').pop() ?? relativePath
  const title = filename.replace(/\.md$/, '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

  const headings = useMemo(() => {
    if (!data?.content) return []
    return extractHeadings(data.content)
  }, [data?.content])

  const htmlContent = useMemo(() => {
    if (!data?.content) return ''
    return markdownToHtml(data.content)
  }, [data?.content])

  const scrollToHeading = useCallback((id: string) => {
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  return (
    <div className="flex h-full w-full flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-border/50 bg-card/30">
        <div className="flex items-center gap-3 px-5 py-2.5">
          <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground/90">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground/40 transition-colors hover:bg-accent/40 hover:text-foreground"
            aria-label="Close document"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="flex items-center gap-1.5 px-5 pb-2 text-[11px] text-muted-foreground/60">
          <span className="font-mono">{relativePath.replace(/^\/Users\/[^/]+\/[^/]+\//, '')}</span>
          {data && (
            <>
              <span className="text-muted-foreground/20">-</span>
              <span>{data.wordCount} words</span>
            </>
          )}
        </div>
      </div>

      {/* Body */}
      {isLoading && (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground/40">
          Loading...
        </div>
      )}

      {error && (
        <div className="flex flex-1 items-center justify-center text-sm text-red-400/60">
          File not found
        </div>
      )}

      {data && (
        <div className="flex min-h-0 flex-1">
          {/* Outline sidebar */}
          {headings.length > 0 && (
            <nav className="w-52 shrink-0 overflow-y-auto border-r border-border/30 bg-card/20 py-3 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border">
              <div className="px-4 pb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/30">
                On this page
              </div>
              {headings.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => scrollToHeading(h.id)}
                  className={cn(
                    'block w-full truncate text-left text-[12px] leading-relaxed transition-colors hover:text-cyan-400',
                    h.level === 1 && 'px-4 py-0.5 font-medium text-muted-foreground/70',
                    h.level === 2 && 'px-4 py-0.5 text-muted-foreground/50',
                    h.level === 3 && 'px-6 py-0.5 text-muted-foreground/40'
                  )}
                  title={h.text}
                >
                  {h.text}
                </button>
              ))}
            </nav>
          )}

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            <div
              className="mx-auto max-w-4xl px-8 py-6 text-sm leading-relaxed text-foreground/80"
              dangerouslySetInnerHTML={{ __html: htmlContent }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

/** Convert markdown to HTML with heading IDs for outline navigation */
function markdownToHtml(md: string): string {
  return md
    // Code blocks
    .replace(/```[\s\S]*?```/g, (match) => {
      const code = match.slice(3).replace(/^[^\n]*\n/, '').slice(0, -3)
      return `<pre class="my-4 rounded-lg bg-muted/30 p-4 font-mono text-xs overflow-x-auto"><code>${escapeHtml(code)}</code></pre>`
    })
    // Headings with IDs
    .replace(/^#### (.+)$/gm, (_m, t) => {
      const id = t.replace(/\*\*/g, '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')
      return `<h4 id="${id}" class="mb-2 mt-6 text-sm font-semibold scroll-mt-4">${t}</h4>`
    })
    .replace(/^### (.+)$/gm, (_m, t) => {
      const id = t.replace(/\*\*/g, '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')
      return `<h3 id="${id}" class="mb-3 mt-6 text-base font-semibold scroll-mt-4">${t}</h3>`
    })
    .replace(/^## (.+)$/gm, (_m, t) => {
      const id = t.replace(/\*\*/g, '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')
      return `<h2 id="${id}" class="mb-4 mt-8 text-lg font-semibold text-foreground/90 scroll-mt-4">${t}</h2>`
    })
    .replace(/^# (.+)$/gm, (_m, t) => {
      const id = t.replace(/\*\*/g, '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')
      return `<h1 id="${id}" class="mb-6 mt-10 text-xl font-bold text-foreground scroll-mt-4">${t}</h1>`
    })
    // Horizontal rules
    .replace(/^---+$/gm, '<hr class="my-6 border-border/20" />')
    // Bold and italic
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-foreground/90">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="rounded bg-muted/40 px-1 py-0.5 font-mono text-[0.85em]">$1</code>')
    // Unordered lists
    .replace(/^[*-] (.+)$/gm, '<li class="ml-4 list-disc mb-1">$1</li>')
    // Ordered lists
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal mb-1">$1</li>')
    // Paragraphs
    .replace(/\n\n/g, '</p><p class="mb-3">')
    .replace(/^/, '<p class="mb-3">')
    .replace(/$/, '</p>')
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

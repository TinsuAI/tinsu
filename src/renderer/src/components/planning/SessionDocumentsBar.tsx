/**
 * SessionDocumentsBar - Tab bar showing all documents created in the current chat session.
 *
 * Renders horizontally scrollable tabs for each document/artifact the agent
 * has created during the conversation. Clicking a tab navigates the content
 * panel to show that document.
 */

import { FileText, ScrollText } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { trpc } from '@renderer/lib/trpc'

interface SessionDocumentsBarProps {
  sessionId: string
  /** Currently selected document path (to highlight active tab) */
  activeDocPath: string | null
  onSelectDoc: (filePath: string, filename: string) => void
}

/** Shorten filename for display — remove date suffixes and extensions */
function shortLabel(filename: string): string {
  return filename
    .replace(/\.md$/, '')
    .replace(/-\d{4}-\d{2}-\d{2}$/, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .slice(0, 28)
}

export function SessionDocumentsBar({ sessionId, activeDocPath, onSelectDoc }: SessionDocumentsBarProps) {
  const { data: docs } = trpc.chatSession.getSessionDocuments.useQuery(
    { sessionId },
    { refetchInterval: 10_000 }
  )

  if (!docs || docs.length === 0) return null

  return (
    <div
      className="flex items-center gap-0.5 overflow-x-auto border-b border-border/15 bg-background/60 px-2 py-1 scrollbar-none"
      data-testid="session-documents-bar"
    >
      <span className="mr-1 shrink-0 font-mono text-[8px] font-semibold uppercase tracking-widest text-muted-foreground/25">
        Docs
      </span>
      {docs.map((doc) => {
        const isActive = activeDocPath === doc.filePath
        return (
          <button
            key={doc.filePath}
            type="button"
            onClick={() => onSelectDoc(doc.filePath, doc.filename)}
            className={cn(
              'group flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 transition-all duration-150',
              isActive
                ? 'bg-cyan-500/10 text-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.06)]'
                : 'text-muted-foreground/45 hover:bg-muted/30 hover:text-muted-foreground/70'
            )}
            title={doc.filePath}
          >
            {doc.workflowKey ? (
              <ScrollText className={cn('h-3 w-3 shrink-0', isActive ? 'text-cyan-400/70' : 'text-muted-foreground/25')} />
            ) : (
              <FileText className={cn('h-3 w-3 shrink-0', isActive ? 'text-cyan-400/70' : 'text-muted-foreground/25')} />
            )}
            <span className="text-[11px] font-medium leading-none whitespace-nowrap">
              {shortLabel(doc.filename)}
            </span>
          </button>
        )
      })}
    </div>
  )
}

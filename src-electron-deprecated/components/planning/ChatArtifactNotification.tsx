/**
 * ChatArtifactNotification - System message card for artifact creation events.
 *
 * Story 10.7: Artifact Detection & Planning Workspace Integration (AC: 3)
 *
 * Renders a centered notification card when the agent creates or updates
 * a planning artifact. Shows the filename with a "View in Workspace" link
 * that navigates to the artifact in the Planning Workspace.
 */

import { FileText, ArrowRight } from 'lucide-react'
import { usePlanningWorkspaceStore } from '@renderer/stores'

interface ArtifactNotificationMessage {
  id: string
  content: string
  tool_input?: string | null
}

/**
 * Parse the tool_input JSON to extract artifact metadata.
 */
function parseArtifactInput(
  toolInput: string | null | undefined
): { filename: string; workflowKey: string | null; filePath: string } | null {
  if (!toolInput) return null
  try {
    const parsed = JSON.parse(toolInput) as Record<string, unknown>
    return {
      filename: (parsed.filename as string) ?? '',
      workflowKey: (parsed.workflowKey as string) ?? null,
      filePath: (parsed.filePath as string) ?? ''
    }
  } catch {
    return null
  }
}

export function ChatArtifactNotification({
  message
}: {
  message: ArtifactNotificationMessage
}) {
  const openWorkspaceToArtifact = usePlanningWorkspaceStore(
    (s) => s.openWorkspaceToArtifact
  )

  const artifactData = parseArtifactInput(message.tool_input)
  const workflowKey = artifactData?.workflowKey ?? null

  const handleViewInWorkspace = () => {
    if (workflowKey) {
      openWorkspaceToArtifact(workflowKey)
    }
  }

  return (
    <div
      className="mx-auto flex max-w-sm items-center gap-2 rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-3 py-2"
      data-testid="chat-artifact-notification"
    >
      <FileText className="h-4 w-4 shrink-0 text-cyan-400/70" />
      <span className="flex-1 text-xs text-cyan-300/80">
        {message.content}
      </span>
      {workflowKey ? (
        <button
          type="button"
          onClick={handleViewInWorkspace}
          className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-cyan-400 transition-colors hover:text-cyan-300"
          data-testid="artifact-view-in-workspace"
        >
          View in Workspace
          <ArrowRight className="h-3 w-3" />
        </button>
      ) : (
        <span
          className="shrink-0 text-[11px] text-muted-foreground/40"
          data-testid="artifact-no-workspace-link"
        >
          Unknown artifact
        </span>
      )}
    </div>
  )
}

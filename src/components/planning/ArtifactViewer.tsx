/**
 * ArtifactViewer — T1.9 stub.
 * Full implementation deferred to T1.10.
 */

interface ArtifactViewerProps {
  workflowKey: string
  filePath: string
  onCloseFile: () => void
}

export function ArtifactViewer(_props: ArtifactViewerProps) {
  return <div className="flex items-center justify-center h-full text-muted-foreground text-sm" data-testid="artifact-viewer">Planning features coming in T1.10</div>
}

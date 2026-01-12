import { useCallback } from 'react'
import { trpc } from '@renderer/lib/trpc'
import { toast } from 'sonner'

/**
 * Artifact with extended status information.
 */
export interface ArtifactWithStatus {
  id: string
  task_id: string
  artifact_type: 'prd' | 'architecture' | 'ux_design' | 'epics' | 'custom'
  artifact_path: string
  section_ref: string | null
  created_at: Date
  exists: boolean
  fileName: string
}

/**
 * Hook for managing task artifacts.
 *
 * Provides functions to:
 * - Fetch artifacts linked to a task
 * - Link new artifacts to a task
 * - Unlink artifacts from a task
 * - Open artifacts in the system editor
 *
 * Story 3.10: Link Artifacts to Tasks
 *
 * @param taskId - ID of the task to manage artifacts for
 *
 * @example
 * ```tsx
 * function TaskArtifacts({ taskId }) {
 *   const { artifacts, isLoading, openInEditor, unlinkArtifact } = useTaskArtifacts(taskId)
 *
 *   return (
 *     <ul>
 *       {artifacts.map(artifact => (
 *         <li key={artifact.id}>
 *           <span>{artifact.fileName}</span>
 *           <button onClick={() => openInEditor(artifact.artifact_path)}>Open</button>
 *           <button onClick={() => unlinkArtifact(artifact.id)}>Unlink</button>
 *         </li>
 *       ))}
 *     </ul>
 *   )
 * }
 * ```
 */
export function useTaskArtifacts(taskId: string | null) {
  const utils = trpc.useUtils()

  // Query: Fetch artifacts for task
  const { data: artifacts = [], isLoading, refetch } = trpc.artifacts.getArtifactsForTask.useQuery(
    { taskId: taskId! },
    {
      enabled: !!taskId,
      staleTime: 30000 // Cache for 30 seconds
    }
  )

  // Mutation: Link artifact to task
  const linkArtifactMutation = trpc.artifacts.linkArtifact.useMutation({
    onSuccess: (result) => {
      toast.success('Artifact linked', {
        description: `Linked ${result.artifact_type} artifact to task`
      })
      // Invalidate artifacts query to refresh the list
      if (taskId) {
        utils.artifacts.getArtifactsForTask.invalidate({ taskId })
      }
    },
    onError: (error) => {
      toast.error('Failed to link artifact', {
        description: error.message
      })
    }
  })

  // Mutation: Unlink artifact from task
  const unlinkArtifactMutation = trpc.artifacts.unlinkArtifact.useMutation({
    onSuccess: () => {
      toast.success('Artifact unlinked')
      // Invalidate artifacts query to refresh the list
      if (taskId) {
        utils.artifacts.getArtifactsForTask.invalidate({ taskId })
      }
    },
    onError: (error) => {
      toast.error('Failed to unlink artifact', {
        description: error.message
      })
    }
  })

  // Mutation: Open artifact in system editor
  const openInEditorMutation = trpc.artifacts.openArtifactInEditor.useMutation({
    onError: (error) => {
      toast.error('Failed to open artifact', {
        description: error.message
      })
    }
  })

  // Link an artifact to the task
  const linkArtifact = useCallback(
    async (
      artifactType: 'prd' | 'architecture' | 'ux_design' | 'epics' | 'custom',
      artifactPath: string,
      sectionRef?: string
    ) => {
      if (!taskId) return

      await linkArtifactMutation.mutateAsync({
        taskId,
        artifactType,
        artifactPath,
        sectionRef
      })
    },
    [taskId, linkArtifactMutation]
  )

  // Unlink an artifact from the task
  const unlinkArtifact = useCallback(
    async (taskArtifactId: string) => {
      await unlinkArtifactMutation.mutateAsync({ taskArtifactId })
    },
    [unlinkArtifactMutation]
  )

  // Open an artifact in the system editor
  const openInEditor = useCallback(
    async (artifactPath: string) => {
      await openInEditorMutation.mutateAsync({ artifactPath })
    },
    [openInEditorMutation]
  )

  // Refetch artifacts
  const refreshArtifacts = useCallback(() => {
    if (taskId) {
      refetch()
    }
  }, [taskId, refetch])

  return {
    /** List of artifacts linked to the task */
    artifacts: artifacts as ArtifactWithStatus[],
    /** Whether artifacts are being loaded */
    isLoading,
    /** Link a new artifact to the task */
    linkArtifact,
    /** Unlink an artifact from the task */
    unlinkArtifact,
    /** Open an artifact in the system editor */
    openInEditor,
    /** Whether a link operation is in progress */
    isLinking: linkArtifactMutation.isPending,
    /** Whether an unlink operation is in progress */
    isUnlinking: unlinkArtifactMutation.isPending,
    /** Whether an open operation is in progress */
    isOpening: openInEditorMutation.isPending,
    /** Refresh the artifacts list */
    refreshArtifacts
  }
}

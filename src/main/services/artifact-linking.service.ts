import { existsSync } from 'fs'
import { eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { db } from '../db'
import { task_artifacts, TaskArtifact, NewTaskArtifact, ArtifactType } from '../db/schema'

/**
 * Extended artifact type with existence status and file name
 */
export interface ArtifactWithStatus extends TaskArtifact {
  exists: boolean
  fileName: string
}

/**
 * Service for managing artifact links to tasks
 * Story 3.10: Link Artifacts to Tasks
 */
export class ArtifactLinkingService {
  /**
   * Link an artifact to a task
   * @param taskId - The task to link the artifact to
   * @param artifactType - Type of artifact (prd, architecture, ux_design, epics, custom)
   * @param artifactPath - Path to the artifact file
   * @param sectionRef - Optional reference to a specific section in the artifact
   */
  static async linkArtifactToTask(
    taskId: string,
    artifactType: ArtifactType,
    artifactPath: string,
    sectionRef?: string
  ): Promise<TaskArtifact> {
    const newArtifact: NewTaskArtifact = {
      id: uuidv4(),
      task_id: taskId,
      artifact_type: artifactType,
      artifact_path: artifactPath,
      section_ref: sectionRef || null,
      created_at: new Date()
    }

    const [created] = await db.insert(task_artifacts).values(newArtifact).returning()

    return created
  }

  /**
   * Remove an artifact link from a task
   * @param taskArtifactId - The ID of the artifact link to remove
   */
  static async unlinkArtifactFromTask(taskArtifactId: string): Promise<void> {
    await db.delete(task_artifacts).where(eq(task_artifacts.id, taskArtifactId))
  }

  /**
   * Get all artifacts linked to a task
   * @param taskId - The task to get artifacts for
   */
  static async getArtifactsForTask(taskId: string): Promise<TaskArtifact[]> {
    return db.select().from(task_artifacts).where(eq(task_artifacts.task_id, taskId)).all()
  }

  /**
   * Check if an artifact file exists on the file system
   * @param artifactPath - Path to check
   */
  static checkArtifactExists(artifactPath: string): boolean {
    return existsSync(artifactPath)
  }

  /**
   * Get all artifacts for a task with existence status
   * Includes boolean `exists` flag and extracted file name
   * @param taskId - The task to get artifacts for
   */
  static async getArtifactsWithStatus(taskId: string): Promise<ArtifactWithStatus[]> {
    const artifacts = await this.getArtifactsForTask(taskId)

    return artifacts.map((artifact) => ({
      ...artifact,
      exists: this.checkArtifactExists(artifact.artifact_path),
      fileName: artifact.artifact_path.split('/').pop() || artifact.artifact_path
    }))
  }
}

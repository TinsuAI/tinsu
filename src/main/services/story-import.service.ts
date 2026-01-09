import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { eq, and } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { readFileSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import * as yaml from 'yaml'
import * as schema from '../db/schema'
import { EpicsParserService, ParsedEpic, ParsedStory } from './epics-parser.service'
import { DetailedStoryParserService, StoryKey } from './detailed-story-parser.service'
import { EPIC_COLORS } from '../db/schema'
import type { TaskStatus } from '@shared/types/task.types'

/**
 * Result returned when importing stories from epics.md.
 */
export interface ImportResult {
  /** Number of epic records created */
  epicsCreated: number
  /** Number of epic records updated (re-import) */
  epicsUpdated: number
  /** Number of story task records created */
  storiesCreated: number
  /** Number of story task records updated (re-import) */
  storiesUpdated: number
  /** Number of detailed story files found and imported */
  detailedStoriesImported: number
  /** IDs of created or updated epic records */
  epicIds: string[]
  /** IDs of created or updated story task records */
  storyIds: string[]
}

/**
 * Status values from sprint-status.yaml
 */
type SprintStatusValue =
  | 'backlog'
  | 'ready-for-dev'
  | 'in-progress'
  | 'review'
  | 'done'
  | 'deferred'
  | 'optional'

/**
 * Map of story keys to their status from sprint-status.yaml
 */
type SprintStatusMap = Map<string, SprintStatusValue>

/**
 * Service for importing epics and stories from parsed epics.md into the database.
 *
 * This service creates:
 * - Epic records in the epics table
 * - Story tasks in the tasks table, linked to their epics
 *
 * CRITICAL: This service runs in the main process only.
 * Never import this in the renderer process.
 */
export class StoryImportService {
  /**
   * Imports stories from an epics.md file into the database.
   *
   * @param db - Drizzle database instance
   * @param projectId - ID of the project to import stories into
   * @param epicsPath - Absolute path to the epics.md file
   * @param statusFilePath - Optional explicit path to sprint-status.yaml (auto-detected if not provided)
   * @returns Import result with counts and created IDs
   *
   * @example
   * ```typescript
   * const result = await StoryImportService.importFromEpicsFile(
   *   db,
   *   'project-123',
   *   '/path/to/epics.md'
   * )
   * console.log(`Imported ${result.storiesCreated} stories`)
   * ```
   */
  static async importFromEpicsFile(
    db: BetterSQLite3Database<typeof schema>,
    projectId: string,
    epicsPath: string,
    statusFilePath?: string
  ): Promise<ImportResult> {
    const parsedEpics = await EpicsParserService.parseEpicsFile(epicsPath)

    // Parse sprint-status.yaml to get story statuses
    // Use explicit path if provided, otherwise auto-detect
    const statusMap = statusFilePath
      ? this.parseSprintStatusFromPath(statusFilePath)
      : this.parseSprintStatus(epicsPath)

    // Scan implementation-artifacts for detailed story files
    // Expected path: sibling directory to planning-artifacts
    const epicsDir = dirname(epicsPath)
    const parentDir = dirname(epicsDir)
    const implementationArtifactsDir = join(parentDir, 'implementation-artifacts')

    const detailedStoriesMap = await DetailedStoryParserService.scanDetailedStories(
      implementationArtifactsDir
    )

    return this.importFromParsedEpics(db, projectId, parsedEpics, statusMap, detailedStoriesMap)
  }

  /**
   * Imports stories from already-parsed epics data into the database.
   * Supports re-import: existing epics and stories are updated rather than duplicated.
   *
   * @param db - Drizzle database instance
   * @param projectId - ID of the project to import stories into
   * @param parsedEpics - Array of parsed epics from EpicsParserService
   * @param statusMap - Optional map of story keys to their status from sprint-status.yaml
   * @param detailedStoriesMap - Optional map of story keys to their detailed content from implementation-artifacts
   * @returns Import result with counts and created IDs
   */
  static async importFromParsedEpics(
    db: BetterSQLite3Database<typeof schema>,
    projectId: string,
    parsedEpics: ParsedEpic[],
    statusMap?: SprintStatusMap,
    detailedStoriesMap?: Map<StoryKey, { filePath: string; fullContent: string }>
  ): Promise<ImportResult> {
    const epicIds: string[] = []
    const storyIds: string[] = []
    let epicsCreated = 0
    let epicsUpdated = 0
    let storiesCreated = 0
    let storiesUpdated = 0
    let detailedStoriesImported = 0

    // Track sort order across all stories for proper ordering
    let sortOrder = 0

    for (const epic of parsedEpics) {
      const now = new Date()

      // Assign color based on epic number (cycle through palette)
      const colorIndex = (epic.epicNumber - 1) % EPIC_COLORS.length
      const color = EPIC_COLORS[colorIndex]

      // Story 3.7 AC 7: Check for existing epic by project_id and epic_number
      const existingEpic = db
        .select()
        .from(schema.epics)
        .where(
          and(eq(schema.epics.project_id, projectId), eq(schema.epics.epic_number, epic.epicNumber))
        )
        .get()

      let epicId: string

      if (existingEpic) {
        // Update existing epic
        epicId = existingEpic.id
        db.update(schema.epics)
          .set({
            title: epic.title,
            goal: epic.goal,
            description: epic.goal // Keep backwards compatibility
          })
          .where(eq(schema.epics.id, epicId))
          .run()
        epicsUpdated++
      } else {
        // Create new epic
        epicId = randomUUID()
        db.insert(schema.epics)
          .values({
            id: epicId,
            project_id: projectId,
            epic_number: epic.epicNumber,
            title: epic.title,
            goal: epic.goal,
            description: epic.goal, // Use goal as description for backwards compatibility
            color,
            created_at: now
          })
          .run()
        epicsCreated++
      }

      epicIds.push(epicId)

      // Create or update story tasks for this epic
      for (const story of epic.stories) {
        const description = this.formatStoryDescription(story)
        const title = `${story.epicNumber}.${story.storyNumber}: ${story.title}`

        // Story 3.7 AC 7: Check for existing story by epic_id and story_number
        const existingStory = db
          .select()
          .from(schema.tasks)
          .where(
            and(
              eq(schema.tasks.epic_id, epicId),
              eq(schema.tasks.story_number, story.storyNumber),
              eq(schema.tasks.task_type, 'story')
            )
          )
          .get()

        // Generate story key for status lookup
        const storyKey = this.generateStoryKey(story.epicNumber, story.storyNumber, story.title)
        const sprintStatus = statusMap?.get(storyKey)
        const kanbanStatus = this.mapSprintStatusToKanban(sprintStatus)

        // Look up detailed story content from implementation-artifacts
        const detailedStoryKey: StoryKey = `${story.epicNumber}-${story.storyNumber}`
        const detailedStory = detailedStoriesMap?.get(detailedStoryKey)
        const storyFilePath = detailedStory?.filePath ?? null
        const fullContent = detailedStory?.fullContent ?? null
        const hasDetailedStory = detailedStory !== undefined

        if (existingStory) {
          // Update existing story (preserving status and other user-modified fields)
          db.update(schema.tasks)
            .set({
              title,
              description,
              story_file_path: storyFilePath,
              full_content: fullContent,
              updated_at: now
              // Note: status is intentionally NOT updated to preserve user progress
            })
            .where(eq(schema.tasks.id, existingStory.id))
            .run()
          storyIds.push(existingStory.id)
          storiesUpdated++
          if (hasDetailedStory) detailedStoriesImported++
        } else {
          // Create new story with status from sprint-status.yaml (or backlog if not found)
          const storyId = randomUUID()
          db.insert(schema.tasks)
            .values({
              id: storyId,
              project_id: projectId,
              task_type: 'story',
              epic_id: epicId,
              story_number: story.storyNumber,
              title,
              description,
              status: kanbanStatus,
              sort_order: sortOrder++,
              story_file_path: storyFilePath,
              full_content: fullContent,
              created_at: now,
              updated_at: now
            })
            .run()
          storyIds.push(storyId)
          storiesCreated++
          if (hasDetailedStory) detailedStoriesImported++
        }
      }
    }

    return {
      epicsCreated,
      epicsUpdated,
      storiesCreated,
      storiesUpdated,
      detailedStoriesImported,
      epicIds,
      storyIds
    }
  }

  /**
   * Formats the story description from parsed story data.
   *
   * @param story - Parsed story from epics.md
   * @returns Formatted description with user story and acceptance criteria
   */
  private static formatStoryDescription(story: ParsedStory): string {
    const parts: string[] = []

    // Add user story
    if (story.userStory.role && story.userStory.action && story.userStory.benefit) {
      parts.push(`As a ${story.userStory.role},`)
      parts.push(`I want to ${story.userStory.action},`)
      parts.push(`So that ${story.userStory.benefit}.`)
      parts.push('')
    } else if (story.userStory.role || story.userStory.action || story.userStory.benefit) {
      // Partial user story - include what we have
      if (story.userStory.role) {
        parts.push(`As a ${story.userStory.role},`)
      }
      if (story.userStory.action) {
        parts.push(`I want to ${story.userStory.action},`)
      }
      if (story.userStory.benefit) {
        parts.push(`So that ${story.userStory.benefit}.`)
      }
      parts.push('')
    }

    // Add acceptance criteria
    if (story.acceptanceCriteria.trim()) {
      parts.push('## Acceptance Criteria')
      parts.push('')
      parts.push(story.acceptanceCriteria)
    }

    return parts.join('\n')
  }

  /**
   * Finds and parses the sprint-status.yaml file relative to the epics.md location.
   *
   * Looks for sprint-status.yaml in multiple locations:
   * 1. Same directory as epics.md (planning-artifacts/)
   * 2. Sibling implementation-artifacts/ directory
   * 3. Parent _bmad-output/ directory
   *
   * @param epicsPath - Path to the epics.md file
   * @returns Map of story keys to their status, or empty map if not found
   */
  static parseSprintStatus(epicsPath: string): SprintStatusMap {
    const statusMap: SprintStatusMap = new Map()

    // Look for sprint-status.yaml in multiple locations
    const epicsDir = dirname(epicsPath)
    const parentDir = dirname(epicsDir)

    const possiblePaths = [
      join(epicsDir, 'sprint-status.yaml'), // Same directory as epics.md
      join(parentDir, 'implementation-artifacts', 'sprint-status.yaml'), // Sibling directory
      join(parentDir, 'sprint-status.yaml') // Parent directory
    ]

    const statusPath = possiblePaths.find((p) => existsSync(p))

    if (!statusPath) {
      // Not found - return empty map
      return statusMap
    }

    try {
      const content = readFileSync(statusPath, 'utf-8')
      const parsed = yaml.parse(content)

      // Extract development_status section
      const devStatus = parsed?.development_status
      if (!devStatus || typeof devStatus !== 'object') {
        return statusMap
      }

      // Build map of story keys to statuses
      for (const [key, value] of Object.entries(devStatus)) {
        if (typeof value === 'string') {
          statusMap.set(key, value as SprintStatusValue)
        }
      }
    } catch {
      // Parse error - return empty map
      return statusMap
    }

    return statusMap
  }

  /**
   * Parses sprint-status.yaml from an explicit file path.
   *
   * @param statusPath - Absolute path to the sprint-status.yaml file
   * @returns Map of story keys to their status, or empty map if parsing fails
   */
  static parseSprintStatusFromPath(statusPath: string): SprintStatusMap {
    const statusMap: SprintStatusMap = new Map()

    if (!existsSync(statusPath)) {
      return statusMap
    }

    try {
      const content = readFileSync(statusPath, 'utf-8')
      const parsed = yaml.parse(content)

      // Extract development_status section
      const devStatus = parsed?.development_status
      if (!devStatus || typeof devStatus !== 'object') {
        return statusMap
      }

      // Build map of story keys to statuses
      for (const [key, value] of Object.entries(devStatus)) {
        if (typeof value === 'string') {
          statusMap.set(key, value as SprintStatusValue)
        }
      }
    } catch {
      // Parse error - return empty map
      return statusMap
    }

    return statusMap
  }

  /**
   * Converts a sprint-status.yaml status to a Kanban column status.
   *
   * @param sprintStatus - Status from sprint-status.yaml
   * @returns Kanban TaskStatus value
   */
  static mapSprintStatusToKanban(sprintStatus: SprintStatusValue | undefined): TaskStatus {
    switch (sprintStatus) {
      case 'done':
        return 'done'
      case 'in-progress':
        return 'in_progress'
      case 'review':
        return 'review'
      case 'ready-for-dev':
      case 'backlog':
      case 'deferred':
      case 'optional':
      default:
        return 'backlog'
    }
  }

  /**
   * Generates the sprint-status.yaml key for a story.
   *
   * Keys are formatted as: {epic_number}-{story_number}-{kebab-case-title}
   * Example: "3-7-story-import-after-epics-phase"
   *
   * @param epicNumber - Epic number
   * @param storyNumber - Story number
   * @param title - Story title
   * @returns Key string matching sprint-status.yaml format
   */
  static generateStoryKey(epicNumber: number, storyNumber: number, title: string): string {
    // Convert title to kebab-case
    const kebabTitle = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Collapse multiple hyphens
      .replace(/^-|-$/g, '') // Remove leading/trailing hyphens

    return `${epicNumber}-${storyNumber}-${kebabTitle}`
  }
}

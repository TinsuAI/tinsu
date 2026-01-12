import { readFile, readdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'

/**
 * Parsed detailed story from implementation-artifacts folder.
 */
export interface DetailedStory {
  epicNumber: number
  /** Story number as string to support formats like "2", "2b", "1-5" */
  storyNumber: string
  filePath: string
  fullContent: string
}

/**
 * Map key for story lookup: "epicNumber-storyNumber"
 * Examples: "3-4", "5-2b", "3-1-5"
 */
export type StoryKey = string

/**
 * Service for scanning and parsing detailed story files from implementation-artifacts.
 *
 * Detailed story files follow the pattern: {epicNumber}-{storyNumber}-{slug}.md
 * Example: 3-4-bmad-agent-launcher.md -> Epic 3, Story 4
 *
 * CRITICAL: This service runs in the main process only.
 * Never import this in the renderer process.
 */
export class DetailedStoryParserService {
  /**
   * Scans the implementation-artifacts directory for detailed story files.
   *
   * @param artifactsDir - Absolute path to implementation-artifacts directory
   * @returns Map of story keys to their detailed content
   *
   * @example
   * ```typescript
   * const stories = await DetailedStoryParserService.scanDetailedStories(
   *   '/path/to/_bmad-output/implementation-artifacts'
   * )
   * const story = stories.get('3-4') // Epic 3, Story 4
   * ```
   */
  static async scanDetailedStories(artifactsDir: string): Promise<Map<StoryKey, DetailedStory>> {
    const result = new Map<StoryKey, DetailedStory>()

    if (!existsSync(artifactsDir)) {
      return result
    }

    try {
      const files = await readdir(artifactsDir)

      // Filter for markdown files matching the pattern
      const storyFiles = files.filter((file) => this.isStoryFile(file))

      // Parse each story file
      for (const file of storyFiles) {
        const parsed = this.parseFileName(file)
        if (!parsed) continue

        const filePath = join(artifactsDir, file)
        try {
          const fullContent = await readFile(filePath, 'utf-8')
          const key: StoryKey = `${parsed.epicNumber}-${parsed.storyNumber}`

          result.set(key, {
            epicNumber: parsed.epicNumber,
            storyNumber: parsed.storyNumber,
            filePath,
            fullContent
          })
        } catch {
          // Skip files that can't be read
          continue
        }
      }
    } catch {
      // Return empty map if directory can't be read
      return result
    }

    return result
  }

  /**
   * Checks if a filename matches the story file pattern.
   *
   * Pattern: {epicNumber}-{storyNumber}-{slug}.md
   * Examples:
   * - 1-3-set-up-sqlite-database.md -> true
   * - 3-4-bmad-agent-launcher.md -> true
   * - 5-2b-add-create-story-column.md -> true (letter suffix)
   * - 3-1-5-multi-project-database-support.md -> true (sub-story)
   * - sprint-status.yaml -> false
   * - schema-gap-multi-project-support.md -> false
   *
   * @param filename - The filename to check
   * @returns true if the file matches the story pattern
   */
  static isStoryFile(filename: string): boolean {
    // Pattern: starts with digit-{digits/letters/dots}- and ends with .md
    // Supports: 1-3-name.md, 5-2b-name.md, 3-1-5-name.md
    const pattern = /^\d+-[\d\w]+-[^.]+\.md$/
    return pattern.test(filename)
  }

  /**
   * Parses epic and story numbers from a filename.
   *
   * @param filename - The filename to parse
   * @returns Object with epicNumber and storyNumber, or null if not a valid story file
   *
   * Examples:
   * - "3-4-bmad-agent-launcher.md" -> { epicNumber: 3, storyNumber: "4" }
   * - "5-2b-add-create-story-column.md" -> { epicNumber: 5, storyNumber: "2b" }
   * - "3-1-5-multi-project-database-support.md" -> { epicNumber: 3, storyNumber: "1-5" }
   */
  static parseFileName(filename: string): { epicNumber: number; storyNumber: string } | null {
    // Match: epicNumber - storyNumber (with optional letter or sub-number) - rest.md
    // Pattern captures: epicNumber, storyNumber (which may contain letters or be like "1-5")
    const match = filename.match(/^(\d+)-([\d\w]+(?:-\d+)?)-[^.]+\.md$/)
    if (!match) return null

    return {
      epicNumber: parseInt(match[1], 10),
      storyNumber: match[2] // Keep as string: "4", "2b", "1-5"
    }
  }

  /**
   * Finds the detailed story file for a specific epic and story number.
   *
   * @param artifactsDir - Absolute path to implementation-artifacts directory
   * @param epicNumber - Epic number
   * @param storyNumber - Story number as string (supports "2", "2b", "1-5")
   * @returns DetailedStory if found, null otherwise
   */
  static async findStoryFile(
    artifactsDir: string,
    epicNumber: number,
    storyNumber: string
  ): Promise<DetailedStory | null> {
    if (!existsSync(artifactsDir)) {
      return null
    }

    try {
      const files = await readdir(artifactsDir)

      // Find file matching pattern {epicNumber}-{storyNumber}-*.md
      // Escape special regex chars in storyNumber
      const escapedStoryNum = storyNumber.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const pattern = new RegExp(`^${epicNumber}-${escapedStoryNum}-.+\\.md$`)
      const matchingFile = files.find((file) => pattern.test(file))

      if (!matchingFile) {
        return null
      }

      const filePath = join(artifactsDir, matchingFile)
      const fullContent = await readFile(filePath, 'utf-8')

      return {
        epicNumber,
        storyNumber,
        filePath,
        fullContent
      }
    } catch {
      return null
    }
  }

  /**
   * Generates the story key for lookup.
   *
   * @param epicNumber - Epic number
   * @param storyNumber - Story number as string (supports "2", "2b", "1-5")
   * @returns Story key string
   */
  static generateKey(epicNumber: number, storyNumber: string): StoryKey {
    return `${epicNumber}-${storyNumber}`
  }
}

import { readFile, readdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'

/**
 * Parsed detailed story from implementation-artifacts folder.
 */
export interface DetailedStory {
  /** Optional prefix like "tes" for sprint-specific stories */
  prefix?: string
  epicNumber: number
  /** Story number as string to support formats like "2", "2b", "1-5" */
  storyNumber: string
  filePath: string
  fullContent: string
}

/**
 * Map key for story lookup: "[prefix-]epicNumber-storyNumber"
 * Examples: "3-4", "5-2b", "3-1-5", "tes-1-1", "tes-1-11"
 */
export type StoryKey = string

/**
 * Service for scanning and parsing detailed story files from implementation-artifacts.
 *
 * Detailed story files follow the pattern: [{prefix}-]{epicNumber}-{storyNumber}-{slug}.md
 * Examples:
 *   - 3-4-bmad-agent-launcher.md -> Epic 3, Story 4 (no prefix)
 *   - tes-1-1-tmux-dependency-check.md -> Epic 1, Story 1, prefix "tes"
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
          // Key includes prefix when present: "tes-1-1" vs "1-1"
          const key: StoryKey = parsed.prefix
            ? `${parsed.prefix}-${parsed.epicNumber}-${parsed.storyNumber}`
            : `${parsed.epicNumber}-${parsed.storyNumber}`

          result.set(key, {
            prefix: parsed.prefix,
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
   * Pattern: [{prefix}-]{epicNumber}-{storyNumber}-{slug}.md
   * Examples:
   * - 1-3-set-up-sqlite-database.md -> true (no prefix)
   * - 3-4-bmad-agent-launcher.md -> true (no prefix)
   * - 5-2b-add-create-story-column.md -> true (letter suffix)
   * - 3-1-5-multi-project-database-support.md -> true (sub-story)
   * - tes-1-1-tmux-dependency-check.md -> true (with prefix)
   * - tes-1-11-session-end-detection.md -> true (with prefix)
   * - sprint-status.yaml -> false
   * - schema-gap-multi-project-support.md -> false
   *
   * @param filename - The filename to check
   * @returns true if the file matches the story pattern
   */
  static isStoryFile(filename: string): boolean {
    // Pattern supports both:
    // - No prefix: {epic}-{story}-{slug}.md (e.g., 1-3-name.md, 5-2b-name.md, 3-1-5-name.md)
    // - With prefix: {prefix}-{epic}-{story}-{slug}.md (e.g., tes-1-1-name.md)
    // Story number MUST start with a digit and can have: letter suffix (2b) or sub-number (1-5)
    const patternNoPrefix = /^\d+-\d+[a-z]?(?:-\d+)?-[^.]+\.md$/
    const patternWithPrefix = /^[a-z]+-\d+-\d+[a-z]?(?:-\d+)?-[^.]+\.md$/
    return patternNoPrefix.test(filename) || patternWithPrefix.test(filename)
  }

  /**
   * Parses prefix, epic and story numbers from a filename.
   *
   * @param filename - The filename to parse
   * @returns Object with optional prefix, epicNumber, and storyNumber, or null if not a valid story file
   *
   * Examples:
   * - "3-4-bmad-agent-launcher.md" -> { epicNumber: 3, storyNumber: "4" }
   * - "5-2b-add-create-story-column.md" -> { epicNumber: 5, storyNumber: "2b" }
   * - "3-1-5-multi-project-database-support.md" -> { epicNumber: 3, storyNumber: "1-5" }
   * - "tes-1-1-tmux-dependency-check.md" -> { prefix: "tes", epicNumber: 1, storyNumber: "1" }
   * - "tes-1-11-session-end-detection.md" -> { prefix: "tes", epicNumber: 1, storyNumber: "11" }
   */
  static parseFileName(
    filename: string
  ): { prefix?: string; epicNumber: number; storyNumber: string } | null {
    // First try pattern with prefix: {prefix}-{epicNumber}-{storyNumber}-{slug}.md
    // Story number: digits with optional letter suffix or sub-number (e.g., "4", "2b", "1-5")
    const matchWithPrefix = filename.match(/^([a-z]+)-(\d+)-(\d+[a-z]?(?:-\d+)?)-[^.]+\.md$/)
    if (matchWithPrefix) {
      return {
        prefix: matchWithPrefix[1],
        epicNumber: parseInt(matchWithPrefix[2], 10),
        storyNumber: matchWithPrefix[3] // Keep as string: "1", "2b", "1-5"
      }
    }

    // Then try pattern without prefix: {epicNumber}-{storyNumber}-{slug}.md
    const matchNoPrefix = filename.match(/^(\d+)-(\d+[a-z]?(?:-\d+)?)-[^.]+\.md$/)
    if (matchNoPrefix) {
      return {
        epicNumber: parseInt(matchNoPrefix[1], 10),
        storyNumber: matchNoPrefix[2] // Keep as string: "4", "2b", "1-5"
      }
    }

    return null
  }

  /**
   * Finds the detailed story file for a specific epic and story number.
   *
   * @param artifactsDir - Absolute path to implementation-artifacts directory
   * @param epicNumber - Epic number
   * @param storyNumber - Story number as string (supports "2", "2b", "1-5")
   * @param prefix - Optional prefix for sprint-specific stories (e.g., "tes")
   * @returns DetailedStory if found, null otherwise
   */
  static async findStoryFile(
    artifactsDir: string,
    epicNumber: number,
    storyNumber: string,
    prefix?: string
  ): Promise<DetailedStory | null> {
    if (!existsSync(artifactsDir)) {
      return null
    }

    try {
      const files = await readdir(artifactsDir)

      // Find file matching pattern [{prefix}-]{epicNumber}-{storyNumber}-*.md
      // Escape special regex chars in storyNumber
      const escapedStoryNum = storyNumber.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const patternStr = prefix
        ? `^${prefix}-${epicNumber}-${escapedStoryNum}-.+\\.md$`
        : `^${epicNumber}-${escapedStoryNum}-.+\\.md$`
      const pattern = new RegExp(patternStr)
      const matchingFile = files.find((file) => pattern.test(file))

      if (!matchingFile) {
        return null
      }

      const filePath = join(artifactsDir, matchingFile)
      const fullContent = await readFile(filePath, 'utf-8')

      return {
        prefix,
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
   * @param prefix - Optional prefix for sprint-specific stories (e.g., "tes")
   * @returns Story key string (e.g., "3-4", "tes-1-1")
   */
  static generateKey(epicNumber: number, storyNumber: string, prefix?: string): StoryKey {
    return prefix ? `${prefix}-${epicNumber}-${storyNumber}` : `${epicNumber}-${storyNumber}`
  }

  /**
   * Extracts the prefix from a task ID if present.
   *
   * @param taskId - Full task ID (e.g., "tes-1-1-tmux-dependency-check")
   * @returns Prefix string if found (e.g., "tes"), undefined otherwise
   *
   * Examples:
   * - "tes-1-1-tmux-dependency-check" -> "tes"
   * - "1-1-initialize-electron-project" -> undefined
   * - "abc-2-3-some-story" -> "abc"
   */
  static extractPrefixFromTaskId(taskId: string): string | undefined {
    // Pattern: {prefix}-{epicNumber}-{storyNumber}-{slug}
    // where prefix is letters only and epicNumber starts with digit
    const match = taskId.match(/^([a-z]+)-\d+-/)
    return match ? match[1] : undefined
  }
}

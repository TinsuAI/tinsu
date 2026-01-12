import { readFile } from 'fs/promises'

/**
 * Parsed user story in As/I want/So that format.
 */
export interface UserStory {
  role: string
  action: string
  benefit: string
}

/**
 * Parsed story from epics.md file.
 */
export interface ParsedStory {
  epicNumber: number
  /** Story number as string to support formats like "2", "2b", "1.5" */
  storyNumber: string
  /**
   * Story number as integer (for database storage, ignores letter suffixes)
   * @deprecated No longer used - story_number column is now TEXT
   */
  storyNumberInt: number
  title: string
  userStory: UserStory
  /** Full acceptance criteria text for storage */
  acceptanceCriteria: string
}

/**
 * Parsed epic from epics.md file.
 */
export interface ParsedEpic {
  epicNumber: number
  title: string
  goal: string
  stories: ParsedStory[]
}

/**
 * Service for parsing BMAD epics.md files into structured data.
 *
 * Parses markdown structure with:
 * - ## Epic N: Title headers
 * - **Goal:** descriptions
 * - ### Story N.M: Title headers
 * - As a... I want... So that... user stories
 * - **Given/When/Then** acceptance criteria
 *
 * CRITICAL: This service runs in the main process only.
 * Never import this in the renderer process.
 */
export class EpicsParserService {
  /**
   * Parses an epics.md file and extracts all epics and stories.
   *
   * @param filePath - Absolute path to the epics.md file
   * @returns Array of parsed epics with their stories
   * @throws Error if file cannot be read
   *
   * @example
   * ```typescript
   * const epics = await EpicsParserService.parseEpicsFile('/path/to/epics.md')
   * console.log(`Found ${epics.length} epics`)
   * ```
   */
  static async parseEpicsFile(filePath: string): Promise<ParsedEpic[]> {
    const content = await readFile(filePath, 'utf-8')
    return this.parseContent(content)
  }

  /**
   * Parses epics.md content string into structured data.
   *
   * @param content - Raw markdown content
   * @returns Array of parsed epics with their stories
   */
  static parseContent(content: string): ParsedEpic[] {
    // Remove BOM if present
    const cleanContent = content.replace(/^\uFEFF/, '')

    if (!cleanContent.trim()) {
      return []
    }

    const epics: ParsedEpic[] = []

    // Split by epic headers
    // Match: ## Epic N: Title
    const epicRegex = /^##\s+Epic\s+(\d+):\s*(.+)$/gm
    const epicMatches = [...cleanContent.matchAll(epicRegex)]

    for (let i = 0; i < epicMatches.length; i++) {
      const match = epicMatches[i]
      const epicNumber = parseInt(match[1], 10)
      const title = match[2].trim()

      // Get content between this epic and the next (or end of file)
      const startIndex = match.index! + match[0].length
      const endIndex = epicMatches[i + 1]?.index ?? cleanContent.length
      const epicContent = cleanContent.slice(startIndex, endIndex)

      // Extract goal
      const goal = this.extractGoal(epicContent)

      // Extract stories
      const stories = this.extractStories(epicContent, epicNumber)

      epics.push({
        epicNumber,
        title,
        goal,
        stories
      })
    }

    return epics
  }

  /**
   * Extracts the goal from epic content.
   */
  private static extractGoal(epicContent: string): string {
    // Match: **Goal:** description text
    // The goal text continues until the next pattern or double newline
    const goalMatch = epicContent.match(/\*\*Goal:\*\*\s*(.+?)(?=\n\n|\n###|\n---|\n\*\*|$)/s)
    if (goalMatch) {
      return goalMatch[1].trim()
    }
    return ''
  }

  /**
   * Extracts all stories from epic content.
   */
  private static extractStories(epicContent: string, epicNumber: number): ParsedStory[] {
    const stories: ParsedStory[] = []

    // Match: ### Story X.Y: Title where Y can be "2", "2b", "1.5", etc.
    // Supports formats: Story 5.2, Story 5.2b, Story 3.1.5
    const storyRegex = /^###\s+Story\s+(\d+)\.([\d\w.]+):\s*(.+)$/gm
    const storyMatches = [...epicContent.matchAll(storyRegex)]

    for (let i = 0; i < storyMatches.length; i++) {
      const match = storyMatches[i]
      const storyEpicNum = parseInt(match[1], 10)
      const storyNumber = match[2] // Keep as string: "2", "2b", "1.5"
      // Extract integer part for database (ignores letters and extra decimals)
      const storyNumberInt = parseInt(storyNumber.replace(/[^\d]/g, ''), 10) || 0
      const title = match[3].trim()

      // Get content between this story and the next (or next epic/section)
      const startIndex = match.index! + match[0].length
      const endIndex = storyMatches[i + 1]?.index ?? epicContent.length
      const storyContent = epicContent.slice(startIndex, endIndex)

      // Extract user story
      const userStory = this.extractUserStory(storyContent)

      // Extract acceptance criteria
      const acceptanceCriteria = this.extractAcceptanceCriteria(storyContent)

      stories.push({
        epicNumber: storyEpicNum || epicNumber,
        storyNumber,
        storyNumberInt,
        title,
        userStory,
        acceptanceCriteria
      })
    }

    return stories
  }

  /**
   * Extracts user story in As/I want/So that format.
   */
  private static extractUserStory(storyContent: string): UserStory {
    // Match the "As a... I want... So that..." pattern
    // Format can be multiline:
    // As a developer,
    // I want to set up the project structure,
    // So that I can start building features.

    const userStoryRegex =
      /As\s+(?:a|an)\s+(.+?),?\s*[\r\n]+I\s+want\s+(?:to\s+)?(.+?),?\s*[\r\n]+So\s+that\s+(.+?)(?:\.|\n\n|\n\*\*|$)/is

    const match = storyContent.match(userStoryRegex)

    if (match) {
      return {
        role: match[1].trim().replace(/,$/, ''),
        action: match[2].trim().replace(/,$/, ''),
        benefit: match[3].trim().replace(/\.$/, '')
      }
    }

    // Return empty structure if pattern not found
    return {
      role: '',
      action: '',
      benefit: ''
    }
  }

  /**
   * Extracts acceptance criteria text.
   */
  private static extractAcceptanceCriteria(storyContent: string): string {
    // Find **Acceptance Criteria:** section
    const acMatch = storyContent.match(/\*\*Acceptance Criteria:\*\*\s*([\s\S]*?)(?=\n---|\n###|$)/i)

    if (acMatch) {
      return acMatch[1].trim()
    }

    // If no explicit AC section, look for Given/When/Then patterns
    const gwt = storyContent.match(/(\*\*Given\*\*[\s\S]*?)(?=\n---|\n###|$)/i)
    if (gwt) {
      return gwt[1].trim()
    }

    return ''
  }
}

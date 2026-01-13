import { readFileSync, existsSync } from 'fs'

/**
 * Context structure for DEV agent story implementation.
 * Contains story content and optional project context information.
 */
export interface StoryContext {
  /** Full markdown content of the story file */
  storyContent: string
  /** Path to the story file being implemented */
  storyFilePath: string
  /** Path to project-context.md if found */
  projectContextPath?: string
  /** Content of project-context.md if found */
  projectContextContent?: string
  /** Optional context notes from task.context_notes */
  contextNotes?: string
}

/**
 * Service for building context for DEV agent story implementation.
 *
 * This service assembles context from multiple sources:
 * - Story file content (acceptance criteria, tasks, dev notes)
 * - Project context (coding standards, patterns)
 * - Context notes (user-provided additional context)
 *
 * CRITICAL: This service runs in the main process only.
 * Never import this in the renderer process.
 */
export class ContextBuilderService {
  /**
   * Builds basic story context from a story file path.
   *
   * Loads and returns the story markdown content.
   * Use this for simple context building without project context.
   *
   * @param storyFilePath - Full path to the story .md file
   * @returns StoryContext with story content
   * @throws Error if story file cannot be read
   *
   * @example
   * ```typescript
   * const context = ContextBuilderService.buildStoryContext('/path/to/story.md')
   * console.log(context.storyContent)
   * ```
   */
  static buildStoryContext(storyFilePath: string): StoryContext {
    const storyContent = readFileSync(storyFilePath, 'utf-8')

    return {
      storyContent,
      storyFilePath
    }
  }

  /**
   * Builds story context including project context when available.
   *
   * Loads story content and optionally loads project-context.md
   * if the path exists. Project context provides coding standards
   * and patterns for the DEV agent to follow.
   *
   * @param storyFilePath - Full path to the story .md file
   * @param projectContextPath - Path to project-context.md
   * @returns StoryContext with story and optionally project context
   * @throws Error if story file cannot be read
   *
   * @example
   * ```typescript
   * const context = ContextBuilderService.buildStoryContextWithProjectContext(
   *   '/path/to/story.md',
   *   '/path/to/project-context.md'
   * )
   * if (context.projectContextContent) {
   *   console.log('Project context loaded')
   * }
   * ```
   */
  static buildStoryContextWithProjectContext(
    storyFilePath: string,
    projectContextPath: string
  ): StoryContext {
    const storyContent = readFileSync(storyFilePath, 'utf-8')

    const context: StoryContext = {
      storyContent,
      storyFilePath
    }

    // Load project context if it exists
    if (existsSync(projectContextPath)) {
      context.projectContextPath = projectContextPath
      context.projectContextContent = readFileSync(projectContextPath, 'utf-8')
    }

    return context
  }

  /**
   * Builds story context with optional context notes.
   *
   * Context notes are user-provided additional information that
   * supplements the story content. This is used by Story 5.11
   * to add task-specific notes.
   *
   * @param storyFilePath - Full path to the story .md file
   * @param contextNotes - Optional user-provided notes
   * @returns StoryContext with story content and notes
   * @throws Error if story file cannot be read
   *
   * @example
   * ```typescript
   * const context = ContextBuilderService.buildStoryContextWithNotes(
   *   '/path/to/story.md',
   *   'Use the existing auth module for login'
   * )
   * ```
   */
  static buildStoryContextWithNotes(
    storyFilePath: string,
    contextNotes?: string
  ): StoryContext {
    const storyContent = readFileSync(storyFilePath, 'utf-8')

    return {
      storyContent,
      storyFilePath,
      contextNotes
    }
  }
}

import { readFileSync, existsSync } from 'fs'
import { join, isAbsolute } from 'path'

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
  /** Optional worktree base path for path resolution (Story 8.4) */
  worktreeBasePath?: string
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
    try {
      const storyContent = readFileSync(storyFilePath, 'utf-8')

      return {
        storyContent,
        storyFilePath
      }
    } catch (error) {
      throw new Error(
        `Failed to read story file at ${storyFilePath}: ${error instanceof Error ? error.message : String(error)}`
      )
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
    try {
      const storyContent = readFileSync(storyFilePath, 'utf-8')

      const context: StoryContext = {
        storyContent,
        storyFilePath
      }

      // Load project context if it exists
      if (existsSync(projectContextPath)) {
        try {
          context.projectContextPath = projectContextPath
          context.projectContextContent = readFileSync(projectContextPath, 'utf-8')
        } catch (error) {
          // Project context is optional - log but don't fail
          console.warn(
            `Failed to read project context at ${projectContextPath}: ${error instanceof Error ? error.message : String(error)}`
          )
        }
      }

      return context
    } catch (error) {
      throw new Error(
        `Failed to read story file at ${storyFilePath}: ${error instanceof Error ? error.message : String(error)}`
      )
    }
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
    try {
      const storyContent = readFileSync(storyFilePath, 'utf-8')

      return {
        storyContent,
        storyFilePath,
        contextNotes
      }
    } catch (error) {
      throw new Error(
        `Failed to read story file at ${storyFilePath}: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * Resolves a file path relative to a worktree base path.
   *
   * Story 8.4 - AC: 4
   *
   * When a worktree path is provided, relative paths are resolved
   * against the worktree instead of the original project root.
   * Absolute paths are returned unchanged.
   *
   * @param filePath - The file path to resolve (absolute or relative)
   * @param worktreePath - Optional worktree base path for resolution
   * @returns The resolved absolute path
   *
   * @example
   * ```typescript
   * // With worktree
   * const path = ContextBuilderService.resolvePathInWorktree(
   *   'src/index.ts',
   *   '/project/.tinsu/worktrees/task-123'
   * )
   * // Returns: '/project/.tinsu/worktrees/task-123/src/index.ts'
   *
   * // Without worktree (absolute path)
   * const path = ContextBuilderService.resolvePathInWorktree('/abs/path.ts')
   * // Returns: '/abs/path.ts'
   * ```
   */
  static resolvePathInWorktree(filePath: string, worktreePath?: string): string {
    // If path is absolute, return as-is
    if (isAbsolute(filePath)) {
      return filePath
    }

    // If no worktree path, return as-is (caller should handle relative paths)
    if (!worktreePath) {
      return filePath
    }

    // Resolve relative path against worktree
    return join(worktreePath, filePath)
  }

  /**
   * Builds complete story context with worktree support.
   *
   * Story 8.4 - AC: 4
   *
   * Loads story content and project context, resolving paths
   * relative to the worktree when provided. This ensures agents
   * working in isolated worktrees have correct file references.
   *
   * @param storyFilePath - Path to the story .md file
   * @param projectContextPath - Path to project-context.md (optional)
   * @param worktreePath - Worktree base path for isolated execution (optional)
   * @param contextNotes - User-provided context notes (optional)
   * @returns StoryContext with all available context
   * @throws Error if story file cannot be read
   *
   * @example
   * ```typescript
   * const context = ContextBuilderService.buildContext({
   *   storyFilePath: '/project/_bmad-output/stories/8-4-story.md',
   *   worktreePath: '/project/.tinsu/worktrees/task-abc123'
   * })
   * ```
   */
  static buildContext(options: {
    storyFilePath: string
    projectContextPath?: string
    worktreePath?: string
    contextNotes?: string
  }): StoryContext {
    const { storyFilePath, projectContextPath, worktreePath, contextNotes } = options

    // Resolve story file path (may be relative to worktree)
    const resolvedStoryPath = this.resolvePathInWorktree(storyFilePath, worktreePath)

    try {
      const storyContent = readFileSync(resolvedStoryPath, 'utf-8')

      const context: StoryContext = {
        storyContent,
        storyFilePath: resolvedStoryPath,
        contextNotes,
        worktreeBasePath: worktreePath
      }

      // Load project context if path provided and file exists
      if (projectContextPath) {
        const resolvedProjectContextPath = this.resolvePathInWorktree(projectContextPath, worktreePath)
        if (existsSync(resolvedProjectContextPath)) {
          try {
            context.projectContextPath = resolvedProjectContextPath
            context.projectContextContent = readFileSync(resolvedProjectContextPath, 'utf-8')
          } catch (error) {
            // Project context is optional - log but don't fail
            console.warn(
              `Failed to read project context at ${resolvedProjectContextPath}: ${error instanceof Error ? error.message : String(error)}`
            )
          }
        }
      }

      return context
    } catch (error) {
      const worktreeNote = worktreePath ? ` (worktree: ${worktreePath})` : ''
      throw new Error(
        `Failed to read story file at ${resolvedStoryPath}${worktreeNote}: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }
}

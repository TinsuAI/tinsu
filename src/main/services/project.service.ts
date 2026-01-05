import * as fs from 'fs'
import * as path from 'path'
import { ConfigService } from './config.service'
import type { ProjectConfig } from '../../shared/types/config.types'

/**
 * Custom error class for project-related errors.
 * Provides clear, user-friendly error messages.
 */
export class ProjectError extends Error {
  constructor(
    message: string,
    public readonly code: 'NOT_GIT_REPO' | 'NOT_FOUND' | 'ALREADY_OPEN' | 'INIT_ERROR',
    public readonly details?: string
  ) {
    super(message)
    this.name = 'ProjectError'
  }
}

/**
 * Project information returned when opening a project.
 */
export interface ProjectInfo {
  path: string
  config: ProjectConfig
  isNewProject: boolean
}

/**
 * Service for managing project initialization and state.
 * Handles git repository validation, .tinsu folder creation,
 * and tracking the currently open project.
 *
 * Uses static methods with singleton state for current project tracking.
 */
export class ProjectService {
  private static currentProjectPath: string | null = null
  private static currentProjectInfo: ProjectInfo | null = null

  /**
   * Checks if the given directory is a git repository.
   * @param dirPath - Path to the directory to check
   * @returns true if the directory contains a .git folder
   */
  static isGitRepository(dirPath: string): boolean {
    try {
      const gitPath = path.join(dirPath, '.git')
      return fs.existsSync(gitPath) && fs.statSync(gitPath).isDirectory()
    } catch {
      return false
    }
  }

  /**
   * Initializes TinSu in a git repository.
   * Creates .tinsu/ folder, config.yaml, and updates .gitignore.
   *
   * @param projectPath - Path to the git repository
   * @returns The created project configuration
   * @throws ProjectError if the directory is not a git repository
   */
  static async initializeProject(projectPath: string): Promise<ProjectConfig> {
    // Validate git repository
    if (!this.isGitRepository(projectPath)) {
      throw new ProjectError(
        'TinSu requires a git repository. Please select a directory with git initialized.',
        'NOT_GIT_REPO'
      )
    }

    // Create .tinsu/ folder and config via ConfigService
    const configService = new ConfigService(projectPath)
    const config = configService.getOrCreateConfig()

    // Update .gitignore
    this.updateGitignore(projectPath)

    return config
  }

  /**
   * Opens a project directory, initializing TinSu if needed.
   *
   * @param projectPath - Path to the project directory
   * @returns Project info including path, config, and whether it was newly initialized
   * @throws ProjectError if the directory doesn't exist or is not a git repository
   */
  static async openProject(projectPath: string): Promise<ProjectInfo> {
    // Validate directory exists
    if (!fs.existsSync(projectPath)) {
      throw new ProjectError(
        'Directory does not exist. Please select a valid directory.',
        'NOT_FOUND',
        projectPath
      )
    }

    // Validate git repository
    if (!this.isGitRepository(projectPath)) {
      throw new ProjectError(
        'TinSu requires a git repository. Please select a directory with git initialized.',
        'NOT_GIT_REPO'
      )
    }

    // Check if .tinsu already exists
    const tinsuPath = path.join(projectPath, '.tinsu')
    const isNewProject = !fs.existsSync(tinsuPath)

    let config: ProjectConfig

    if (isNewProject) {
      // Initialize new project
      config = await this.initializeProject(projectPath)
    } else {
      // Load existing project
      const configService = new ConfigService(projectPath)
      config = configService.loadConfig()
    }

    // Store current project
    this.currentProjectPath = projectPath
    this.currentProjectInfo = {
      path: projectPath,
      config,
      isNewProject
    }

    return this.currentProjectInfo
  }

  /**
   * Updates .gitignore to include .tinsu/data/ pattern.
   * Creates .gitignore if it doesn't exist.
   * Idempotent - won't duplicate the pattern if already present.
   *
   * @param projectPath - Path to the project root
   */
  static updateGitignore(projectPath: string): void {
    const gitignorePath = path.join(projectPath, '.gitignore')
    const pattern = '.tinsu/data/'

    if (!fs.existsSync(gitignorePath)) {
      // Create new .gitignore with pattern
      fs.writeFileSync(gitignorePath, `${pattern}\n`, 'utf-8')
      return
    }

    // Read existing content
    const content = fs.readFileSync(gitignorePath, 'utf-8')

    // Check if pattern already exists
    if (content.includes(pattern)) {
      return
    }

    // Append pattern with proper newline handling
    const newContent = content.endsWith('\n')
      ? `${content}${pattern}\n`
      : `${content}\n${pattern}\n`

    fs.writeFileSync(gitignorePath, newContent, 'utf-8')
  }

  /**
   * Gets the path of the currently open project.
   *
   * @returns The project path, or null if no project is open
   */
  static getCurrentProject(): string | null {
    return this.currentProjectPath
  }

  /**
   * Gets full info about the currently open project.
   *
   * @returns Project info, or null if no project is open
   */
  static getProjectInfo(): ProjectInfo | null {
    return this.currentProjectInfo
  }

  /**
   * Closes the current project, clearing the stored state.
   */
  static closeProject(): void {
    this.currentProjectPath = null
    this.currentProjectInfo = null
  }

  /**
   * Resets the singleton state. Used for testing.
   */
  static reset(): void {
    this.currentProjectPath = null
    this.currentProjectInfo = null
  }
}

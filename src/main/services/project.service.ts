import * as fs from 'fs'
import * as path from 'path'
import { execSync } from 'child_process'
import { nanoid } from 'nanoid'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { ConfigService } from './config.service'
import { PlanningInitService } from './planning-init.service'
import { db } from '../db'
import { projects, sprints } from '../db/schema'
import type { ProjectConfig } from '../../shared/types/config.types'

/**
 * Custom error class for project-related errors.
 * Provides clear, user-friendly error messages.
 */
export class ProjectError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'NOT_GIT_REPO'
      | 'NOT_FOUND'
      | 'ALREADY_OPEN'
      | 'INIT_ERROR'
      | 'INVALID_PATH'
      | 'ALREADY_EXISTS'
      | 'GIT_INIT_FAILED',
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
  id: string
  path: string
  config: ProjectConfig
  isNewProject: boolean
  needsOnboarding: boolean
}

/**
 * Service for managing project initialization and state.
 * Handles git repository validation, .tinsu folder creation,
 * database project registration, and tracking the currently open project.
 *
 * Uses static methods with singleton state for current project tracking.
 */
export class ProjectService {
  private static currentProjectPath: string | null = null
  private static currentProjectId: string | null = null
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
   * Creates a brand-new project from scratch.
   * Creates the project folder, initializes git, then delegates to openProject()
   * for full TinSu initialization (.tinsu/, config, DB, sprints, planning tasks).
   *
   * @param parentDir - Path to the parent directory where the project folder will be created
   * @param projectName - Name of the project (used as folder name)
   * @returns Project info from openProject()
   * @throws ProjectError if parent dir not found, folder already exists, or git init fails
   */
  static async createNewProject(parentDir: string, projectName: string): Promise<ProjectInfo> {
    // Validate parent directory exists and is a directory
    if (!fs.existsSync(parentDir) || !fs.statSync(parentDir).isDirectory()) {
      throw new ProjectError(
        `Parent directory not found: ${parentDir}`,
        'NOT_FOUND'
      )
    }

    const newProjectPath = path.join(parentDir, projectName)

    // Check folder doesn't already exist
    if (fs.existsSync(newProjectPath)) {
      throw new ProjectError(
        `A folder named '${projectName}' already exists at that location.`,
        'ALREADY_EXISTS'
      )
    }

    // Create folder
    try {
      fs.mkdirSync(newProjectPath, { recursive: false })
    } catch (err) {
      throw new ProjectError(
        `Failed to create project folder: ${(err as Error).message}`,
        'INIT_ERROR'
      )
    }

    // Initialize git
    try {
      execSync('git init', { cwd: newProjectPath, stdio: 'pipe' })
    } catch {
      // Clean up folder on failure
      try { fs.rmSync(newProjectPath, { recursive: true, force: true }) } catch { /* ignore cleanup errors */ }
      throw new ProjectError(
        'Failed to initialize git repository. Please ensure git is installed.',
        'GIT_INIT_FAILED'
      )
    }

    // Reuse existing openProject flow — handles .tinsu, config, DB, sprints, planning tasks
    return this.openProject(newProjectPath)
  }

  /**
   * Opens a project directory, initializing TinSu if needed.
   * Registers or updates the project in the database.
   *
   * @param projectPath - Path to the project directory
   * @returns Project info including id, path, config, and whether it was newly initialized
   * @throws ProjectError if the directory doesn't exist or is not a git repository
   */
  static async openProject(projectPath: string): Promise<ProjectInfo> {
    // Validate directory exists
    if (!fs.existsSync(projectPath)) {
      throw new ProjectError(
        `Invalid project path: ${projectPath}`,
        'INVALID_PATH',
        projectPath
      )
    }

    // Validate it's a directory
    if (!fs.statSync(projectPath).isDirectory()) {
      throw new ProjectError(
        `Invalid project path: ${projectPath}`,
        'INVALID_PATH',
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

    // Story 3.1.5: Register or lookup project in database
    const { id: projectId, alreadyRegistered } = await this.registerOrUpdateProject(projectPath, config.projectName)

    // Ensure project has at least one sprint (create default Backlog if none exist)
    this.ensureDefaultSprint(projectId)

    // Initialize planning tasks if not already done (Story 3.2)
    if (!config.planningTasksInitialized) {
      await PlanningInitService.initializePlanningTasks(projectPath, projectId)
      const configService = new ConfigService(projectPath)
      config = configService.updateConfig({ planningTasksInitialized: true })
    }

    // Store current project
    this.currentProjectPath = projectPath
    this.currentProjectId = projectId
    this.currentProjectInfo = {
      id: projectId,
      path: projectPath,
      config,
      isNewProject,
      needsOnboarding: !alreadyRegistered
    }

    return this.currentProjectInfo
  }

  /**
   * Registers a new project in the database or updates last_opened_at for existing project.
   *
   * @param projectPath - The absolute path to the project directory
   * @param projectName - The name of the project (from config or directory basename)
   * @returns The project ID
   */
  private static async registerOrUpdateProject(
    projectPath: string,
    projectName?: string
  ): Promise<{ id: string; alreadyRegistered: boolean }> {
    // Check if project exists in database by path
    const existingProject = db
      .select()
      .from(projects)
      .where(eq(projects.path, projectPath))
      .get()

    if (existingProject) {
      // Update last_opened_at for existing project
      db.update(projects)
        .set({ last_opened_at: new Date() })
        .where(eq(projects.id, existingProject.id))
        .run()
      return { id: existingProject.id, alreadyRegistered: true }
    }

    // Create new project record
    const projectId = nanoid()
    const name = projectName || path.basename(projectPath)

    db.insert(projects)
      .values({
        id: projectId,
        path: projectPath,
        name,
        last_opened_at: new Date()
      })
      .run()

    return { id: projectId, alreadyRegistered: false }
  }

  /**
   * Ensures a project has at least one sprint.
   * Creates a default "Backlog" sprint if no sprints exist for the project.
   *
   * @param projectId - The ID of the project to check
   */
  private static ensureDefaultSprint(projectId: string): void {
    // Check if project has any sprints
    const existingSprints = db
      .select()
      .from(sprints)
      .where(eq(sprints.project_id, projectId))
      .all()

    if (existingSprints.length === 0) {
      // Create default Backlog sprint
      const sprintId = randomUUID()

      db.insert(sprints)
        .values({
          id: sprintId,
          name: 'Backlog',
          status: 'active',
          goal: 'Default sprint for organizing unscheduled work',
          project_id: projectId,
          created_at: new Date()
        })
        .run()
    }
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
   * Gets the ID of the currently open project.
   * Used by tRPC context to scope queries to the current project.
   *
   * @returns The project ID, or null if no project is open
   */
  static getCurrentProjectId(): string | null {
    return this.currentProjectId
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
    this.currentProjectId = null
    this.currentProjectInfo = null
  }

  /**
   * Resets the singleton state. Used for testing.
   */
  static reset(): void {
    this.currentProjectPath = null
    this.currentProjectId = null
    this.currentProjectInfo = null
  }
}

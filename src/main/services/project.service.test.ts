import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { ProjectService, ProjectError } from './project.service'
import { PlanningInitService } from './planning-init.service'

// Mock the database module to avoid Electron/sqlite dependencies (Story 3.1.5)
vi.mock('../db', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          get: vi.fn().mockReturnValue(null) // No existing project found
        })
      })
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        run: vi.fn()
      })
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          run: vi.fn()
        })
      })
    })
  }
}))

// Mock PlanningInitService to avoid database/electron dependencies
vi.mock('./planning-init.service', () => ({
  PlanningInitService: {
    initializePlanningTasks: vi.fn().mockResolvedValue([])
  }
}))

// Test fixture paths
const TEST_BASE = '/tmp/tinsu-project-test-' + Date.now()
const TEST_GIT_REPO = path.join(TEST_BASE, 'git-repo')
const TEST_NON_GIT_DIR = path.join(TEST_BASE, 'non-git')
const TEST_EXISTING_TINSU = path.join(TEST_BASE, 'existing-tinsu')

describe('ProjectService', () => {
  beforeEach(() => {
    // Create test directories
    fs.mkdirSync(TEST_GIT_REPO, { recursive: true })
    fs.mkdirSync(path.join(TEST_GIT_REPO, '.git'), { recursive: true })

    fs.mkdirSync(TEST_NON_GIT_DIR, { recursive: true })

    fs.mkdirSync(TEST_EXISTING_TINSU, { recursive: true })
    fs.mkdirSync(path.join(TEST_EXISTING_TINSU, '.git'), { recursive: true })
    fs.mkdirSync(path.join(TEST_EXISTING_TINSU, '.tinsu'), { recursive: true })
    fs.writeFileSync(
      path.join(TEST_EXISTING_TINSU, '.tinsu', 'config.yaml'),
      `projectName: "ExistingProject"
methodology: bmad
createdAt: "2026-01-01T00:00:00Z"
version: "1.0.0"
`
    )
  })

  afterEach(() => {
    // Clean up test directories
    fs.rmSync(TEST_BASE, { recursive: true, force: true })
    // Reset singleton state
    ProjectService.reset()
    // Clear mocks
    vi.clearAllMocks()
  })

  describe('isGitRepository()', () => {
    it('should return true for directories with .git folder', () => {
      expect(ProjectService.isGitRepository(TEST_GIT_REPO)).toBe(true)
    })

    it('should return false for directories without .git folder', () => {
      expect(ProjectService.isGitRepository(TEST_NON_GIT_DIR)).toBe(false)
    })

    it('should return false for non-existent directories', () => {
      expect(ProjectService.isGitRepository('/non/existent/path')).toBe(false)
    })
  })

  describe('initializeProject()', () => {
    it('should create .tinsu folder in project root', async () => {
      await ProjectService.initializeProject(TEST_GIT_REPO)

      expect(fs.existsSync(path.join(TEST_GIT_REPO, '.tinsu'))).toBe(true)
    })

    it('should create config.yaml via ConfigService', async () => {
      await ProjectService.initializeProject(TEST_GIT_REPO)

      const configPath = path.join(TEST_GIT_REPO, '.tinsu', 'config.yaml')
      expect(fs.existsSync(configPath)).toBe(true)

      const content = fs.readFileSync(configPath, 'utf-8')
      expect(content).toContain('projectName:')
      expect(content).toContain('methodology:')
    })

    it('should update .gitignore with .tinsu/data/', async () => {
      await ProjectService.initializeProject(TEST_GIT_REPO)

      const gitignorePath = path.join(TEST_GIT_REPO, '.gitignore')
      expect(fs.existsSync(gitignorePath)).toBe(true)

      const content = fs.readFileSync(gitignorePath, 'utf-8')
      expect(content).toContain('.tinsu/data/')
    })

    it('should return the project config', async () => {
      const config = await ProjectService.initializeProject(TEST_GIT_REPO)

      expect(config).toBeDefined()
      expect(config.projectName).toBeDefined()
      expect(config.methodology).toBe('bmad')
    })

    it('should throw ProjectError for non-git directories', async () => {
      await expect(ProjectService.initializeProject(TEST_NON_GIT_DIR)).rejects.toThrow(ProjectError)

      await expect(ProjectService.initializeProject(TEST_NON_GIT_DIR)).rejects.toThrow(
        'requires a git repository'
      )
    })
  })

  describe('openProject()', () => {
    it('should validate git repository and initialize if needed', async () => {
      const result = await ProjectService.openProject(TEST_GIT_REPO)

      expect(result.path).toBe(TEST_GIT_REPO)
      expect(result.config).toBeDefined()
      expect(result.isNewProject).toBe(true)
    })

    it('should load existing .tinsu config without re-initialization', async () => {
      const result = await ProjectService.openProject(TEST_EXISTING_TINSU)

      expect(result.path).toBe(TEST_EXISTING_TINSU)
      expect(result.config.projectName).toBe('ExistingProject')
      expect(result.isNewProject).toBe(false)
    })

    it('should set the project as current', async () => {
      await ProjectService.openProject(TEST_GIT_REPO)

      const current = ProjectService.getCurrentProject()
      expect(current).toBe(TEST_GIT_REPO)
    })

    it('should throw ProjectError for non-git directories', async () => {
      await expect(ProjectService.openProject(TEST_NON_GIT_DIR)).rejects.toThrow(ProjectError)

      await expect(ProjectService.openProject(TEST_NON_GIT_DIR)).rejects.toThrow(
        'requires a git repository'
      )
    })

    it('should throw ProjectError for non-existent directories', async () => {
      await expect(ProjectService.openProject('/non/existent/path')).rejects.toThrow(ProjectError)

      await expect(ProjectService.openProject('/non/existent/path')).rejects.toThrow(
        'Invalid project path'
      )
    })
  })

  describe('updateGitignore()', () => {
    it('should create .gitignore if it does not exist', () => {
      ProjectService.updateGitignore(TEST_GIT_REPO)

      const gitignorePath = path.join(TEST_GIT_REPO, '.gitignore')
      expect(fs.existsSync(gitignorePath)).toBe(true)

      const content = fs.readFileSync(gitignorePath, 'utf-8')
      expect(content).toContain('.tinsu/data/')
    })

    it('should add pattern to existing .gitignore', () => {
      const gitignorePath = path.join(TEST_GIT_REPO, '.gitignore')
      fs.writeFileSync(gitignorePath, 'node_modules/\n.env\n')

      ProjectService.updateGitignore(TEST_GIT_REPO)

      const content = fs.readFileSync(gitignorePath, 'utf-8')
      expect(content).toContain('node_modules/')
      expect(content).toContain('.env')
      expect(content).toContain('.tinsu/data/')
    })

    it('should not duplicate pattern if already present', () => {
      const gitignorePath = path.join(TEST_GIT_REPO, '.gitignore')
      fs.writeFileSync(gitignorePath, 'node_modules/\n.tinsu/data/\n')

      ProjectService.updateGitignore(TEST_GIT_REPO)

      const content = fs.readFileSync(gitignorePath, 'utf-8')
      const matches = content.match(/\.tinsu\/data\//g) || []
      expect(matches.length).toBe(1)
    })

    it('should be idempotent - multiple calls should produce same result', () => {
      ProjectService.updateGitignore(TEST_GIT_REPO)
      ProjectService.updateGitignore(TEST_GIT_REPO)
      ProjectService.updateGitignore(TEST_GIT_REPO)

      const gitignorePath = path.join(TEST_GIT_REPO, '.gitignore')
      const content = fs.readFileSync(gitignorePath, 'utf-8')
      const matches = content.match(/\.tinsu\/data\//g) || []
      expect(matches.length).toBe(1)
    })
  })

  describe('getCurrentProject()', () => {
    it('should return null when no project is loaded', () => {
      expect(ProjectService.getCurrentProject()).toBeNull()
    })

    it('should return the current project path after opening', async () => {
      await ProjectService.openProject(TEST_GIT_REPO)

      expect(ProjectService.getCurrentProject()).toBe(TEST_GIT_REPO)
    })
  })

  describe('closeProject()', () => {
    it('should clear the current project', async () => {
      await ProjectService.openProject(TEST_GIT_REPO)
      expect(ProjectService.getCurrentProject()).toBe(TEST_GIT_REPO)

      ProjectService.closeProject()

      expect(ProjectService.getCurrentProject()).toBeNull()
    })
  })

  describe('getProjectInfo()', () => {
    it('should return null when no project is loaded', () => {
      expect(ProjectService.getProjectInfo()).toBeNull()
    })

    it('should return project info when project is loaded', async () => {
      await ProjectService.openProject(TEST_GIT_REPO)

      const info = ProjectService.getProjectInfo()
      expect(info).not.toBeNull()
      expect(info!.path).toBe(TEST_GIT_REPO)
      expect(info!.config).toBeDefined()
    })
  })

  // Story 3.2: Planning task initialization tests
  describe('planning task initialization (Story 3.2)', () => {
    it('should call PlanningInitService.initializePlanningTasks on new project', async () => {
      await ProjectService.openProject(TEST_GIT_REPO)

      // Story 3.1.5: initializePlanningTasks now takes projectId as second arg
      expect(PlanningInitService.initializePlanningTasks).toHaveBeenCalledWith(
        TEST_GIT_REPO,
        expect.any(String) // projectId
      )
    })

    it('should set planningTasksInitialized to true after initialization', async () => {
      const result = await ProjectService.openProject(TEST_GIT_REPO)

      expect(result.config.planningTasksInitialized).toBe(true)
    })

    it('should call PlanningInitService on existing project without planning initialized', async () => {
      // Existing project WITHOUT planningTasksInitialized set
      await ProjectService.openProject(TEST_EXISTING_TINSU)

      // Story 3.1.5: initializePlanningTasks now takes projectId as second arg
      expect(PlanningInitService.initializePlanningTasks).toHaveBeenCalledWith(
        TEST_EXISTING_TINSU,
        expect.any(String) // projectId
      )
    })

    it('should not call PlanningInitService if planningTasksInitialized is true', async () => {
      // Create project with planningTasksInitialized: true
      const alreadyInitialized = path.join(TEST_BASE, 'already-initialized')
      fs.mkdirSync(alreadyInitialized, { recursive: true })
      fs.mkdirSync(path.join(alreadyInitialized, '.git'), { recursive: true })
      fs.mkdirSync(path.join(alreadyInitialized, '.tinsu'), { recursive: true })
      fs.writeFileSync(
        path.join(alreadyInitialized, '.tinsu', 'config.yaml'),
        `projectName: "AlreadyInitialized"
methodology: bmad
createdAt: "2026-01-01T00:00:00Z"
version: "1.0.0"
planningTasksInitialized: true
`
      )

      await ProjectService.openProject(alreadyInitialized)

      expect(PlanningInitService.initializePlanningTasks).not.toHaveBeenCalled()
    })

    it('should be idempotent - second open does not re-initialize', async () => {
      // First open - initializes
      await ProjectService.openProject(TEST_GIT_REPO)
      expect(PlanningInitService.initializePlanningTasks).toHaveBeenCalledTimes(1)

      // Reset project state but keep filesystem
      ProjectService.reset()
      vi.clearAllMocks()

      // Second open - should not re-initialize because config now has planningTasksInitialized: true
      await ProjectService.openProject(TEST_GIT_REPO)
      expect(PlanningInitService.initializePlanningTasks).not.toHaveBeenCalled()
    })
  })
})

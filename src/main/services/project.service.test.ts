import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { ProjectService, ProjectError } from './project.service'

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
        'does not exist'
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
})

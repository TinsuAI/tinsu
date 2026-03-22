import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { execSync } from 'child_process'

// Mock child_process for git init (Story 1.11)
vi.mock('child_process', () => ({
  execSync: vi.fn()
}))

// Mock the database module to avoid Electron/sqlite dependencies (Story 3.1.5)
vi.mock('../../db', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          get: vi.fn().mockReturnValue(null), // No existing project found
          all: vi.fn().mockReturnValue([]) // No sprints found
        }),
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            all: vi.fn().mockReturnValue([])
          })
        }),
        all: vi.fn().mockReturnValue([])
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
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        run: vi.fn()
      })
    })
  }
}))

// Mock PlanningInitService before importing modules that use it (Story 3.2)
vi.mock('../../services/planning-init.service', () => ({
  PlanningInitService: {
    initializePlanningTasks: vi.fn().mockResolvedValue([])
  }
}))

import { projectRouter, setDialogHandler } from './project.router'
import { ProjectService } from '../../services/project.service'
import { router } from '../trpc'
import type { Context } from '../context'

// Create a test router with project router
const testRouter = router({
  project: projectRouter
})

// Test directories
const TEST_BASE = '/tmp/tinsu-project-router-test-' + Date.now()
const TEST_GIT_REPO = path.join(TEST_BASE, 'git-repo')
const TEST_NON_GIT_DIR = path.join(TEST_BASE, 'non-git')
const TEST_EXISTING_TINSU = path.join(TEST_BASE, 'existing-tinsu')

function createTestContext(): Context {
  return {
    projectRoot: TEST_GIT_REPO,
    db: {} as Context['db'],
    projectId: null,
    activityLogService: {} as Context['activityLogService'],
    hookListenerService: {} as Context['hookListenerService']
  }
}

describe('projectRouter', () => {
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

    // Reset mocks and state
    setDialogHandler(null)
    ProjectService.reset()
  })

  afterEach(() => {
    fs.rmSync(TEST_BASE, { recursive: true, force: true })
    ProjectService.reset()
    setDialogHandler(null)
  })

  describe('project.getCurrent', () => {
    it('should return null when no project is loaded', async () => {
      const caller = testRouter.createCaller(createTestContext())

      const result = await caller.project.getCurrent()

      expect(result).toBeNull()
    })

    it('should return project info when project is loaded', async () => {
      // Open a project first
      await ProjectService.openProject(TEST_GIT_REPO)

      const caller = testRouter.createCaller(createTestContext())
      const result = await caller.project.getCurrent()

      expect(result).not.toBeNull()
      expect(result!.path).toBe(TEST_GIT_REPO)
      expect(result!.config).toBeDefined()
    })
  })

  describe('project.close', () => {
    it('should clear the current project', async () => {
      // Open a project first
      await ProjectService.openProject(TEST_GIT_REPO)
      expect(ProjectService.getCurrentProject()).toBe(TEST_GIT_REPO)

      const caller = testRouter.createCaller(createTestContext())
      await caller.project.close()

      expect(ProjectService.getCurrentProject()).toBeNull()
    })

    it('should succeed even when no project is open', async () => {
      const caller = testRouter.createCaller(createTestContext())

      // Should not throw
      await caller.project.close()

      expect(ProjectService.getCurrentProject()).toBeNull()
    })
  })

  describe('project.open', () => {
    it('should open a valid git repository when dialog returns path', async () => {
      // Mock the dialog to return the git repo path
      setDialogHandler(async () => ({
        canceled: false,
        filePaths: [TEST_GIT_REPO]
      }))

      const caller = testRouter.createCaller(createTestContext())
      const result = await caller.project.open()

      expect(result).not.toBeNull()
      expect(result!.path).toBe(TEST_GIT_REPO)
      expect(result!.config).toBeDefined()
      expect(result!.isNewProject).toBe(true)
    })

    it('should return null when dialog is cancelled', async () => {
      setDialogHandler(async () => ({
        canceled: true,
        filePaths: []
      }))

      const caller = testRouter.createCaller(createTestContext())
      const result = await caller.project.open()

      expect(result).toBeNull()
    })

    it('should throw error for non-git directories', async () => {
      setDialogHandler(async () => ({
        canceled: false,
        filePaths: [TEST_NON_GIT_DIR]
      }))

      const caller = testRouter.createCaller(createTestContext())

      await expect(caller.project.open()).rejects.toThrow('requires a git repository')
    })

    it('should load existing project without re-initialization', async () => {
      setDialogHandler(async () => ({
        canceled: false,
        filePaths: [TEST_EXISTING_TINSU]
      }))

      const caller = testRouter.createCaller(createTestContext())
      const result = await caller.project.open()

      expect(result).not.toBeNull()
      expect(result!.path).toBe(TEST_EXISTING_TINSU)
      expect(result!.config.projectName).toBe('ExistingProject')
      expect(result!.isNewProject).toBe(false)
    })
  })

  describe('project.openPath', () => {
    it('should open a valid git repository by path', async () => {
      const caller = testRouter.createCaller(createTestContext())
      const result = await caller.project.openPath({ path: TEST_GIT_REPO })

      expect(result).not.toBeNull()
      expect(result.path).toBe(TEST_GIT_REPO)
      expect(result.config).toBeDefined()
      expect(result.isNewProject).toBe(true)
    })

    it('should throw error for non-git directories', async () => {
      const caller = testRouter.createCaller(createTestContext())

      await expect(caller.project.openPath({ path: TEST_NON_GIT_DIR })).rejects.toThrow(
        'requires a git repository'
      )
    })

    it('should throw error for non-existent directories', async () => {
      const caller = testRouter.createCaller(createTestContext())

      await expect(caller.project.openPath({ path: '/non/existent/path' })).rejects.toThrow(
        'Invalid project path'
      )
    })

    it('should load existing project', async () => {
      const caller = testRouter.createCaller(createTestContext())
      const result = await caller.project.openPath({ path: TEST_EXISTING_TINSU })

      expect(result.path).toBe(TEST_EXISTING_TINSU)
      expect(result.config.projectName).toBe('ExistingProject')
      expect(result.isNewProject).toBe(false)
    })
  })

  // Story 1.11: project.create tests
  describe('project.create', () => {
    const TEST_PARENT = path.join(TEST_BASE, 'create-parent')

    beforeEach(() => {
      fs.mkdirSync(TEST_PARENT, { recursive: true })
      // Mock execSync to succeed and create .git dir (simulating real git init)
      vi.mocked(execSync).mockImplementation((_cmd, opts) => {
        const cwd = (opts as { cwd: string }).cwd
        fs.mkdirSync(path.join(cwd, '.git'), { recursive: true })
        return Buffer.from('')
      })
    })

    it('should call createNewProject and return ProjectInfo', async () => {
      const caller = testRouter.createCaller(createTestContext())
      const result = await caller.project.create({
        parentDir: TEST_PARENT,
        projectName: 'test-project'
      })

      expect(result).not.toBeNull()
      expect(result.path).toBe(path.join(TEST_PARENT, 'test-project'))
      expect(result.config).toBeDefined()
    })

    it('should convert ALREADY_EXISTS error to BAD_REQUEST TRPCError', async () => {
      // Create folder first so it already exists
      fs.mkdirSync(path.join(TEST_PARENT, 'existing-project'), { recursive: true })

      const caller = testRouter.createCaller(createTestContext())

      await expect(
        caller.project.create({
          parentDir: TEST_PARENT,
          projectName: 'existing-project'
        })
      ).rejects.toThrow('already exists')
    })
  })

  // Story 1.11: project.selectParentDirectory tests
  describe('project.selectParentDirectory', () => {
    it('should return selected path when dialog is not cancelled', async () => {
      setDialogHandler(async () => ({
        canceled: false,
        filePaths: ['/some/parent/dir']
      }))

      const caller = testRouter.createCaller(createTestContext())
      const result = await caller.project.selectParentDirectory()

      expect(result.canceled).toBe(false)
      expect(result.path).toBe('/some/parent/dir')
    })

    it('should return null path when dialog is cancelled', async () => {
      setDialogHandler(async () => ({
        canceled: true,
        filePaths: []
      }))

      const caller = testRouter.createCaller(createTestContext())
      const result = await caller.project.selectParentDirectory()

      expect(result.canceled).toBe(true)
      expect(result.path).toBeNull()
    })
  })
})

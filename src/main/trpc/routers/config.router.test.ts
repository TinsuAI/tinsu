import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { configRouter } from './config.router'
import { router } from '../trpc'

// Create a test router with config router
const testRouter = router({
  config: configRouter
})

// Test project root
const TEST_PROJECT_ROOT = '/tmp/tinsu-config-router-test-' + Date.now()
const TEST_CONFIG_DIR = path.join(TEST_PROJECT_ROOT, '.tinsu')
const TEST_CONFIG_PATH = path.join(TEST_CONFIG_DIR, 'config.yaml')

// Create a mock context factory
function createTestContext() {
  return {
    projectRoot: TEST_PROJECT_ROOT,
    // db is not used by config router, so we can pass a minimal mock
    db: {} as any
  }
}

describe('configRouter', () => {
  beforeEach(() => {
    // Create test directory
    fs.mkdirSync(TEST_CONFIG_DIR, { recursive: true })

    // Set environment variable for project root (used by ConfigService)
    process.env.TINSU_PROJECT_ROOT = TEST_PROJECT_ROOT
  })

  afterEach(() => {
    // Clean up test directory
    fs.rmSync(TEST_PROJECT_ROOT, { recursive: true, force: true })
    delete process.env.TINSU_PROJECT_ROOT
  })

  describe('config.get', () => {
    it('should create and return default config when no config exists', async () => {
      const caller = testRouter.createCaller(createTestContext())

      const config = await caller.config.get()

      expect(config).toBeDefined()
      expect(config.methodology).toBe('bmad')
      expect(config.version).toBe('1.0.0')
      expect(config.projectName).toBeDefined()
      expect(config.createdAt).toBeDefined()
    })

    it('should return existing config when file exists', async () => {
      // Create a config file
      const existingConfig = `projectName: "ExistingProject"
methodology: taskmaster
createdAt: "2026-01-01T00:00:00Z"
version: "2.0.0"
`
      fs.writeFileSync(TEST_CONFIG_PATH, existingConfig)

      const caller = testRouter.createCaller(createTestContext())
      const config = await caller.config.get()

      expect(config.projectName).toBe('ExistingProject')
      expect(config.methodology).toBe('taskmaster')
      expect(config.version).toBe('2.0.0')
    })
  })

  describe('config.update', () => {
    it('should update specific fields while preserving others', async () => {
      // Create initial config
      const initialConfig = `projectName: "Original"
methodology: bmad
createdAt: "2026-01-01T00:00:00Z"
version: "1.0.0"
`
      fs.writeFileSync(TEST_CONFIG_PATH, initialConfig)

      const caller = testRouter.createCaller(createTestContext())

      const updated = await caller.config.update({
        projectName: 'UpdatedName'
      })

      expect(updated.projectName).toBe('UpdatedName')
      expect(updated.methodology).toBe('bmad') // Preserved
      expect(updated.version).toBe('1.0.0') // Preserved
    })

    it('should update methodology', async () => {
      // Create initial config
      const initialConfig = `projectName: "TestProject"
methodology: bmad
createdAt: "2026-01-01T00:00:00Z"
version: "1.0.0"
`
      fs.writeFileSync(TEST_CONFIG_PATH, initialConfig)

      const caller = testRouter.createCaller(createTestContext())

      const updated = await caller.config.update({
        methodology: 'taskmaster'
      })

      expect(updated.methodology).toBe('taskmaster')
      expect(updated.projectName).toBe('TestProject') // Preserved
    })

    it('should persist changes to disk', async () => {
      // Create initial config
      const initialConfig = `projectName: "Initial"
methodology: bmad
createdAt: "2026-01-01T00:00:00Z"
version: "1.0.0"
`
      fs.writeFileSync(TEST_CONFIG_PATH, initialConfig)

      const caller = testRouter.createCaller(createTestContext())

      await caller.config.update({ projectName: 'Persisted' })

      // Read file directly to verify persistence
      const fileContent = fs.readFileSync(TEST_CONFIG_PATH, 'utf-8')
      expect(fileContent).toContain('projectName: Persisted')
    })

    it('should throw TRPCError when config does not exist', async () => {
      const caller = testRouter.createCaller(createTestContext())

      await expect(caller.config.update({ projectName: 'Test' })).rejects.toThrow()
    })

    it('should reject invalid methodology value', async () => {
      // Create initial config
      const initialConfig = `projectName: "TestProject"
methodology: bmad
createdAt: "2026-01-01T00:00:00Z"
version: "1.0.0"
`
      fs.writeFileSync(TEST_CONFIG_PATH, initialConfig)

      const caller = testRouter.createCaller(createTestContext())

      await expect(caller.config.update({ methodology: 'invalid' as 'bmad' })).rejects.toThrow()
    })
  })
})

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { ConfigService, ConfigError } from './config.service'
import type { ProjectConfig } from '../../shared/types/config.types'

// Mock the project root for testing
const TEST_PROJECT_ROOT = '/tmp/tinsu-test-' + Date.now()
const TEST_CONFIG_DIR = path.join(TEST_PROJECT_ROOT, '.tinsu')
const TEST_CONFIG_PATH = path.join(TEST_CONFIG_DIR, 'config.yaml')

describe('ConfigService', () => {
  let configService: ConfigService

  beforeEach(() => {
    // Create test directory
    fs.mkdirSync(TEST_CONFIG_DIR, { recursive: true })
    configService = new ConfigService(TEST_PROJECT_ROOT)
  })

  afterEach(() => {
    // Clean up test directory
    fs.rmSync(TEST_PROJECT_ROOT, { recursive: true, force: true })
  })

  describe('getConfigPath()', () => {
    it('should return path to .tinsu/config.yaml in project root', () => {
      expect(configService.getConfigPath()).toBe(TEST_CONFIG_PATH)
    })
  })

  describe('getOrCreateConfig()', () => {
    it('should create default config when file does not exist', () => {
      const config = configService.getOrCreateConfig()

      expect(config).toBeDefined()
      expect(config.projectName).toBe(
        'tinsu-test-' + path.basename(TEST_PROJECT_ROOT).split('-').pop()
      )
      expect(config.methodology).toBe('bmad')
      expect(config.version).toBe('1.0.0')
      expect(config.createdAt).toBeDefined()

      // Verify file was created
      expect(fs.existsSync(TEST_CONFIG_PATH)).toBe(true)
    })

    it('should load existing config when file exists', () => {
      // Create a config file first
      const existingConfig = `projectName: "TestProject"
methodology: taskmaster
createdAt: "2026-01-01T00:00:00Z"
version: "2.0.0"
`
      fs.writeFileSync(TEST_CONFIG_PATH, existingConfig)

      const config = configService.getOrCreateConfig()

      expect(config.projectName).toBe('TestProject')
      expect(config.methodology).toBe('taskmaster')
      expect(config.version).toBe('2.0.0')
    })

    it('should create .tinsu directory if it does not exist', () => {
      // Remove the directory
      fs.rmSync(TEST_CONFIG_DIR, { recursive: true, force: true })

      const config = configService.getOrCreateConfig()

      expect(config).toBeDefined()
      expect(fs.existsSync(TEST_CONFIG_DIR)).toBe(true)
    })
  })

  describe('loadConfig()', () => {
    it('should load and validate existing config', () => {
      const validConfig = `projectName: "MyProject"
methodology: bmad
createdAt: "2026-01-04T12:00:00Z"
version: "1.0.0"
`
      fs.writeFileSync(TEST_CONFIG_PATH, validConfig)

      const config = configService.loadConfig()

      expect(config.projectName).toBe('MyProject')
      expect(config.methodology).toBe('bmad')
    })

    it('should throw ConfigError when file does not exist', () => {
      expect(() => configService.loadConfig()).toThrow(ConfigError)
      expect(() => configService.loadConfig()).toThrow('Config file not found')
    })

    it('should throw ConfigError with clear message for invalid YAML syntax', () => {
      const invalidYaml = `projectName: "Test
  invalid yaml here
    broken: yes`
      fs.writeFileSync(TEST_CONFIG_PATH, invalidYaml)

      expect(() => configService.loadConfig()).toThrow(ConfigError)
      try {
        configService.loadConfig()
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigError)
        expect((error as ConfigError).message).toContain('Invalid YAML syntax')
      }
    })

    it('should throw ConfigError with field errors for invalid schema', () => {
      const invalidSchema = `projectName: ""
methodology: invalid
createdAt: "not-a-date"
`
      fs.writeFileSync(TEST_CONFIG_PATH, invalidSchema)

      expect(() => configService.loadConfig()).toThrow(ConfigError)
      try {
        configService.loadConfig()
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigError)
        expect((error as ConfigError).message).toContain('Invalid config')
      }
    })
  })

  describe('saveConfig()', () => {
    it('should save config to YAML file', () => {
      const config: ProjectConfig = {
        projectName: 'SavedProject',
        methodology: 'bmad',
        createdAt: '2026-01-04T00:00:00Z',
        version: '1.0.0',
        planningTasksInitialized: false,
        devAgentModel: 'opus',
        reviewAgentModel: 'sonnet',
        preserveWorktrees: false
      }

      configService.saveConfig(config)

      const fileContent = fs.readFileSync(TEST_CONFIG_PATH, 'utf-8')
      expect(fileContent).toContain('projectName: SavedProject')
      expect(fileContent).toContain('methodology: bmad')
    })

    it('should create .tinsu directory if missing before save', () => {
      fs.rmSync(TEST_CONFIG_DIR, { recursive: true, force: true })

      const config: ProjectConfig = {
        projectName: 'NewProject',
        methodology: 'bmad',
        createdAt: '2026-01-04T00:00:00Z',
        version: '1.0.0',
        planningTasksInitialized: false,
        devAgentModel: 'opus',
        reviewAgentModel: 'sonnet',
        preserveWorktrees: false
      }

      configService.saveConfig(config)

      expect(fs.existsSync(TEST_CONFIG_PATH)).toBe(true)
    })

    it('should overwrite existing config', () => {
      // Create initial config
      const initialConfig: ProjectConfig = {
        projectName: 'Initial',
        methodology: 'bmad',
        createdAt: '2026-01-01T00:00:00Z',
        version: '1.0.0',
        planningTasksInitialized: false,
        devAgentModel: 'opus',
        reviewAgentModel: 'sonnet',
        preserveWorktrees: false
      }
      configService.saveConfig(initialConfig)

      // Update config
      const updatedConfig: ProjectConfig = {
        projectName: 'Updated',
        methodology: 'taskmaster',
        createdAt: '2026-01-04T00:00:00Z',
        version: '2.0.0',
        planningTasksInitialized: true,
        devAgentModel: 'opus',
        reviewAgentModel: 'sonnet',
        preserveWorktrees: false
      }
      configService.saveConfig(updatedConfig)

      const loaded = configService.loadConfig()
      expect(loaded.projectName).toBe('Updated')
      expect(loaded.methodology).toBe('taskmaster')
    })
  })

  describe('updateConfig()', () => {
    it('should update specific fields while preserving others', () => {
      // Create initial config
      const initialConfig: ProjectConfig = {
        projectName: 'Original',
        methodology: 'bmad',
        createdAt: '2026-01-01T00:00:00Z',
        version: '1.0.0',
        planningTasksInitialized: false,
        devAgentModel: 'opus',
        reviewAgentModel: 'sonnet',
        preserveWorktrees: false
      }
      configService.saveConfig(initialConfig)

      // Partial update
      const updated = configService.updateConfig({ projectName: 'NewName' })

      expect(updated.projectName).toBe('NewName')
      expect(updated.methodology).toBe('bmad') // Preserved
      expect(updated.version).toBe('1.0.0') // Preserved
    })

    it('should throw if config does not exist', () => {
      expect(() => configService.updateConfig({ projectName: 'Test' })).toThrow(ConfigError)
    })
  })

  describe('Agent Model Settings', () => {
    it('should return default dev agent model when config does not exist', () => {
      const model = configService.getDevAgentModel()
      expect(model).toBe('opus')
    })

    it('should return default review agent model when config does not exist', () => {
      const model = configService.getReviewAgentModel()
      expect(model).toBe('sonnet')
    })

    it('should return configured dev agent model', () => {
      const configContent = `projectName: "TestProject"
methodology: bmad
createdAt: "2026-01-04T12:00:00Z"
version: "1.0.0"
devAgentModel: haiku
reviewAgentModel: opus
`
      fs.writeFileSync(TEST_CONFIG_PATH, configContent)

      const model = configService.getDevAgentModel()
      expect(model).toBe('haiku')
    })

    it('should return configured review agent model', () => {
      const configContent = `projectName: "TestProject"
methodology: bmad
createdAt: "2026-01-04T12:00:00Z"
version: "1.0.0"
devAgentModel: haiku
reviewAgentModel: opus
`
      fs.writeFileSync(TEST_CONFIG_PATH, configContent)

      const model = configService.getReviewAgentModel()
      expect(model).toBe('opus')
    })

    it('should migrate old config without model fields', () => {
      // Old config without agent model fields
      const oldConfig = `projectName: "OldProject"
methodology: bmad
createdAt: "2026-01-01T00:00:00Z"
version: "1.0.0"
`
      fs.writeFileSync(TEST_CONFIG_PATH, oldConfig)

      // Loading should work with defaults applied
      const config = configService.loadConfig()
      expect(config.devAgentModel).toBe('opus')
      expect(config.reviewAgentModel).toBe('sonnet')
    })

    it('should include agent model settings in default config', () => {
      const config = configService.getOrCreateConfig()
      expect(config.devAgentModel).toBe('opus')
      expect(config.reviewAgentModel).toBe('sonnet')
    })

    it('should persist agent model changes', () => {
      const initialConfig: ProjectConfig = {
        projectName: 'TestProject',
        methodology: 'bmad',
        createdAt: '2026-01-04T00:00:00Z',
        version: '1.0.0',
        planningTasksInitialized: false,
        devAgentModel: 'opus',
        reviewAgentModel: 'sonnet',
        preserveWorktrees: false
      }
      configService.saveConfig(initialConfig)

      const updated = configService.updateConfig({
        devAgentModel: 'haiku',
        reviewAgentModel: 'opus'
      })

      expect(updated.devAgentModel).toBe('haiku')
      expect(updated.reviewAgentModel).toBe('opus')

      // Verify persisted
      const loaded = configService.loadConfig()
      expect(loaded.devAgentModel).toBe('haiku')
      expect(loaded.reviewAgentModel).toBe('opus')
    })
  })

  describe('error handling', () => {
    it('should provide clear error message for permission errors on read', () => {
      // Create a valid config file
      const validConfig = `projectName: "TestProject"
methodology: bmad
createdAt: "2026-01-04T12:00:00Z"
version: "1.0.0"
`
      fs.writeFileSync(TEST_CONFIG_PATH, validConfig)

      // Remove read permissions
      fs.chmodSync(TEST_CONFIG_PATH, 0o000)

      try {
        expect(() => configService.loadConfig()).toThrow(ConfigError)
        expect(() => configService.loadConfig()).toThrow(/Failed to read config file/)
      } finally {
        // Restore permissions for cleanup
        fs.chmodSync(TEST_CONFIG_PATH, 0o644)
      }
    })

    it('should provide clear error message for permission errors on write', () => {
      // Create config dir with no write permission
      fs.chmodSync(TEST_CONFIG_DIR, 0o444)

      const config: ProjectConfig = {
        projectName: 'TestProject',
        methodology: 'bmad',
        createdAt: '2026-01-04T00:00:00Z',
        version: '1.0.0',
        planningTasksInitialized: false,
        devAgentModel: 'opus',
        reviewAgentModel: 'sonnet',
        preserveWorktrees: false
      }

      try {
        expect(() => configService.saveConfig(config)).toThrow(ConfigError)
        expect(() => configService.saveConfig(config)).toThrow(/Failed to write config file/)
      } finally {
        // Restore permissions for cleanup
        fs.chmodSync(TEST_CONFIG_DIR, 0o755)
      }
    })
  })
})

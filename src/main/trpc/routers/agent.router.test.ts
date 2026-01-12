import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { agentRouter } from './agent.router'
import { BmadAgentLauncherService } from '../../services/bmad-agent-launcher.service'
import { ClaudeCliDetectorService } from '../../services/claude-cli-detector.service'
import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as schema from '../../db/schema'

// Mock the services
vi.mock('../../services/claude-cli-detector.service', () => ({
  ClaudeCliDetectorService: {
    isClaudeCodeInstalled: vi.fn(),
    getClaudeCodePath: vi.fn(),
    clearCache: vi.fn()
  }
}))

vi.mock('../../services/bmad-agent-launcher.service', () => ({
  BmadAgentLauncherService: {
    launchPlanningAgent: vi.fn()
  }
}))

// Mock ConfigService for Story 5.1: Agent Model Configuration
vi.mock('../../services/config.service', () => ({
  ConfigService: class MockConfigService {
    getDevAgentModel() {
      return 'opus'
    }
    getReviewAgentModel() {
      return 'sonnet'
    }
  }
}))

type TestDb = BetterSQLite3Database<typeof schema>

const TEST_PROJECT_ID = 'test-project-id'
const TEST_PROJECT_ROOT = '/home/user/test-project'

// Create an in-memory SQLite database for testing
function createTestDb(): TestDb {
  const sqlite = new Database(':memory:')

  // Create the projects table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY NOT NULL,
      path TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      last_opened_at INTEGER
    );
  `)

  // Create the tasks table matching Drizzle schema (Story 3.7: added story_number, story_file_path, full_content)
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'backlog',
      sort_order INTEGER NOT NULL DEFAULT 0,
      epic_id TEXT,
      sprint_id TEXT,
      task_type TEXT NOT NULL DEFAULT 'story',
      phase_number INTEGER,
      phase_name TEXT,
      bmad_agent TEXT,
      bmad_workflow TEXT,
      is_start_here INTEGER,
      artifact_path TEXT,
      story_number INTEGER,
      story_file_path TEXT,
      full_content TEXT,
      project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `)

  const db = drizzle({ client: sqlite, schema })

  // Create test project
  db.insert(schema.projects)
    .values({
      id: TEST_PROJECT_ID,
      path: TEST_PROJECT_ROOT,
      name: 'Test Project'
    })
    .run()

  return db
}

// Helper to create a test caller
function createTestCaller(db: TestDb) {
  return agentRouter.createCaller({
    db: db as unknown as typeof import('../../db').db,
    projectRoot: TEST_PROJECT_ROOT,
    projectId: TEST_PROJECT_ID
  })
}

describe('agentRouter', () => {
  let db: TestDb
  let caller: ReturnType<typeof createTestCaller>

  // Helper to create a planning task in the database
  const createPlanningTask = (overrides: Partial<typeof schema.tasks.$inferInsert> = {}) => {
    const id = `planning-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const now = new Date()
    return db
      .insert(schema.tasks)
      .values({
        id,
        title: 'Test Planning Task',
        status: 'in_progress',
        sort_order: 0,
        task_type: 'planning',
        phase_number: 1,
        phase_name: 'Product Brief',
        bmad_agent: 'bmad:bmm:agents:pm',
        bmad_workflow: '_bmad/bmm/workflows/1-ideation/create-product-brief/workflow.yaml',
        is_start_here: true,
        project_id: TEST_PROJECT_ID,
        created_at: now,
        updated_at: now,
        ...overrides
      })
      .returning()
      .get()
  }

  // Helper to create a story task (non-planning)
  const createStoryTask = (overrides: Partial<typeof schema.tasks.$inferInsert> = {}) => {
    const id = `story-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const now = new Date()
    return db
      .insert(schema.tasks)
      .values({
        id,
        title: 'Test Story Task',
        status: 'backlog',
        sort_order: 0,
        task_type: 'story',
        phase_number: null,
        phase_name: null,
        bmad_agent: null,
        bmad_workflow: null,
        is_start_here: null,
        project_id: TEST_PROJECT_ID,
        created_at: now,
        updated_at: now,
        ...overrides
      })
      .returning()
      .get()
  }

  beforeEach(() => {
    vi.clearAllMocks()
    db = createTestDb()
    caller = createTestCaller(db)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('checkClaudeCliInstalled', () => {
    it('returns true when Claude CLI is installed', async () => {
      vi.mocked(ClaudeCliDetectorService.isClaudeCodeInstalled).mockResolvedValue(true)

      const result = await caller.checkClaudeCliInstalled()

      expect(result).toBe(true)
      expect(ClaudeCliDetectorService.isClaudeCodeInstalled).toHaveBeenCalled()
    })

    it('returns false when Claude CLI is not installed', async () => {
      vi.mocked(ClaudeCliDetectorService.isClaudeCodeInstalled).mockResolvedValue(false)

      const result = await caller.checkClaudeCliInstalled()

      expect(result).toBe(false)
    })
  })

  describe('launchPlanningAgent', () => {
    it('throws PRECONDITION_FAILED when CLI not installed', async () => {
      vi.mocked(ClaudeCliDetectorService.isClaudeCodeInstalled).mockResolvedValue(false)
      const task = createPlanningTask()

      await expect(caller.launchPlanningAgent({ taskId: task.id })).rejects.toMatchObject({
        code: 'PRECONDITION_FAILED',
        message: expect.stringContaining('Claude Code CLI is not installed')
      })
    })

    it('throws NOT_FOUND for invalid taskId', async () => {
      vi.mocked(ClaudeCliDetectorService.isClaudeCodeInstalled).mockResolvedValue(true)

      await expect(caller.launchPlanningAgent({ taskId: 'non-existent-id' })).rejects.toMatchObject(
        {
          code: 'NOT_FOUND',
          message: 'Task not found'
        }
      )
    })

    it('throws BAD_REQUEST for non-planning task', async () => {
      vi.mocked(ClaudeCliDetectorService.isClaudeCodeInstalled).mockResolvedValue(true)
      const storyTask = createStoryTask()

      await expect(caller.launchPlanningAgent({ taskId: storyTask.id })).rejects.toMatchObject({
        code: 'BAD_REQUEST',
        message: 'Task is not a planning task'
      })
    })

    it('returns processId on successful launch', async () => {
      vi.mocked(ClaudeCliDetectorService.isClaudeCodeInstalled).mockResolvedValue(true)
      const mockProcessId = 'process-uuid-123'
      vi.mocked(BmadAgentLauncherService.launchPlanningAgent).mockReturnValue({
        processId: mockProcessId,
        command: 'claude',
        args: ['--skill', 'bmad:bmm:agents:pm']
      })

      const task = createPlanningTask()

      const result = await caller.launchPlanningAgent({ taskId: task.id })

      expect(result.processId).toBe(mockProcessId)
      expect(result.command).toBe('claude')
      expect(result.args).toEqual(['--skill', 'bmad:bmm:agents:pm'])
      expect(BmadAgentLauncherService.launchPlanningAgent).toHaveBeenCalled()
    })

    it('calls BmadAgentLauncherService with correct arguments including model (Story 5.1)', async () => {
      vi.mocked(ClaudeCliDetectorService.isClaudeCodeInstalled).mockResolvedValue(true)
      vi.mocked(BmadAgentLauncherService.launchPlanningAgent).mockReturnValue({
        processId: 'process-123',
        command: 'claude',
        args: ['--skill', 'bmad:bmm:agents:architect', '--model', 'opus']
      })

      const task = createPlanningTask({
        phase_number: 3,
        phase_name: 'Architecture',
        bmad_agent: 'bmad:bmm:agents:architect'
      })

      await caller.launchPlanningAgent({ taskId: task.id })

      // Should now include model as third argument
      expect(BmadAgentLauncherService.launchPlanningAgent).toHaveBeenCalledWith(
        expect.objectContaining({
          id: task.id,
          bmad_agent: 'bmad:bmm:agents:architect',
          phase_number: 3
        }),
        TEST_PROJECT_ROOT,
        'opus' // Story 5.1: Dev agent model from config
      )
    })
  })
})

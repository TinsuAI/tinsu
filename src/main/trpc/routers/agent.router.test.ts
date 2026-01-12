import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { agentRouter } from './agent.router'
import { BmadAgentLauncherService } from '../../services/bmad-agent-launcher.service'
import { ClaudeCliDetectorService } from '../../services/claude-cli-detector.service'
import { StoryCompletionService } from '../../services/story-completion.service'
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
    launchPlanningAgent: vi.fn(),
    launchCreateStory: vi.fn(),
    launchDevStory: vi.fn(),
    launchBasicTask: vi.fn()
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

// Mock StoryCompletionService for Story 5.3 - AC: 2
vi.mock('../../services/story-completion.service', () => ({
  StoryCompletionService: {
    handleCreateStoryComplete: vi.fn()
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

  // Create the epics table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS epics (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      color TEXT NOT NULL DEFAULT 'blue',
      epic_number INTEGER,
      goal TEXT,
      project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
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
      epic_id TEXT REFERENCES epics(id),
      sprint_id TEXT,
      task_type TEXT NOT NULL DEFAULT 'story',
      phase_number INTEGER,
      phase_name TEXT,
      bmad_agent TEXT,
      bmad_workflow TEXT,
      is_start_here INTEGER,
      artifact_path TEXT,
      story_number TEXT,
      story_file_path TEXT,
      full_content TEXT,
      story_file_status TEXT,
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

  // Helper to create an epic
  const createEpic = (overrides: Partial<typeof schema.epics.$inferInsert> = {}) => {
    const id = `epic-${Date.now()}-${Math.random().toString(36).slice(2)}`
    return db
      .insert(schema.epics)
      .values({
        id,
        title: 'Test Epic',
        color: 'blue',
        epic_number: 5,
        project_id: TEST_PROJECT_ID,
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

  describe('startCreateStory (Story 5.3 - AC: 1)', () => {
    it('throws PRECONDITION_FAILED when CLI not installed', async () => {
      vi.mocked(ClaudeCliDetectorService.isClaudeCodeInstalled).mockResolvedValue(false)
      const epic = createEpic({ epic_number: 5 })
      const task = createStoryTask({ story_number: 3, epic_id: epic.id })

      await expect(caller.startCreateStory({ taskId: task.id })).rejects.toMatchObject({
        code: 'PRECONDITION_FAILED',
        message: expect.stringContaining('Claude Code CLI is not installed')
      })
    })

    it('throws NOT_FOUND for invalid taskId', async () => {
      vi.mocked(ClaudeCliDetectorService.isClaudeCodeInstalled).mockResolvedValue(true)

      await expect(caller.startCreateStory({ taskId: 'non-existent-id' })).rejects.toMatchObject({
        code: 'NOT_FOUND',
        message: 'Task not found'
      })
    })

    it('throws BAD_REQUEST for non-story task (planning task)', async () => {
      vi.mocked(ClaudeCliDetectorService.isClaudeCodeInstalled).mockResolvedValue(true)
      const planningTask = createPlanningTask()

      await expect(caller.startCreateStory({ taskId: planningTask.id })).rejects.toMatchObject({
        code: 'BAD_REQUEST',
        message: 'Task is not a story task'
      })
    })

    it('throws BAD_REQUEST when story_number is missing', async () => {
      vi.mocked(ClaudeCliDetectorService.isClaudeCodeInstalled).mockResolvedValue(true)
      const task = createStoryTask({ story_number: null })

      await expect(caller.startCreateStory({ taskId: task.id })).rejects.toMatchObject({
        code: 'BAD_REQUEST',
        message: expect.stringContaining('Cannot determine story identifier')
      })
    })

    it('passes story identifier from epic_number.story_number', async () => {
      vi.mocked(ClaudeCliDetectorService.isClaudeCodeInstalled).mockResolvedValue(true)
      const mockProcessId = 'process-create-story-123'
      vi.mocked(BmadAgentLauncherService.launchCreateStory).mockReturnValue({
        processId: mockProcessId,
        command: 'claude',
        args: ['--dangerously-skip-permissions', '/bmad:bmm:workflows:create-story', '5.3']
      })

      const epic = createEpic({ epic_number: 5 })
      const task = createStoryTask({ story_number: 3, epic_id: epic.id })

      const result = await caller.startCreateStory({ taskId: task.id })

      expect(result.processId).toBe(mockProcessId)
      expect(result.command).toBe('claude')
      expect(BmadAgentLauncherService.launchCreateStory).toHaveBeenCalledWith(
        TEST_PROJECT_ROOT,
        '5.3', // Story identifier in format epic_number.story_number
        'opus' // Story 5.1: Dev agent model from config
      )
    })

    it('falls back to story_number only when no epic', async () => {
      vi.mocked(ClaudeCliDetectorService.isClaudeCodeInstalled).mockResolvedValue(true)
      const mockProcessId = 'process-create-story-124'
      vi.mocked(BmadAgentLauncherService.launchCreateStory).mockReturnValue({
        processId: mockProcessId,
        command: 'claude',
        args: ['--dangerously-skip-permissions', '/bmad:bmm:workflows:create-story', '7']
      })

      const task = createStoryTask({ story_number: 7, epic_id: null })

      const result = await caller.startCreateStory({ taskId: task.id })

      expect(result.processId).toBe(mockProcessId)
      expect(BmadAgentLauncherService.launchCreateStory).toHaveBeenCalledWith(
        TEST_PROJECT_ROOT,
        '7', // Story number only when no epic
        'opus'
      )
    })
  })

  describe('startDevStory (Story 5.3 - AC: 3)', () => {
    const mockStoryFilePath = '/path/to/story/5-3-story.md'

    it('throws PRECONDITION_FAILED when CLI not installed', async () => {
      vi.mocked(ClaudeCliDetectorService.isClaudeCodeInstalled).mockResolvedValue(false)
      const task = createStoryTask({
        story_number: 3,
        story_file_status: 'story_ready',
        story_file_path: mockStoryFilePath
      })

      await expect(caller.startDevStory({ taskId: task.id })).rejects.toMatchObject({
        code: 'PRECONDITION_FAILED',
        message: expect.stringContaining('Claude Code CLI is not installed')
      })
    })

    it('throws NOT_FOUND for invalid taskId', async () => {
      vi.mocked(ClaudeCliDetectorService.isClaudeCodeInstalled).mockResolvedValue(true)

      await expect(caller.startDevStory({ taskId: 'non-existent-id' })).rejects.toMatchObject({
        code: 'NOT_FOUND',
        message: 'Task not found'
      })
    })

    it('throws BAD_REQUEST for non-story task', async () => {
      vi.mocked(ClaudeCliDetectorService.isClaudeCodeInstalled).mockResolvedValue(true)
      const planningTask = createPlanningTask()

      await expect(caller.startDevStory({ taskId: planningTask.id })).rejects.toMatchObject({
        code: 'BAD_REQUEST',
        message: 'Task is not a story task'
      })
    })

    it('throws BAD_REQUEST when story file is not ready', async () => {
      vi.mocked(ClaudeCliDetectorService.isClaudeCodeInstalled).mockResolvedValue(true)
      const task = createStoryTask({
        story_number: 3,
        story_file_status: 'summary_only'
      })

      await expect(caller.startDevStory({ taskId: task.id })).rejects.toMatchObject({
        code: 'BAD_REQUEST',
        message: expect.stringContaining('Story file not ready')
      })
    })

    it('throws BAD_REQUEST when story file path is missing', async () => {
      vi.mocked(ClaudeCliDetectorService.isClaudeCodeInstalled).mockResolvedValue(true)
      const task = createStoryTask({
        story_number: 3,
        story_file_status: 'story_ready',
        story_file_path: null
      })

      await expect(caller.startDevStory({ taskId: task.id })).rejects.toMatchObject({
        code: 'BAD_REQUEST',
        message: expect.stringContaining('Story file path is missing')
      })
    })

    it('returns processId on successful launch', async () => {
      vi.mocked(ClaudeCliDetectorService.isClaudeCodeInstalled).mockResolvedValue(true)
      const mockProcessId = 'process-dev-story-123'
      vi.mocked(BmadAgentLauncherService.launchDevStory).mockReturnValue({
        processId: mockProcessId,
        command: 'claude',
        args: ['--dangerously-skip-permissions', '/bmad:bmm:workflows:dev-story', mockStoryFilePath]
      })

      const task = createStoryTask({
        story_number: 3,
        story_file_status: 'story_ready',
        story_file_path: mockStoryFilePath
      })

      const result = await caller.startDevStory({ taskId: task.id })

      expect(result.processId).toBe(mockProcessId)
      expect(result.command).toBe('claude')
      expect(BmadAgentLauncherService.launchDevStory).toHaveBeenCalledWith(
        TEST_PROJECT_ROOT,
        mockStoryFilePath,
        'opus' // Story 5.1: Dev agent model from config
      )
    })
  })

  describe('handleCreateStoryComplete (Story 5.3 - AC: 2)', () => {
    it('calls StoryCompletionService with correct arguments', async () => {
      vi.mocked(StoryCompletionService.handleCreateStoryComplete).mockResolvedValue({
        success: true,
        storyFilePath: '/path/to/story/5-3-story.md'
      })

      const task = createStoryTask({ story_number: 3 })

      const result = await caller.handleCreateStoryComplete({ taskId: task.id })

      expect(StoryCompletionService.handleCreateStoryComplete).toHaveBeenCalledWith(
        expect.anything(), // db
        task.id,
        TEST_PROJECT_ROOT
      )
      expect(result.success).toBe(true)
      expect(result.storyFilePath).toBe('/path/to/story/5-3-story.md')
    })

    it('returns error result when service returns error', async () => {
      vi.mocked(StoryCompletionService.handleCreateStoryComplete).mockResolvedValue({
        success: false,
        storyFilePath: null,
        error: 'Task not found'
      })

      const result = await caller.handleCreateStoryComplete({ taskId: 'nonexistent-task' })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Task not found')
      expect(result.storyFilePath).toBeNull()
    })

    it('handles story file not found gracefully', async () => {
      vi.mocked(StoryCompletionService.handleCreateStoryComplete).mockResolvedValue({
        success: false,
        storyFilePath: null,
        error: 'Story file not found in implementation-artifacts'
      })

      const task = createStoryTask({ story_number: 3 })

      const result = await caller.handleCreateStoryComplete({ taskId: task.id })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Story file not found in implementation-artifacts')
    })
  })

  describe('startBasicTask (Story 5.3b - AC: 1)', () => {
    // Helper to create a basic task (story type without story_number)
    const createBasicTask = (overrides: Partial<typeof schema.tasks.$inferInsert> = {}) => {
      const id = `basic-${Date.now()}-${Math.random().toString(36).slice(2)}`
      const now = new Date()
      return db
        .insert(schema.tasks)
        .values({
          id,
          title: 'Fix login bug',
          description: 'The login button does not work on mobile Safari',
          status: 'in_progress',
          sort_order: 0,
          task_type: 'story',
          phase_number: null,
          phase_name: null,
          bmad_agent: null,
          bmad_workflow: null,
          is_start_here: null,
          story_number: null, // Basic tasks have no story_number
          project_id: TEST_PROJECT_ID,
          created_at: now,
          updated_at: now,
          ...overrides
        })
        .returning()
        .get()
    }

    it('throws PRECONDITION_FAILED when CLI not installed', async () => {
      vi.mocked(ClaudeCliDetectorService.isClaudeCodeInstalled).mockResolvedValue(false)
      const task = createBasicTask()

      await expect(caller.startBasicTask({ taskId: task.id })).rejects.toMatchObject({
        code: 'PRECONDITION_FAILED',
        message: expect.stringContaining('Claude Code CLI is not installed')
      })
    })

    it('throws NOT_FOUND for invalid taskId', async () => {
      vi.mocked(ClaudeCliDetectorService.isClaudeCodeInstalled).mockResolvedValue(true)

      await expect(caller.startBasicTask({ taskId: 'non-existent-id' })).rejects.toMatchObject({
        code: 'NOT_FOUND',
        message: 'Task not found'
      })
    })

    it('throws BAD_REQUEST for imported story task (has story_number)', async () => {
      vi.mocked(ClaudeCliDetectorService.isClaudeCodeInstalled).mockResolvedValue(true)
      const importedStory = createStoryTask({ story_number: 3 })

      await expect(caller.startBasicTask({ taskId: importedStory.id })).rejects.toMatchObject({
        code: 'BAD_REQUEST',
        message: expect.stringContaining('Task is not a basic task')
      })
    })

    it('throws BAD_REQUEST for planning task', async () => {
      vi.mocked(ClaudeCliDetectorService.isClaudeCodeInstalled).mockResolvedValue(true)
      const planningTask = createPlanningTask()

      await expect(caller.startBasicTask({ taskId: planningTask.id })).rejects.toMatchObject({
        code: 'BAD_REQUEST',
        message: expect.stringContaining('Task is not a basic task')
      })
    })

    it('returns processId on successful launch', async () => {
      vi.mocked(ClaudeCliDetectorService.isClaudeCodeInstalled).mockResolvedValue(true)
      const mockProcessId = 'process-basic-123'
      vi.mocked(BmadAgentLauncherService.launchBasicTask).mockReturnValue({
        processId: mockProcessId,
        command: 'claude',
        args: ['--dangerously-skip-permissions', 'Fix login bug']
      })

      const task = createBasicTask()

      const result = await caller.startBasicTask({ taskId: task.id })

      expect(result.processId).toBe(mockProcessId)
      expect(result.command).toBe('claude')
    })

    it('passes task title and description to launcher', async () => {
      vi.mocked(ClaudeCliDetectorService.isClaudeCodeInstalled).mockResolvedValue(true)
      const mockProcessId = 'process-basic-124'
      vi.mocked(BmadAgentLauncherService.launchBasicTask).mockReturnValue({
        processId: mockProcessId,
        command: 'claude',
        args: ['--dangerously-skip-permissions', 'Fix login bug\n\nThe login button does not work on mobile Safari']
      })

      const task = createBasicTask({
        title: 'Fix login bug',
        description: 'The login button does not work on mobile Safari'
      })

      await caller.startBasicTask({ taskId: task.id })

      expect(BmadAgentLauncherService.launchBasicTask).toHaveBeenCalledWith(
        TEST_PROJECT_ROOT,
        'Fix login bug',
        'The login button does not work on mobile Safari',
        'opus' // Story 5.1: Dev agent model from config
      )
    })

    it('handles task with no description', async () => {
      vi.mocked(ClaudeCliDetectorService.isClaudeCodeInstalled).mockResolvedValue(true)
      const mockProcessId = 'process-basic-125'
      vi.mocked(BmadAgentLauncherService.launchBasicTask).mockReturnValue({
        processId: mockProcessId,
        command: 'claude',
        args: ['--dangerously-skip-permissions', 'Quick fix']
      })

      const task = createBasicTask({
        title: 'Quick fix',
        description: null
      })

      await caller.startBasicTask({ taskId: task.id })

      expect(BmadAgentLauncherService.launchBasicTask).toHaveBeenCalledWith(
        TEST_PROJECT_ROOT,
        'Quick fix',
        undefined, // description is undefined when null
        'opus'
      )
    })
  })

  describe('handleBasicTaskComplete (Story 5.3b - AC: 3)', () => {
    const createBasicTask = (overrides: Partial<typeof schema.tasks.$inferInsert> = {}) => {
      const id = `basic-${Date.now()}-${Math.random().toString(36).slice(2)}`
      const now = new Date()
      return db
        .insert(schema.tasks)
        .values({
          id,
          title: 'Fix login bug',
          status: 'in_progress',
          sort_order: 0,
          task_type: 'story',
          story_number: null,
          project_id: TEST_PROJECT_ID,
          created_at: now,
          updated_at: now,
          ...overrides
        })
        .returning()
        .get()
    }

    it('returns error for non-existent task', async () => {
      const result = await caller.handleBasicTaskComplete({ taskId: 'non-existent-id' })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Task not found')
    })

    it('updates task status to review on success', async () => {
      const task = createBasicTask({ status: 'in_progress' })

      const result = await caller.handleBasicTaskComplete({ taskId: task.id })

      expect(result.success).toBe(true)
      expect(result.newStatus).toBe('review')

      // Verify database was updated using drizzle eq function
      const { eq } = await import('drizzle-orm')
      const updatedTask = db.select().from(schema.tasks).where(eq(schema.tasks.id, task.id)).get()
      expect(updatedTask?.status).toBe('review')
    })
  })
})

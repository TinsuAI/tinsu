import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { existsSync } from 'fs'
import { agentRouter } from './agent.router'
import { BmadAgentLauncherService } from '../../services/bmad-agent-launcher.service'
import { ClaudeCliDetectorService } from '../../services/claude-cli-detector.service'
import { StoryCompletionService } from '../../services/story-completion.service'
import { TaskTerminalService } from '../../services/task-terminal.service'
import { TaskSessionService } from '../../services/task-session.service'
import { ScrollbackBackupService } from '../../services/scrollback-backup.service'
import { ptyService } from '../../services/pty.service'
import { devAgentProgressService, DevAgentProgressInfo } from '../../services/dev-agent-progress.service'
import { ActivityLogService } from '../../services/activity-log.service'
import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as schema from '../../db/schema'

// Story 8.4: Mock fs for worktree path validation
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>()
  return {
    ...actual,
    existsSync: vi.fn((path: string) => {
      // By default, return false for worktree paths (to test validation)
      // Tests can override this with mockReturnValueOnce
      if (typeof path === 'string' && path.includes('.tinsu/worktrees')) {
        return false
      }
      return actual.existsSync(path)
    })
  }
})

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

// Mock TaskTerminalService for TES-1.4
vi.mock('../../services/task-terminal.service', () => ({
  TaskTerminalService: {
    getAttachCommand: vi.fn(),
    sendCommand: vi.fn(),
    createSession: vi.fn(),
    hasSession: vi.fn(),
    killSession: vi.fn(),
    getSessionName: vi.fn(),
    clearCache: vi.fn()
  }
}))

// Mock TaskSessionService for TES-1.7
vi.mock('../../services/task-session.service', () => ({
  TaskSessionService: {
    updateSessionId: vi.fn(),
    getTaskBySessionId: vi.fn(),
    routeHookEvent: vi.fn(),
    clearSession: vi.fn(),
    clearCache: vi.fn(),
    getCacheSize: vi.fn()
  }
}))

// Mock ScrollbackBackupService for TES-1.9
vi.mock('../../services/scrollback-backup.service', () => ({
  ScrollbackBackupService: {
    restoreScrollback: vi.fn(),
    getBackupMetadata: vi.fn(),
    getScrollbackGap: vi.fn(),
    backupScrollback: vi.fn(),
    captureScrollback: vi.fn(),
    startPeriodicBackup: vi.fn(),
    stopPeriodicBackup: vi.fn(),
    backupOnShutdown: vi.fn(),
    deleteBackup: vi.fn(),
    listBackups: vi.fn(),
    clearTimers: vi.fn()
  }
}))

// Mock ptyService for TES-1.4
vi.mock('../../services/pty.service', () => ({
  ptyService: {
    spawn: vi.fn(),
    kill: vi.fn(),
    write: vi.fn(),
    resize: vi.fn(),
    on: vi.fn(),
    off: vi.fn()
  }
}))

// Mock ActivityLogService for TES-2.8
vi.mock('../../services/activity-log.service', () => ({
  ActivityLogService: {
    logActivity: vi.fn()
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

  // Create the epics table (must match schema.ts including sprint_id)
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS epics (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      color TEXT NOT NULL DEFAULT 'blue',
      epic_number INTEGER,
      goal TEXT,
      sprint_id TEXT,
      project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `)

  // Create the tasks table matching Drizzle schema (Story 3.7: added story_number, story_file_path, full_content)
  // Story 8.2-8.3: Added worktree_path and branch_name columns
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
      context_notes TEXT,
      worktree_path TEXT,
      branch_name TEXT,
      project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `)

  // TES-1.4: Create the task_sessions table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS task_sessions (
      id TEXT PRIMARY KEY NOT NULL,
      task_id TEXT NOT NULL UNIQUE,
      tmux_session TEXT NOT NULL,
      session_id TEXT,
      current_phase TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
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

    it('returns success on successful launch', async () => {
      vi.mocked(ClaudeCliDetectorService.isClaudeCodeInstalled).mockResolvedValue(true)
      vi.mocked(BmadAgentLauncherService.launchPlanningAgent).mockResolvedValue({
        command: 'cd "/home/user/test-project" && claude --skill bmad:bmm:agents:pm',
        success: true
      })

      const task = createPlanningTask()

      const result = await caller.launchPlanningAgent({ taskId: task.id })

      expect(result.success).toBe(true)
      expect(result.command).toContain('claude')
      expect(BmadAgentLauncherService.launchPlanningAgent).toHaveBeenCalled()
    })

    it('calls BmadAgentLauncherService with correct arguments including model (Story 5.1)', async () => {
      vi.mocked(ClaudeCliDetectorService.isClaudeCodeInstalled).mockResolvedValue(true)
      vi.mocked(BmadAgentLauncherService.launchPlanningAgent).mockResolvedValue({
        command: 'cd "/home/user/test-project" && claude --skill bmad:bmm:agents:architect --model opus',
        success: true
      })

      const task = createPlanningTask({
        phase_number: 3,
        phase_name: 'Architecture',
        bmad_agent: 'bmad:bmm:agents:architect'
      })

      await caller.launchPlanningAgent({ taskId: task.id })

      // Should now include taskId as first argument and model as fourth argument
      expect(BmadAgentLauncherService.launchPlanningAgent).toHaveBeenCalledWith(
        task.id,
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
      const task = createStoryTask({ story_number: '3', epic_id: epic.id })

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
      vi.mocked(BmadAgentLauncherService.launchCreateStory).mockResolvedValue({
        command: 'cd "/home/user/test-project" && claude --dangerously-skip-permissions "/bmad:bmm:workflows:create-story 5.3"',
        success: true
      })

      const epic = createEpic({ epic_number: 5 })
      const task = createStoryTask({ story_number: '3', epic_id: epic.id })

      const result = await caller.startCreateStory({ taskId: task.id })

      expect(result.success).toBe(true)
      expect(result.command).toContain('claude')
      expect(BmadAgentLauncherService.launchCreateStory).toHaveBeenCalledWith(
        task.id,
        TEST_PROJECT_ROOT,
        '5.3', // Story identifier in format epic_number.story_number
        'opus', // Story 5.1: Dev agent model from config
        undefined // Story 8.4: worktree path (undefined when not set)
      )
    })

    it('falls back to story_number only when no epic', async () => {
      vi.mocked(ClaudeCliDetectorService.isClaudeCodeInstalled).mockResolvedValue(true)
      vi.mocked(BmadAgentLauncherService.launchCreateStory).mockResolvedValue({
        command: 'cd "/home/user/test-project" && claude --dangerously-skip-permissions "/bmad:bmm:workflows:create-story 7"',
        success: true
      })

      const task = createStoryTask({ story_number: '7', epic_id: null })

      const result = await caller.startCreateStory({ taskId: task.id })

      expect(result.success).toBe(true)
      expect(BmadAgentLauncherService.launchCreateStory).toHaveBeenCalledWith(
        task.id,
        TEST_PROJECT_ROOT,
        '7', // Story number only when no epic
        'opus',
        undefined // Story 8.4: worktree path (undefined when not set)
      )
    })
  })

  describe('startDevStory (Story 5.3 - AC: 3)', () => {
    const mockStoryFilePath = '/path/to/story/5-3-story.md'

    it('throws PRECONDITION_FAILED when CLI not installed', async () => {
      vi.mocked(ClaudeCliDetectorService.isClaudeCodeInstalled).mockResolvedValue(false)
      const task = createStoryTask({
        story_number: '3',
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
        story_number: '3',
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
        story_number: '3',
        story_file_status: 'story_ready',
        story_file_path: null
      })

      await expect(caller.startDevStory({ taskId: task.id })).rejects.toMatchObject({
        code: 'BAD_REQUEST',
        message: expect.stringContaining('Story file path is missing')
      })
    })

    it('returns success on successful launch', async () => {
      vi.mocked(ClaudeCliDetectorService.isClaudeCodeInstalled).mockResolvedValue(true)
      vi.mocked(BmadAgentLauncherService.launchDevStory).mockResolvedValue({
        command: `cd "/home/user/test-project" && claude --dangerously-skip-permissions "/bmad:bmm:workflows:dev-story ${mockStoryFilePath}"`,
        success: true
      })

      const task = createStoryTask({
        story_number: '3',
        story_file_status: 'story_ready',
        story_file_path: mockStoryFilePath
      })

      const result = await caller.startDevStory({ taskId: task.id })

      expect(result.success).toBe(true)
      expect(result.command).toContain('claude')
      expect(BmadAgentLauncherService.launchDevStory).toHaveBeenCalledWith(
        task.id,
        TEST_PROJECT_ROOT,
        mockStoryFilePath,
        'opus', // Story 5.1: Dev agent model from config
        undefined // Story 8.4: worktree path (undefined when not set)
      )
    })

    // Story 8.4: Worktree path tests
    it('passes worktree_path to launcher when task has one (Story 8.4)', async () => {
      vi.mocked(ClaudeCliDetectorService.isClaudeCodeInstalled).mockResolvedValue(true)
      vi.mocked(BmadAgentLauncherService.launchDevStory).mockResolvedValue({
        command: `cd "/home/user/test-project/.tinsu/worktrees/task-xyz" && claude --dangerously-skip-permissions "/bmad:bmm:workflows:dev-story ${mockStoryFilePath}"`,
        success: true
      })

      const worktreePath = '/home/user/test-project/.tinsu/worktrees/task-xyz'
      const task = createStoryTask({
        story_number: '3',
        story_file_status: 'story_ready',
        story_file_path: mockStoryFilePath,
        worktree_path: worktreePath
      })

      // Mock existsSync to return true for this worktree path
      vi.mocked(existsSync).mockReturnValueOnce(true)

      const result = await caller.startDevStory({ taskId: task.id })

      expect(result.success).toBe(true)
      expect(BmadAgentLauncherService.launchDevStory).toHaveBeenCalledWith(
        task.id,
        TEST_PROJECT_ROOT,
        mockStoryFilePath,
        'opus',
        worktreePath
      )
    })

    it('throws PRECONDITION_FAILED when worktree_path does not exist (Story 8.4)', async () => {
      vi.mocked(ClaudeCliDetectorService.isClaudeCodeInstalled).mockResolvedValue(true)

      const nonExistentWorktree = '/home/user/test-project/.tinsu/worktrees/deleted-task'
      const task = createStoryTask({
        story_number: '3',
        story_file_status: 'story_ready',
        story_file_path: mockStoryFilePath,
        worktree_path: nonExistentWorktree
      })

      // existsSync will return false for the non-existent worktree
      await expect(caller.startDevStory({ taskId: task.id })).rejects.toMatchObject({
        code: 'PRECONDITION_FAILED',
        message: expect.stringContaining('Worktree path does not exist')
      })

      // Launcher should NOT be called
      expect(BmadAgentLauncherService.launchDevStory).not.toHaveBeenCalled()
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

    it('returns success on successful launch', async () => {
      vi.mocked(ClaudeCliDetectorService.isClaudeCodeInstalled).mockResolvedValue(true)
      vi.mocked(BmadAgentLauncherService.launchBasicTask).mockResolvedValue({
        command: 'cd "/home/user/test-project" && claude --dangerously-skip-permissions "Fix login bug"',
        success: true
      })

      const task = createBasicTask()

      const result = await caller.startBasicTask({ taskId: task.id })

      expect(result.success).toBe(true)
      expect(result.command).toContain('claude')
    })

    it('passes task title and description to launcher', async () => {
      vi.mocked(ClaudeCliDetectorService.isClaudeCodeInstalled).mockResolvedValue(true)
      vi.mocked(BmadAgentLauncherService.launchBasicTask).mockResolvedValue({
        command: 'cd "/home/user/test-project" && claude --dangerously-skip-permissions "Fix login bug\\n\\nThe login button does not work on mobile Safari"',
        success: true
      })

      const task = createBasicTask({
        title: 'Fix login bug',
        description: 'The login button does not work on mobile Safari'
      })

      await caller.startBasicTask({ taskId: task.id })

      expect(BmadAgentLauncherService.launchBasicTask).toHaveBeenCalledWith(
        task.id,
        TEST_PROJECT_ROOT,
        'Fix login bug',
        'The login button does not work on mobile Safari',
        'opus', // Story 5.1: Dev agent model from config
        undefined // Story 8.4: worktree path (undefined when not set)
      )
    })

    // Story 8.4: Worktree path tests
    it('passes worktree_path to launcher when task has one (Story 8.4)', async () => {
      vi.mocked(ClaudeCliDetectorService.isClaudeCodeInstalled).mockResolvedValue(true)
      vi.mocked(BmadAgentLauncherService.launchBasicTask).mockResolvedValue({
        command: 'cd "/home/user/test-project/.tinsu/worktrees/task-basic" && claude --dangerously-skip-permissions "Fix login bug"',
        success: true
      })

      const worktreePath = '/home/user/test-project/.tinsu/worktrees/task-basic'
      const task = createBasicTask({
        worktree_path: worktreePath
      })

      // Mock existsSync to return true for this worktree path
      vi.mocked(existsSync).mockReturnValueOnce(true)

      const result = await caller.startBasicTask({ taskId: task.id })

      expect(result.success).toBe(true)
      expect(BmadAgentLauncherService.launchBasicTask).toHaveBeenCalledWith(
        task.id,
        TEST_PROJECT_ROOT,
        task.title,
        task.description,
        'opus',
        worktreePath
      )
    })

    it('throws PRECONDITION_FAILED when worktree_path does not exist (Story 8.4)', async () => {
      vi.mocked(ClaudeCliDetectorService.isClaudeCodeInstalled).mockResolvedValue(true)

      const nonExistentWorktree = '/home/user/test-project/.tinsu/worktrees/deleted-basic'
      const task = createBasicTask({
        worktree_path: nonExistentWorktree
      })

      await expect(caller.startBasicTask({ taskId: task.id })).rejects.toMatchObject({
        code: 'PRECONDITION_FAILED',
        message: expect.stringContaining('Worktree path does not exist')
      })

      expect(BmadAgentLauncherService.launchBasicTask).not.toHaveBeenCalled()
    })

    it('handles task with no description', async () => {
      vi.mocked(ClaudeCliDetectorService.isClaudeCodeInstalled).mockResolvedValue(true)
      vi.mocked(BmadAgentLauncherService.launchBasicTask).mockResolvedValue({
        command: 'cd "/home/user/test-project" && claude --dangerously-skip-permissions "Quick fix"',
        success: true
      })

      const task = createBasicTask({
        title: 'Quick fix',
        description: null
      })

      await caller.startBasicTask({ taskId: task.id })

      expect(BmadAgentLauncherService.launchBasicTask).toHaveBeenCalledWith(
        task.id,
        TEST_PROJECT_ROOT,
        'Quick fix',
        undefined, // description is undefined when null
        'opus',
        undefined // Story 8.4: worktree path (undefined when not set)
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

  describe('onDevAgentProgress subscription (Story 5.5 - AC: 2)', () => {
    it('emits progress when state changes', async () => {
      // Test that the subscription returns the correct initial progress
      // Note: Full subscription testing requires more setup, so we test the service directly
      // The router just wraps the service's onProgress method
      const progressUpdates: DevAgentProgressInfo[] = []
      const unsubscribe = devAgentProgressService.onProgress((progress) => {
        progressUpdates.push(progress)
      })

      devAgentProgressService.setState('dev_implementing')

      expect(progressUpdates).toHaveLength(1)
      expect(progressUpdates[0]).toEqual({
        step: 2,
        total: 3,
        label: 'Step 2/3: DEV Implementing'
      })

      unsubscribe()
      devAgentProgressService.setState('idle')
    })

    it('emits correct progress for code_reviewing state', async () => {
      const progressUpdates: DevAgentProgressInfo[] = []
      const unsubscribe = devAgentProgressService.onProgress((progress) => {
        progressUpdates.push(progress)
      })

      devAgentProgressService.setState('code_reviewing')

      expect(progressUpdates).toHaveLength(1)
      expect(progressUpdates[0]).toEqual({
        step: 3,
        total: 3,
        label: 'Step 3/3: Code Review'
      })

      unsubscribe()
      devAgentProgressService.setState('idle')
    })

    it('getDevAgentProgress returns current step info', async () => {
      devAgentProgressService.setState('dev_implementing')

      const result = await caller.getDevAgentProgress()

      expect(result).toEqual({
        step: 2,
        total: 3,
        label: 'Step 2/3: DEV Implementing'
      })

      devAgentProgressService.setState('idle')
    })

    it('getDevAgentProgress returns idle state when not running', async () => {
      devAgentProgressService.setState('idle')

      const result = await caller.getDevAgentProgress()

      expect(result).toEqual({
        step: 0,
        total: 3,
        label: 'Ready'
      })
    })
  })

  // ===== TES-1.4: Task Terminal Attachment Tests =====

  describe('getTaskSession (TES-1.4 - AC: #1, #3)', () => {
    // Helper to create a task session
    const createTaskSession = (taskId: string, sessionName: string) => {
      const id = `session-${Date.now()}-${Math.random().toString(36).slice(2)}`
      return db
        .insert(schema.task_sessions)
        .values({
          id,
          task_id: taskId,
          tmux_session: sessionName,
          session_id: null,
          current_phase: null,
          created_at: new Date()
        })
        .returning()
        .get()
    }

    it('returns task session when it exists', async () => {
      const task = createStoryTask()
      const sessionName = `tinsu-test-${task.id}`
      createTaskSession(task.id, sessionName)

      const result = await caller.getTaskSession({ taskId: task.id })

      expect(result).not.toBeNull()
      expect(result?.task_id).toBe(task.id)
      expect(result?.tmux_session).toBe(sessionName)
    })

    it('returns null when no session exists', async () => {
      const result = await caller.getTaskSession({ taskId: 'non-existent-task' })

      expect(result).toBeNull()
    })
  })

  describe('attachTaskTerminal (TES-1.4 - AC: #1)', () => {
    it('returns attached=false when no tmux session exists', async () => {
      vi.mocked(TaskTerminalService.getAttachCommand).mockResolvedValue(null)

      const result = await caller.attachTaskTerminal({ taskId: 'task-123' })

      expect(result.attached).toBe(false)
      expect(result.processId).toBeNull()
      expect(ptyService.spawn).not.toHaveBeenCalled()
    })

    it('spawns PTY and returns processId when session exists', async () => {
      vi.mocked(TaskTerminalService.getAttachCommand).mockResolvedValue(
        'tmux attach-session -t tinsu-test-task-123'
      )
      vi.mocked(ptyService.spawn).mockReturnValue('pty-process-uuid-123')

      const result = await caller.attachTaskTerminal({ taskId: 'task-123' })

      expect(result.attached).toBe(true)
      expect(result.processId).toBe('pty-process-uuid-123')
      expect(ptyService.spawn).toHaveBeenCalledWith(
        'bash',
        ['-c', 'tmux attach-session -t tinsu-test-task-123'],
        expect.objectContaining({ cols: 80, rows: 24 })
      )
    })

    it('uses custom dimensions when provided', async () => {
      vi.mocked(TaskTerminalService.getAttachCommand).mockResolvedValue(
        'tmux attach-session -t tinsu-test-task-123'
      )
      vi.mocked(ptyService.spawn).mockReturnValue('pty-process-uuid-124')

      await caller.attachTaskTerminal({
        taskId: 'task-123',
        cols: 120,
        rows: 40
      })

      expect(ptyService.spawn).toHaveBeenCalledWith(
        'bash',
        ['-c', 'tmux attach-session -t tinsu-test-task-123'],
        expect.objectContaining({ cols: 120, rows: 40 })
      )
    })
  })

  describe('detachTaskTerminal (TES-1.4 - AC: #1)', () => {
    it('kills the PTY process and returns detached=true', async () => {
      const result = await caller.detachTaskTerminal({ processId: 'pty-process-123' })

      expect(result.detached).toBe(true)
      expect(ptyService.kill).toHaveBeenCalledWith('pty-process-123')
    })
  })

  // ===== TES-1.5: User Command Input Tests =====

  describe('sendTerminalCommand (TES-1.5 - AC: #1)', () => {
    it('sends command via TaskTerminalService and returns success', async () => {
      vi.mocked(TaskTerminalService.sendCommand).mockResolvedValue()

      const result = await caller.sendTerminalCommand({
        taskId: 'task-123',
        command: 'ls -la'
      })

      expect(result.success).toBe(true)
      expect(TaskTerminalService.sendCommand).toHaveBeenCalledWith('task-123', 'ls -la')
    })

    it('throws NOT_FOUND when no terminal session exists', async () => {
      vi.mocked(TaskTerminalService.sendCommand).mockRejectedValue(
        new Error('No terminal session for task task-456')
      )

      await expect(
        caller.sendTerminalCommand({ taskId: 'task-456', command: 'pwd' })
      ).rejects.toMatchObject({
        code: 'NOT_FOUND',
        message: expect.stringContaining('No terminal session')
      })
    })

    it('throws INTERNAL_SERVER_ERROR for other tmux errors', async () => {
      vi.mocked(TaskTerminalService.sendCommand).mockRejectedValue(
        new Error('tmux send-keys failed: permission denied')
      )

      await expect(
        caller.sendTerminalCommand({ taskId: 'task-123', command: 'test' })
      ).rejects.toMatchObject({
        code: 'INTERNAL_SERVER_ERROR',
        message: expect.stringContaining('permission denied')
      })
    })

    it('validates command is non-empty', async () => {
      // Zod validation should reject empty command
      await expect(
        caller.sendTerminalCommand({ taskId: 'task-123', command: '' })
      ).rejects.toThrow()
    })

    it('handles commands with special characters', async () => {
      vi.mocked(TaskTerminalService.sendCommand).mockResolvedValue()

      const result = await caller.sendTerminalCommand({
        taskId: 'task-123',
        command: 'echo "hello world" && npm run test'
      })

      expect(result.success).toBe(true)
      expect(TaskTerminalService.sendCommand).toHaveBeenCalledWith(
        'task-123',
        'echo "hello world" && npm run test'
      )
    })

    // ===== TES-2.8: User Command Event Capture Tests =====

    it('logs user_command activity when command sent successfully (TES-2.8)', async () => {
      vi.mocked(TaskTerminalService.sendCommand).mockResolvedValue()
      vi.mocked(ActivityLogService.logActivity).mockResolvedValue({
        id: 'activity-1',
        task_id: 'task-123',
        event_type: 'user_command',
        payload: '{"command":"npm run test"}',
        created_at: Date.now()
      })

      await caller.sendTerminalCommand({
        taskId: 'task-123',
        command: 'npm run test'
      })

      expect(ActivityLogService.logActivity).toHaveBeenCalledWith(
        'task-123',
        'user_command',
        { command: 'npm run test' }
      )
    })

    it('returns success even when activity logging fails (TES-2.8)', async () => {
      vi.mocked(TaskTerminalService.sendCommand).mockResolvedValue()
      vi.mocked(ActivityLogService.logActivity).mockRejectedValue(new Error('DB error'))

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const result = await caller.sendTerminalCommand({
        taskId: 'task-123',
        command: 'npm run test'
      })

      expect(result).toEqual({ success: true })
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to log user_command'),
        expect.any(Error)
      )

      consoleSpy.mockRestore()
    })

    it('logs activity with correct payload containing command text (TES-2.8)', async () => {
      vi.mocked(TaskTerminalService.sendCommand).mockResolvedValue()
      vi.mocked(ActivityLogService.logActivity).mockResolvedValue({
        id: 'activity-2',
        task_id: 'task-456',
        event_type: 'user_command',
        payload: '{"command":"git status --short"}',
        created_at: Date.now()
      })

      await caller.sendTerminalCommand({
        taskId: 'task-456',
        command: 'git status --short'
      })

      expect(ActivityLogService.logActivity).toHaveBeenCalledWith(
        'task-456',
        'user_command',
        { command: 'git status --short' }
      )
    })

    it('does not log activity when command send fails (TES-2.8)', async () => {
      vi.mocked(TaskTerminalService.sendCommand).mockRejectedValue(
        new Error('No terminal session for task task-789')
      )

      await expect(
        caller.sendTerminalCommand({ taskId: 'task-789', command: 'pwd' })
      ).rejects.toMatchObject({
        code: 'NOT_FOUND'
      })

      // Activity logging should not be called if command send failed
      expect(ActivityLogService.logActivity).not.toHaveBeenCalled()
    })

    it('masks common secrets in logged command', async () => {
      vi.mocked(TaskTerminalService.sendCommand).mockResolvedValue()
      vi.mocked(ActivityLogService.logActivity).mockResolvedValue({
        id: 'activity-3',
        task_id: 'task-123',
        event_type: 'user_command',
        payload: '{"command":"login --password *****"}',
        created_at: Date.now()
      })

      await caller.sendTerminalCommand({
        taskId: 'task-123',
        command: 'login --password mysecretpassword123'
      })

      expect(ActivityLogService.logActivity).toHaveBeenCalledWith(
        'task-123',
        'user_command',
        { command: expect.stringContaining('*****') }
      )
      expect(ActivityLogService.logActivity).toHaveBeenCalledWith(
        'task-123',
        'user_command',
        { command: expect.not.stringContaining('mysecretpassword123') }
      )
    })

    it('truncates long commands in logged command', async () => {
      vi.mocked(TaskTerminalService.sendCommand).mockResolvedValue()
      vi.mocked(ActivityLogService.logActivity).mockResolvedValue({
        id: 'activity-4',
        task_id: 'task-123',
        event_type: 'user_command',
        payload: '...',
        created_at: Date.now()
      })

      const longCommand = 'a'.repeat(2000)
      await caller.sendTerminalCommand({
        taskId: 'task-123',
        command: longCommand
      })

      // Should be truncated to 1000 chars + suffix
      expect(ActivityLogService.logActivity).toHaveBeenCalledWith(
        'task-123',
        'user_command',
        { command: expect.stringContaining('... (truncated)') }
      )
      // Should verify length is much shorter than original
      const callArgs = vi.mocked(ActivityLogService.logActivity).mock.calls[0]
      const payload = callArgs[2] as { command: string }
      expect(payload.command.length).toBeLessThan(1100)
    })
  })

  // ===== TES-1.7: Session-Task Mapping & Event Routing Tests =====

  describe('registerSessionId (TES-1.7 - AC: #3)', () => {
    // Helper to create a task session record for testing
    const createTaskSessionForTest = (taskId: string, tmuxSession: string) => {
      const id = `session-${Date.now()}-${Math.random().toString(36).slice(2)}`
      return db
        .insert(schema.task_sessions)
        .values({
          id,
          task_id: taskId,
          tmux_session: tmuxSession,
          session_id: null,
          current_phase: null,
          created_at: new Date()
        })
        .returning()
        .get()
    }

    it('calls TaskSessionService.updateSessionId with correct arguments', async () => {
      vi.mocked(TaskSessionService.updateSessionId).mockResolvedValue()

      // Create a task and its session first
      const task = createStoryTask()
      createTaskSessionForTest(task.id, `tinsu-test-${task.id}`)

      const result = await caller.registerSessionId({
        taskId: task.id,
        sessionId: 'claude-session-abc-def'
      })

      expect(result.success).toBe(true)
      expect(TaskSessionService.updateSessionId).toHaveBeenCalledWith(
        task.id,
        'claude-session-abc-def'
      )
    })

    it('returns success true when update succeeds', async () => {
      vi.mocked(TaskSessionService.updateSessionId).mockResolvedValue()

      // Create a task and its session first
      const task = createStoryTask()
      createTaskSessionForTest(task.id, `tinsu-test-${task.id}`)

      const result = await caller.registerSessionId({
        taskId: task.id,
        sessionId: 'claude-session-xyz'
      })

      expect(result).toEqual({ success: true })
    })

    it('throws NOT_FOUND when no task_sessions record exists', async () => {
      // Don't create a task_session record - should fail validation
      await expect(
        caller.registerSessionId({
          taskId: 'non-existent-task',
          sessionId: 'claude-session-123'
        })
      ).rejects.toMatchObject({
        code: 'NOT_FOUND',
        message: expect.stringContaining('No task session found')
      })

      // TaskSessionService should NOT be called
      expect(TaskSessionService.updateSessionId).not.toHaveBeenCalled()
    })

    it('handles various sessionId formats', async () => {
      vi.mocked(TaskSessionService.updateSessionId).mockResolvedValue()

      // Create tasks with sessions
      const task1 = createStoryTask()
      createTaskSessionForTest(task1.id, `tinsu-test-${task1.id}`)

      const task2 = createStoryTask()
      createTaskSessionForTest(task2.id, `tinsu-test-${task2.id}`)

      // Test with UUID-like session ID
      const result1 = await caller.registerSessionId({
        taskId: task1.id,
        sessionId: '550e8400-e29b-41d4-a716-446655440000'
      })
      expect(result1.success).toBe(true)

      // Test with simple alphanumeric
      const result2 = await caller.registerSessionId({
        taskId: task2.id,
        sessionId: 'session123'
      })
      expect(result2.success).toBe(true)
    })
  })

  // ===== TES-1.9: Scrollback Restoration Tests =====

  describe('getScrollbackBackup (TES-1.9 - AC: #1, #3)', () => {
    it('returns content and metadata when backup exists', async () => {
      const mockContent = 'Line 1\nLine 2\nLine 3'
      const mockMetadata = {
        lines: 3,
        bytes: 100,
        lastBackup: '2026-01-13T10:00:00.000Z',
        tmuxSession: 'tinsu-test-task-123'
      }

      vi.mocked(ScrollbackBackupService.restoreScrollback).mockResolvedValue(mockContent)
      vi.mocked(ScrollbackBackupService.getBackupMetadata).mockResolvedValue(mockMetadata)

      const result = await caller.getScrollbackBackup({ taskId: 'task-123' })

      expect(result.content).toBe(mockContent)
      expect(result.metadata).toEqual(mockMetadata)
      expect(ScrollbackBackupService.restoreScrollback).toHaveBeenCalledWith('task-123')
      expect(ScrollbackBackupService.getBackupMetadata).toHaveBeenCalledWith('task-123')
    })

    it('returns null content and metadata when no backup exists', async () => {
      vi.mocked(ScrollbackBackupService.restoreScrollback).mockResolvedValue(null)
      vi.mocked(ScrollbackBackupService.getBackupMetadata).mockResolvedValue(null)

      const result = await caller.getScrollbackBackup({ taskId: 'task-456' })

      expect(result.content).toBeNull()
      expect(result.metadata).toBeNull()
    })

    it('handles content without metadata gracefully', async () => {
      const mockContent = 'Some old scrollback content'
      vi.mocked(ScrollbackBackupService.restoreScrollback).mockResolvedValue(mockContent)
      vi.mocked(ScrollbackBackupService.getBackupMetadata).mockResolvedValue(null)

      const result = await caller.getScrollbackBackup({ taskId: 'task-789' })

      expect(result.content).toBe(mockContent)
      expect(result.metadata).toBeNull()
    })

    it('handles large scrollback content', async () => {
      // Simulate 50,000 lines of content
      const mockContent = Array.from({ length: 50000 }, (_, i) => `Line ${i + 1}`).join('\n')
      const mockMetadata = {
        lines: 50000,
        bytes: mockContent.length,
        lastBackup: '2026-01-13T10:00:00.000Z',
        tmuxSession: 'tinsu-test-task-large'
      }

      vi.mocked(ScrollbackBackupService.restoreScrollback).mockResolvedValue(mockContent)
      vi.mocked(ScrollbackBackupService.getBackupMetadata).mockResolvedValue(mockMetadata)

      const result = await caller.getScrollbackBackup({ taskId: 'task-large' })

      expect(result.content).toBe(mockContent)
      expect(result.metadata?.lines).toBe(50000)
    })

    it('returns null on timeout (TES-1.9 Task 6)', async () => {
      // Simulate a slow restoration that exceeds timeout
      vi.mocked(ScrollbackBackupService.restoreScrollback).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve('content'), 10000))
      )
      vi.mocked(ScrollbackBackupService.getBackupMetadata).mockResolvedValue(null)

      // Use fake timers for this test
      vi.useFakeTimers()

      const resultPromise = caller.getScrollbackBackup({ taskId: 'task-timeout' })

      // Advance past the 5 second timeout
      await vi.advanceTimersByTimeAsync(6000)

      const result = await resultPromise

      expect(result.content).toBeNull()
      expect(result.metadata).toBeNull()

      vi.useRealTimers()
    })

    it('handles corrupted backup gracefully (TES-1.9 Task 6)', async () => {
      // Service already returns null for corrupted files
      vi.mocked(ScrollbackBackupService.restoreScrollback).mockResolvedValue(null)
      vi.mocked(ScrollbackBackupService.getBackupMetadata).mockResolvedValue({
        lines: 100,
        bytes: 5000,
        lastBackup: '2026-01-13T10:00:00.000Z',
        tmuxSession: 'tinsu-test-corrupted'
      })

      const result = await caller.getScrollbackBackup({ taskId: 'task-corrupted' })

      // Content is null but metadata still returned (metadata.json was fine)
      expect(result.content).toBeNull()
      expect(result.metadata).not.toBeNull()
    })
  })

  describe('getBackupInfo (TES-1.9 - AC: #1)', () => {
    it('returns metadata when backup exists', async () => {
      const mockMetadata = {
        lines: 1500,
        bytes: 45000,
        lastBackup: '2026-01-13T12:30:00.000Z',
        tmuxSession: 'tinsu-test-task-info'
      }

      vi.mocked(ScrollbackBackupService.getBackupMetadata).mockResolvedValue(mockMetadata)

      const result = await caller.getBackupInfo({ taskId: 'task-info' })

      expect(result).toEqual(mockMetadata)
      expect(ScrollbackBackupService.getBackupMetadata).toHaveBeenCalledWith('task-info')
    })

    it('returns null when no backup exists', async () => {
      vi.mocked(ScrollbackBackupService.getBackupMetadata).mockResolvedValue(null)

      const result = await caller.getBackupInfo({ taskId: 'task-no-backup' })

      expect(result).toBeNull()
    })

    it('only calls getBackupMetadata, not restoreScrollback', async () => {
      const mockMetadata = {
        lines: 100,
        bytes: 3000,
        lastBackup: '2026-01-13T08:00:00.000Z',
        tmuxSession: 'tinsu-test-task-meta'
      }

      vi.mocked(ScrollbackBackupService.getBackupMetadata).mockResolvedValue(mockMetadata)

      await caller.getBackupInfo({ taskId: 'task-meta' })

      expect(ScrollbackBackupService.getBackupMetadata).toHaveBeenCalledWith('task-meta')
      expect(ScrollbackBackupService.restoreScrollback).not.toHaveBeenCalled()
    })
  })
})

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { TRPCError } from '@trpc/server'
import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as schema from '../../db/schema'

// Mock services BEFORE importing task.router to avoid Electron app dependency
// TES-2.5: Use inline vi.fn() for mock factory to avoid hoisting issues
vi.mock('../../services', () => {
  const mockLogActivity = vi.fn()
  const mockGetActivities = vi.fn()
  const mockOnStatusInProgress = vi.fn().mockResolvedValue(undefined)
  return {
    activityLogService: {
      logActivity: mockLogActivity,
      getActivities: mockGetActivities
    },
    AutomationService: {
      onStatusInProgress: mockOnStatusInProgress
    },
    // Export for test assertions
    __mocks: { mockLogActivity, mockGetActivities, mockOnStatusInProgress }
  }
})

// Mock TaskTerminalService to avoid Electron app dependency
vi.mock('../../services/task-terminal.service', () => ({
  TaskTerminalService: {
    createSession: vi.fn().mockResolvedValue('mock-session-name')
  }
}))

// Mock StorySyncService to avoid file system operations
vi.mock('../../services/story-sync.service', () => ({
  StorySyncService: {
    updateStoryFileStatus: vi.fn().mockResolvedValue(undefined)
  }
}))

// Mock ConfigService to avoid file system operations
vi.mock('../../services/config.service', () => ({
  ConfigService: class MockConfigService {
    loadConfig() {
      return { projectName: 'test-project' }
    }
  }
}))

// Now import task.router after mocks are set up
import { taskRouter } from './task.router'
// TES-2.5: Import the mock functions for assertions
import { __mocks } from '../../services'
const { mockLogActivity, mockGetActivities, mockOnStatusInProgress } = __mocks as { mockLogActivity: ReturnType<typeof vi.fn>, mockGetActivities: ReturnType<typeof vi.fn>, mockOnStatusInProgress: ReturnType<typeof vi.fn> }

type TestDb = BetterSQLite3Database<typeof schema>

const TEST_PROJECT_ID = 'test-project-id'

// Create an in-memory SQLite database for testing
function createTestDb(): TestDb {
  const sqlite = new Database(':memory:')

  // Create the projects table first (Story 3.1.5)
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY NOT NULL,
      path TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      last_opened_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_projects_path ON projects(path);
    CREATE INDEX IF NOT EXISTS idx_projects_last_opened ON projects(last_opened_at);
  `)

  // Create the tasks table matching Drizzle schema (including Story 3.1 planning fields, Story 3.2 is_start_here, Story 3.1.5 project_id, Story 3.7 story_number, story_file_path, full_content, Story 5.2b story_file_status, Story 5.5 context_notes)
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
      story_number TEXT,
      story_file_path TEXT,
      full_content TEXT,
      story_file_status TEXT,
      context_notes TEXT,
      project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_epic_id ON tasks(epic_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_sprint_id ON tasks(sprint_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_sort_order ON tasks(sort_order);
    CREATE INDEX IF NOT EXISTS idx_tasks_task_type ON tasks(task_type);
    CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
  `)

  // Create epics table (needed for getAllWithEpics, Story 3.7 - epic_number, goal)
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
    CREATE INDEX IF NOT EXISTS idx_epics_project_id ON epics(project_id);
  `)

  // Create task_activities table (TES-2.1, needed for TES-2.5 status_change logging tests)
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS task_activities (
      id TEXT PRIMARY KEY NOT NULL,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      payload TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_task_activities_task_id ON task_activities(task_id);
    CREATE INDEX IF NOT EXISTS idx_task_activities_event_type ON task_activities(event_type);
    CREATE INDEX IF NOT EXISTS idx_task_activities_created_at ON task_activities(created_at);
  `)

  const db = drizzle({ client: sqlite, schema })

  // Create test project
  db.insert(schema.projects)
    .values({
      id: TEST_PROJECT_ID,
      path: '/test/project',
      name: 'Test Project'
    })
    .run()

  return db
}

// Helper to create a test caller with projectId (Story 3.1.5)
function createTestCaller(db: TestDb, projectId: string | null = TEST_PROJECT_ID) {
  const createCaller = taskRouter.createCaller
  return createCaller({
    db,
    projectRoot: process.cwd(),
    projectId
  } as { db: typeof import('../../db').db; projectRoot: string; projectId: string | null })
}

describe('taskRouter', () => {
  let db: ReturnType<typeof createTestDb>
  let caller: ReturnType<typeof createTestCaller>

  beforeEach(() => {
    db = createTestDb()
    caller = createTestCaller(db)
    // TES-2.5: Reset activity log mocks before each test
    mockLogActivity.mockReset()
    mockLogActivity.mockResolvedValue({ id: 'activity-1', task_id: '', event_type: '', payload: null, created_at: Date.now() })
    mockGetActivities.mockReset()
    mockOnStatusInProgress.mockReset()
  })

  describe('getAll', () => {
    it('should return empty array when no tasks exist', async () => {
      const result = await caller.getAll()
      expect(result).toEqual([])
    })

    it('should return all tasks', async () => {
      // Insert test tasks directly with project_id
      db.insert(schema.tasks)
        .values({
          id: 'task-1',
          title: 'Test Task 1',
          status: 'backlog',
          project_id: TEST_PROJECT_ID,
          created_at: new Date(),
          updated_at: new Date()
        })
        .run()
      db.insert(schema.tasks)
        .values({
          id: 'task-2',
          title: 'Test Task 2',
          status: 'in_progress',
          project_id: TEST_PROJECT_ID,
          created_at: new Date(),
          updated_at: new Date()
        })
        .run()

      const result = await caller.getAll()
      expect(result).toHaveLength(2)
      expect(result[0].title).toBe('Test Task 1')
      expect(result[1].title).toBe('Test Task 2')
    })
  })

  describe('getById', () => {
    it('should return task when found', async () => {
      db.insert(schema.tasks)
        .values({
          id: 'task-1',
          title: 'Test Task',
          status: 'backlog',
          project_id: TEST_PROJECT_ID,
          created_at: new Date(),
          updated_at: new Date()
        })
        .run()

      const result = await caller.getById({ id: 'task-1' })
      expect(result.id).toBe('task-1')
      expect(result.title).toBe('Test Task')
    })

    it('should throw NOT_FOUND when task does not exist', async () => {
      await expect(caller.getById({ id: 'nonexistent' })).rejects.toThrow(TRPCError)

      try {
        await caller.getById({ id: 'nonexistent' })
      } catch (error) {
        expect((error as TRPCError).code).toBe('NOT_FOUND')
      }
    })
  })

  describe('create', () => {
    it('should create a task with required fields', async () => {
      const result = await caller.create({ title: 'New Task' })

      expect(result.id).toBeDefined()
      expect(result.title).toBe('New Task')
      expect(result.status).toBe('backlog')
      expect(result.description).toBeNull()
      expect(result.project_id).toBe(TEST_PROJECT_ID) // Story 3.1.5: Verify project_id is set
    })

    // Story 5.2c: Basic task (manually created) should have null story_file_status
    it('should create a basic task with null story_file_status', async () => {
      const result = await caller.create({ title: 'Manual Basic Task' })

      expect(result.story_number).toBeNull()
      expect(result.story_file_status).toBeNull()
      expect(result.task_type).toBe('story') // Default task_type
    })

    it('should create a task with all fields', async () => {
      const result = await caller.create({
        title: 'Full Task',
        description: 'A description',
        status: 'in_progress',
        epic_id: 'epic-1',
        sprint_id: 'sprint-1'
      })

      expect(result.title).toBe('Full Task')
      expect(result.description).toBe('A description')
      expect(result.status).toBe('in_progress')
      expect(result.epic_id).toBe('epic-1')
      expect(result.sprint_id).toBe('sprint-1')
      expect(result.project_id).toBe(TEST_PROJECT_ID)
    })

    it('should reject empty title', async () => {
      await expect(caller.create({ title: '' })).rejects.toThrow()
    })
  })

  describe('updateStatus', () => {
    it('should update task status', async () => {
      db.insert(schema.tasks)
        .values({
          id: 'task-1',
          title: 'Test Task',
          status: 'backlog',
          project_id: TEST_PROJECT_ID,
          created_at: new Date(),
          updated_at: new Date()
        })
        .run()

      const result = await caller.updateStatus({ id: 'task-1', status: 'done' })
      expect(result.status).toBe('done')
    })

    it('should throw NOT_FOUND when task does not exist', async () => {
      await expect(caller.updateStatus({ id: 'nonexistent', status: 'done' })).rejects.toThrow(
        TRPCError
      )

      try {
        await caller.updateStatus({ id: 'nonexistent', status: 'done' })
      } catch (error) {
        expect((error as TRPCError).code).toBe('NOT_FOUND')
      }
    })

    it('should reject invalid status', async () => {
      db.insert(schema.tasks)
        .values({
          id: 'task-1',
          title: 'Test Task',
          status: 'backlog',
          project_id: TEST_PROJECT_ID,
          created_at: new Date(),
          updated_at: new Date()
        })
        .run()

      await expect(
        caller.updateStatus({ id: 'task-1', status: 'invalid' as any })
      ).rejects.toThrow()
    })

    // Story 5.2b: Create Story status support
    it('should update task status to create_story', async () => {
      db.insert(schema.tasks)
        .values({
          id: 'task-create-story',
          title: 'Create Story Task',
          status: 'backlog',
          project_id: TEST_PROJECT_ID,
          created_at: new Date(),
          updated_at: new Date()
        })
        .run()

      const result = await caller.updateStatus({ id: 'task-create-story', status: 'create_story' })
      expect(result.status).toBe('create_story')
    })

    it('should update task from create_story to in_progress', async () => {
      db.insert(schema.tasks)
        .values({
          id: 'task-in-create-story',
          title: 'Task in Create Story',
          status: 'create_story',
          project_id: TEST_PROJECT_ID,
          created_at: new Date(),
          updated_at: new Date()
        })
        .run()

      const result = await caller.updateStatus({ id: 'task-in-create-story', status: 'in_progress' })
      expect(result.status).toBe('in_progress')
    })

          // TES-2.9: Automation Trigger Integration
          it('should trigger AutomationService.onStatusInProgress when status changes to in_progress', async () => {
            // Arrange
            db.insert(schema.tasks)
              .values({
                id: 'task-automation',
                title: 'Task for Automation',
                status: 'backlog',
                task_type: 'story',
                project_id: TEST_PROJECT_ID,
                created_at: new Date(),
                updated_at: new Date()
              })
              .run()
    
            // Act
            await caller.updateStatus({ id: 'task-automation', status: 'in_progress' })
    
            // Assert
            expect(mockOnStatusInProgress).toHaveBeenCalledWith('task-automation', 'story')
          })
    
          it('should not trigger AutomationService when status changes to review', async () => {
            // Arrange
            db.insert(schema.tasks)
              .values({
                id: 'task-no-automation',
                title: 'Task No Automation',
                status: 'in_progress',
                project_id: TEST_PROJECT_ID,
                created_at: new Date(),
                updated_at: new Date()
              })
              .run()
    
            // Act
            await caller.updateStatus({ id: 'task-no-automation', status: 'review' })
    
            // Assert
            expect(mockOnStatusInProgress).not.toHaveBeenCalled()
          })
    
          // TES-2.5: Status change event capture tests
          describe('status_change activity logging', () => {      it('should log status_change activity when task status changes', async () => {
        // Arrange: Create a task in backlog
        db.insert(schema.tasks)
          .values({
            id: 'task-status-log',
            title: 'Task for Status Log',
            status: 'backlog',
            project_id: TEST_PROJECT_ID,
            created_at: new Date(),
            updated_at: new Date()
          })
          .run()

        // Act: Update status to in_progress
        await caller.updateStatus({ id: 'task-status-log', status: 'in_progress' })

        // Assert: Activity log was called with correct arguments
        expect(mockLogActivity).toHaveBeenCalledTimes(1)
        expect(mockLogActivity).toHaveBeenCalledWith('task-status-log', 'status_change', {
          from: 'backlog',
          to: 'in_progress'
        })
      })

      it('should capture payload with correct from/to values', async () => {
        // Arrange
        db.insert(schema.tasks)
          .values({
            id: 'task-payload-test',
            title: 'Task for Payload Test',
            status: 'in_progress',
            project_id: TEST_PROJECT_ID,
            created_at: new Date(),
            updated_at: new Date()
          })
          .run()

        // Act: Update status from in_progress to review
        await caller.updateStatus({ id: 'task-payload-test', status: 'review' })

        // Assert: Correct from/to values in payload
        expect(mockLogActivity).toHaveBeenCalledWith('task-payload-test', 'status_change', {
          from: 'in_progress',
          to: 'review'
        })
      })

      it('should call logActivity at time of update', async () => {
        // Arrange
        db.insert(schema.tasks)
          .values({
            id: 'task-timestamp-test',
            title: 'Task for Timestamp Test',
            status: 'backlog',
            project_id: TEST_PROJECT_ID,
            created_at: new Date(),
            updated_at: new Date()
          })
          .run()

        // Act
        await caller.updateStatus({ id: 'task-timestamp-test', status: 'in_progress' })

        // Assert: logActivity was called (timestamp is handled by the service)
        expect(mockLogActivity).toHaveBeenCalledTimes(1)
      })

      it('should capture multiple rapid status changes in order', async () => {
        // Arrange
        db.insert(schema.tasks)
          .values({
            id: 'task-rapid-changes',
            title: 'Task for Rapid Changes',
            status: 'backlog',
            project_id: TEST_PROJECT_ID,
            created_at: new Date(),
            updated_at: new Date()
          })
          .run()

        // Act: Rapid sequential updates
        await caller.updateStatus({ id: 'task-rapid-changes', status: 'in_progress' })
        await caller.updateStatus({ id: 'task-rapid-changes', status: 'review' })
        await caller.updateStatus({ id: 'task-rapid-changes', status: 'done' })

        // Assert: All 3 changes captured in order
        expect(mockLogActivity).toHaveBeenCalledTimes(3)

        // Verify calls in order
        expect(mockLogActivity).toHaveBeenNthCalledWith(1, 'task-rapid-changes', 'status_change', {
          from: 'backlog',
          to: 'in_progress'
        })
        expect(mockLogActivity).toHaveBeenNthCalledWith(2, 'task-rapid-changes', 'status_change', {
          from: 'in_progress',
          to: 'review'
        })
        expect(mockLogActivity).toHaveBeenNthCalledWith(3, 'task-rapid-changes', 'status_change', {
          from: 'review',
          to: 'done'
        })
      })

      it('should not log status_change when status unchanged (same from/to)', async () => {
        // Arrange
        db.insert(schema.tasks)
          .values({
            id: 'task-same-status',
            title: 'Task with Same Status',
            status: 'in_progress',
            project_id: TEST_PROJECT_ID,
            created_at: new Date(),
            updated_at: new Date()
          })
          .run()

        // Act: Update to same status
        await caller.updateStatus({ id: 'task-same-status', status: 'in_progress' })

        // Assert: No activity logged (status didn't actually change)
        expect(mockLogActivity).not.toHaveBeenCalled()
      })

      it('should not fail status update if activity logging fails', async () => {
        // Arrange: Make activity logging fail
        mockLogActivity.mockRejectedValue(new Error('Activity log failed'))

        db.insert(schema.tasks)
          .values({
            id: 'task-log-fail',
            title: 'Task with Log Failure',
            status: 'backlog',
            project_id: TEST_PROJECT_ID,
            created_at: new Date(),
            updated_at: new Date()
          })
          .run()

        // Act: Update status (should succeed even if activity log fails)
        const result = await caller.updateStatus({ id: 'task-log-fail', status: 'in_progress' })

        // Assert: Status was updated despite activity log failure
        expect(result.status).toBe('in_progress')
        expect(mockLogActivity).toHaveBeenCalled()
      })
    })
  })

  // TES-2.5 Code Review Fix: Test update mutation also logs status_change
  describe('update mutation status_change logging', () => {
    it('should log status_change activity when status is changed via update mutation', async () => {
      // Arrange
      db.insert(schema.tasks)
        .values({
          id: 'task-update-status',
          title: 'Task for Update Status',
          status: 'backlog',
          project_id: TEST_PROJECT_ID,
          created_at: new Date(),
          updated_at: new Date()
        })
        .run()

      // Act: Change status via update mutation (not updateStatus)
      await caller.update({ id: 'task-update-status', status: 'in_progress' })

      // Assert: Activity log was called
      expect(mockLogActivity).toHaveBeenCalledTimes(1)
      expect(mockLogActivity).toHaveBeenCalledWith('task-update-status', 'status_change', {
        from: 'backlog',
        to: 'in_progress'
      })
    })

    it('should not log status_change when status unchanged via update mutation', async () => {
      // Arrange
      db.insert(schema.tasks)
        .values({
          id: 'task-update-same',
          title: 'Task Same Status',
          status: 'in_progress',
          project_id: TEST_PROJECT_ID,
          created_at: new Date(),
          updated_at: new Date()
        })
        .run()

      // Act: Update with same status
      await caller.update({ id: 'task-update-same', status: 'in_progress' })

      // Assert: No activity logged
      expect(mockLogActivity).not.toHaveBeenCalled()
    })

    it('should not log status_change when only title is updated via update mutation', async () => {
      // Arrange
      db.insert(schema.tasks)
        .values({
          id: 'task-update-title',
          title: 'Original Title',
          status: 'backlog',
          project_id: TEST_PROJECT_ID,
          created_at: new Date(),
          updated_at: new Date()
        })
        .run()

      // Act: Update only title, not status
      await caller.update({ id: 'task-update-title', title: 'New Title' })

      // Assert: No activity logged (status wasn't changed)
      expect(mockLogActivity).not.toHaveBeenCalled()
    })

    it('should not fail update if activity logging fails', async () => {
      // Arrange
      mockLogActivity.mockRejectedValue(new Error('Activity log failed'))

      db.insert(schema.tasks)
        .values({
          id: 'task-update-log-fail',
          title: 'Task Log Fail',
          status: 'backlog',
          project_id: TEST_PROJECT_ID,
          created_at: new Date(),
          updated_at: new Date()
        })
        .run()

      // Act: Update status (should succeed even if activity log fails)
      const result = await caller.update({ id: 'task-update-log-fail', status: 'in_progress' })

      // Assert: Update succeeded despite activity log failure
      expect(result.status).toBe('in_progress')
      expect(mockLogActivity).toHaveBeenCalled()
    })
  })

  describe('delete', () => {
    it('should delete task and return deleted task', async () => {
      db.insert(schema.tasks)
        .values({
          id: 'task-1',
          title: 'Test Task',
          status: 'backlog',
          project_id: TEST_PROJECT_ID,
          created_at: new Date(),
          updated_at: new Date()
        })
        .run()

      const result = await caller.delete({ id: 'task-1' })
      expect(result.id).toBe('task-1')

      // Verify task is deleted
      const tasks = await caller.getAll()
      expect(tasks).toHaveLength(0)
    })

    it('should throw NOT_FOUND when task does not exist', async () => {
      await expect(caller.delete({ id: 'nonexistent' })).rejects.toThrow(TRPCError)

      try {
        await caller.delete({ id: 'nonexistent' })
      } catch (error) {
        expect((error as TRPCError).code).toBe('NOT_FOUND')
      }
    })
  })

  describe('reorder', () => {
    it('should update sort_order for tasks in column', async () => {
      // Create 3 tasks in backlog column
      db.insert(schema.tasks)
        .values([
          { id: 'task-1', title: 'Task 1', status: 'backlog', sort_order: 0, project_id: TEST_PROJECT_ID, created_at: new Date(), updated_at: new Date() },
          { id: 'task-2', title: 'Task 2', status: 'backlog', sort_order: 1, project_id: TEST_PROJECT_ID, created_at: new Date(), updated_at: new Date() },
          { id: 'task-3', title: 'Task 3', status: 'backlog', sort_order: 2, project_id: TEST_PROJECT_ID, created_at: new Date(), updated_at: new Date() }
        ])
        .run()

      // Reorder: move task-3 to the top
      const result = await caller.reorder({ taskIds: ['task-3', 'task-1', 'task-2'], status: 'backlog' })
      expect(result).toBe(3)

      // Verify new order
      const tasks = await caller.getAll()
      const task1 = tasks.find(t => t.id === 'task-1')
      const task2 = tasks.find(t => t.id === 'task-2')
      const task3 = tasks.find(t => t.id === 'task-3')

      expect(task3?.sort_order).toBe(0) // moved to first
      expect(task1?.sort_order).toBe(1) // moved to second
      expect(task2?.sort_order).toBe(2) // moved to third
    })

    it('should only update tasks in the specified status column', async () => {
      // Create tasks in different columns
      db.insert(schema.tasks)
        .values([
          { id: 'task-1', title: 'Task 1', status: 'backlog', sort_order: 0, project_id: TEST_PROJECT_ID, created_at: new Date(), updated_at: new Date() },
          { id: 'task-2', title: 'Task 2', status: 'in_progress', sort_order: 0, project_id: TEST_PROJECT_ID, created_at: new Date(), updated_at: new Date() }
        ])
        .run()

      // Reorder backlog column
      await caller.reorder({ taskIds: ['task-1'], status: 'backlog' })

      // Verify in_progress task was not affected
      const tasks = await caller.getAll()
      const task2 = tasks.find(t => t.id === 'task-2')
      expect(task2?.sort_order).toBe(0) // unchanged
    })
  })

  // Story 3.2: getPlanningTasks tests
  describe('getPlanningTasks', () => {
    it('should return empty array when no planning tasks exist', async () => {
      const result = await caller.getPlanningTasks()
      expect(result).toEqual([])
    })

    it('should return only planning tasks (not story tasks)', async () => {
      db.insert(schema.tasks)
        .values([
          { id: 'story-1', title: 'Story Task', task_type: 'story', status: 'backlog', project_id: TEST_PROJECT_ID, created_at: new Date(), updated_at: new Date() },
          { id: 'planning-1', title: 'Product Brief', task_type: 'planning', phase_number: 1, status: 'backlog', project_id: TEST_PROJECT_ID, created_at: new Date(), updated_at: new Date() },
          { id: 'planning-2', title: 'PRD', task_type: 'planning', phase_number: 2, status: 'backlog', project_id: TEST_PROJECT_ID, created_at: new Date(), updated_at: new Date() }
        ])
        .run()

      const result = await caller.getPlanningTasks()

      expect(result).toHaveLength(2)
      expect(result.every(t => t.task_type === 'planning')).toBe(true)
    })

    it('should return planning tasks ordered by phase_number', async () => {
      // Insert out of order
      db.insert(schema.tasks)
        .values([
          { id: 'planning-3', title: 'Architecture', task_type: 'planning', phase_number: 3, status: 'backlog', project_id: TEST_PROJECT_ID, created_at: new Date(), updated_at: new Date() },
          { id: 'planning-1', title: 'Product Brief', task_type: 'planning', phase_number: 1, status: 'backlog', project_id: TEST_PROJECT_ID, created_at: new Date(), updated_at: new Date() },
          { id: 'planning-5', title: 'Epics', task_type: 'planning', phase_number: 5, status: 'backlog', project_id: TEST_PROJECT_ID, created_at: new Date(), updated_at: new Date() },
          { id: 'planning-2', title: 'PRD', task_type: 'planning', phase_number: 2, status: 'backlog', project_id: TEST_PROJECT_ID, created_at: new Date(), updated_at: new Date() },
          { id: 'planning-4', title: 'UX Design', task_type: 'planning', phase_number: 4, status: 'backlog', project_id: TEST_PROJECT_ID, created_at: new Date(), updated_at: new Date() }
        ])
        .run()

      const result = await caller.getPlanningTasks()

      expect(result).toHaveLength(5)
      expect(result[0].phase_number).toBe(1)
      expect(result[1].phase_number).toBe(2)
      expect(result[2].phase_number).toBe(3)
      expect(result[3].phase_number).toBe(4)
      expect(result[4].phase_number).toBe(5)
    })

    it('should include is_start_here field in response', async () => {
      db.insert(schema.tasks)
        .values([
          { id: 'planning-1', title: 'Product Brief', task_type: 'planning', phase_number: 1, is_start_here: true, status: 'backlog', project_id: TEST_PROJECT_ID, created_at: new Date(), updated_at: new Date() },
          { id: 'planning-2', title: 'PRD', task_type: 'planning', phase_number: 2, is_start_here: null, status: 'backlog', project_id: TEST_PROJECT_ID, created_at: new Date(), updated_at: new Date() }
        ])
        .run()

      const result = await caller.getPlanningTasks()

      expect(result[0].is_start_here).toBe(true)
      expect(result[1].is_start_here).toBeNull()
    })
  })

  // Story 3.1.5: Project isolation tests
  describe('project isolation', () => {
    it('should only return tasks from current project', async () => {
      // Create another project
      db.insert(schema.projects)
        .values({
          id: 'other-project',
          path: '/other/project',
          name: 'Other Project'
        })
        .run()

      // Create tasks in both projects
      db.insert(schema.tasks)
        .values([
          { id: 'task-1', title: 'Task 1', status: 'backlog', project_id: TEST_PROJECT_ID, created_at: new Date(), updated_at: new Date() },
          { id: 'task-2', title: 'Task 2', status: 'backlog', project_id: 'other-project', created_at: new Date(), updated_at: new Date() }
        ])
        .run()

      const result = await caller.getAll()
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('task-1')
    })

    it('should return empty array when no project is open', async () => {
      // Insert a task
      db.insert(schema.tasks)
        .values({
          id: 'task-1',
          title: 'Test Task',
          status: 'backlog',
          project_id: TEST_PROJECT_ID,
          created_at: new Date(),
          updated_at: new Date()
        })
        .run()

      // Create caller with no projectId
      const noProjectCaller = createTestCaller(db, null)
      const result = await noProjectCaller.getAll()
      expect(result).toEqual([])
    })

    it('should throw error when creating task without project open', async () => {
      const noProjectCaller = createTestCaller(db, null)
      await expect(noProjectCaller.create({ title: 'Test' })).rejects.toThrow(TRPCError)

      try {
        await noProjectCaller.create({ title: 'Test' })
      } catch (error) {
        expect((error as TRPCError).code).toBe('PRECONDITION_FAILED')
        expect((error as TRPCError).message).toBe('No project open')
      }
    })
  })

  describe('deleteAll', () => {
    it('should delete all tasks in current project and return count', async () => {
      // Create multiple tasks
      db.insert(schema.tasks)
        .values([
          { id: 'task-1', title: 'Task 1', status: 'backlog', project_id: TEST_PROJECT_ID, created_at: new Date(), updated_at: new Date() },
          { id: 'task-2', title: 'Task 2', status: 'in_progress', project_id: TEST_PROJECT_ID, created_at: new Date(), updated_at: new Date() },
          { id: 'task-3', title: 'Task 3', status: 'done', project_id: TEST_PROJECT_ID, created_at: new Date(), updated_at: new Date() }
        ])
        .run()

      const result = await caller.deleteAll()
      expect(result.deletedCount).toBe(3)

      // Verify all tasks are deleted
      const remainingTasks = await caller.getAll()
      expect(remainingTasks).toHaveLength(0)
    })

    it('should return 0 when no tasks exist', async () => {
      const result = await caller.deleteAll()
      expect(result.deletedCount).toBe(0)
    })

    it('should only delete tasks from current project', async () => {
      // Create another project
      db.insert(schema.projects)
        .values({
          id: 'other-project',
          path: '/other/project',
          name: 'Other Project'
        })
        .run()

      // Create tasks in both projects
      db.insert(schema.tasks)
        .values([
          { id: 'task-1', title: 'Task 1', status: 'backlog', project_id: TEST_PROJECT_ID, created_at: new Date(), updated_at: new Date() },
          { id: 'task-2', title: 'Task 2', status: 'backlog', project_id: 'other-project', created_at: new Date(), updated_at: new Date() }
        ])
        .run()

      const result = await caller.deleteAll()
      expect(result.deletedCount).toBe(1)

      // Verify other project's task still exists
      const otherCaller = createTestCaller(db, 'other-project')
      const otherTasks = await otherCaller.getAll()
      expect(otherTasks).toHaveLength(1)
      expect(otherTasks[0].id).toBe('task-2')
    })

    it('should throw error when no project is open', async () => {
      const noProjectCaller = createTestCaller(db, null)
      await expect(noProjectCaller.deleteAll()).rejects.toThrow(TRPCError)

      try {
        await noProjectCaller.deleteAll()
      } catch (error) {
        expect((error as TRPCError).code).toBe('PRECONDITION_FAILED')
        expect((error as TRPCError).message).toBe('No project open')
      }
    })
  })
})

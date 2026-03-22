/**
 * AutomationService Tests - TES-2.9
 *
 * Tests for automation_trigger event logging when workflows are auto-triggered.
 *
 * Test coverage:
 * - Task 3.2: automation_trigger event logged when dev-story triggered on status change
 * - Task 3.3: automation_trigger event logged when code-review triggered on dev-story completion
 * - Task 3.4: Payload contains correct command and trigger values
 * - Task 3.5: Automation continues even if logging fails
 *
 * @see TES-2.9: Automation Trigger Event Capture
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { eq } from 'drizzle-orm'
import * as schema from '../db/schema'
import { AutomationService } from './automation.service'
import { ActivityLogService, setActivityLogServiceInstance } from './activity-log.service'

type TestDb = BetterSQLite3Database<typeof schema>

/**
 * Create an in-memory SQLite database for testing.
 */
function createTestDb(): TestDb {
  const sqlite = new Database(':memory:')

  // Enable foreign keys
  sqlite.exec('PRAGMA foreign_keys = ON;')

  // Create projects table (required for tasks FK)
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY NOT NULL,
      path TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      last_opened_at INTEGER
    );
  `)

  // Create tasks table (required for task_activities FK)
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
  `)

  // Create task_activities table (TES-2.1)
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
    CREATE INDEX IF NOT EXISTS idx_task_activities_task_id_created_at ON task_activities(task_id, created_at);
  `)

  return drizzle({ client: sqlite, schema })
}

/**
 * Create a test task in the database.
 */
function createTestTask(db: TestDb, taskId: string, taskType: string = 'story'): void {
  db.insert(schema.tasks)
    .values({
      id: taskId,
      title: `Test Task ${taskId}`,
      task_type: taskType,
      created_at: new Date(),
      updated_at: new Date()
    })
    .run()
}

describe('AutomationService automation_trigger logging (TES-2.9)', () => {
  let db: TestDb
  let activityLogService: ActivityLogService

  beforeEach(() => {
    db = createTestDb()
    activityLogService = new ActivityLogService(db as unknown as BetterSQLite3Database)
    // Set the global instance so static methods work
    setActivityLogServiceInstance(activityLogService)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('onStatusInProgress', () => {
    it('logs automation_trigger event when dev-story auto-triggered on status change to in_progress (Task 3.2)', async () => {
      // Setup
      const taskId = 'task-123'
      createTestTask(db, taskId, 'story')

      // Execute
      await AutomationService.onStatusInProgress(taskId, 'story')

      // Verify: Check database for automation_trigger event
      const activities = db
        .select()
        .from(schema.taskActivities)
        .where(eq(schema.taskActivities.task_id, taskId))
        .all()

      expect(activities).toHaveLength(1)
      expect(activities[0].event_type).toBe('automation_trigger')

      // Verify payload (Task 3.4)
      const payload = JSON.parse(activities[0].payload!)
      expect(payload).toEqual({
        command: 'dev-story',
        trigger: 'status-in-progress'
      })
    })

    it('does not log event for non-story tasks', async () => {
      // Setup
      const taskId = 'task-basic'
      createTestTask(db, taskId, 'basic')

      // Execute
      await AutomationService.onStatusInProgress(taskId, 'basic')

      // Verify: No event logged
      const activities = db
        .select()
        .from(schema.taskActivities)
        .where(eq(schema.taskActivities.task_id, taskId))
        .all()

      expect(activities).toHaveLength(0)
    })

    it('does not log event for planning tasks', async () => {
      // Setup
      const taskId = 'task-planning'
      createTestTask(db, taskId, 'planning')

      // Execute
      await AutomationService.onStatusInProgress(taskId, 'planning')

      // Verify: No event logged
      const activities = db
        .select()
        .from(schema.taskActivities)
        .where(eq(schema.taskActivities.task_id, taskId))
        .all()

      expect(activities).toHaveLength(0)
    })
  })

  describe('onAgentComplete', () => {
    it('logs automation_trigger event when code-review auto-triggered on dev-story completion (Task 3.3)', async () => {
      // Setup
      const taskId = 'task-456'
      createTestTask(db, taskId, 'story')

      // Execute
      await AutomationService.onAgentComplete(taskId, 'dev-story')

      // Verify: Check database for automation_trigger event
      const activities = db
        .select()
        .from(schema.taskActivities)
        .where(eq(schema.taskActivities.task_id, taskId))
        .all()

      expect(activities).toHaveLength(1)
      expect(activities[0].event_type).toBe('automation_trigger')

      // Verify payload (Task 3.4)
      const payload = JSON.parse(activities[0].payload!)
      expect(payload).toEqual({
        command: 'code-review',
        trigger: 'dev-story-complete'
      })
    })

    it('does not log event for non-dev-story phase completion', async () => {
      // Setup
      const taskId = 'task-789'
      createTestTask(db, taskId, 'story')

      // Execute - code-review phase completion should not trigger another code-review
      await AutomationService.onAgentComplete(taskId, 'code-review')

      // Verify: No event logged
      const activities = db
        .select()
        .from(schema.taskActivities)
        .where(eq(schema.taskActivities.task_id, taskId))
        .all()

      expect(activities).toHaveLength(0)
    })

    it('does not log event for manual phase completion', async () => {
      // Setup
      const taskId = 'task-manual'
      createTestTask(db, taskId, 'story')

      // Execute
      await AutomationService.onAgentComplete(taskId, 'manual')

      // Verify: No event logged
      const activities = db
        .select()
        .from(schema.taskActivities)
        .where(eq(schema.taskActivities.task_id, taskId))
        .all()

      expect(activities).toHaveLength(0)
    })
  })

  describe('Error handling (Task 3.5)', () => {
    it('continues automation even when activity logging fails for onStatusInProgress', async () => {
      // Setup: Mock ActivityLogService to throw
      const logActivitySpy = vi.spyOn(ActivityLogService, 'logActivity').mockRejectedValueOnce(new Error('DB error'))
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      // Execute - should not throw
      await expect(AutomationService.onStatusInProgress('task-error', 'story')).resolves.not.toThrow()

      // Verify: Warning was logged
      expect(consoleSpy).toHaveBeenCalledWith(
        '[AutomationService] Failed to log automation_trigger activity:',
        expect.any(Error)
      )

      consoleSpy.mockRestore()
      logActivitySpy.mockRestore()
    })

    it('continues automation even when activity logging fails for onAgentComplete', async () => {
      // Setup: Mock ActivityLogService to throw
      const logActivitySpy = vi.spyOn(ActivityLogService, 'logActivity').mockRejectedValueOnce(new Error('DB error'))
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      // Execute - should not throw
      await expect(AutomationService.onAgentComplete('task-error-2', 'dev-story')).resolves.not.toThrow()

      // Verify: Warning was logged
      expect(consoleSpy).toHaveBeenCalledWith(
        '[AutomationService] Failed to log automation_trigger activity:',
        expect.any(Error)
      )

      consoleSpy.mockRestore()
      logActivitySpy.mockRestore()
    })
  })

  describe('Payload validation (Task 3.4)', () => {
    it('dev-story trigger payload contains correct command and trigger values', async () => {
      // Setup
      const taskId = 'task-payload-1'
      createTestTask(db, taskId, 'story')

      // Execute
      await AutomationService.onStatusInProgress(taskId, 'story')

      // Verify payload structure
      const activities = db
        .select()
        .from(schema.taskActivities)
        .where(eq(schema.taskActivities.task_id, taskId))
        .all()

      const payload = JSON.parse(activities[0].payload!)
      expect(payload).toHaveProperty('command', 'dev-story')
      expect(payload).toHaveProperty('trigger', 'status-in-progress')
      expect(Object.keys(payload)).toHaveLength(2) // Only command and trigger
    })

    it('code-review trigger payload contains correct command and trigger values', async () => {
      // Setup
      const taskId = 'task-payload-2'
      createTestTask(db, taskId, 'story')

      // Execute
      await AutomationService.onAgentComplete(taskId, 'dev-story')

      // Verify payload structure
      const activities = db
        .select()
        .from(schema.taskActivities)
        .where(eq(schema.taskActivities.task_id, taskId))
        .all()

      const payload = JSON.parse(activities[0].payload!)
      expect(payload).toHaveProperty('command', 'code-review')
      expect(payload).toHaveProperty('trigger', 'dev-story-complete')
      expect(Object.keys(payload)).toHaveLength(2) // Only command and trigger
    })
  })
})

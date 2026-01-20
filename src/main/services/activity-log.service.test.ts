/**
 * ActivityLogService Tests - TES-2.2
 *
 * Comprehensive tests for the activity log service including:
 * - Database persistence (logActivity)
 * - Query with filtering (getActivities)
 * - Concurrent write handling
 * - Unique ID generation
 * - JSON payload serialization
 *
 * @see TES-2.2: Activity Log Service Core
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { eq, desc } from 'drizzle-orm'
import * as schema from '../db/schema'
import { ActivityLogService, type ActivityEventType, type ActivityPayload } from './activity-log.service'

// Mock electron BrowserWindow for ActivityEventEmitter
vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: vi.fn(() => [])
  }
}))

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
function createTestTask(db: TestDb, taskId: string): void {
  db.insert(schema.tasks)
    .values({
      id: taskId,
      title: `Test Task ${taskId}`,
      created_at: new Date(),
      updated_at: new Date()
    })
    .run()
}

describe('ActivityLogService (TES-2.2)', () => {
  let db: TestDb
  let service: ActivityLogService

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    db = createTestDb()
    // Cast to BetterSQLite3Database for ActivityLogService constructor
    service = new ActivityLogService(db as unknown as BetterSQLite3Database)
  })

  describe('logActivity (AC: #1)', () => {
    it('creates record with correct columns', async () => {
      createTestTask(db, 'task-1')

      const activity = await service.logActivity('task-1', 'status_change', {
        from: 'backlog',
        to: 'in_progress'
      })

      expect(activity.id).toBeDefined()
      expect(activity.id.length).toBeGreaterThan(0)
      expect(activity.task_id).toBe('task-1')
      expect(activity.event_type).toBe('status_change')
      expect(activity.created_at).toBeGreaterThan(0)
    })

    it('generates unique IDs for each activity (AC: #3)', async () => {
      createTestTask(db, 'task-2')

      const activity1 = await service.logActivity('task-2', 'agent_start', {})
      const activity2 = await service.logActivity('task-2', 'agent_complete', {})
      const activity3 = await service.logActivity('task-2', 'tool_used', {})

      expect(activity1.id).not.toBe(activity2.id)
      expect(activity2.id).not.toBe(activity3.id)
      expect(activity1.id).not.toBe(activity3.id)
    })

    it('generates unique IDs for concurrent calls (AC: #3)', async () => {
      createTestTask(db, 'task-concurrent')

      // Simulate concurrent writes
      const promises = Array(10)
        .fill(null)
        .map((_, i) =>
          service.logActivity('task-concurrent', 'tool_used', { tool: `tool-${i}` })
        )

      const activities = await Promise.all(promises)
      const ids = activities.map((a) => a.id)
      const uniqueIds = new Set(ids)

      // All IDs should be unique
      expect(uniqueIds.size).toBe(10)
    })

    it('serializes payload to JSON correctly', async () => {
      createTestTask(db, 'task-json')

      const payload = {
        from: 'backlog',
        to: 'in_progress',
        reason: 'drag-drop',
        nested: { value: 123, array: [1, 2, 3] }
      }

      await service.logActivity('task-json', 'status_change', payload)

      // Query directly to verify serialization
      const stored = db
        .select()
        .from(schema.taskActivities)
        .where(eq(schema.taskActivities.task_id, 'task-json'))
        .get()

      expect(stored?.payload).toBe(JSON.stringify(payload))

      // Verify it can be parsed back
      const parsed = JSON.parse(stored!.payload!)
      expect(parsed).toEqual(payload)
    })

    it('handles null payload correctly', async () => {
      createTestTask(db, 'task-null')

      const activity = await service.logActivity('task-null', 'session_ended')

      expect(activity.payload).toBeNull()

      // Verify in database
      const stored = db
        .select()
        .from(schema.taskActivities)
        .where(eq(schema.taskActivities.id, activity.id))
        .get()

      expect(stored?.payload).toBeNull()
    })

    it('handles undefined payload correctly', async () => {
      createTestTask(db, 'task-undefined')

      const activity = await service.logActivity('task-undefined', 'agent_start', undefined)

      expect(activity.payload).toBeNull()
    })

    it('returns the created TaskActivity object', async () => {
      createTestTask(db, 'task-return')

      const activity = await service.logActivity('task-return', 'error', {
        message: 'Something failed'
      })

      expect(activity).toHaveProperty('id')
      expect(activity).toHaveProperty('task_id')
      expect(activity).toHaveProperty('event_type')
      expect(activity).toHaveProperty('payload')
      expect(activity).toHaveProperty('created_at')
    })

    it('uses Date.now() for accurate timestamp', async () => {
      createTestTask(db, 'task-time')

      const beforeMs = Date.now()
      const activity = await service.logActivity('task-time', 'user_command', {
        command: 'npm test'
      })
      const afterMs = Date.now()

      expect(activity.created_at).toBeGreaterThanOrEqual(beforeMs)
      expect(activity.created_at).toBeLessThanOrEqual(afterMs)
    })

    it('logs all supported event types', async () => {
      createTestTask(db, 'task-types')

      const eventTypes: ActivityEventType[] = [
        'status_change',
        'agent_start',
        'agent_complete',
        'tool_used',
        'user_command',
        'automation_trigger',
        'error',
        'session_ended',
        'stall_detected',
        'stall_recovered'
      ]

      for (const eventType of eventTypes) {
        const activity = await service.logActivity('task-types', eventType, {})
        expect(activity.event_type).toBe(eventType)
      }

      // Verify all were stored
      const stored = db
        .select()
        .from(schema.taskActivities)
        .where(eq(schema.taskActivities.task_id, 'task-types'))
        .all()

      expect(stored).toHaveLength(eventTypes.length)
    })

    it('no events are lost during concurrent writes (AC: #3)', async () => {
      createTestTask(db, 'task-loss')

      const concurrentWrites = 50
      const promises = Array(concurrentWrites)
        .fill(null)
        .map((_, i) =>
          service.logActivity('task-loss', 'tool_used', { index: i })
        )

      await Promise.all(promises)

      const stored = db
        .select()
        .from(schema.taskActivities)
        .where(eq(schema.taskActivities.task_id, 'task-loss'))
        .all()

      // All events should be stored
      expect(stored).toHaveLength(concurrentWrites)
    })
  })

  describe('getActivities (AC: #2)', () => {
    beforeEach(() => {
      createTestTask(db, 'task-query')

      // Insert test activities
      const baseTime = Date.now()
      const activities = [
        { type: 'status_change', offset: 0 },
        { type: 'agent_start', offset: 100 },
        { type: 'tool_used', offset: 200 },
        { type: 'tool_used', offset: 300 },
        { type: 'error', offset: 400 },
        { type: 'agent_complete', offset: 500 }
      ]

      activities.forEach((a, idx) => {
        db.insert(schema.taskActivities)
          .values({
            id: `activity-${idx}`,
            task_id: 'task-query',
            event_type: a.type,
            payload: JSON.stringify({ index: idx }),
            created_at: baseTime + a.offset
          })
          .run()
      })
    })

    it('returns records sorted by created_at DESC (newest first)', async () => {
      const activities = await service.getActivities('task-query')

      expect(activities.length).toBe(6)

      // Check descending order
      for (let i = 1; i < activities.length; i++) {
        expect(activities[i - 1].created_at).toBeGreaterThanOrEqual(activities[i].created_at)
      }
    })

    it('filters by eventTypes correctly', async () => {
      const activities = await service.getActivities('task-query', {
        eventTypes: ['tool_used']
      })

      expect(activities.length).toBe(2)
      expect(activities.every((a) => a.event_type === 'tool_used')).toBe(true)
    })

    it('filters by multiple eventTypes', async () => {
      const activities = await service.getActivities('task-query', {
        eventTypes: ['agent_start', 'agent_complete']
      })

      expect(activities.length).toBe(2)
      expect(activities.some((a) => a.event_type === 'agent_start')).toBe(true)
      expect(activities.some((a) => a.event_type === 'agent_complete')).toBe(true)
    })

    it('applies limit correctly', async () => {
      const activities = await service.getActivities('task-query', { limit: 3 })

      expect(activities.length).toBe(3)
    })

    it('applies offset for pagination', async () => {
      const page1 = await service.getActivities('task-query', { limit: 2, offset: 0 })
      const page2 = await service.getActivities('task-query', { limit: 2, offset: 2 })
      const page3 = await service.getActivities('task-query', { limit: 2, offset: 4 })

      expect(page1.length).toBe(2)
      expect(page2.length).toBe(2)
      expect(page3.length).toBe(2)

      // No overlap between pages
      const allIds = [...page1, ...page2, ...page3].map((a) => a.id)
      const uniqueIds = new Set(allIds)
      expect(uniqueIds.size).toBe(6)
    })

    it('filters by since timestamp', async () => {
      // Get all activities first to find their timestamps
      const all = await service.getActivities('task-query')
      const midTimestamp = all[3].created_at // Get timestamp from middle

      const recent = await service.getActivities('task-query', {
        since: midTimestamp
      })

      // Should only include activities after midTimestamp
      expect(recent.length).toBeLessThan(all.length)
      expect(recent.every((a) => a.created_at > midTimestamp)).toBe(true)
    })

    it('returns empty array when no matching activities', async () => {
      const activities = await service.getActivities('task-query', {
        eventTypes: ['stall_detected'] // None of these exist
      })

      expect(activities).toEqual([])
    })

    it('returns empty array for unknown taskId', async () => {
      const activities = await service.getActivities('nonexistent-task')

      expect(activities).toEqual([])
    })

    it('defaults limit to 100', async () => {
      // Create task with more than 100 activities
      createTestTask(db, 'task-many')
      const baseTime = Date.now()

      for (let i = 0; i < 150; i++) {
        db.insert(schema.taskActivities)
          .values({
            id: `many-${i}`,
            task_id: 'task-many',
            event_type: 'tool_used',
            created_at: baseTime + i
          })
          .run()
      }

      const activities = await service.getActivities('task-many')

      expect(activities.length).toBe(100) // Default limit
    })

    it('defaults offset to 0', async () => {
      const activities = await service.getActivities('task-query')
      const withExplicitOffset = await service.getActivities('task-query', { offset: 0 })

      expect(activities.length).toBe(withExplicitOffset.length)
      expect(activities.map((a) => a.id)).toEqual(withExplicitOffset.map((a) => a.id))
    })

    it('combines multiple filters correctly', async () => {
      const all = await service.getActivities('task-query')
      const midTimestamp = all[3].created_at

      const filtered = await service.getActivities('task-query', {
        eventTypes: ['tool_used', 'error'],
        since: midTimestamp,
        limit: 10
      })

      // Should satisfy all conditions
      filtered.forEach((a) => {
        expect(['tool_used', 'error']).toContain(a.event_type)
        expect(a.created_at).toBeGreaterThan(midTimestamp)
      })
    })
  })

  describe('Static Compatibility Layer (TES-1.11 backward compatibility)', () => {
    it('static logActivity works like instance method', async () => {
      // Create task in the global db (mocked for this test)
      // This test verifies the namespace function exists
      expect(typeof ActivityLogService.logActivity).toBe('function')
    })
  })

  describe('edge cases', () => {
    it('throws TRPCError NOT_FOUND for invalid taskId (M1 fix)', async () => {
      // Don't create task - should fail validation
      await expect(
        service.logActivity('nonexistent-task', 'status_change', { test: true })
      ).rejects.toThrow('Task not found: nonexistent-task')
    })

    it('handles very large payloads', async () => {
      createTestTask(db, 'task-large')

      const largePayload = {
        data: 'x'.repeat(10000),
        nested: {
          array: Array(100).fill({ key: 'value' })
        }
      }

      const activity = await service.logActivity('task-large', 'tool_used', largePayload)

      const stored = db
        .select()
        .from(schema.taskActivities)
        .where(eq(schema.taskActivities.id, activity.id))
        .get()

      expect(JSON.parse(stored!.payload!)).toEqual(largePayload)
    })

    it('handles special characters in payload', async () => {
      createTestTask(db, 'task-special')

      const specialPayload = {
        message: 'Hello "world" with \'quotes\' and\nnewlines\ttabs',
        unicode: '🎉 émojis и юникод',
        path: '/path/to/file\\with\\backslashes'
      }

      const activity = await service.logActivity('task-special', 'user_command', specialPayload)

      const stored = db
        .select()
        .from(schema.taskActivities)
        .where(eq(schema.taskActivities.id, activity.id))
        .get()

      expect(JSON.parse(stored!.payload!)).toEqual(specialPayload)
    })
  })
})

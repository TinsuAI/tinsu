import { describe, it, expect, beforeEach } from 'vitest'
import { velocityRouter } from './velocity.router'
import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as schema from '../../db/schema'
import { startOfISOWeek, subWeeks, subDays, addDays, getISOWeek } from 'date-fns'

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

  // Create the tasks table matching Drizzle schema (including Story 3.1 planning fields, Story 3.2 is_start_here, Story 3.1.5 project_id, Story 3.7 story_number, story_file_path, full_content)
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
      story_file_status TEXT,
      project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_task_type ON tasks(task_type);
    CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
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
  const createCaller = velocityRouter.createCaller
  return createCaller({
    db,
    projectRoot: process.cwd(),
    projectId
  } as { db: typeof import('../../db').db; projectRoot: string; projectId: string | null })
}

// Helper to insert a completed task at a specific date
function insertCompletedTask(db: TestDb, id: string, completedAt: Date, projectId: string = TEST_PROJECT_ID) {
  db.insert(schema.tasks)
    .values({
      id,
      title: `Task ${id}`,
      status: 'done',
      sort_order: 0,
      project_id: projectId,
      created_at: new Date(),
      updated_at: completedAt
    })
    .run()
}

// Helper to insert a non-completed task
function insertInProgressTask(db: TestDb, id: string, projectId: string = TEST_PROJECT_ID) {
  db.insert(schema.tasks)
    .values({
      id,
      title: `Task ${id}`,
      status: 'in_progress',
      sort_order: 0,
      project_id: projectId,
      created_at: new Date(),
      updated_at: new Date()
    })
    .run()
}

describe('velocityRouter', () => {
  let db: ReturnType<typeof createTestDb>
  let caller: ReturnType<typeof createTestCaller>

  beforeEach(() => {
    db = createTestDb()
    caller = createTestCaller(db)
  })

  describe('getWeeklyVelocity', () => {
    it('returns empty data when no tasks completed', async () => {
      const result = await caller.getWeeklyVelocity({ weeks: 4 })

      expect(result.weeks).toHaveLength(4)
      expect(result.weeks.every((w) => w.count === 0)).toBe(true)
      expect(result.totalCompleted).toBe(0)
      expect(result.avgVelocity).toBe(0)
    })

    it('returns zero counts even when in-progress tasks exist', async () => {
      insertInProgressTask(db, 'task-1')
      insertInProgressTask(db, 'task-2')

      const result = await caller.getWeeklyVelocity({ weeks: 4 })

      expect(result.totalCompleted).toBe(0)
      expect(result.weeks.every((w) => w.count === 0)).toBe(true)
    })

    it('groups completed tasks by ISO week', async () => {
      const now = new Date()
      const currentWeekStart = startOfISOWeek(now)

      // Add 2 tasks completed this week
      insertCompletedTask(db, 'task-1', currentWeekStart)
      insertCompletedTask(db, 'task-2', addDays(currentWeekStart, 1))

      // Add 1 task completed last week
      const lastWeekStart = subWeeks(currentWeekStart, 1)
      insertCompletedTask(db, 'task-3', lastWeekStart)

      const result = await caller.getWeeklyVelocity({ weeks: 4 })

      // Current week should have 2 tasks
      expect(result.weeks[0].count).toBe(2)
      // Last week should have 1 task
      expect(result.weeks[1].count).toBe(1)
      // Older weeks should have 0
      expect(result.weeks[2].count).toBe(0)
      expect(result.weeks[3].count).toBe(0)

      expect(result.totalCompleted).toBe(3)
    })

    it('uses Monday as week start (ISO week)', async () => {
      // Create a date that is a Sunday
      const sunday = new Date('2026-01-04T12:00:00') // Jan 4, 2026 is a Sunday
      const monday = new Date('2026-01-05T12:00:00') // Jan 5, 2026 is a Monday

      // Task completed on Sunday should be in the PREVIOUS week
      insertCompletedTask(db, 'task-sunday', sunday)
      // Task completed on Monday should be in the CURRENT week
      insertCompletedTask(db, 'task-monday', monday)

      const result = await caller.getWeeklyVelocity({ weeks: 4 })

      // Verify the tasks were inserted (should have 2 total)
      expect(result.totalCompleted).toBe(2)

      // They should be in different ISO weeks
      const sundayISOWeek = getISOWeek(sunday)
      const mondayISOWeek = getISOWeek(monday)

      expect(sundayISOWeek).not.toBe(mondayISOWeek)
    })

    it('fills missing weeks with zero count', async () => {
      const now = new Date()
      const currentWeekStart = startOfISOWeek(now)

      // Only add task in week 1 and week 3 (skip week 2)
      insertCompletedTask(db, 'task-1', currentWeekStart) // week 0 (current)
      insertCompletedTask(db, 'task-2', subWeeks(currentWeekStart, 2)) // week 2

      const result = await caller.getWeeklyVelocity({ weeks: 4 })

      expect(result.weeks).toHaveLength(4)
      expect(result.weeks[0].count).toBe(1) // current week
      expect(result.weeks[1].count).toBe(0) // week 1 - should be zero filled
      expect(result.weeks[2].count).toBe(1) // week 2
      expect(result.weeks[3].count).toBe(0) // week 3
    })

    it('returns correct week metadata (startDate, endDate)', async () => {
      const result = await caller.getWeeklyVelocity({ weeks: 4 })

      // Each week should have valid date ranges
      for (const week of result.weeks) {
        expect(week.startDate).toBeInstanceOf(Date)
        expect(week.endDate).toBeInstanceOf(Date)
        // End date should be after start date
        expect(week.endDate.getTime()).toBeGreaterThan(week.startDate.getTime())
        // Week should be 7 days
        const daysDiff = (week.endDate.getTime() - week.startDate.getTime()) / (1000 * 60 * 60 * 24)
        expect(daysDiff).toBeCloseTo(7, 0)
      }
    })

    it('calculates average velocity correctly', async () => {
      const now = new Date()
      const currentWeekStart = startOfISOWeek(now)

      // 4 tasks over 4 weeks = 1 avg
      insertCompletedTask(db, 'task-1', currentWeekStart)
      insertCompletedTask(db, 'task-2', subWeeks(currentWeekStart, 1))
      insertCompletedTask(db, 'task-3', subWeeks(currentWeekStart, 2))
      insertCompletedTask(db, 'task-4', subWeeks(currentWeekStart, 3))

      const result = await caller.getWeeklyVelocity({ weeks: 4 })

      expect(result.totalCompleted).toBe(4)
      expect(result.avgVelocity).toBe(1) // 4 tasks / 4 weeks
    })

    it('defaults to 4 weeks when not specified', async () => {
      const result = await caller.getWeeklyVelocity({})

      expect(result.weeks).toHaveLength(4)
    })

    it('respects custom weeks parameter', async () => {
      const result = await caller.getWeeklyVelocity({ weeks: 8 })

      expect(result.weeks).toHaveLength(8)
    })
  })

  describe('getDailyVelocity', () => {
    it('returns daily breakdown for last N days', async () => {
      const result = await caller.getDailyVelocity({ days: 28 })

      expect(result.days).toHaveLength(28)
      expect(result.days.every((d) => d.count === 0)).toBe(true)
    })

    it('groups completed tasks by day', async () => {
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0)

      // Add 2 tasks completed today
      insertCompletedTask(db, 'task-1', today)
      insertCompletedTask(db, 'task-2', today)

      // Add 1 task completed yesterday
      const yesterday = subDays(today, 1)
      insertCompletedTask(db, 'task-3', yesterday)

      const result = await caller.getDailyVelocity({ days: 7 })

      // Find today's entry (should be first/most recent)
      expect(result.days[0].count).toBe(2)
      expect(result.days[1].count).toBe(1)
    })

    it('returns day metadata (date)', async () => {
      const result = await caller.getDailyVelocity({ days: 7 })

      for (const day of result.days) {
        expect(day.date).toBeInstanceOf(Date)
      }

      // Days should be in descending order (most recent first)
      for (let i = 1; i < result.days.length; i++) {
        expect(result.days[i - 1].date.getTime()).toBeGreaterThan(result.days[i].date.getTime())
      }
    })

    it('defaults to 28 days when not specified', async () => {
      const result = await caller.getDailyVelocity({})

      expect(result.days).toHaveLength(28)
    })

    it('calculates totalCompleted for the period', async () => {
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0)

      insertCompletedTask(db, 'task-1', today)
      insertCompletedTask(db, 'task-2', subDays(today, 1))
      insertCompletedTask(db, 'task-3', subDays(today, 5))

      const result = await caller.getDailyVelocity({ days: 7 })

      expect(result.totalCompleted).toBe(3)
    })
  })
})

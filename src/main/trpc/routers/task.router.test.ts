import { describe, it, expect, beforeEach } from 'vitest'
import { taskRouter } from './task.router'
import { TRPCError } from '@trpc/server'
import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as schema from '../../db/schema'

type TestDb = BetterSQLite3Database<typeof schema>

// Create an in-memory SQLite database for testing
function createTestDb(): TestDb {
  const sqlite = new Database(':memory:')

  // Create the tasks table matching Drizzle schema (including Story 3.1 planning fields, Story 3.2 is_start_here)
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
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_epic_id ON tasks(epic_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_sprint_id ON tasks(sprint_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_sort_order ON tasks(sort_order);
    CREATE INDEX IF NOT EXISTS idx_tasks_task_type ON tasks(task_type);
  `)

  return drizzle({ client: sqlite, schema })
}

// Helper to create a test caller
function createTestCaller(db: TestDb) {
  const createCaller = taskRouter.createCaller
  return createCaller({
    db,
    projectRoot: process.cwd()
  } as { db: typeof import('../../db').db; projectRoot: string })
}

describe('taskRouter', () => {
  let db: ReturnType<typeof createTestDb>
  let caller: ReturnType<typeof createTestCaller>

  beforeEach(() => {
    db = createTestDb()
    caller = createTestCaller(db)
  })

  describe('getAll', () => {
    it('should return empty array when no tasks exist', async () => {
      const result = await caller.getAll()
      expect(result).toEqual([])
    })

    it('should return all tasks', async () => {
      // Insert test tasks directly
      db.insert(schema.tasks)
        .values({
          id: 'task-1',
          title: 'Test Task 1',
          status: 'backlog',
          created_at: new Date(),
          updated_at: new Date()
        })
        .run()
      db.insert(schema.tasks)
        .values({
          id: 'task-2',
          title: 'Test Task 2',
          status: 'in_progress',
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
          created_at: new Date(),
          updated_at: new Date()
        })
        .run()

      await expect(
        caller.updateStatus({ id: 'task-1', status: 'invalid' as any })
      ).rejects.toThrow()
    })
  })

  describe('delete', () => {
    it('should delete task and return deleted task', async () => {
      db.insert(schema.tasks)
        .values({
          id: 'task-1',
          title: 'Test Task',
          status: 'backlog',
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
          { id: 'task-1', title: 'Task 1', status: 'backlog', sort_order: 0, created_at: new Date(), updated_at: new Date() },
          { id: 'task-2', title: 'Task 2', status: 'backlog', sort_order: 1, created_at: new Date(), updated_at: new Date() },
          { id: 'task-3', title: 'Task 3', status: 'backlog', sort_order: 2, created_at: new Date(), updated_at: new Date() }
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
          { id: 'task-1', title: 'Task 1', status: 'backlog', sort_order: 0, created_at: new Date(), updated_at: new Date() },
          { id: 'task-2', title: 'Task 2', status: 'in_progress', sort_order: 0, created_at: new Date(), updated_at: new Date() }
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
          { id: 'story-1', title: 'Story Task', task_type: 'story', status: 'backlog', created_at: new Date(), updated_at: new Date() },
          { id: 'planning-1', title: 'Product Brief', task_type: 'planning', phase_number: 1, status: 'backlog', created_at: new Date(), updated_at: new Date() },
          { id: 'planning-2', title: 'PRD', task_type: 'planning', phase_number: 2, status: 'backlog', created_at: new Date(), updated_at: new Date() }
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
          { id: 'planning-3', title: 'Architecture', task_type: 'planning', phase_number: 3, status: 'backlog', created_at: new Date(), updated_at: new Date() },
          { id: 'planning-1', title: 'Product Brief', task_type: 'planning', phase_number: 1, status: 'backlog', created_at: new Date(), updated_at: new Date() },
          { id: 'planning-5', title: 'Epics', task_type: 'planning', phase_number: 5, status: 'backlog', created_at: new Date(), updated_at: new Date() },
          { id: 'planning-2', title: 'PRD', task_type: 'planning', phase_number: 2, status: 'backlog', created_at: new Date(), updated_at: new Date() },
          { id: 'planning-4', title: 'UX Design', task_type: 'planning', phase_number: 4, status: 'backlog', created_at: new Date(), updated_at: new Date() }
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
          { id: 'planning-1', title: 'Product Brief', task_type: 'planning', phase_number: 1, is_start_here: true, status: 'backlog', created_at: new Date(), updated_at: new Date() },
          { id: 'planning-2', title: 'PRD', task_type: 'planning', phase_number: 2, is_start_here: null, status: 'backlog', created_at: new Date(), updated_at: new Date() }
        ])
        .run()

      const result = await caller.getPlanningTasks()

      expect(result[0].is_start_here).toBe(true)
      expect(result[1].is_start_here).toBeNull()
    })
  })
})

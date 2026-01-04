import { describe, it, expect, beforeEach } from 'vitest';
import { taskRouter } from './task.router';
import { TRPCError } from '@trpc/server';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../../db/schema';

type TestDb = BetterSQLite3Database<typeof schema>;

// Create an in-memory SQLite database for testing
function createTestDb(): TestDb {
  const sqlite = new Database(':memory:');

  // Create the tasks table matching Drizzle schema
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'backlog',
      epic_id TEXT,
      sprint_id TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_epic_id ON tasks(epic_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_sprint_id ON tasks(sprint_id);
  `);

  return drizzle({ client: sqlite, schema });
}

// Helper to create a test caller
function createTestCaller(db: TestDb) {
  const createCaller = taskRouter.createCaller;
  return createCaller({ db } as { db: typeof import('../../db').db });
}

describe('taskRouter', () => {
  let db: ReturnType<typeof createTestDb>;
  let caller: ReturnType<typeof createTestCaller>;

  beforeEach(() => {
    db = createTestDb();
    caller = createTestCaller(db);
  });

  describe('getAll', () => {
    it('should return empty array when no tasks exist', async () => {
      const result = await caller.getAll();
      expect(result).toEqual([]);
    });

    it('should return all tasks', async () => {
      // Insert test tasks directly
      db.insert(schema.tasks).values({
        id: 'task-1',
        title: 'Test Task 1',
        status: 'backlog',
        created_at: new Date(),
        updated_at: new Date(),
      }).run();
      db.insert(schema.tasks).values({
        id: 'task-2',
        title: 'Test Task 2',
        status: 'in_progress',
        created_at: new Date(),
        updated_at: new Date(),
      }).run();

      const result = await caller.getAll();
      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Test Task 1');
      expect(result[1].title).toBe('Test Task 2');
    });
  });

  describe('getById', () => {
    it('should return task when found', async () => {
      db.insert(schema.tasks).values({
        id: 'task-1',
        title: 'Test Task',
        status: 'backlog',
        created_at: new Date(),
        updated_at: new Date(),
      }).run();

      const result = await caller.getById({ id: 'task-1' });
      expect(result.id).toBe('task-1');
      expect(result.title).toBe('Test Task');
    });

    it('should throw NOT_FOUND when task does not exist', async () => {
      await expect(caller.getById({ id: 'nonexistent' }))
        .rejects.toThrow(TRPCError);

      try {
        await caller.getById({ id: 'nonexistent' });
      } catch (error) {
        expect((error as TRPCError).code).toBe('NOT_FOUND');
      }
    });
  });

  describe('create', () => {
    it('should create a task with required fields', async () => {
      const result = await caller.create({ title: 'New Task' });

      expect(result.id).toBeDefined();
      expect(result.title).toBe('New Task');
      expect(result.status).toBe('backlog');
      expect(result.description).toBeNull();
    });

    it('should create a task with all fields', async () => {
      const result = await caller.create({
        title: 'Full Task',
        description: 'A description',
        status: 'in_progress',
        epic_id: 'epic-1',
        sprint_id: 'sprint-1',
      });

      expect(result.title).toBe('Full Task');
      expect(result.description).toBe('A description');
      expect(result.status).toBe('in_progress');
      expect(result.epic_id).toBe('epic-1');
      expect(result.sprint_id).toBe('sprint-1');
    });

    it('should reject empty title', async () => {
      await expect(caller.create({ title: '' }))
        .rejects.toThrow();
    });
  });

  describe('updateStatus', () => {
    it('should update task status', async () => {
      db.insert(schema.tasks).values({
        id: 'task-1',
        title: 'Test Task',
        status: 'backlog',
        created_at: new Date(),
        updated_at: new Date(),
      }).run();

      const result = await caller.updateStatus({ id: 'task-1', status: 'done' });
      expect(result.status).toBe('done');
    });

    it('should throw NOT_FOUND when task does not exist', async () => {
      await expect(caller.updateStatus({ id: 'nonexistent', status: 'done' }))
        .rejects.toThrow(TRPCError);

      try {
        await caller.updateStatus({ id: 'nonexistent', status: 'done' });
      } catch (error) {
        expect((error as TRPCError).code).toBe('NOT_FOUND');
      }
    });

    it('should reject invalid status', async () => {
      db.insert(schema.tasks).values({
        id: 'task-1',
        title: 'Test Task',
        status: 'backlog',
        created_at: new Date(),
        updated_at: new Date(),
      }).run();

      await expect(caller.updateStatus({ id: 'task-1', status: 'invalid' as any }))
        .rejects.toThrow();
    });
  });

  describe('delete', () => {
    it('should delete task and return deleted task', async () => {
      db.insert(schema.tasks).values({
        id: 'task-1',
        title: 'Test Task',
        status: 'backlog',
        created_at: new Date(),
        updated_at: new Date(),
      }).run();

      const result = await caller.delete({ id: 'task-1' });
      expect(result.id).toBe('task-1');

      // Verify task is deleted
      const tasks = await caller.getAll();
      expect(tasks).toHaveLength(0);
    });

    it('should throw NOT_FOUND when task does not exist', async () => {
      await expect(caller.delete({ id: 'nonexistent' }))
        .rejects.toThrow(TRPCError);

      try {
        await caller.delete({ id: 'nonexistent' });
      } catch (error) {
        expect((error as TRPCError).code).toBe('NOT_FOUND');
      }
    });
  });
});

import { describe, it, expect, beforeEach } from 'vitest'
import { epicRouter } from './epic.router'
import { TRPCError } from '@trpc/server'
import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as schema from '../../db/schema'

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

  // Create the epics table matching Drizzle schema (Story 3.1.5 project_id)
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS epics (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      color TEXT NOT NULL DEFAULT 'blue',
      project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_epics_project_id ON epics(project_id);
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
  const createCaller = epicRouter.createCaller
  return createCaller({
    db,
    projectRoot: process.cwd(),
    projectId
  } as { db: typeof import('../../db').db; projectRoot: string; projectId: string | null })
}

describe('epicRouter', () => {
  let db: ReturnType<typeof createTestDb>
  let caller: ReturnType<typeof createTestCaller>

  beforeEach(() => {
    db = createTestDb()
    caller = createTestCaller(db)
  })

  describe('getAll', () => {
    it('should return empty array when no epics exist', async () => {
      const result = await caller.getAll()
      expect(result).toEqual([])
    })

    it('should return all epics for current project', async () => {
      db.insert(schema.epics)
        .values([
          { id: 'epic-1', title: 'Epic 1', color: 'blue', project_id: TEST_PROJECT_ID, created_at: new Date() },
          { id: 'epic-2', title: 'Epic 2', color: 'green', project_id: TEST_PROJECT_ID, created_at: new Date() }
        ])
        .run()

      const result = await caller.getAll()
      expect(result).toHaveLength(2)
    })

    it('should return epics ordered by title', async () => {
      db.insert(schema.epics)
        .values([
          { id: 'epic-2', title: 'Zebra Epic', color: 'blue', project_id: TEST_PROJECT_ID, created_at: new Date() },
          { id: 'epic-1', title: 'Alpha Epic', color: 'green', project_id: TEST_PROJECT_ID, created_at: new Date() }
        ])
        .run()

      const result = await caller.getAll()
      expect(result[0].title).toBe('Alpha Epic')
      expect(result[1].title).toBe('Zebra Epic')
    })
  })

  describe('getById', () => {
    it('should return epic when found', async () => {
      db.insert(schema.epics)
        .values({
          id: 'epic-1',
          title: 'Test Epic',
          color: 'blue',
          project_id: TEST_PROJECT_ID,
          created_at: new Date()
        })
        .run()

      const result = await caller.getById({ id: 'epic-1' })
      expect(result.id).toBe('epic-1')
      expect(result.title).toBe('Test Epic')
    })

    it('should throw NOT_FOUND when epic does not exist', async () => {
      await expect(caller.getById({ id: 'nonexistent' })).rejects.toThrow(TRPCError)

      try {
        await caller.getById({ id: 'nonexistent' })
      } catch (error) {
        expect((error as TRPCError).code).toBe('NOT_FOUND')
      }
    })

    it('should throw NOT_FOUND when epic belongs to different project', async () => {
      // Create another project
      db.insert(schema.projects)
        .values({
          id: 'other-project',
          path: '/other/project',
          name: 'Other Project'
        })
        .run()

      // Create epic in other project
      db.insert(schema.epics)
        .values({
          id: 'epic-other',
          title: 'Other Epic',
          color: 'blue',
          project_id: 'other-project',
          created_at: new Date()
        })
        .run()

      await expect(caller.getById({ id: 'epic-other' })).rejects.toThrow(TRPCError)

      try {
        await caller.getById({ id: 'epic-other' })
      } catch (error) {
        expect((error as TRPCError).code).toBe('NOT_FOUND')
      }
    })
  })

  describe('create', () => {
    it('should create an epic with required fields', async () => {
      const result = await caller.create({ title: 'New Epic' })

      expect(result.id).toBeDefined()
      expect(result.title).toBe('New Epic')
      expect(result.color).toBe('blue')
      expect(result.project_id).toBe(TEST_PROJECT_ID)
    })

    it('should create an epic with all fields', async () => {
      const result = await caller.create({
        title: 'Full Epic',
        description: 'A description',
        color: 'green'
      })

      expect(result.title).toBe('Full Epic')
      expect(result.description).toBe('A description')
      expect(result.color).toBe('green')
      expect(result.project_id).toBe(TEST_PROJECT_ID)
    })

    it('should reject empty title', async () => {
      await expect(caller.create({ title: '' })).rejects.toThrow()
    })

    it('should throw PRECONDITION_FAILED when no project open', async () => {
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

  describe('update', () => {
    it('should update epic fields', async () => {
      db.insert(schema.epics)
        .values({
          id: 'epic-1',
          title: 'Original',
          color: 'blue',
          project_id: TEST_PROJECT_ID,
          created_at: new Date()
        })
        .run()

      const result = await caller.update({ id: 'epic-1', title: 'Updated', color: 'red' })
      expect(result.title).toBe('Updated')
      expect(result.color).toBe('red')
    })

    it('should throw NOT_FOUND when epic does not exist', async () => {
      await expect(caller.update({ id: 'nonexistent', title: 'Test' })).rejects.toThrow(TRPCError)

      try {
        await caller.update({ id: 'nonexistent', title: 'Test' })
      } catch (error) {
        expect((error as TRPCError).code).toBe('NOT_FOUND')
      }
    })
  })

  describe('delete', () => {
    it('should delete epic and return deleted epic', async () => {
      db.insert(schema.epics)
        .values({
          id: 'epic-1',
          title: 'Test Epic',
          color: 'blue',
          project_id: TEST_PROJECT_ID,
          created_at: new Date()
        })
        .run()

      const result = await caller.delete({ id: 'epic-1' })
      expect(result.id).toBe('epic-1')

      const epics = await caller.getAll()
      expect(epics).toHaveLength(0)
    })

    it('should throw NOT_FOUND when epic does not exist', async () => {
      await expect(caller.delete({ id: 'nonexistent' })).rejects.toThrow(TRPCError)

      try {
        await caller.delete({ id: 'nonexistent' })
      } catch (error) {
        expect((error as TRPCError).code).toBe('NOT_FOUND')
      }
    })
  })

  // Story 3.1.5: Project isolation tests
  describe('project isolation', () => {
    it('should only return epics from current project', async () => {
      // Create another project
      db.insert(schema.projects)
        .values({
          id: 'other-project',
          path: '/other/project',
          name: 'Other Project'
        })
        .run()

      // Create epics in both projects
      db.insert(schema.epics)
        .values([
          { id: 'epic-1', title: 'Epic 1', color: 'blue', project_id: TEST_PROJECT_ID, created_at: new Date() },
          { id: 'epic-2', title: 'Epic 2', color: 'green', project_id: 'other-project', created_at: new Date() }
        ])
        .run()

      const result = await caller.getAll()
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('epic-1')
    })

    it('should return empty array when no project is open', async () => {
      db.insert(schema.epics)
        .values({
          id: 'epic-1',
          title: 'Test Epic',
          color: 'blue',
          project_id: TEST_PROJECT_ID,
          created_at: new Date()
        })
        .run()

      const noProjectCaller = createTestCaller(db, null)
      const result = await noProjectCaller.getAll()
      expect(result).toEqual([])
    })

    it('should set project_id when creating epic', async () => {
      const result = await caller.create({ title: 'New Epic' })
      expect(result.project_id).toBe(TEST_PROJECT_ID)
    })
  })
})

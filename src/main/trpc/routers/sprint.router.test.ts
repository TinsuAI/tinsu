import { describe, it, expect, beforeEach } from 'vitest'
import { sprintRouter } from './sprint.router'
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

  // Create the sprints table matching Drizzle schema (Story 3.1.5 project_id)
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS sprints (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      start_date INTEGER,
      end_date INTEGER,
      is_active INTEGER NOT NULL DEFAULT 0,
      project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_sprints_project_id ON sprints(project_id);
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
  const createCaller = sprintRouter.createCaller
  return createCaller({
    db,
    projectRoot: process.cwd(),
    projectId
  } as { db: typeof import('../../db').db; projectRoot: string; projectId: string | null })
}

describe('sprintRouter', () => {
  let db: ReturnType<typeof createTestDb>
  let caller: ReturnType<typeof createTestCaller>

  beforeEach(() => {
    db = createTestDb()
    caller = createTestCaller(db)
  })

  describe('getAll', () => {
    it('should return empty array when no sprints exist', async () => {
      const result = await caller.getAll()
      expect(result).toEqual([])
    })

    it('should return all sprints for current project', async () => {
      const now = new Date()
      db.insert(schema.sprints)
        .values([
          { id: 'sprint-1', name: 'Sprint 1', project_id: TEST_PROJECT_ID, created_at: now },
          { id: 'sprint-2', name: 'Sprint 2', project_id: TEST_PROJECT_ID, created_at: now }
        ])
        .run()

      const result = await caller.getAll()
      expect(result).toHaveLength(2)
    })

    it('should return sprints ordered by start_date descending', async () => {
      const now = new Date()
      const earlier = new Date(now.getTime() - 86400000) // 1 day earlier
      db.insert(schema.sprints)
        .values([
          { id: 'sprint-1', name: 'Earlier Sprint', start_date: earlier, project_id: TEST_PROJECT_ID, created_at: now },
          { id: 'sprint-2', name: 'Later Sprint', start_date: now, project_id: TEST_PROJECT_ID, created_at: now }
        ])
        .run()

      const result = await caller.getAll()
      expect(result[0].name).toBe('Later Sprint')
      expect(result[1].name).toBe('Earlier Sprint')
    })
  })

  describe('getActive', () => {
    it('should return null when no active sprint', async () => {
      const result = await caller.getActive()
      expect(result).toBeNull()
    })

    it('should return active sprint for current project', async () => {
      const now = new Date()
      db.insert(schema.sprints)
        .values([
          { id: 'sprint-1', name: 'Inactive', is_active: false, project_id: TEST_PROJECT_ID, created_at: now },
          { id: 'sprint-2', name: 'Active', is_active: true, project_id: TEST_PROJECT_ID, created_at: now }
        ])
        .run()

      const result = await caller.getActive()
      expect(result).not.toBeNull()
      expect(result!.name).toBe('Active')
    })

    it('should not return active sprint from other project', async () => {
      // Create another project
      db.insert(schema.projects)
        .values({
          id: 'other-project',
          path: '/other/project',
          name: 'Other Project'
        })
        .run()

      const now = new Date()
      db.insert(schema.sprints)
        .values({
          id: 'sprint-other',
          name: 'Other Active',
          is_active: true,
          project_id: 'other-project',
          created_at: now
        })
        .run()

      const result = await caller.getActive()
      expect(result).toBeNull()
    })
  })

  describe('getById', () => {
    it('should return sprint when found', async () => {
      db.insert(schema.sprints)
        .values({
          id: 'sprint-1',
          name: 'Test Sprint',
          project_id: TEST_PROJECT_ID,
          created_at: new Date()
        })
        .run()

      const result = await caller.getById({ id: 'sprint-1' })
      expect(result.id).toBe('sprint-1')
      expect(result.name).toBe('Test Sprint')
    })

    it('should throw NOT_FOUND when sprint does not exist', async () => {
      await expect(caller.getById({ id: 'nonexistent' })).rejects.toThrow(TRPCError)

      try {
        await caller.getById({ id: 'nonexistent' })
      } catch (error) {
        expect((error as TRPCError).code).toBe('NOT_FOUND')
      }
    })

    it('should throw NOT_FOUND when sprint belongs to different project', async () => {
      // Create another project
      db.insert(schema.projects)
        .values({
          id: 'other-project',
          path: '/other/project',
          name: 'Other Project'
        })
        .run()

      // Create sprint in other project
      db.insert(schema.sprints)
        .values({
          id: 'sprint-other',
          name: 'Other Sprint',
          project_id: 'other-project',
          created_at: new Date()
        })
        .run()

      await expect(caller.getById({ id: 'sprint-other' })).rejects.toThrow(TRPCError)

      try {
        await caller.getById({ id: 'sprint-other' })
      } catch (error) {
        expect((error as TRPCError).code).toBe('NOT_FOUND')
      }
    })
  })

  describe('create', () => {
    it('should create a sprint with required fields', async () => {
      const result = await caller.create({ name: 'New Sprint' })

      expect(result.id).toBeDefined()
      expect(result.name).toBe('New Sprint')
      expect(result.is_active).toBe(false)
      expect(result.project_id).toBe(TEST_PROJECT_ID)
    })

    it('should create a sprint with all fields', async () => {
      const startDate = new Date('2026-01-01')
      const endDate = new Date('2026-01-14')

      const result = await caller.create({
        name: 'Full Sprint',
        start_date: startDate,
        end_date: endDate,
        is_active: true
      })

      expect(result.name).toBe('Full Sprint')
      expect(result.is_active).toBe(true)
      expect(result.project_id).toBe(TEST_PROJECT_ID)
    })

    it('should reject empty name', async () => {
      await expect(caller.create({ name: '' })).rejects.toThrow()
    })

    it('should throw PRECONDITION_FAILED when no project open', async () => {
      const noProjectCaller = createTestCaller(db, null)
      await expect(noProjectCaller.create({ name: 'Test' })).rejects.toThrow(TRPCError)

      try {
        await noProjectCaller.create({ name: 'Test' })
      } catch (error) {
        expect((error as TRPCError).code).toBe('PRECONDITION_FAILED')
        expect((error as TRPCError).message).toBe('No project open')
      }
    })
  })

  describe('update', () => {
    it('should update sprint fields', async () => {
      db.insert(schema.sprints)
        .values({
          id: 'sprint-1',
          name: 'Original',
          project_id: TEST_PROJECT_ID,
          created_at: new Date()
        })
        .run()

      const result = await caller.update({ id: 'sprint-1', name: 'Updated' })
      expect(result.name).toBe('Updated')
    })

    it('should throw NOT_FOUND when sprint does not exist', async () => {
      await expect(caller.update({ id: 'nonexistent', name: 'Test' })).rejects.toThrow(TRPCError)

      try {
        await caller.update({ id: 'nonexistent', name: 'Test' })
      } catch (error) {
        expect((error as TRPCError).code).toBe('NOT_FOUND')
      }
    })
  })

  describe('setActive', () => {
    it('should set sprint as active and deactivate others in same project', async () => {
      const now = new Date()
      db.insert(schema.sprints)
        .values([
          { id: 'sprint-1', name: 'Sprint 1', is_active: true, project_id: TEST_PROJECT_ID, created_at: now },
          { id: 'sprint-2', name: 'Sprint 2', is_active: false, project_id: TEST_PROJECT_ID, created_at: now }
        ])
        .run()

      await caller.setActive({ id: 'sprint-2' })

      const allSprints = await caller.getAll()
      const sprint1 = allSprints.find(s => s.id === 'sprint-1')
      const sprint2 = allSprints.find(s => s.id === 'sprint-2')

      expect(sprint1?.is_active).toBe(false)
      expect(sprint2?.is_active).toBe(true)
    })

    it('should throw PRECONDITION_FAILED when no project open', async () => {
      const noProjectCaller = createTestCaller(db, null)
      await expect(noProjectCaller.setActive({ id: 'sprint-1' })).rejects.toThrow(TRPCError)

      try {
        await noProjectCaller.setActive({ id: 'sprint-1' })
      } catch (error) {
        expect((error as TRPCError).code).toBe('PRECONDITION_FAILED')
      }
    })
  })

  describe('delete', () => {
    it('should delete sprint and return deleted sprint', async () => {
      db.insert(schema.sprints)
        .values({
          id: 'sprint-1',
          name: 'Test Sprint',
          project_id: TEST_PROJECT_ID,
          created_at: new Date()
        })
        .run()

      const result = await caller.delete({ id: 'sprint-1' })
      expect(result.id).toBe('sprint-1')

      const sprints = await caller.getAll()
      expect(sprints).toHaveLength(0)
    })

    it('should throw NOT_FOUND when sprint does not exist', async () => {
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
    it('should only return sprints from current project', async () => {
      // Create another project
      db.insert(schema.projects)
        .values({
          id: 'other-project',
          path: '/other/project',
          name: 'Other Project'
        })
        .run()

      const now = new Date()
      // Create sprints in both projects
      db.insert(schema.sprints)
        .values([
          { id: 'sprint-1', name: 'Sprint 1', project_id: TEST_PROJECT_ID, created_at: now },
          { id: 'sprint-2', name: 'Sprint 2', project_id: 'other-project', created_at: now }
        ])
        .run()

      const result = await caller.getAll()
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('sprint-1')
    })

    it('should return empty array when no project is open', async () => {
      db.insert(schema.sprints)
        .values({
          id: 'sprint-1',
          name: 'Test Sprint',
          project_id: TEST_PROJECT_ID,
          created_at: new Date()
        })
        .run()

      const noProjectCaller = createTestCaller(db, null)
      const result = await noProjectCaller.getAll()
      expect(result).toEqual([])
    })

    it('should return null for getActive when no project is open', async () => {
      db.insert(schema.sprints)
        .values({
          id: 'sprint-1',
          name: 'Active Sprint',
          is_active: true,
          project_id: TEST_PROJECT_ID,
          created_at: new Date()
        })
        .run()

      const noProjectCaller = createTestCaller(db, null)
      const result = await noProjectCaller.getActive()
      expect(result).toBeNull()
    })

    it('should set project_id when creating sprint', async () => {
      const result = await caller.create({ name: 'New Sprint' })
      expect(result.project_id).toBe(TEST_PROJECT_ID)
    })

    it('should only deactivate sprints in current project when setting active', async () => {
      // Create another project
      db.insert(schema.projects)
        .values({
          id: 'other-project',
          path: '/other/project',
          name: 'Other Project'
        })
        .run()

      const now = new Date()
      db.insert(schema.sprints)
        .values([
          { id: 'sprint-1', name: 'Sprint 1', is_active: true, project_id: TEST_PROJECT_ID, created_at: now },
          { id: 'sprint-2', name: 'Sprint 2', is_active: false, project_id: TEST_PROJECT_ID, created_at: now },
          { id: 'sprint-other', name: 'Other Sprint', is_active: true, project_id: 'other-project', created_at: now }
        ])
        .run()

      // Set sprint-2 as active in current project
      await caller.setActive({ id: 'sprint-2' })

      // Verify other project's sprint is still active (not affected)
      const otherCaller = createTestCaller(db, 'other-project')
      const otherActive = await otherCaller.getActive()
      expect(otherActive).not.toBeNull()
      expect(otherActive!.is_active).toBe(true)
    })
  })
})

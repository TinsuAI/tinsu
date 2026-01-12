import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as schema from '../../db/schema'

// Mock fs module
let mockExistsSync: (path: string) => boolean = () => true
vi.mock('fs', () => ({
  existsSync: (path: string) => mockExistsSync(path)
}))

// Mock shell.openPath
const mockOpenPath = vi.fn().mockResolvedValue('')
vi.mock('electron', () => ({
  shell: {
    openPath: (path: string) => mockOpenPath(path)
  }
}))

// Mock the database module
vi.mock('../../db', () => ({
  db: null as unknown as BetterSQLite3Database<typeof schema>
}))

// Import after mocking
import * as dbModule from '../../db'
import { artifactsRouter } from './artifacts.router'
import { createCallerFactory } from '@trpc/server'

type TestDb = BetterSQLite3Database<typeof schema>

function createTestDb(): TestDb {
  const sqlite = new Database(':memory:')

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY NOT NULL,
      path TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      last_opened_at INTEGER
    );
  `)

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
      project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `)

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS task_artifacts (
      id TEXT PRIMARY KEY NOT NULL,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      artifact_type TEXT NOT NULL,
      artifact_path TEXT NOT NULL,
      section_ref TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_task_artifacts_task_id ON task_artifacts(task_id);
  `)

  return drizzle({ client: sqlite, schema })
}

describe('artifactsRouter', () => {
  let db: TestDb
  let caller: ReturnType<ReturnType<typeof createCallerFactory<typeof artifactsRouter>>>

  beforeEach(() => {
    db = createTestDb()
    ;(dbModule as { db: TestDb }).db = db

    // Create caller for testing
    const createCaller = createCallerFactory(artifactsRouter)
    caller = createCaller({ db } as any)

    // Create a test task
    db.insert(schema.tasks)
      .values({
        id: 'task-1',
        title: 'Test Task',
        created_at: new Date(),
        updated_at: new Date()
      })
      .run()

    // Reset mocks
    mockExistsSync = () => true
    mockOpenPath.mockReset()
    mockOpenPath.mockResolvedValue('')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getArtifactsForTask', () => {
    it('returns empty array when no artifacts linked', async () => {
      const result = await caller.getArtifactsForTask({ taskId: 'task-1' })
      expect(result).toEqual([])
    })

    it('returns all artifacts linked to task with status', async () => {
      // Create artifacts directly in DB
      db.insert(schema.task_artifacts)
        .values([
          {
            id: 'artifact-1',
            task_id: 'task-1',
            artifact_type: 'prd',
            artifact_path: '/path/to/prd.md',
            created_at: new Date()
          },
          {
            id: 'artifact-2',
            task_id: 'task-1',
            artifact_type: 'architecture',
            artifact_path: '/path/to/arch.md',
            created_at: new Date()
          }
        ])
        .run()

      const result = await caller.getArtifactsForTask({ taskId: 'task-1' })
      expect(result).toHaveLength(2)
      expect(result[0]).toHaveProperty('exists')
      expect(result[0]).toHaveProperty('fileName')
    })
  })

  describe('linkArtifact', () => {
    it('links artifact to task when file exists', async () => {
      mockExistsSync = () => true

      const result = await caller.linkArtifact({
        taskId: 'task-1',
        artifactType: 'prd',
        artifactPath: '/path/to/prd.md'
      })

      expect(result).toBeDefined()
      expect(result.task_id).toBe('task-1')
      expect(result.artifact_type).toBe('prd')
      expect(result.artifact_path).toBe('/path/to/prd.md')
    })

    it('links artifact with optional section reference', async () => {
      mockExistsSync = () => true

      const result = await caller.linkArtifact({
        taskId: 'task-1',
        artifactType: 'epics',
        artifactPath: '/path/to/epics.md',
        sectionRef: 'Story-3.10'
      })

      expect(result.section_ref).toBe('Story-3.10')
    })

    it('throws BAD_REQUEST when file does not exist', async () => {
      mockExistsSync = () => false

      await expect(
        caller.linkArtifact({
          taskId: 'task-1',
          artifactType: 'prd',
          artifactPath: '/path/to/missing.md'
        })
      ).rejects.toThrow(/not found/i)
    })
  })

  describe('unlinkArtifact', () => {
    it('removes artifact link', async () => {
      // Create an artifact first
      db.insert(schema.task_artifacts)
        .values({
          id: 'artifact-to-remove',
          task_id: 'task-1',
          artifact_type: 'prd',
          artifact_path: '/path/to/prd.md',
          created_at: new Date()
        })
        .run()

      const result = await caller.unlinkArtifact({ taskArtifactId: 'artifact-to-remove' })
      expect(result.success).toBe(true)

      // Verify it's removed
      const artifacts = await caller.getArtifactsForTask({ taskId: 'task-1' })
      expect(artifacts).toHaveLength(0)
    })
  })

  describe('openArtifactInEditor', () => {
    it('opens artifact in system editor when file exists', async () => {
      mockExistsSync = () => true

      const result = await caller.openArtifactInEditor({
        artifactPath: '/path/to/prd.md'
      })

      expect(result.success).toBe(true)
      expect(mockOpenPath).toHaveBeenCalledWith('/path/to/prd.md')
    })

    it('throws NOT_FOUND when file does not exist', async () => {
      mockExistsSync = () => false

      await expect(
        caller.openArtifactInEditor({
          artifactPath: '/path/to/missing.md'
        })
      ).rejects.toThrow(/not found/i)

      expect(mockOpenPath).not.toHaveBeenCalled()
    })

    it('throws INTERNAL_SERVER_ERROR when shell.openPath fails', async () => {
      mockExistsSync = () => true
      mockOpenPath.mockRejectedValue(new Error('Failed to open'))

      await expect(
        caller.openArtifactInEditor({
          artifactPath: '/path/to/prd.md'
        })
      ).rejects.toThrow(/failed to open/i)
    })
  })
})

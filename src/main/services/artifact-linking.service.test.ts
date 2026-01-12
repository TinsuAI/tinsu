import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as fs from 'fs'
import * as schema from '../db/schema'

// Mock the database module
vi.mock('../db', () => ({
  db: null as unknown as BetterSQLite3Database<typeof schema>
}))

// Import after mocking
import * as dbModule from '../db'
import {
  ArtifactLinkingService,
  type ArtifactWithStatus
} from './artifact-linking.service'

type TestDb = BetterSQLite3Database<typeof schema>

function createTestDb(): TestDb {
  const sqlite = new Database(':memory:')

  // Create projects table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY NOT NULL,
      path TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      last_opened_at INTEGER
    );
  `)

  // Create tasks table
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
  `)

  // Create task_artifacts table
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

describe('ArtifactLinkingService', () => {
  let db: TestDb

  beforeEach(() => {
    db = createTestDb()
    // Set the mock database
    ;(dbModule as { db: TestDb }).db = db

    // Create a test task
    db.insert(schema.tasks)
      .values({
        id: 'task-1',
        title: 'Test Task',
        created_at: new Date(),
        updated_at: new Date()
      })
      .run()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('linkArtifactToTask', () => {
    it('links artifact to task with required fields', async () => {
      const result = await ArtifactLinkingService.linkArtifactToTask(
        'task-1',
        'prd',
        '/path/to/prd.md'
      )

      expect(result).toBeDefined()
      expect(result.task_id).toBe('task-1')
      expect(result.artifact_type).toBe('prd')
      expect(result.artifact_path).toBe('/path/to/prd.md')
      expect(result.section_ref).toBeNull()
      expect(result.id).toBeDefined()
    })

    it('links artifact with optional section_ref', async () => {
      const result = await ArtifactLinkingService.linkArtifactToTask(
        'task-1',
        'epics',
        '/path/to/epics.md',
        'Story-3.10'
      )

      expect(result.section_ref).toBe('Story-3.10')
    })

    it('generates unique ID for each artifact', async () => {
      const result1 = await ArtifactLinkingService.linkArtifactToTask(
        'task-1',
        'prd',
        '/path/to/prd.md'
      )
      const result2 = await ArtifactLinkingService.linkArtifactToTask(
        'task-1',
        'architecture',
        '/path/to/arch.md'
      )

      expect(result1.id).not.toBe(result2.id)
    })
  })

  describe('unlinkArtifactFromTask', () => {
    it('removes artifact link from task', async () => {
      const artifact = await ArtifactLinkingService.linkArtifactToTask(
        'task-1',
        'prd',
        '/path/to/prd.md'
      )

      await ArtifactLinkingService.unlinkArtifactFromTask(artifact.id)

      const artifacts = await ArtifactLinkingService.getArtifactsForTask('task-1')
      expect(artifacts).toHaveLength(0)
    })
  })

  describe('getArtifactsForTask', () => {
    it('returns empty array when no artifacts linked', async () => {
      const artifacts = await ArtifactLinkingService.getArtifactsForTask('task-1')
      expect(artifacts).toEqual([])
    })

    it('returns all artifacts linked to task', async () => {
      await ArtifactLinkingService.linkArtifactToTask('task-1', 'prd', '/path/to/prd.md')
      await ArtifactLinkingService.linkArtifactToTask('task-1', 'architecture', '/path/to/arch.md')

      const artifacts = await ArtifactLinkingService.getArtifactsForTask('task-1')
      expect(artifacts).toHaveLength(2)
    })
  })

  describe('checkArtifactExists', () => {
    it('returns true when file exists', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true)

      const exists = ArtifactLinkingService.checkArtifactExists('/path/to/existing.md')
      expect(exists).toBe(true)
    })

    it('returns false when file does not exist', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(false)

      const exists = ArtifactLinkingService.checkArtifactExists('/path/to/missing.md')
      expect(exists).toBe(false)
    })
  })

  describe('getArtifactsWithStatus', () => {
    it('returns artifacts with exists flag true for existing files', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true)

      await ArtifactLinkingService.linkArtifactToTask('task-1', 'prd', '/path/to/prd.md')

      const artifacts = await ArtifactLinkingService.getArtifactsWithStatus('task-1')

      expect(artifacts).toHaveLength(1)
      expect(artifacts[0].exists).toBe(true)
      expect(artifacts[0].fileName).toBe('prd.md')
    })

    it('returns artifacts with exists flag false for missing files', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(false)

      await ArtifactLinkingService.linkArtifactToTask('task-1', 'prd', '/path/to/missing.md')

      const artifacts = await ArtifactLinkingService.getArtifactsWithStatus('task-1')

      expect(artifacts).toHaveLength(1)
      expect(artifacts[0].exists).toBe(false)
    })

    it('extracts fileName from path correctly', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true)

      await ArtifactLinkingService.linkArtifactToTask(
        'task-1',
        'architecture',
        '/home/user/project/_bmad-output/architecture.md'
      )

      const artifacts = await ArtifactLinkingService.getArtifactsWithStatus('task-1')
      expect(artifacts[0].fileName).toBe('architecture.md')
    })

    it('returns mixed status for existing and missing files', async () => {
      vi.spyOn(fs, 'existsSync').mockImplementation((path) => {
        return String(path).includes('existing')
      })

      await ArtifactLinkingService.linkArtifactToTask('task-1', 'prd', '/path/to/existing-prd.md')
      await ArtifactLinkingService.linkArtifactToTask('task-1', 'architecture', '/path/to/missing.md')

      const artifacts = await ArtifactLinkingService.getArtifactsWithStatus('task-1')

      const existingArtifact = artifacts.find((a) => a.artifact_path.includes('existing'))
      const missingArtifact = artifacts.find((a) => a.artifact_path.includes('missing'))

      expect(existingArtifact?.exists).toBe(true)
      expect(missingArtifact?.exists).toBe(false)
    })
  })
})

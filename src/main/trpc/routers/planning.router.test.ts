import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as schema from '../../db/schema'

// Mock fs module
// mockStatSync should throw ENOENT (as real statSync does) when a file is "missing"
let mockStatSync: (path: string) => { mtimeMs: number; size: number } = () => {
  const err = Object.assign(new Error('ENOENT: no such file or directory'), { code: 'ENOENT' })
  throw err
}

vi.mock('fs', () => ({
  statSync: (path: string) => mockStatSync(path)
}))

// Mock the database module
vi.mock('../../db', () => ({
  db: null as unknown as BetterSQLite3Database<typeof schema>
}))

// Import after mocking
import * as dbModule from '../../db'
import { planningRouter } from './planning.router'
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
    CREATE TABLE IF NOT EXISTS planning_artifact_statuses (
      id TEXT PRIMARY KEY NOT NULL,
      project_id TEXT NOT NULL,
      artifact_key TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      UNIQUE(project_id, artifact_key),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `)

  return drizzle({ client: sqlite, schema })
}

describe('planningRouter', () => {
  let db: TestDb
  let caller: ReturnType<ReturnType<typeof createCallerFactory<typeof planningRouter>>>

  beforeEach(() => {
    db = createTestDb()
    ;(dbModule as { db: TestDb }).db = db

    // Create a test project
    db.insert(schema.projects)
      .values({
        id: 'project-1',
        path: '/test/project',
        name: 'Test Project',
        created_at: new Date()
      })
      .run()

    // Create caller for testing
    const createCaller = createCallerFactory(planningRouter)
    caller = createCaller({
      db,
      projectRoot: '/test/project',
      projectId: 'project-1'
    } as any)

    // Reset mock: all files missing by default (statSync throws)
    mockStatSync = () => {
      const err = Object.assign(new Error('ENOENT: no such file or directory'), { code: 'ENOENT' })
      throw err
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('scanArtifacts', () => {
    it('returns all artifacts as missing when no files exist', async () => {
      // mockStatSync already throws by default (all missing)

      const result = await caller.scanArtifacts({ projectId: 'project-1' })

      expect(result).toHaveLength(9)
      expect(result.every((a) => a.status === 'missing')).toBe(true)
      expect(result.every((a) => !a.exists)).toBe(true)
      expect(result.every((a) => a.lastModified === null)).toBe(true)
      expect(result.every((a) => a.sizeBytes === null)).toBe(true)
    })

    it('returns correct status for existing files', async () => {
      mockStatSync = (p: string) => {
        if (p.includes('product-brief.md')) return { mtimeMs: 1700000000000, size: 1024 }
        const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
        throw err
      }

      const result = await caller.scanArtifacts({ projectId: 'project-1' })

      // brainstorming and product-brief both map to product-brief.md
      const productBrief = result.find((a) => a.workflowKey === 'product-brief')
      expect(productBrief?.exists).toBe(true)
      expect(productBrief?.status).toBe('draft')
      expect(productBrief?.lastModified).toBe(1700000000000)
      expect(productBrief?.sizeBytes).toBe(1024)

      // prd.md should be missing
      const prd = result.find((a) => a.workflowKey === 'prd')
      expect(prd?.exists).toBe(false)
      expect(prd?.status).toBe('missing')
    })

    it('returns approved status when persisted in database', async () => {
      mockStatSync = (p: string) => {
        if (p.includes('prd.md')) return { mtimeMs: 1700000000000, size: 1024 }
        const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
        throw err
      }

      // Set approval status in DB
      db.insert(schema.planning_artifact_statuses)
        .values({
          id: 'status-1',
          project_id: 'project-1',
          artifact_key: 'prd',
          status: 'approved',
          updated_at: new Date()
        })
        .run()

      const result = await caller.scanArtifacts({ projectId: 'project-1' })

      const prd = result.find((a) => a.workflowKey === 'prd')
      expect(prd?.status).toBe('approved')
      expect(prd?.exists).toBe(true)
    })

    it('returns all workflow keys', async () => {
      const result = await caller.scanArtifacts({ projectId: 'project-1' })

      const keys = result.map((a) => a.workflowKey)
      expect(keys).toContain('brainstorming')
      expect(keys).toContain('product-brief')
      expect(keys).toContain('market-research')
      expect(keys).toContain('domain-research')
      expect(keys).toContain('prd')
      expect(keys).toContain('ux-design')
      expect(keys).toContain('architecture')
      expect(keys).toContain('epics-stories')
      expect(keys).toContain('readiness-check')
    })
  })

  describe('updateArtifactStatus', () => {
    it('inserts new status when none exists', async () => {
      const result = await caller.updateArtifactStatus({
        projectId: 'project-1',
        artifactKey: 'prd',
        status: 'approved'
      })

      expect(result.artifactKey).toBe('prd')
      expect(result.status).toBe('approved')

      // Verify it was persisted
      mockStatSync = (p: string) => {
        if (p.includes('prd.md')) return { mtimeMs: 1700000000000, size: 1024 }
        const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
        throw err
      }
      const scan = await caller.scanArtifacts({ projectId: 'project-1' })
      const prd = scan.find((a) => a.workflowKey === 'prd')
      expect(prd?.status).toBe('approved')
    })

    it('updates existing status', async () => {
      // Insert initial status
      db.insert(schema.planning_artifact_statuses)
        .values({
          id: 'status-1',
          project_id: 'project-1',
          artifact_key: 'prd',
          status: 'approved',
          updated_at: new Date()
        })
        .run()

      // Toggle back to draft
      const result = await caller.updateArtifactStatus({
        projectId: 'project-1',
        artifactKey: 'prd',
        status: 'draft'
      })

      expect(result.status).toBe('draft')
    })

    it('rejects unknown artifact keys', async () => {
      await expect(
        caller.updateArtifactStatus({
          projectId: 'project-1',
          artifactKey: 'unknown-key',
          status: 'approved'
        })
      ).rejects.toThrow(/unknown artifact key/i)
    })
  })
})

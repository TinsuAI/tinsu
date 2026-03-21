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

let mockReadFileSync: (path: string, encoding: string) => string = () => {
  const err = Object.assign(new Error('ENOENT: no such file or directory'), { code: 'ENOENT' })
  throw err
}

vi.mock('fs', () => ({
  statSync: (path: string) => mockStatSync(path),
  readFileSync: (path: string, encoding: string) => mockReadFileSync(path, encoding)
}))

// Mock the database module
vi.mock('../../db', () => ({
  db: null as unknown as BetterSQLite3Database<typeof schema>
}))

// Import after mocking
import * as dbModule from '../../db'
import { planningRouter } from './planning.router'
import { initTRPC } from '@trpc/server'

const t = initTRPC.context<any>().create()
const createCallerFactory = t.createCallerFactory

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
      project_id TEXT,
      worktree_path TEXT,
      branch_name TEXT,
      merge_commit_sha TEXT,
      has_merge_conflict INTEGER DEFAULT 0,
      conflict_files TEXT,
      worktree_skipped INTEGER DEFAULT 0,
      rejection_feedback TEXT,
      rejected_agent_run_id TEXT,
      inline_comments TEXT,
      rejection_count INTEGER DEFAULT 0,
      last_review_commit TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `)

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS workflow_runs (
      id TEXT PRIMARY KEY NOT NULL,
      project_id TEXT NOT NULL,
      workflow_key TEXT NOT NULL,
      phase TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'running',
      started_at INTEGER NOT NULL DEFAULT (unixepoch()),
      finished_at INTEGER,
      input_artifacts TEXT,
      output_artifacts TEXT,
      agent_name TEXT,
      task_id TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL
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

    // Reset mocks: all files missing by default (statSync/readFileSync throw)
    mockStatSync = () => {
      const err = Object.assign(new Error('ENOENT: no such file or directory'), { code: 'ENOENT' })
      throw err
    }
    mockReadFileSync = () => {
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

    it('accepts in-review status', async () => {
      const result = await caller.updateArtifactStatus({
        projectId: 'project-1',
        artifactKey: 'prd',
        status: 'in-review'
      })

      expect(result.artifactKey).toBe('prd')
      expect(result.status).toBe('in-review')
    })
  })

  describe('getArtifactContent', () => {
    it('returns content and metadata for existing artifact', async () => {
      const testContent = '# Product Brief\n\nThis is a test product brief with some words.'
      mockReadFileSync = (p: string) => {
        if (p.includes('product-brief.md')) return testContent
        const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
        throw err
      }
      mockStatSync = (p: string) => {
        if (p.includes('product-brief.md')) return { mtimeMs: 1700000000000, size: 512 }
        const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
        throw err
      }

      const result = await caller.getArtifactContent({
        projectId: 'project-1',
        workflowKey: 'product-brief'
      })

      expect(result.content).toBe(testContent)
      expect(result.filePath).toBe('_bmad-output/planning-artifacts/product-brief.md')
      expect(result.lastModified).toBe(1700000000000)
      expect(result.sizeBytes).toBe(512)
      expect(result.wordCount).toBe(12)
      expect(result.workflowKey).toBe('product-brief')
    })

    it('throws NOT_FOUND for missing artifact file', async () => {
      // readFileSync throws by default (all missing)

      await expect(
        caller.getArtifactContent({
          projectId: 'project-1',
          workflowKey: 'prd'
        })
      ).rejects.toThrow(/artifact not found/i)
    })

    it('throws BAD_REQUEST for unknown workflow key', async () => {
      await expect(
        caller.getArtifactContent({
          projectId: 'project-1',
          workflowKey: 'unknown-workflow'
        })
      ).rejects.toThrow(/unknown workflow/i)
    })

    it('computes correct word count', async () => {
      const content = 'One two three four five'
      mockReadFileSync = () => content
      mockStatSync = () => ({ mtimeMs: 1700000000000, size: content.length })

      const result = await caller.getArtifactContent({
        projectId: 'project-1',
        workflowKey: 'architecture'
      })

      expect(result.wordCount).toBe(5)
    })

    it('handles empty content', async () => {
      mockReadFileSync = () => ''
      mockStatSync = () => ({ mtimeMs: 1700000000000, size: 0 })

      const result = await caller.getArtifactContent({
        projectId: 'project-1',
        workflowKey: 'architecture'
      })

      expect(result.content).toBe('')
      expect(result.wordCount).toBe(0)
    })
  })

  describe('scanArtifacts with in-review status', () => {
    it('returns in-review status when persisted in database', async () => {
      mockStatSync = (p: string) => {
        if (p.includes('prd.md')) return { mtimeMs: 1700000000000, size: 1024 }
        const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
        throw err
      }

      // Set in-review status in DB
      db.insert(schema.planning_artifact_statuses)
        .values({
          id: 'status-1',
          project_id: 'project-1',
          artifact_key: 'prd',
          status: 'in-review',
          updated_at: new Date()
        })
        .run()

      const result = await caller.scanArtifacts({ projectId: 'project-1' })

      const prd = result.find((a) => a.workflowKey === 'prd')
      expect(prd?.status).toBe('in-review')
      expect(prd?.exists).toBe(true)
    })
  })

  // Story 9.5: Workflow run procedure tests
  describe('createWorkflowRun', () => {
    it('creates a workflow run with running status', async () => {
      const result = await caller.createWorkflowRun({
        projectId: 'project-1',
        workflowKey: 'prd',
        phase: 'planning',
        agentName: 'bmad:bmm:agents:pm'
      })

      expect(result.id).toBeDefined()
      expect(result.project_id).toBe('project-1')
      expect(result.workflow_key).toBe('prd')
      expect(result.phase).toBe('planning')
      expect(result.status).toBe('running')
      expect(result.agent_name).toBe('bmad:bmm:agents:pm')
      expect(result.finished_at).toBeNull()
    })

    it('stores input artifacts as JSON', async () => {
      const result = await caller.createWorkflowRun({
        projectId: 'project-1',
        workflowKey: 'architecture',
        phase: 'solutioning',
        inputArtifacts: ['prd']
      })

      expect(result.input_artifacts).toBe(JSON.stringify(['prd']))
    })

    it('rejects unknown workflow keys', async () => {
      await expect(
        caller.createWorkflowRun({
          projectId: 'project-1',
          workflowKey: 'unknown-workflow',
          phase: 'analysis'
        })
      ).rejects.toThrow(/unknown workflow key/i)
    })

    it('links to task when taskId is provided', async () => {
      // Create a task first
      db.insert(schema.tasks)
        .values({
          id: 'task-1',
          title: 'Test Planning Task',
          task_type: 'planning',
          status: 'in_progress',
          project_id: 'project-1'
        })
        .run()

      const result = await caller.createWorkflowRun({
        projectId: 'project-1',
        workflowKey: 'prd',
        phase: 'planning',
        taskId: 'task-1'
      })

      expect(result.task_id).toBe('task-1')
    })
  })

  describe('updateWorkflowRun', () => {
    it('updates status and sets finished_at for terminal statuses', async () => {
      // Create a run first
      const created = await caller.createWorkflowRun({
        projectId: 'project-1',
        workflowKey: 'prd',
        phase: 'planning'
      })

      const result = await caller.updateWorkflowRun({
        runId: created.id,
        status: 'succeeded',
        outputArtifacts: ['prd.md']
      })

      expect(result.status).toBe('succeeded')
      expect(result.finished_at).not.toBeNull()
      expect(result.output_artifacts).toBe(JSON.stringify(['prd.md']))
    })

    it('does not set finished_at for non-terminal statuses', async () => {
      const created = await caller.createWorkflowRun({
        projectId: 'project-1',
        workflowKey: 'prd',
        phase: 'planning'
      })

      const result = await caller.updateWorkflowRun({
        runId: created.id,
        status: 'needs-input'
      })

      expect(result.status).toBe('needs-input')
      expect(result.finished_at).toBeNull()
    })

    it('sets finished_at for failed status', async () => {
      const created = await caller.createWorkflowRun({
        projectId: 'project-1',
        workflowKey: 'prd',
        phase: 'planning'
      })

      const result = await caller.updateWorkflowRun({
        runId: created.id,
        status: 'failed'
      })

      expect(result.status).toBe('failed')
      expect(result.finished_at).not.toBeNull()
    })
  })

  describe('listWorkflowRuns', () => {
    it('returns runs ordered by started_at descending', async () => {
      // Create multiple runs
      await caller.createWorkflowRun({
        projectId: 'project-1',
        workflowKey: 'product-brief',
        phase: 'analysis'
      })
      await caller.createWorkflowRun({
        projectId: 'project-1',
        workflowKey: 'prd',
        phase: 'planning'
      })

      const result = await caller.listWorkflowRuns({ projectId: 'project-1' })

      expect(result.length).toBe(2)
      // Results should be parsed from JSON
      expect(Array.isArray(result[0].input_artifacts)).toBe(true)
      expect(Array.isArray(result[0].output_artifacts)).toBe(true)
    })

    it('respects limit parameter', async () => {
      await caller.createWorkflowRun({ projectId: 'project-1', workflowKey: 'product-brief', phase: 'analysis' })
      await caller.createWorkflowRun({ projectId: 'project-1', workflowKey: 'prd', phase: 'planning' })
      await caller.createWorkflowRun({ projectId: 'project-1', workflowKey: 'architecture', phase: 'solutioning' })

      const result = await caller.listWorkflowRuns({ projectId: 'project-1', limit: 2 })
      expect(result.length).toBe(2)
    })

    it('returns empty array for project with no runs', async () => {
      const result = await caller.listWorkflowRuns({ projectId: 'project-1' })
      expect(result).toEqual([])
    })
  })

  describe('getActiveWorkflowRun', () => {
    it('returns null when no active run exists', async () => {
      const result = await caller.getActiveWorkflowRun({ projectId: 'project-1' })
      expect(result).toBeNull()
    })

    it('returns active running run', async () => {
      await caller.createWorkflowRun({
        projectId: 'project-1',
        workflowKey: 'prd',
        phase: 'planning',
        agentName: 'bmad:bmm:agents:pm'
      })

      const result = await caller.getActiveWorkflowRun({ projectId: 'project-1' })
      expect(result).not.toBeNull()
      expect(result!.status).toBe('running')
      expect(result!.workflow_key).toBe('prd')
    })

    it('returns null when all runs are terminal', async () => {
      const created = await caller.createWorkflowRun({
        projectId: 'project-1',
        workflowKey: 'prd',
        phase: 'planning'
      })
      await caller.updateWorkflowRun({ runId: created.id, status: 'succeeded' })

      const result = await caller.getActiveWorkflowRun({ projectId: 'project-1' })
      expect(result).toBeNull()
    })

    it('returns needs-input run as active', async () => {
      const created = await caller.createWorkflowRun({
        projectId: 'project-1',
        workflowKey: 'prd',
        phase: 'planning'
      })
      await caller.updateWorkflowRun({ runId: created.id, status: 'needs-input' })

      const result = await caller.getActiveWorkflowRun({ projectId: 'project-1' })
      expect(result).not.toBeNull()
      expect(result!.status).toBe('needs-input')
    })
  })
})

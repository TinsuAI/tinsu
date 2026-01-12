import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { syncRouter } from './sync.router'
import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as schema from '../../db/schema'

type TestDb = BetterSQLite3Database<typeof schema>

const TEST_PROJECT_ID = 'test-project-id'

// Create an in-memory SQLite database for testing
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
      story_file_status TEXT,
      project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
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

function createTestCaller(db: TestDb, projectId: string | null = TEST_PROJECT_ID) {
  const createCaller = syncRouter.createCaller
  return createCaller({
    db,
    projectRoot: process.cwd(),
    projectId
  } as { db: typeof import('../../db').db; projectRoot: string; projectId: string | null })
}

describe('syncRouter', () => {
  let tempDir: string
  let db: ReturnType<typeof createTestDb>
  let caller: ReturnType<typeof createTestCaller>

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'sync-router-test-'))
    db = createTestDb()
    caller = createTestCaller(db)
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  describe('syncStatusToFile', () => {
    it('syncs status to story file', async () => {
      const storyFile = join(tempDir, '3-9-test-story.md')
      writeFileSync(
        storyFile,
        `# Story 3.9: Test Story

Status: ready-for-dev

## Story

Content here.
`
      )

      // Create a task with the story file path
      db.insert(schema.tasks)
        .values({
          id: 'task-1',
          title: 'Test Story',
          status: 'backlog',
          story_file_path: storyFile,
          project_id: TEST_PROJECT_ID,
          created_at: new Date(),
          updated_at: new Date()
        })
        .run()

      const result = await caller.syncStatusToFile({
        taskId: 'task-1',
        newStatus: 'in-progress'
      })

      expect(result.synced).toBe(true)

      // Verify file was updated
      const fileContent = readFileSync(storyFile, 'utf-8')
      expect(fileContent).toContain('Status: in-progress')
    })

    it('returns synced:false for task without story_file_path', async () => {
      db.insert(schema.tasks)
        .values({
          id: 'task-1',
          title: 'Test Task',
          status: 'backlog',
          project_id: TEST_PROJECT_ID,
          created_at: new Date(),
          updated_at: new Date()
        })
        .run()

      const result = await caller.syncStatusToFile({
        taskId: 'task-1',
        newStatus: 'in-progress'
      })

      expect(result.synced).toBe(false)
      expect(result.reason).toBe('no_file_path')
    })

    it('throws NOT_FOUND for non-existent task', async () => {
      await expect(
        caller.syncStatusToFile({
          taskId: 'non-existent-id',
          newStatus: 'in-progress'
        })
      ).rejects.toThrow('Task not found')
    })
  })

  describe('syncFromFile', () => {
    it('syncs content from story file to database', async () => {
      const storyFile = join(tempDir, '3-9-test-story.md')
      const fileContent = `# Story 3.9: Test Story

Status: in-progress

## Story

Updated content from file.

## Tasks

- [ ] Task 1
`
      writeFileSync(storyFile, fileContent)

      db.insert(schema.tasks)
        .values({
          id: 'task-1',
          title: 'Test Story',
          status: 'backlog',
          story_file_path: storyFile,
          full_content: 'Old content',
          project_id: TEST_PROJECT_ID,
          created_at: new Date(),
          updated_at: new Date()
        })
        .run()

      const result = await caller.syncFromFile({ taskId: 'task-1' })

      expect(result.synced).toBe(true)
      expect(result.task?.full_content).toBe(fileContent)
      expect(result.task?.status).toBe('in_progress')
    })

    it('returns synced:false for task without story_file_path', async () => {
      db.insert(schema.tasks)
        .values({
          id: 'task-1',
          title: 'Test Task',
          status: 'backlog',
          project_id: TEST_PROJECT_ID,
          created_at: new Date(),
          updated_at: new Date()
        })
        .run()

      const result = await caller.syncFromFile({ taskId: 'task-1' })

      expect(result.synced).toBe(false)
      expect(result.reason).toBe('no_file_path')
    })

    it('throws NOT_FOUND for non-existent task', async () => {
      await expect(caller.syncFromFile({ taskId: 'non-existent-id' })).rejects.toThrow(
        'Task not found'
      )
    })
  })

  describe('checkFileChanges', () => {
    it('returns hasChanges:true when file differs from DB', async () => {
      const storyFile = join(tempDir, '3-9-test-story.md')
      writeFileSync(storyFile, 'New file content')

      db.insert(schema.tasks)
        .values({
          id: 'task-1',
          title: 'Test Story',
          status: 'backlog',
          story_file_path: storyFile,
          full_content: 'Old content',
          project_id: TEST_PROJECT_ID,
          created_at: new Date(),
          updated_at: new Date()
        })
        .run()

      const result = await caller.checkFileChanges({ taskId: 'task-1' })

      expect(result.hasChanges).toBe(true)
    })

    it('returns hasChanges:false when file matches DB', async () => {
      const storyFile = join(tempDir, '3-9-test-story.md')
      const content = `# Story 3.9: Test

Status: backlog

Content here.
`
      writeFileSync(storyFile, content)

      db.insert(schema.tasks)
        .values({
          id: 'task-1',
          title: 'Test Story',
          status: 'backlog',
          story_file_path: storyFile,
          full_content: content,
          project_id: TEST_PROJECT_ID,
          created_at: new Date(),
          updated_at: new Date()
        })
        .run()

      const result = await caller.checkFileChanges({ taskId: 'task-1' })

      expect(result.hasChanges).toBe(false)
    })

    it('returns hasChanges:false for task without story_file_path', async () => {
      db.insert(schema.tasks)
        .values({
          id: 'task-1',
          title: 'Test Task',
          status: 'backlog',
          project_id: TEST_PROJECT_ID,
          created_at: new Date(),
          updated_at: new Date()
        })
        .run()

      const result = await caller.checkFileChanges({ taskId: 'task-1' })

      expect(result.hasChanges).toBe(false)
    })

    it('throws NOT_FOUND for non-existent task', async () => {
      await expect(caller.checkFileChanges({ taskId: 'non-existent-id' })).rejects.toThrow(
        'Task not found'
      )
    })
  })

  describe('detectConflict', () => {
    it('detects status conflict between DB and file', async () => {
      const storyFile = join(tempDir, '3-9-test-story.md')
      writeFileSync(
        storyFile,
        `# Story 3.9: Test

Status: done

Content here.
`
      )

      db.insert(schema.tasks)
        .values({
          id: 'task-1',
          title: 'Test Story',
          status: 'in_progress',
          story_file_path: storyFile,
          full_content: '# Story 3.9\n\nStatus: in-progress\n\nOld content.',
          project_id: TEST_PROJECT_ID,
          created_at: new Date(),
          updated_at: new Date()
        })
        .run()

      const result = await caller.detectConflict({ taskId: 'task-1' })

      expect(result.hasConflict).toBe(true)
      expect(result.hasStatusConflict).toBe(true)
      expect(result.hasContentConflict).toBe(true)
    })

    it('returns no conflict when file matches DB', async () => {
      const content = `# Story 3.9: Test

Status: backlog

Content here.
`
      const storyFile = join(tempDir, '3-9-test-story.md')
      writeFileSync(storyFile, content)

      db.insert(schema.tasks)
        .values({
          id: 'task-1',
          title: 'Test Story',
          status: 'backlog',
          story_file_path: storyFile,
          full_content: content,
          project_id: TEST_PROJECT_ID,
          created_at: new Date(),
          updated_at: new Date()
        })
        .run()

      const result = await caller.detectConflict({ taskId: 'task-1' })

      expect(result.hasConflict).toBe(false)
    })

    it('returns no conflict for task without story_file_path', async () => {
      db.insert(schema.tasks)
        .values({
          id: 'task-1',
          title: 'Test Task',
          status: 'backlog',
          project_id: TEST_PROJECT_ID,
          created_at: new Date(),
          updated_at: new Date()
        })
        .run()

      const result = await caller.detectConflict({ taskId: 'task-1' })

      expect(result.hasConflict).toBe(false)
    })

    it('throws NOT_FOUND for non-existent task', async () => {
      await expect(caller.detectConflict({ taskId: 'non-existent-id' })).rejects.toThrow(
        'Task not found'
      )
    })
  })

  describe('resolveConflict', () => {
    it('keeps kanban version when keepKanban is true', async () => {
      const storyFile = join(tempDir, '3-9-test-story.md')
      writeFileSync(
        storyFile,
        `# Story 3.9: Test

Status: done

File content.
`
      )

      const dbContent = `# Story 3.9: Test

Status: in-progress

DB content.
`

      db.insert(schema.tasks)
        .values({
          id: 'task-1',
          title: 'Test Story',
          status: 'in_progress',
          story_file_path: storyFile,
          full_content: dbContent,
          project_id: TEST_PROJECT_ID,
          created_at: new Date(),
          updated_at: new Date()
        })
        .run()

      const result = await caller.resolveConflict({
        taskId: 'task-1',
        keepKanban: true
      })

      expect(result.resolved).toBe(true)
      // File should be updated to match DB
      const fileContent = readFileSync(storyFile, 'utf-8')
      expect(fileContent).toContain('Status: in-progress')
    })

    it('keeps file version when keepKanban is false', async () => {
      const storyFile = join(tempDir, '3-9-test-story.md')
      const fileContent = `# Story 3.9: Test

Status: done

File content.
`
      writeFileSync(storyFile, fileContent)

      db.insert(schema.tasks)
        .values({
          id: 'task-1',
          title: 'Test Story',
          status: 'in_progress',
          story_file_path: storyFile,
          full_content: 'Old DB content',
          project_id: TEST_PROJECT_ID,
          created_at: new Date(),
          updated_at: new Date()
        })
        .run()

      const result = await caller.resolveConflict({
        taskId: 'task-1',
        keepKanban: false
      })

      expect(result.resolved).toBe(true)
      expect(result.task?.status).toBe('done')
      expect(result.task?.full_content).toBe(fileContent)
    })
  })
})

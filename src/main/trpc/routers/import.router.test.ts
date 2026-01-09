import { describe, it, expect, beforeEach } from 'vitest'
import { importRouter } from './import.router'
import { TRPCError } from '@trpc/server'
import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as schema from '../../db/schema'
import { writeFileSync, unlinkSync, mkdtempSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

type TestDb = BetterSQLite3Database<typeof schema> & { $client: Database.Database }

const TEST_PROJECT_ID = 'test-project-id'

// Create an in-memory SQLite database for testing
function createTestDb(): TestDb {
  const sqlite = new Database(':memory:')

  // Create the projects table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY NOT NULL,
      path TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      last_opened_at INTEGER
    );
  `)

  // Create the epics table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS epics (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      color TEXT NOT NULL DEFAULT 'blue',
      epic_number INTEGER,
      goal TEXT,
      project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `)

  // Create the tasks table (Story 3.7: story_file_path, full_content)
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

// Helper to create test epics.md file
function createTestEpicsFile(content: string): string {
  const tempDir = mkdtempSync(join(tmpdir(), 'import-router-test-'))
  const filePath = join(tempDir, 'epics.md')
  writeFileSync(filePath, content, 'utf-8')
  return filePath
}

// Helper to create tRPC caller
function createCaller(db: TestDb, projectId: string | null = TEST_PROJECT_ID) {
  return importRouter.createCaller({
    db,
    projectRoot: '/test/project',
    projectId
  })
}

describe('importRouter', () => {
  let db: TestDb
  let caller: ReturnType<typeof createCaller>

  beforeEach(() => {
    db = createTestDb()
    caller = createCaller(db)
  })

  describe('importStoriesFromEpics', () => {
    it('throws NOT_FOUND for missing epics file', async () => {
      await expect(
        caller.importStoriesFromEpics({
          projectId: TEST_PROJECT_ID,
          epicsFilePath: '/non/existent/epics.md'
        })
      ).rejects.toThrow(TRPCError)

      await expect(
        caller.importStoriesFromEpics({
          projectId: TEST_PROJECT_ID,
          epicsFilePath: '/non/existent/epics.md'
        })
      ).rejects.toThrow('Epics file not found')
    })

    it('returns import result on success', async () => {
      const content = `## Epic 1: Foundation

**Goal:** Set up base.

### Story 1.1: Initialize

As a developer,
I want to initialize,
So that it works.

**Acceptance Criteria:**

**Given** start
**When** I do
**Then** done
`
      const filePath = createTestEpicsFile(content)

      try {
        const result = await caller.importStoriesFromEpics({
          projectId: TEST_PROJECT_ID,
          epicsFilePath: filePath
        })

        expect(result.epicsCreated).toBe(1)
        expect(result.storiesCreated).toBe(1)
        expect(result.epicIds).toHaveLength(1)
        expect(result.storyIds).toHaveLength(1)
      } finally {
        unlinkSync(filePath)
      }
    })

    it('handles parse errors gracefully', async () => {
      // Empty file should return empty results, not error
      const filePath = createTestEpicsFile('')

      try {
        const result = await caller.importStoriesFromEpics({
          projectId: TEST_PROJECT_ID,
          epicsFilePath: filePath
        })

        expect(result.epicsCreated).toBe(0)
        expect(result.storiesCreated).toBe(0)
      } finally {
        unlinkSync(filePath)
      }
    })

    it('throws PRECONDITION_FAILED when no project is open', async () => {
      const callerWithoutProject = createCaller(db, null)
      const filePath = createTestEpicsFile('## Epic 1: Test\n')

      try {
        await expect(
          callerWithoutProject.importStoriesFromEpics({
            projectId: TEST_PROJECT_ID,
            epicsFilePath: filePath
          })
        ).rejects.toThrow('No project open')
      } finally {
        unlinkSync(filePath)
      }
    })

    it('imports multiple epics with stories', async () => {
      const content = `## Epic 1: Foundation

**Goal:** Base setup.

### Story 1.1: Setup

As a dev,
I want setup,
So that ready.

**Acceptance Criteria:**

**Given** a
**When** b
**Then** c

---

## Epic 2: Features

**Goal:** Add features.

### Story 2.1: Feature A

As a user,
I want feature,
So that happy.

**Acceptance Criteria:**

**Given** x
**When** y
**Then** z

---

### Story 2.2: Feature B

As a user,
I want more,
So that better.

**Acceptance Criteria:**

**Given** m
**When** n
**Then** o
`
      const filePath = createTestEpicsFile(content)

      try {
        const result = await caller.importStoriesFromEpics({
          projectId: TEST_PROJECT_ID,
          epicsFilePath: filePath
        })

        expect(result.epicsCreated).toBe(2)
        expect(result.storiesCreated).toBe(3)

        // Verify database state
        const epics = db.select().from(schema.epics).all()
        expect(epics).toHaveLength(2)

        const tasks = db.select().from(schema.tasks).all()
        expect(tasks).toHaveLength(3)
      } finally {
        unlinkSync(filePath)
      }
    })
  })
})

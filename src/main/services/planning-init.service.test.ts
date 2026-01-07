import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import * as schema from '../db/schema'
import { BMAD_PLANNING_PHASES, PHASE_NUMBERS, PhaseNumber } from '../db/planning-phases'

type TestDb = BetterSQLite3Database<typeof schema>

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

  // Create the tasks table matching Drizzle schema (including is_start_here from Story 3.2, project_id from Story 3.1.5)
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
      project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_epic_id ON tasks(epic_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_sprint_id ON tasks(sprint_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_sort_order ON tasks(sort_order);
    CREATE INDEX IF NOT EXISTS idx_tasks_task_type ON tasks(task_type);
    CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
  `)

  return drizzle({ client: sqlite, schema })
}

// Inline implementation for testing (avoids electron dependency from importing db)
function initializePlanningTasks(
  testDb: TestDb,
  existingArtifacts: Map<PhaseNumber, string>
): schema.Task[] {
  const createdTasks: schema.Task[] = []

  for (const phaseNum of PHASE_NUMBERS) {
    const phase = BMAD_PLANNING_PHASES[phaseNum]
    const hasArtifact = existingArtifacts.has(phaseNum)
    const now = new Date()

    const task = testDb
      .insert(schema.tasks)
      .values({
        id: randomUUID(),
        title: phase.name,
        description: `BMAD Planning Phase ${phaseNum}: ${phase.name}`,
        task_type: 'planning',
        phase_number: phaseNum,
        phase_name: phase.name,
        bmad_agent: phase.agent,
        bmad_workflow: phase.workflow,
        status: hasArtifact ? 'done' : 'backlog',
        sort_order: phaseNum - 1,
        is_start_here: phaseNum === 1 ? true : null, // Story 3.2: Only phase 1 is "Start Here"
        created_at: now,
        updated_at: now
      })
      .returning()
      .get()

    createdTasks.push(task)
  }

  return createdTasks
}

describe('PlanningInitService', () => {
  let testDb: TestDb

  beforeEach(() => {
    testDb = createTestDb()
  })

  describe('initializePlanningTasks', () => {
    it('creates 5 planning tasks', () => {
      const result = initializePlanningTasks(testDb, new Map())

      expect(result).toHaveLength(5)
    })

    it('sets correct sort_order 0-4', () => {
      const result = initializePlanningTasks(testDb, new Map())

      for (let i = 0; i < 5; i++) {
        expect(result[i].sort_order).toBe(i)
      }
    })

    it('marks completed phases as done', () => {
      const existingArtifacts = new Map<PhaseNumber, string>()
      existingArtifacts.set(1, '/path/to/product-brief.md')
      existingArtifacts.set(2, '/path/to/prd.md')

      const result = initializePlanningTasks(testDb, existingArtifacts)

      expect(result[0].status).toBe('done') // Phase 1 - has artifact
      expect(result[1].status).toBe('done') // Phase 2 - has artifact
      expect(result[2].status).toBe('backlog') // Phase 3 - no artifact
      expect(result[3].status).toBe('backlog') // Phase 4 - no artifact
      expect(result[4].status).toBe('backlog') // Phase 5 - no artifact
    })

    it('marks incomplete phases as backlog', () => {
      const result = initializePlanningTasks(testDb, new Map())

      for (const task of result) {
        expect(task.status).toBe('backlog')
      }
    })

    it('uses correct BMAD phase data', () => {
      const result = initializePlanningTasks(testDb, new Map())

      for (let i = 0; i < 5; i++) {
        const phaseNum = (i + 1) as PhaseNumber
        const phase = BMAD_PLANNING_PHASES[phaseNum]
        const task = result[i]

        expect(task.task_type).toBe('planning')
        expect(task.phase_number).toBe(phaseNum)
        expect(task.phase_name).toBe(phase.name)
        expect(task.bmad_agent).toBe(phase.agent)
        expect(task.bmad_workflow).toBe(phase.workflow)
        expect(task.title).toBe(phase.name)
      }
    })

    it('persists tasks to database', () => {
      initializePlanningTasks(testDb, new Map())

      const dbTasks = testDb.select().from(schema.tasks).where(eq(schema.tasks.task_type, 'planning')).all()
      expect(dbTasks).toHaveLength(5)
    })

    it('creates tasks with valid UUIDs', () => {
      const result = initializePlanningTasks(testDb, new Map())

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      for (const task of result) {
        expect(task.id).toMatch(uuidRegex)
      }
    })

    it('returns tasks in phase number order', () => {
      const result = initializePlanningTasks(testDb, new Map())

      for (let i = 0; i < 5; i++) {
        expect(result[i].phase_number).toBe(i + 1)
      }
    })

    it('sets description with phase info', () => {
      const result = initializePlanningTasks(testDb, new Map())

      expect(result[0].description).toBe('BMAD Planning Phase 1: Product Brief')
      expect(result[1].description).toBe('BMAD Planning Phase 2: PRD')
      expect(result[2].description).toBe('BMAD Planning Phase 3: Architecture')
      expect(result[3].description).toBe('BMAD Planning Phase 4: UX Design')
      expect(result[4].description).toBe('BMAD Planning Phase 5: Epics & Stories')
    })

    // Story 3.2: is_start_here tests
    it('sets is_start_here to true only for phase 1 (AC: 2)', () => {
      const result = initializePlanningTasks(testDb, new Map())

      expect(result[0].is_start_here).toBe(true) // Phase 1 - Product Brief
      expect(result[1].is_start_here).toBeNull() // Phase 2 - PRD
      expect(result[2].is_start_here).toBeNull() // Phase 3 - Architecture
      expect(result[3].is_start_here).toBeNull() // Phase 4 - UX Design
      expect(result[4].is_start_here).toBeNull() // Phase 5 - Epics & Stories
    })

    it('persists is_start_here to database', () => {
      initializePlanningTasks(testDb, new Map())

      const dbTasks = testDb.select().from(schema.tasks).where(eq(schema.tasks.task_type, 'planning')).all()
      const sortedTasks = dbTasks.sort((a, b) => (a.phase_number || 0) - (b.phase_number || 0))

      expect(sortedTasks[0].is_start_here).toBe(true)
      expect(sortedTasks[1].is_start_here).toBeNull()
      expect(sortedTasks[2].is_start_here).toBeNull()
      expect(sortedTasks[3].is_start_here).toBeNull()
      expect(sortedTasks[4].is_start_here).toBeNull()
    })
  })
})

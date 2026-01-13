import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { eq } from 'drizzle-orm'
import * as schema from './schema'

type TestDb = BetterSQLite3Database<typeof schema>

// Create an in-memory SQLite database for testing task_sessions
function createTestDb(): TestDb {
  const sqlite = new Database(':memory:')

  // Enable foreign keys
  sqlite.exec('PRAGMA foreign_keys = ON;')

  // Create projects table (required for tasks FK)
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY NOT NULL,
      path TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      last_opened_at INTEGER
    );
  `)

  // Create tasks table (required for task_sessions FK)
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
      project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
  `)

  // Create task_sessions table (Story TES-1.2)
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS task_sessions (
      id TEXT PRIMARY KEY NOT NULL,
      task_id TEXT NOT NULL UNIQUE,
      session_id TEXT,
      tmux_session TEXT NOT NULL,
      current_phase TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_task_sessions_session_id ON task_sessions(session_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_task_sessions_task_id_unique ON task_sessions(task_id);
  `)

  return drizzle({ client: sqlite, schema })
}

describe('Story TES-1.2: Task Session Database Schema', () => {
  let db: TestDb

  beforeEach(() => {
    db = createTestDb()
  })

  describe('table structure (AC: #1)', () => {
    it('creates task_sessions table with all required columns', () => {
      // First create a task to reference
      db.insert(schema.tasks)
        .values({
          id: 'task-1',
          title: 'Test Task',
          created_at: new Date(),
          updated_at: new Date()
        })
        .run()

      // Insert a task session with all columns
      db.insert(schema.task_sessions)
        .values({
          id: 'session-1',
          task_id: 'task-1',
          session_id: 'claude-session-abc',
          tmux_session: 'tinsu-myproject-task-1',
          current_phase: 'dev-story',
          created_at: new Date()
        })
        .run()

      const session = db
        .select()
        .from(schema.task_sessions)
        .where(eq(schema.task_sessions.id, 'session-1'))
        .get()

      expect(session).not.toBeNull()
      expect(session?.id).toBe('session-1')
      expect(session?.task_id).toBe('task-1')
      expect(session?.session_id).toBe('claude-session-abc')
      expect(session?.tmux_session).toBe('tinsu-myproject-task-1')
      expect(session?.current_phase).toBe('dev-story')
      expect(session?.created_at).toBeInstanceOf(Date)
    })

    it('allows nullable session_id (set when Claude Code starts)', () => {
      db.insert(schema.tasks)
        .values({
          id: 'task-2',
          title: 'Test Task 2',
          created_at: new Date(),
          updated_at: new Date()
        })
        .run()

      db.insert(schema.task_sessions)
        .values({
          id: 'session-2',
          task_id: 'task-2',
          tmux_session: 'tinsu-myproject-task-2',
          created_at: new Date()
        })
        .run()

      const session = db
        .select()
        .from(schema.task_sessions)
        .where(eq(schema.task_sessions.id, 'session-2'))
        .get()

      expect(session?.session_id).toBeNull()
    })

    it('allows nullable current_phase (set when workflow starts)', () => {
      db.insert(schema.tasks)
        .values({
          id: 'task-3',
          title: 'Test Task 3',
          created_at: new Date(),
          updated_at: new Date()
        })
        .run()

      db.insert(schema.task_sessions)
        .values({
          id: 'session-3',
          task_id: 'task-3',
          tmux_session: 'tinsu-myproject-task-3',
          created_at: new Date()
        })
        .run()

      const session = db
        .select()
        .from(schema.task_sessions)
        .where(eq(schema.task_sessions.id, 'session-3'))
        .get()

      expect(session?.current_phase).toBeNull()
    })

    it('supports all valid current_phase values', () => {
      const phases = ['dev-story', 'code-review', 'user-feedback'] as const

      phases.forEach((phase, index) => {
        const taskId = `task-phase-${index}`
        const sessionId = `session-phase-${index}`

        db.insert(schema.tasks)
          .values({
            id: taskId,
            title: `Task for ${phase}`,
            created_at: new Date(),
            updated_at: new Date()
          })
          .run()

        db.insert(schema.task_sessions)
          .values({
            id: sessionId,
            task_id: taskId,
            tmux_session: `tinsu-myproject-${taskId}`,
            current_phase: phase,
            created_at: new Date()
          })
          .run()

        const session = db
          .select()
          .from(schema.task_sessions)
          .where(eq(schema.task_sessions.id, sessionId))
          .get()

        expect(session?.current_phase).toBe(phase)
      })
    })
  })

  describe('foreign key constraint (AC: #1)', () => {
    it('allows insert with valid task_id', () => {
      db.insert(schema.tasks)
        .values({
          id: 'valid-task',
          title: 'Valid Task',
          created_at: new Date(),
          updated_at: new Date()
        })
        .run()

      // Should not throw
      expect(() => {
        db.insert(schema.task_sessions)
          .values({
            id: 'fk-session',
            task_id: 'valid-task',
            tmux_session: 'tinsu-myproject-valid-task',
            created_at: new Date()
          })
          .run()
      }).not.toThrow()
    })

    it('rejects insert with invalid task_id', () => {
      // Should throw due to foreign key constraint
      expect(() => {
        db.insert(schema.task_sessions)
          .values({
            id: 'invalid-session',
            task_id: 'nonexistent-task',
            tmux_session: 'tinsu-myproject-nonexistent',
            created_at: new Date()
          })
          .run()
      }).toThrow()
    })
  })

  describe('ON DELETE CASCADE (AC: #2)', () => {
    it('deletes task_session when associated task is deleted', () => {
      // Create task
      db.insert(schema.tasks)
        .values({
          id: 'cascade-task',
          title: 'Task to Delete',
          created_at: new Date(),
          updated_at: new Date()
        })
        .run()

      // Create session for the task
      db.insert(schema.task_sessions)
        .values({
          id: 'cascade-session',
          task_id: 'cascade-task',
          tmux_session: 'tinsu-myproject-cascade-task',
          session_id: 'some-session-id',
          current_phase: 'dev-story',
          created_at: new Date()
        })
        .run()

      // Verify session exists
      const sessionBefore = db
        .select()
        .from(schema.task_sessions)
        .where(eq(schema.task_sessions.id, 'cascade-session'))
        .get()
      expect(sessionBefore).not.toBeNull()

      // Delete the task
      db.delete(schema.tasks).where(eq(schema.tasks.id, 'cascade-task')).run()

      // Verify session is also deleted (CASCADE)
      const sessionAfter = db
        .select()
        .from(schema.task_sessions)
        .where(eq(schema.task_sessions.id, 'cascade-session'))
        .get()
      expect(sessionAfter).toBeUndefined()
    })
  })

  describe('unique constraint on task_id (AC: #1)', () => {
    it('enforces only one session per task', () => {
      db.insert(schema.tasks)
        .values({
          id: 'unique-task',
          title: 'Task with One Session',
          created_at: new Date(),
          updated_at: new Date()
        })
        .run()

      // First session should succeed
      db.insert(schema.task_sessions)
        .values({
          id: 'first-session',
          task_id: 'unique-task',
          tmux_session: 'tinsu-myproject-unique-task',
          created_at: new Date()
        })
        .run()

      // Second session for same task should fail
      expect(() => {
        db.insert(schema.task_sessions)
          .values({
            id: 'second-session',
            task_id: 'unique-task',
            tmux_session: 'tinsu-myproject-unique-task-2',
            created_at: new Date()
          })
          .run()
      }).toThrow()
    })
  })

  describe('session_id index (AC: #1)', () => {
    it('allows fast lookups by session_id', () => {
      // Create multiple tasks and sessions
      for (let i = 1; i <= 5; i++) {
        db.insert(schema.tasks)
          .values({
            id: `index-task-${i}`,
            title: `Task ${i}`,
            created_at: new Date(),
            updated_at: new Date()
          })
          .run()

        db.insert(schema.task_sessions)
          .values({
            id: `index-session-${i}`,
            task_id: `index-task-${i}`,
            session_id: `claude-${i}`,
            tmux_session: `tinsu-myproject-index-task-${i}`,
            created_at: new Date()
          })
          .run()
      }

      // Query by session_id should use the index
      const session = db
        .select()
        .from(schema.task_sessions)
        .where(eq(schema.task_sessions.session_id, 'claude-3'))
        .get()

      expect(session).not.toBeNull()
      expect(session?.task_id).toBe('index-task-3')
    })
  })

  describe('type exports', () => {
    it('exports SESSION_PHASE constant', () => {
      expect(schema.SESSION_PHASE).toEqual(['dev-story', 'code-review', 'user-feedback'])
    })

    it('TaskSession type includes all fields', () => {
      db.insert(schema.tasks)
        .values({
          id: 'type-task',
          title: 'Type Test Task',
          created_at: new Date(),
          updated_at: new Date()
        })
        .run()

      const inserted = db
        .insert(schema.task_sessions)
        .values({
          id: 'type-session',
          task_id: 'type-task',
          session_id: 'claude-type',
          tmux_session: 'tinsu-myproject-type-task',
          current_phase: 'dev-story',
          created_at: new Date()
        })
        .returning()
        .get()

      // TypeScript would catch if these properties don't exist
      const session: schema.TaskSession = inserted
      expect(session.id).toBe('type-session')
      expect(session.task_id).toBe('type-task')
      expect(session.session_id).toBe('claude-type')
      expect(session.tmux_session).toBe('tinsu-myproject-type-task')
      expect(session.current_phase).toBe('dev-story')
      expect(session.created_at).toBeInstanceOf(Date)
    })
  })
})

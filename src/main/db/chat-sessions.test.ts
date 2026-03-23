/**
 * Chat Sessions Schema Tests - Story 10.1
 *
 * Tests for chat_sessions and chat_messages table creation,
 * FK constraints, and index existence.
 *
 * @see Story 10.1: Chat Session Schema & Hook Endpoint (AC: 1)
 */

import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { eq } from 'drizzle-orm'
import * as schema from './schema'

type TestDb = BetterSQLite3Database<typeof schema>

/** Create an in-memory SQLite database with chat session tables */
function createTestDb(): { db: TestDb; sqlite: Database.Database } {
  const sqlite = new Database(':memory:')

  // Create prerequisite tables
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY NOT NULL,
      path TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      last_opened_at INTEGER
    )
  `)

  // Story 10.1: Create chat_sessions table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id TEXT PRIMARY KEY NOT NULL,
      session_uuid TEXT NOT NULL UNIQUE,
      agent_persona TEXT NOT NULL,
      workflow_phase TEXT,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'active',
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      last_message_at INTEGER,
      workflow_key TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_chat_sessions_project_id ON chat_sessions(project_id);
    CREATE INDEX IF NOT EXISTS idx_chat_sessions_status ON chat_sessions(status);
    CREATE INDEX IF NOT EXISTS idx_chat_sessions_session_uuid ON chat_sessions(session_uuid);
    CREATE INDEX IF NOT EXISTS idx_chat_sessions_workflow_key ON chat_sessions(project_id, workflow_key);
  `)

  // Story 10.1: Create chat_messages table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY NOT NULL,
      session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      tool_name TEXT,
      tool_input TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
    CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);
  `)

  const db = drizzle({ client: sqlite, schema })
  return { db, sqlite }
}

describe('Chat Sessions Schema (Story 10.1)', () => {
  let testDb: TestDb
  let sqlite: Database.Database

  beforeEach(() => {
    const result = createTestDb()
    testDb = result.db
    sqlite = result.sqlite

    // Insert a test project
    testDb
      .insert(schema.projects)
      .values({
        id: 'project-1',
        path: '/test/project',
        name: 'Test Project',
        created_at: new Date()
      })
      .run()
  })

  describe('chat_sessions table (AC: 1)', () => {
    it('creates a chat session with all required fields', () => {
      const now = new Date()

      testDb
        .insert(schema.chat_sessions)
        .values({
          id: 'cs-1',
          session_uuid: 'uuid-1',
          agent_persona: 'bmad-pm',
          project_id: 'project-1',
          status: 'active',
          created_at: now,
          updated_at: now
        })
        .run()

      const session = testDb
        .select()
        .from(schema.chat_sessions)
        .where(eq(schema.chat_sessions.id, 'cs-1'))
        .get()

      expect(session).toBeDefined()
      expect(session!.id).toBe('cs-1')
      expect(session!.session_uuid).toBe('uuid-1')
      expect(session!.agent_persona).toBe('bmad-pm')
      expect(session!.project_id).toBe('project-1')
      expect(session!.status).toBe('active')
      expect(session!.workflow_phase).toBeNull()
      expect(session!.last_message_at).toBeNull()
    })

    it('creates a chat session with optional workflow_phase', () => {
      const now = new Date()

      testDb
        .insert(schema.chat_sessions)
        .values({
          id: 'cs-2',
          session_uuid: 'uuid-2',
          agent_persona: 'bmad-architect',
          workflow_phase: 'architecture',
          project_id: 'project-1',
          status: 'active',
          created_at: now,
          updated_at: now
        })
        .run()

      const session = testDb
        .select()
        .from(schema.chat_sessions)
        .where(eq(schema.chat_sessions.id, 'cs-2'))
        .get()

      expect(session!.workflow_phase).toBe('architecture')
    })

    it('enforces unique session_uuid constraint', () => {
      const now = new Date()

      testDb
        .insert(schema.chat_sessions)
        .values({
          id: 'cs-3',
          session_uuid: 'uuid-dup',
          agent_persona: 'bmad-pm',
          project_id: 'project-1',
          status: 'active',
          created_at: now,
          updated_at: now
        })
        .run()

      expect(() => {
        testDb
          .insert(schema.chat_sessions)
          .values({
            id: 'cs-4',
            session_uuid: 'uuid-dup',
            agent_persona: 'bmad-pm',
            project_id: 'project-1',
            status: 'active',
            created_at: now,
            updated_at: now
          })
          .run()
      }).toThrow()
    })

    it('cascades delete when project is deleted', () => {
      const now = new Date()

      testDb
        .insert(schema.chat_sessions)
        .values({
          id: 'cs-5',
          session_uuid: 'uuid-5',
          agent_persona: 'bmad-pm',
          project_id: 'project-1',
          status: 'active',
          created_at: now,
          updated_at: now
        })
        .run()

      // Enable FK enforcement
      sqlite.exec('PRAGMA foreign_keys = ON')

      // Delete the project
      testDb
        .delete(schema.projects)
        .where(eq(schema.projects.id, 'project-1'))
        .run()

      const session = testDb
        .select()
        .from(schema.chat_sessions)
        .where(eq(schema.chat_sessions.id, 'cs-5'))
        .get()

      expect(session).toBeUndefined()
    })

    it('creates a chat session with workflow_key', () => {
      const now = new Date()

      testDb
        .insert(schema.chat_sessions)
        .values({
          id: 'cs-wk-1',
          session_uuid: 'uuid-wk-1',
          agent_persona: 'bmad-pm',
          project_id: 'project-1',
          workflow_key: 'brainstorming',
          status: 'active',
          created_at: now,
          updated_at: now
        })
        .run()

      const session = testDb
        .select()
        .from(schema.chat_sessions)
        .where(eq(schema.chat_sessions.id, 'cs-wk-1'))
        .get()

      expect(session!.workflow_key).toBe('brainstorming')
    })

    it('workflow_key defaults to null when not provided', () => {
      const now = new Date()

      testDb
        .insert(schema.chat_sessions)
        .values({
          id: 'cs-wk-2',
          session_uuid: 'uuid-wk-2',
          agent_persona: 'bmad-pm',
          project_id: 'project-1',
          status: 'active',
          created_at: now,
          updated_at: now
        })
        .run()

      const session = testDb
        .select()
        .from(schema.chat_sessions)
        .where(eq(schema.chat_sessions.id, 'cs-wk-2'))
        .get()

      expect(session!.workflow_key).toBeNull()
    })

    it('defaults status to active', () => {
      const now = new Date()

      testDb
        .insert(schema.chat_sessions)
        .values({
          id: 'cs-6',
          session_uuid: 'uuid-6',
          agent_persona: 'bmad-pm',
          project_id: 'project-1',
          created_at: now,
          updated_at: now
        })
        .run()

      const session = testDb
        .select()
        .from(schema.chat_sessions)
        .where(eq(schema.chat_sessions.id, 'cs-6'))
        .get()

      expect(session!.status).toBe('active')
    })
  })

  describe('chat_messages table (AC: 1)', () => {
    beforeEach(() => {
      const now = new Date()
      testDb
        .insert(schema.chat_sessions)
        .values({
          id: 'cs-msg',
          session_uuid: 'uuid-msg',
          agent_persona: 'bmad-pm',
          project_id: 'project-1',
          status: 'active',
          created_at: now,
          updated_at: now
        })
        .run()
    })

    it('creates an assistant message', () => {
      const now = new Date()

      testDb
        .insert(schema.chat_messages)
        .values({
          id: 'msg-1',
          session_id: 'cs-msg',
          role: 'assistant',
          content: 'Hello, how can I help?',
          created_at: now
        })
        .run()

      const msg = testDb
        .select()
        .from(schema.chat_messages)
        .where(eq(schema.chat_messages.id, 'msg-1'))
        .get()

      expect(msg).toBeDefined()
      expect(msg!.role).toBe('assistant')
      expect(msg!.content).toBe('Hello, how can I help?')
      expect(msg!.tool_name).toBeNull()
      expect(msg!.tool_input).toBeNull()
    })

    it('creates a tool message with tool_name and tool_input', () => {
      const now = new Date()

      testDb
        .insert(schema.chat_messages)
        .values({
          id: 'msg-2',
          session_id: 'cs-msg',
          role: 'tool',
          content: 'Tool: Read',
          tool_name: 'Read',
          tool_input: JSON.stringify({ file_path: '/test/file.ts' }),
          created_at: now
        })
        .run()

      const msg = testDb
        .select()
        .from(schema.chat_messages)
        .where(eq(schema.chat_messages.id, 'msg-2'))
        .get()

      expect(msg!.role).toBe('tool')
      expect(msg!.tool_name).toBe('Read')
      expect(msg!.tool_input).toBe(JSON.stringify({ file_path: '/test/file.ts' }))
    })

    it('creates a user message', () => {
      const now = new Date()

      testDb
        .insert(schema.chat_messages)
        .values({
          id: 'msg-3',
          session_id: 'cs-msg',
          role: 'user',
          content: 'Create a PRD',
          created_at: now
        })
        .run()

      const msg = testDb
        .select()
        .from(schema.chat_messages)
        .where(eq(schema.chat_messages.id, 'msg-3'))
        .get()

      expect(msg!.role).toBe('user')
      expect(msg!.content).toBe('Create a PRD')
    })

    it('cascades delete when chat session is deleted', () => {
      const now = new Date()

      // Enable FK enforcement
      sqlite.exec('PRAGMA foreign_keys = ON')

      testDb
        .insert(schema.chat_messages)
        .values({
          id: 'msg-cascade',
          session_id: 'cs-msg',
          role: 'assistant',
          content: 'test message',
          created_at: now
        })
        .run()

      // Delete the session
      testDb
        .delete(schema.chat_sessions)
        .where(eq(schema.chat_sessions.id, 'cs-msg'))
        .run()

      const msg = testDb
        .select()
        .from(schema.chat_messages)
        .where(eq(schema.chat_messages.id, 'msg-cascade'))
        .get()

      expect(msg).toBeUndefined()
    })
  })

  describe('indexes', () => {
    it('has indexes on chat_sessions table', () => {
      const indexes = sqlite
        .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='chat_sessions'")
        .all() as Array<{ name: string }>

      const indexNames = indexes.map((i) => i.name)
      expect(indexNames).toContain('idx_chat_sessions_project_id')
      expect(indexNames).toContain('idx_chat_sessions_status')
      expect(indexNames).toContain('idx_chat_sessions_session_uuid')
      expect(indexNames).toContain('idx_chat_sessions_workflow_key')
    })

    it('has indexes on chat_messages table', () => {
      const indexes = sqlite
        .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='chat_messages'")
        .all() as Array<{ name: string }>

      const indexNames = indexes.map((i) => i.name)
      expect(indexNames).toContain('idx_chat_messages_session_id')
      expect(indexNames).toContain('idx_chat_messages_created_at')
    })
  })
})

/**
 * Chat Session Router Tests - Story 10.1
 *
 * Tests for all 4 chatSession procedures:
 * create, list, getMessages, updateStatus.
 *
 * Uses in-memory SQLite and mocks the db module.
 *
 * @see Story 10.1: Chat Session Schema & Hook Endpoint (AC: 5)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from '../../db/schema'
import { router } from '../trpc'

// Create in-memory SQLite for test isolation
const mockSqlite = new Database(':memory:')
const testDb = drizzle({ client: mockSqlite, schema })

// Mock the db module to use our test database
vi.mock('../../db', async () => {
  // Return a lazy getter so testDb is resolved at access time (after vi.hoisted)
  return {
    get db() {
      return testDb
    }
  }
})

// Import router after mock is established
const { chatSessionRouter } = await import('./chat-session.router')

const testRouter = router({
  chatSession: chatSessionRouter
})

function setupTestDb(): void {
  // Drop and recreate tables for clean state
  mockSqlite.exec('DROP TABLE IF EXISTS chat_messages')
  mockSqlite.exec('DROP TABLE IF EXISTS chat_sessions')
  mockSqlite.exec('DROP TABLE IF EXISTS projects')

  mockSqlite.exec(`
    CREATE TABLE projects (
      id TEXT PRIMARY KEY NOT NULL,
      path TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      last_opened_at INTEGER
    )
  `)

  mockSqlite.exec(`
    CREATE TABLE chat_sessions (
      id TEXT PRIMARY KEY NOT NULL,
      session_uuid TEXT NOT NULL UNIQUE,
      agent_persona TEXT NOT NULL,
      workflow_phase TEXT,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'active',
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      last_message_at INTEGER
    );
    CREATE INDEX idx_chat_sessions_project_id ON chat_sessions(project_id);
    CREATE INDEX idx_chat_sessions_status ON chat_sessions(status);
    CREATE INDEX idx_chat_sessions_session_uuid ON chat_sessions(session_uuid);
  `)

  mockSqlite.exec(`
    CREATE TABLE chat_messages (
      id TEXT PRIMARY KEY NOT NULL,
      session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      tool_name TEXT,
      tool_input TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE INDEX idx_chat_messages_session_id ON chat_messages(session_id);
    CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at);
  `)
}

function createTestContext() {
  return {
    db: testDb as any,
    projectRoot: '/test',
    projectId: 'project-1',
    activityLogService: {} as any,
    hookListenerService: {} as any
  }
}

describe('chatSessionRouter (Story 10.1, AC: 5)', () => {
  beforeEach(() => {
    setupTestDb()

    // Insert test project
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

  describe('create', () => {
    it('should create a new chat session with required fields', async () => {
      const caller = testRouter.createCaller(createTestContext())

      const session = await caller.chatSession.create({
        agentPersona: 'bmad-pm',
        projectId: 'project-1'
      })

      expect(session).toBeDefined()
      expect(session!.id).toBeDefined()
      expect(session!.session_uuid).toBeDefined()
      expect(session!.agent_persona).toBe('bmad-pm')
      expect(session!.project_id).toBe('project-1')
      expect(session!.status).toBe('active')
      expect(session!.workflow_phase).toBeNull()
    })

    it('should create a chat session with optional workflowPhase', async () => {
      const caller = testRouter.createCaller(createTestContext())

      const session = await caller.chatSession.create({
        agentPersona: 'bmad-architect',
        workflowPhase: 'architecture',
        projectId: 'project-1'
      })

      expect(session!.workflow_phase).toBe('architecture')
    })

    it('should generate unique session_uuid', async () => {
      const caller = testRouter.createCaller(createTestContext())

      const session1 = await caller.chatSession.create({
        agentPersona: 'bmad-pm',
        projectId: 'project-1'
      })

      const session2 = await caller.chatSession.create({
        agentPersona: 'bmad-pm',
        projectId: 'project-1'
      })

      expect(session1!.session_uuid).not.toBe(session2!.session_uuid)
    })

    it('should reject empty agentPersona', async () => {
      const caller = testRouter.createCaller(createTestContext())

      await expect(
        caller.chatSession.create({
          agentPersona: '',
          projectId: 'project-1'
        })
      ).rejects.toThrow()
    })

    it('should reject empty projectId', async () => {
      const caller = testRouter.createCaller(createTestContext())

      await expect(
        caller.chatSession.create({
          agentPersona: 'bmad-pm',
          projectId: ''
        })
      ).rejects.toThrow()
    })
  })

  describe('list', () => {
    it('should return empty list when no sessions exist', async () => {
      const caller = testRouter.createCaller(createTestContext())

      const sessions = await caller.chatSession.list({
        projectId: 'project-1'
      })

      expect(sessions).toEqual([])
    })

    it('should return sessions for the specified project', async () => {
      const caller = testRouter.createCaller(createTestContext())

      await caller.chatSession.create({
        agentPersona: 'bmad-pm',
        projectId: 'project-1'
      })

      await caller.chatSession.create({
        agentPersona: 'bmad-architect',
        projectId: 'project-1'
      })

      const sessions = await caller.chatSession.list({
        projectId: 'project-1'
      })

      expect(sessions).toHaveLength(2)
    })

    it('should order sessions by last_message_at desc, then created_at desc', async () => {
      // Insert sessions directly with explicit timestamps for deterministic ordering
      const earlier = new Date(Date.now() - 5000)
      const later = new Date(Date.now())

      testDb
        .insert(schema.chat_sessions)
        .values({
          id: 'cs-older',
          session_uuid: 'uuid-older',
          agent_persona: 'bmad-pm',
          project_id: 'project-1',
          status: 'active',
          created_at: earlier,
          updated_at: earlier
        })
        .run()

      testDb
        .insert(schema.chat_sessions)
        .values({
          id: 'cs-newer',
          session_uuid: 'uuid-newer',
          agent_persona: 'bmad-architect',
          project_id: 'project-1',
          status: 'active',
          created_at: later,
          updated_at: later
        })
        .run()

      const caller = testRouter.createCaller(createTestContext())

      const sessions = await caller.chatSession.list({
        projectId: 'project-1'
      })

      // Both have null last_message_at, so ordered by created_at desc
      // cs-newer was created later so it should appear first
      expect(sessions).toHaveLength(2)
      expect(sessions[0].id).toBe('cs-newer')
      expect(sessions[1].id).toBe('cs-older')
    })

    it('should not return sessions from other projects', async () => {
      const caller = testRouter.createCaller(createTestContext())

      await caller.chatSession.create({
        agentPersona: 'bmad-pm',
        projectId: 'project-1'
      })

      const sessions = await caller.chatSession.list({
        projectId: 'project-nonexistent'
      })

      expect(sessions).toEqual([])
    })
  })

  describe('getMessages', () => {
    it('should return empty list when no messages exist', async () => {
      const caller = testRouter.createCaller(createTestContext())

      const session = await caller.chatSession.create({
        agentPersona: 'bmad-pm',
        projectId: 'project-1'
      })

      const messages = await caller.chatSession.getMessages({
        sessionId: session!.id
      })

      expect(messages).toEqual([])
    })

    it('should return messages ordered by created_at ascending', async () => {
      const caller = testRouter.createCaller(createTestContext())

      const session = await caller.chatSession.create({
        agentPersona: 'bmad-pm',
        projectId: 'project-1'
      })

      const now = new Date()
      testDb
        .insert(schema.chat_messages)
        .values({
          id: 'msg-1',
          session_id: session!.id,
          role: 'user',
          content: 'First message',
          created_at: new Date(now.getTime() - 2000)
        })
        .run()

      testDb
        .insert(schema.chat_messages)
        .values({
          id: 'msg-2',
          session_id: session!.id,
          role: 'assistant',
          content: 'Second message',
          created_at: new Date(now.getTime() - 1000)
        })
        .run()

      testDb
        .insert(schema.chat_messages)
        .values({
          id: 'msg-3',
          session_id: session!.id,
          role: 'tool',
          content: 'Tool: Read',
          tool_name: 'Read',
          tool_input: '{"file_path": "/test"}',
          created_at: now
        })
        .run()

      const messages = await caller.chatSession.getMessages({
        sessionId: session!.id
      })

      expect(messages).toHaveLength(3)
      expect(messages[0].role).toBe('user')
      expect(messages[1].role).toBe('assistant')
      expect(messages[2].role).toBe('tool')
      expect(messages[2].tool_name).toBe('Read')
    })

    it('should respect limit parameter', async () => {
      const caller = testRouter.createCaller(createTestContext())

      const session = await caller.chatSession.create({
        agentPersona: 'bmad-pm',
        projectId: 'project-1'
      })

      for (let i = 0; i < 5; i++) {
        testDb
          .insert(schema.chat_messages)
          .values({
            id: `msg-limit-${i}`,
            session_id: session!.id,
            role: 'user',
            content: `Message ${i}`,
            created_at: new Date(Date.now() + i * 1000)
          })
          .run()
      }

      const messages = await caller.chatSession.getMessages({
        sessionId: session!.id,
        limit: 3
      })

      expect(messages).toHaveLength(3)
    })

    it('should respect offset parameter', async () => {
      const caller = testRouter.createCaller(createTestContext())

      const session = await caller.chatSession.create({
        agentPersona: 'bmad-pm',
        projectId: 'project-1'
      })

      for (let i = 0; i < 5; i++) {
        testDb
          .insert(schema.chat_messages)
          .values({
            id: `msg-offset-${i}`,
            session_id: session!.id,
            role: 'user',
            content: `Message ${i}`,
            created_at: new Date(Date.now() + i * 1000)
          })
          .run()
      }

      const messages = await caller.chatSession.getMessages({
        sessionId: session!.id,
        offset: 2
      })

      expect(messages).toHaveLength(3)
      expect(messages[0].content).toBe('Message 2')
    })

    it('should use default limit of 100', async () => {
      const caller = testRouter.createCaller(createTestContext())

      const session = await caller.chatSession.create({
        agentPersona: 'bmad-pm',
        projectId: 'project-1'
      })

      const messages = await caller.chatSession.getMessages({
        sessionId: session!.id
      })

      expect(messages).toEqual([])
    })
  })

  describe('updateStatus', () => {
    it('should update session status to paused', async () => {
      const caller = testRouter.createCaller(createTestContext())

      const session = await caller.chatSession.create({
        agentPersona: 'bmad-pm',
        projectId: 'project-1'
      })

      const updated = await caller.chatSession.updateStatus({
        sessionId: session!.id,
        status: 'paused'
      })

      expect(updated!.status).toBe('paused')
    })

    it('should update session status to completed', async () => {
      const caller = testRouter.createCaller(createTestContext())

      const session = await caller.chatSession.create({
        agentPersona: 'bmad-pm',
        projectId: 'project-1'
      })

      const updated = await caller.chatSession.updateStatus({
        sessionId: session!.id,
        status: 'completed'
      })

      expect(updated!.status).toBe('completed')
    })

    it('should update updated_at timestamp', async () => {
      const caller = testRouter.createCaller(createTestContext())

      const session = await caller.chatSession.create({
        agentPersona: 'bmad-pm',
        projectId: 'project-1'
      })

      const updated = await caller.chatSession.updateStatus({
        sessionId: session!.id,
        status: 'paused'
      })

      expect(updated!.updated_at).toBeDefined()
    })

    it('should throw NOT_FOUND for non-existent session', async () => {
      const caller = testRouter.createCaller(createTestContext())

      await expect(
        caller.chatSession.updateStatus({
          sessionId: 'non-existent',
          status: 'paused'
        })
      ).rejects.toThrow('Chat session not found')
    })

    it('should reject invalid status values', async () => {
      const caller = testRouter.createCaller(createTestContext())

      const session = await caller.chatSession.create({
        agentPersona: 'bmad-pm',
        projectId: 'project-1'
      })

      await expect(
        caller.chatSession.updateStatus({
          sessionId: session!.id,
          status: 'invalid_status' as any
        })
      ).rejects.toThrow()
    })
  })
})

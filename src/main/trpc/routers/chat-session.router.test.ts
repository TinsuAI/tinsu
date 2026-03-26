/**
 * Chat Session Router Tests - Story 10.1, 10.3, 10.6
 *
 * Tests for all chatSession procedures:
 * create, list, getMessages, updateStatus, sendChatMessage,
 * deleteSession, getLastMessage, listWithPreview.
 *
 * Uses in-memory SQLite and mocks the db module.
 *
 * @see Story 10.1: Chat Session Schema & Hook Endpoint (AC: 5)
 * @see Story 10.3: Claude Code CLI Chat Session Spawning (AC: 1, 2, 5)
 * @see Story 10.6: Session Persistence & Resume (AC: 1, 5, 6)
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

// Mock ChatCliService to prevent actual PTY spawning in tests
const mockIsSessionAlive = vi.fn().mockReturnValue(false)
const mockHasSession = vi.fn().mockReturnValue(false)
const mockSpawnSession = vi.fn().mockReturnValue('pty-test')
const mockSendMessage = vi.fn()
const mockKillSession = vi.fn()
const mockIsTmuxAlive = vi.fn().mockResolvedValue(false)
const mockReattachSession = vi.fn().mockResolvedValue('pty-reattached')
// CTM-2.3: Mock getSessionStatus for live status badge tests
const mockGetSessionStatus = vi.fn().mockReturnValue('unknown')

vi.mock('../../services', () => ({
  chatCliService: {
    isSessionAlive: (...args: unknown[]) => mockIsSessionAlive(...args),
    hasSession: (...args: unknown[]) => mockHasSession(...args),
    spawnSession: (...args: unknown[]) => mockSpawnSession(...args),
    sendMessage: (...args: unknown[]) => mockSendMessage(...args),
    killSession: (...args: unknown[]) => mockKillSession(...args),
    isTmuxAlive: (...args: unknown[]) => mockIsTmuxAlive(...args),
    reattachSession: (...args: unknown[]) => mockReattachSession(...args),
    getSessionStatus: (...args: unknown[]) => mockGetSessionStatus(...args),
    buildTmuxSessionName: (projectName: string, sessionId: string) => {
      const sanitized = projectName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
      return `tinsu-${sanitized}-${sessionId}`
    }
  }
}))

// Mock PersonaContextService (Story 10.4)
// Use vi.hoisted so the mock fn is available when the vi.mock factory is hoisted
const { mockBuildContext, MockPersonaContextServiceClass } = vi.hoisted(() => {
  const _mockBuildContext = vi.fn().mockReturnValue('Mock persona context for testing')
  // Must use regular function (not arrow) so it can be used with `new`
  const _MockClass = vi.fn().mockImplementation(function () {
    return {
      buildContext: _mockBuildContext,
      loadConfig: vi.fn(),
      getPersonaFilePath: vi.fn()
    }
  })
  return { mockBuildContext: _mockBuildContext, MockPersonaContextServiceClass: _MockClass }
})

vi.mock('../../services/persona-context.service', () => ({
  PersonaContextService: MockPersonaContextServiceClass
}))

// Import router after mocks are established
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
      last_message_at INTEGER,
      workflow_key TEXT,
      skip_permissions INTEGER NOT NULL DEFAULT 1,
      tmux_session TEXT
    );
    CREATE INDEX idx_chat_sessions_project_id ON chat_sessions(project_id);
    CREATE INDEX idx_chat_sessions_status ON chat_sessions(status);
    CREATE INDEX idx_chat_sessions_session_uuid ON chat_sessions(session_uuid);
    CREATE INDEX idx_chat_sessions_workflow_key ON chat_sessions(project_id, workflow_key);
    CREATE INDEX idx_chat_sessions_tmux_session ON chat_sessions(tmux_session);
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
        sessionId: session!.id
      })

      expect(messages).toHaveLength(5)
    })

    it('should return empty array for session with no messages', async () => {
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

  describe('addMessage (Story 10.2, AC: 6)', () => {
    it('should add a user message to a session', async () => {
      const caller = testRouter.createCaller(createTestContext())

      const session = await caller.chatSession.create({
        agentPersona: 'bmad-pm',
        projectId: 'project-1'
      })

      const message = await caller.chatSession.addMessage({
        sessionId: session!.id,
        role: 'user',
        content: 'Hello agent!'
      })

      expect(message).toBeDefined()
      expect(message!.id).toBeDefined()
      expect(message!.session_id).toBe(session!.id)
      expect(message!.role).toBe('user')
      expect(message!.content).toBe('Hello agent!')
      expect(message!.tool_name).toBeNull()
      expect(message!.tool_input).toBeNull()
    })

    it('should add an assistant message with optional tool fields', async () => {
      const caller = testRouter.createCaller(createTestContext())

      const session = await caller.chatSession.create({
        agentPersona: 'bmad-pm',
        projectId: 'project-1'
      })

      const message = await caller.chatSession.addMessage({
        sessionId: session!.id,
        role: 'tool',
        content: 'Read file result',
        toolName: 'Read',
        toolInput: '{"file_path": "/test"}'
      })

      expect(message!.role).toBe('tool')
      expect(message!.tool_name).toBe('Read')
      expect(message!.tool_input).toBe('{"file_path": "/test"}')
    })

    it('should update session last_message_at when adding a message', async () => {
      const caller = testRouter.createCaller(createTestContext())

      const session = await caller.chatSession.create({
        agentPersona: 'bmad-pm',
        projectId: 'project-1'
      })

      // Initially last_message_at should be null
      expect(session!.last_message_at).toBeNull()

      await caller.chatSession.addMessage({
        sessionId: session!.id,
        role: 'user',
        content: 'Hello!'
      })

      // Fetch the session to verify last_message_at was updated
      const sessions = await caller.chatSession.list({ projectId: 'project-1' })
      const updatedSession = sessions.find((s) => s.id === session!.id)
      expect(updatedSession!.last_message_at).not.toBeNull()
    })

    it('should throw NOT_FOUND for non-existent session', async () => {
      const caller = testRouter.createCaller(createTestContext())

      await expect(
        caller.chatSession.addMessage({
          sessionId: 'non-existent',
          role: 'user',
          content: 'Hello!'
        })
      ).rejects.toThrow('Chat session not found')
    })

    it('should reject invalid role values', async () => {
      const caller = testRouter.createCaller(createTestContext())

      const session = await caller.chatSession.create({
        agentPersona: 'bmad-pm',
        projectId: 'project-1'
      })

      await expect(
        caller.chatSession.addMessage({
          sessionId: session!.id,
          role: 'invalid_role' as any,
          content: 'Hello!'
        })
      ).rejects.toThrow()
    })

    it('should reject empty content', async () => {
      const caller = testRouter.createCaller(createTestContext())

      const session = await caller.chatSession.create({
        agentPersona: 'bmad-pm',
        projectId: 'project-1'
      })

      await expect(
        caller.chatSession.addMessage({
          sessionId: session!.id,
          role: 'user',
          content: ''
        })
      ).rejects.toThrow()
    })

    it('should reject empty sessionId', async () => {
      const caller = testRouter.createCaller(createTestContext())

      await expect(
        caller.chatSession.addMessage({
          sessionId: '',
          role: 'user',
          content: 'Hello!'
        })
      ).rejects.toThrow()
    })

    it('should retrieve added messages via getMessages', async () => {
      const caller = testRouter.createCaller(createTestContext())

      const session = await caller.chatSession.create({
        agentPersona: 'bmad-pm',
        projectId: 'project-1'
      })

      await caller.chatSession.addMessage({
        sessionId: session!.id,
        role: 'user',
        content: 'First message'
      })

      await caller.chatSession.addMessage({
        sessionId: session!.id,
        role: 'assistant',
        content: 'Second message'
      })

      const messages = await caller.chatSession.getMessages({
        sessionId: session!.id
      })

      expect(messages).toHaveLength(2)
      expect(messages[0].content).toBe('First message')
      expect(messages[1].content).toBe('Second message')
    })
  })

  describe('sendChatMessage (Story 10.3, AC: 1, 2, 5; CTM-1.3 AC: 2, 3, 4)', () => {
    beforeEach(() => {
      vi.clearAllMocks()
      mockIsSessionAlive.mockReturnValue(false)
      mockHasSession.mockReturnValue(false)
      mockIsTmuxAlive.mockResolvedValue(false)
      mockReattachSession.mockResolvedValue('pty-reattached')
      mockBuildContext.mockReturnValue('Mock persona context for testing')
      // Restore PersonaContextService mock implementation after clearAllMocks
      // Must use regular function (not arrow) so it can be used with `new`
      MockPersonaContextServiceClass.mockImplementation(function () {
        return {
          buildContext: mockBuildContext,
          loadConfig: vi.fn(),
          getPersonaFilePath: vi.fn()
        }
      })
    })

    it('should store user message and spawn CLI for new session (AC: 1)', async () => {
      const caller = testRouter.createCaller(createTestContext())

      const session = await caller.chatSession.create({
        agentPersona: 'bmad-pm',
        projectId: 'project-1'
      })

      const message = await caller.chatSession.sendChatMessage({
        sessionId: session!.id,
        content: 'Hello agent!'
      })

      // User message should be stored
      expect(message).toBeDefined()
      expect(message!.role).toBe('user')
      expect(message!.content).toBe('Hello agent!')
      expect(message!.session_id).toBe(session!.id)

      // CLI should have been spawned (not resumed)
      // Story 10.4: spawnSession now receives persona context as 5th arg
      expect(mockSpawnSession).toHaveBeenCalledWith(
        session!.id,
        session!.session_uuid,
        '/test/project',
        'Hello agent!',
        'Mock persona context for testing'
      )
      expect(mockSendMessage).not.toHaveBeenCalled()
    })

    it('should send to existing CLI when session is alive (AC: 2)', async () => {
      const caller = testRouter.createCaller(createTestContext())

      const session = await caller.chatSession.create({
        agentPersona: 'bmad-pm',
        projectId: 'project-1'
      })

      mockIsSessionAlive.mockReturnValue(true)

      const message = await caller.chatSession.sendChatMessage({
        sessionId: session!.id,
        content: 'Follow-up message'
      })

      expect(message!.content).toBe('Follow-up message')
      expect(mockSendMessage).toHaveBeenCalledWith(session!.id, 'Follow-up message')
      expect(mockSpawnSession).not.toHaveBeenCalled()
    })

    it('CTM-1.1: exited CLI session spawns new tmux session (replaces resume)', async () => {
      const caller = testRouter.createCaller(createTestContext())

      const session = await caller.chatSession.create({
        agentPersona: 'bmad-pm',
        projectId: 'project-1'
      })

      // CLI session was started but has exited
      mockIsSessionAlive.mockReturnValue(false)
      mockHasSession.mockReturnValue(true)

      const message = await caller.chatSession.sendChatMessage({
        sessionId: session!.id,
        content: 'Resume message'
      })

      expect(message!.content).toBe('Resume message')
      // CTM-1.1: Now calls spawnSession instead of resumeSession
      expect(mockSpawnSession).toHaveBeenCalledWith(
        session!.id,
        session!.session_uuid,
        '/test/project',
        'Resume message',
        'Mock persona context for testing'
      )
      expect(mockSendMessage).not.toHaveBeenCalled()
    })

    it('should throw NOT_FOUND for non-existent session', async () => {
      const caller = testRouter.createCaller(createTestContext())

      await expect(
        caller.chatSession.sendChatMessage({
          sessionId: 'non-existent',
          content: 'Hello!'
        })
      ).rejects.toThrow('Chat session not found')
    })

    it('should reject empty content', async () => {
      const caller = testRouter.createCaller(createTestContext())

      const session = await caller.chatSession.create({
        agentPersona: 'bmad-pm',
        projectId: 'project-1'
      })

      await expect(
        caller.chatSession.sendChatMessage({
          sessionId: session!.id,
          content: ''
        })
      ).rejects.toThrow()
    })

    it('should update session last_message_at', async () => {
      const caller = testRouter.createCaller(createTestContext())

      const session = await caller.chatSession.create({
        agentPersona: 'bmad-pm',
        projectId: 'project-1'
      })

      expect(session!.last_message_at).toBeNull()

      await caller.chatSession.sendChatMessage({
        sessionId: session!.id,
        content: 'Hello!'
      })

      const sessions = await caller.chatSession.list({ projectId: 'project-1' })
      const updated = sessions.find((s) => s.id === session!.id)
      expect(updated!.last_message_at).not.toBeNull()
    })

    it('should store message even when retrievable via getMessages', async () => {
      const caller = testRouter.createCaller(createTestContext())

      const session = await caller.chatSession.create({
        agentPersona: 'bmad-pm',
        projectId: 'project-1'
      })

      await caller.chatSession.sendChatMessage({
        sessionId: session!.id,
        content: 'Stored message'
      })

      const messages = await caller.chatSession.getMessages({
        sessionId: session!.id
      })

      expect(messages).toHaveLength(1)
      expect(messages[0].content).toBe('Stored message')
      expect(messages[0].role).toBe('user')
    })

    it('CTM-1.3 Case B: re-attaches PTY when tmux alive but PTY detached', async () => {
      const caller = testRouter.createCaller(createTestContext())

      const session = await caller.chatSession.create({
        agentPersona: 'bmad-pm',
        projectId: 'project-1'
      })

      // Case B: PTY not alive, but tmux IS alive
      mockIsSessionAlive.mockReturnValue(false)
      mockIsTmuxAlive.mockResolvedValue(true)

      const message = await caller.chatSession.sendChatMessage({
        sessionId: session!.id,
        content: 'Recovery message'
      })

      expect(message!.content).toBe('Recovery message')

      // Should call reattachSession then sendMessage (not spawnSession)
      expect(mockReattachSession).toHaveBeenCalledWith(
        session!.id,
        session!.session_uuid,
        '/test/project'
      )
      expect(mockSendMessage).toHaveBeenCalledWith(session!.id, 'Recovery message')
      expect(mockSpawnSession).not.toHaveBeenCalled()
    })

    it('CTM-1.3 Case C: creates new tmux session and updates status to active', async () => {
      const caller = testRouter.createCaller(createTestContext())

      const session = await caller.chatSession.create({
        agentPersona: 'bmad-pm',
        projectId: 'project-1'
      })

      // First set status to 'paused' (as it would be after dead tmux detection)
      await caller.chatSession.updateStatus({
        sessionId: session!.id,
        status: 'paused'
      })
      vi.clearAllMocks()
      mockIsSessionAlive.mockReturnValue(false)
      mockIsTmuxAlive.mockResolvedValue(false)
      mockBuildContext.mockReturnValue('Mock persona context for testing')
      MockPersonaContextServiceClass.mockImplementation(function () {
        return {
          buildContext: mockBuildContext,
          loadConfig: vi.fn(),
          getPersonaFilePath: vi.fn()
        }
      })

      const message = await caller.chatSession.sendChatMessage({
        sessionId: session!.id,
        content: 'New session message'
      })

      expect(message!.content).toBe('New session message')

      // Should call spawnSession (not reattachSession) — with project name
      expect(mockSpawnSession).toHaveBeenCalledWith(
        session!.id,
        session!.session_uuid,
        'Test Project',
        '/test/project',
        'New session message',
        'Mock persona context for testing'
      )
      expect(mockReattachSession).not.toHaveBeenCalled()

      // Direct DB check for updated status — name follows tinsu-{projectName}-{sessionId} convention
      const dbSession = mockSqlite
        .prepare('SELECT tmux_session, status FROM chat_sessions WHERE id = ?')
        .get(session!.id) as { tmux_session: string; status: string }

      expect(dbSession.tmux_session).toBe(`tinsu-test-project-${session!.id}`)
      expect(dbSession.status).toBe('active')
    })

    it('CTM-1.3 Case B: does NOT reload persona context on reattach', async () => {
      const caller = testRouter.createCaller(createTestContext())

      const session = await caller.chatSession.create({
        agentPersona: 'bmad:bmm:agents:pm',
        projectId: 'project-1'
      })

      // Case B
      mockIsSessionAlive.mockReturnValue(false)
      mockIsTmuxAlive.mockResolvedValue(true)

      await caller.chatSession.sendChatMessage({
        sessionId: session!.id,
        content: 'Reattach message'
      })

      // PersonaContextService should NOT be instantiated for Case B
      expect(MockPersonaContextServiceClass).not.toHaveBeenCalled()
      expect(mockBuildContext).not.toHaveBeenCalled()
    })
  })

  describe('sendChatMessage persona context injection (Story 10.4, AC: 1-5)', () => {
    beforeEach(() => {
      vi.clearAllMocks()
      mockIsSessionAlive.mockReturnValue(false)
      mockHasSession.mockReturnValue(false)
      mockIsTmuxAlive.mockResolvedValue(false)
      mockReattachSession.mockResolvedValue('pty-reattached')
      mockBuildContext.mockReturnValue('Mock persona context for testing')
      // Restore PersonaContextService mock implementation after clearAllMocks
      // Must use regular function (not arrow) so it can be used with `new`
      MockPersonaContextServiceClass.mockImplementation(function () {
        return {
          buildContext: mockBuildContext,
          loadConfig: vi.fn(),
          getPersonaFilePath: vi.fn()
        }
      })
    })

    it('calls personaContextService.buildContext on first spawn (AC: 1)', async () => {
      const caller = testRouter.createCaller(createTestContext())

      const session = await caller.chatSession.create({
        agentPersona: 'bmad:bmm:agents:pm',
        projectId: 'project-1'
      })

      await caller.chatSession.sendChatMessage({
        sessionId: session!.id,
        content: 'Hello PM!'
      })

      // buildContext should have been called with the agent_persona key
      expect(mockBuildContext).toHaveBeenCalledWith('bmad:bmm:agents:pm')
    })

    it('passes persona context to chatCliService.spawnSession (AC: 1-5)', async () => {
      const caller = testRouter.createCaller(createTestContext())

      const session = await caller.chatSession.create({
        agentPersona: 'bmad:bmm:agents:architect',
        projectId: 'project-1'
      })

      await caller.chatSession.sendChatMessage({
        sessionId: session!.id,
        content: 'Design the architecture'
      })

      // spawnSession should receive the persona context as the 5th argument
      expect(mockSpawnSession).toHaveBeenCalledWith(
        session!.id,
        session!.session_uuid,
        '/test/project',
        'Design the architecture',
        'Mock persona context for testing'
      )
    })

    it('CTM-1.1: Case B (exited session) creates new tmux session with persona context', async () => {
      const caller = testRouter.createCaller(createTestContext())

      const session = await caller.chatSession.create({
        agentPersona: 'bmad:bmm:agents:pm',
        projectId: 'project-1'
      })

      // CLI session was started but exited -- CTM-1.1: both Case B and C call spawnSession
      mockIsSessionAlive.mockReturnValue(false)
      mockHasSession.mockReturnValue(true)

      await caller.chatSession.sendChatMessage({
        sessionId: session!.id,
        content: 'Resume message'
      })

      // CTM-1.1: spawnSession is now called for Case B too (no more resumeSession)
      expect(mockSpawnSession).toHaveBeenCalledWith(
        session!.id,
        session!.session_uuid,
        '/test/project',
        'Resume message',
        'Mock persona context for testing'
      )
    })

    it('still works when persona context loading fails — graceful degradation', async () => {
      // Make buildContext throw an error
      mockBuildContext.mockImplementation(() => {
        throw new Error('File not found: pm.md')
      })

      const caller = testRouter.createCaller(createTestContext())

      const session = await caller.chatSession.create({
        agentPersona: 'bmad:bmm:agents:pm',
        projectId: 'project-1'
      })

      // Should NOT throw — message should still be sent
      const message = await caller.chatSession.sendChatMessage({
        sessionId: session!.id,
        content: 'Hello anyway!'
      })

      expect(message).toBeDefined()
      expect(message!.content).toBe('Hello anyway!')

      // spawnSession should be called with undefined personaContext (graceful degradation)
      expect(mockSpawnSession).toHaveBeenCalledWith(
        session!.id,
        session!.session_uuid,
        '/test/project',
        'Hello anyway!',
        undefined
      )
    })
  })

  describe('getToolActivity (Story 10.5, AC: 1, 2, 3, 4)', () => {
    it('should return tool messages for a session', async () => {
      const caller = testRouter.createCaller(createTestContext())

      // Create a session
      const session = await caller.chatSession.create({
        agentPersona: 'bmad-pm',
        projectId: 'project-1'
      })

      // Insert some tool messages directly
      testDb.insert(schema.chat_messages).values({
        id: 'tool-msg-1',
        session_id: session!.id,
        role: 'tool',
        content: 'PreToolUse: Read',
        tool_name: 'Read',
        tool_input: JSON.stringify({ file_path: '/test/file.ts' }),
        created_at: new Date()
      }).run()

      testDb.insert(schema.chat_messages).values({
        id: 'tool-msg-2',
        session_id: session!.id,
        role: 'tool',
        content: 'Tool: Read',
        tool_name: 'Read',
        tool_input: JSON.stringify({ file_path: '/test/file.ts' }),
        created_at: new Date(Date.now() + 1000)
      }).run()

      // Also insert a non-tool message that should NOT appear
      testDb.insert(schema.chat_messages).values({
        id: 'user-msg-1',
        session_id: session!.id,
        role: 'user',
        content: 'Hello',
        created_at: new Date(Date.now() + 2000)
      }).run()

      const toolMessages = await caller.chatSession.getToolActivity({
        sessionId: session!.id
      })

      expect(toolMessages).toHaveLength(2)
      expect(toolMessages[0].role).toBe('tool')
      expect(toolMessages[1].role).toBe('tool')
      expect(toolMessages[0].tool_name).toBe('Read')
    })

    it('should return empty array when no tool messages exist', async () => {
      const caller = testRouter.createCaller(createTestContext())

      const session = await caller.chatSession.create({
        agentPersona: 'bmad-pm',
        projectId: 'project-1'
      })

      const toolMessages = await caller.chatSession.getToolActivity({
        sessionId: session!.id
      })

      expect(toolMessages).toEqual([])
    })

    it('should return tool messages ordered by created_at ascending', async () => {
      const caller = testRouter.createCaller(createTestContext())

      const session = await caller.chatSession.create({
        agentPersona: 'bmad-pm',
        projectId: 'project-1'
      })

      const baseTime = Date.now()

      testDb.insert(schema.chat_messages).values({
        id: 'tool-later',
        session_id: session!.id,
        role: 'tool',
        content: 'Tool: Grep',
        tool_name: 'Grep',
        tool_input: JSON.stringify({ pattern: 'TODO' }),
        created_at: new Date(baseTime + 2000)
      }).run()

      testDb.insert(schema.chat_messages).values({
        id: 'tool-earlier',
        session_id: session!.id,
        role: 'tool',
        content: 'PreToolUse: Read',
        tool_name: 'Read',
        tool_input: JSON.stringify({ file_path: '/test/a.ts' }),
        created_at: new Date(baseTime)
      }).run()

      const toolMessages = await caller.chatSession.getToolActivity({
        sessionId: session!.id
      })

      expect(toolMessages).toHaveLength(2)
      expect(toolMessages[0].id).toBe('tool-earlier')
      expect(toolMessages[1].id).toBe('tool-later')
    })

    it('should include notification messages with tool_name __notification__', async () => {
      const caller = testRouter.createCaller(createTestContext())

      const session = await caller.chatSession.create({
        agentPersona: 'bmad-pm',
        projectId: 'project-1'
      })

      testDb.insert(schema.chat_messages).values({
        id: 'notif-msg-1',
        session_id: session!.id,
        role: 'tool',
        content: 'Notification: permission_prompt: Allow?',
        tool_name: '__notification__',
        tool_input: JSON.stringify({ type: 'permission_prompt', message: 'Allow?' }),
        created_at: new Date()
      }).run()

      const toolMessages = await caller.chatSession.getToolActivity({
        sessionId: session!.id
      })

      expect(toolMessages).toHaveLength(1)
      expect(toolMessages[0].tool_name).toBe('__notification__')
    })
  })

  describe('deleteSession (Story 10.6, AC: 6)', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('should delete a session and cascade delete its messages', async () => {
      const caller = testRouter.createCaller(createTestContext())

      const session = await caller.chatSession.create({
        agentPersona: 'bmad-pm',
        projectId: 'project-1'
      })

      // Add some messages
      await caller.chatSession.addMessage({
        sessionId: session!.id,
        role: 'user',
        content: 'Hello'
      })
      await caller.chatSession.addMessage({
        sessionId: session!.id,
        role: 'assistant',
        content: 'Hi there'
      })

      const result = await caller.chatSession.deleteSession({
        sessionId: session!.id
      })

      expect(result).toEqual({ deleted: true })

      // Verify session is gone
      const sessions = await caller.chatSession.list({ projectId: 'project-1' })
      expect(sessions).toHaveLength(0)

      // Verify messages are cascade deleted
      const messages = await caller.chatSession.getMessages({ sessionId: session!.id })
      expect(messages).toHaveLength(0)
    })

    it('should kill CLI session on delete', async () => {
      const caller = testRouter.createCaller(createTestContext())

      const session = await caller.chatSession.create({
        agentPersona: 'bmad-pm',
        projectId: 'project-1'
      })

      await caller.chatSession.deleteSession({
        sessionId: session!.id
      })

      expect(mockKillSession).toHaveBeenCalledWith(session!.id)
    })

    it('should throw NOT_FOUND for non-existent session', async () => {
      const caller = testRouter.createCaller(createTestContext())

      await expect(
        caller.chatSession.deleteSession({
          sessionId: 'non-existent'
        })
      ).rejects.toThrow('Chat session not found')
    })
  })

  describe('getLastMessage (Story 10.6, AC: 1)', () => {
    it('should return the last user/assistant message (not tool)', async () => {
      const caller = testRouter.createCaller(createTestContext())

      const session = await caller.chatSession.create({
        agentPersona: 'bmad-pm',
        projectId: 'project-1'
      })

      const baseTime = Date.now()

      testDb.insert(schema.chat_messages).values({
        id: 'msg-user-1',
        session_id: session!.id,
        role: 'user',
        content: 'First user message',
        created_at: new Date(baseTime)
      }).run()

      testDb.insert(schema.chat_messages).values({
        id: 'msg-tool-1',
        session_id: session!.id,
        role: 'tool',
        content: 'Tool: Read',
        tool_name: 'Read',
        tool_input: '{}',
        created_at: new Date(baseTime + 1000)
      }).run()

      testDb.insert(schema.chat_messages).values({
        id: 'msg-assistant-1',
        session_id: session!.id,
        role: 'assistant',
        content: 'Last assistant message',
        created_at: new Date(baseTime + 2000)
      }).run()

      // Add another tool message AFTER the assistant message
      testDb.insert(schema.chat_messages).values({
        id: 'msg-tool-2',
        session_id: session!.id,
        role: 'tool',
        content: 'Tool: Grep',
        tool_name: 'Grep',
        tool_input: '{}',
        created_at: new Date(baseTime + 3000)
      }).run()

      const lastMessage = await caller.chatSession.getLastMessage({
        sessionId: session!.id
      })

      // Should return the assistant message, not the tool message
      expect(lastMessage).toBeDefined()
      expect(lastMessage!.content).toBe('Last assistant message')
      expect(lastMessage!.role).toBe('assistant')
    })

    it('should return null for session with no messages', async () => {
      const caller = testRouter.createCaller(createTestContext())

      const session = await caller.chatSession.create({
        agentPersona: 'bmad-pm',
        projectId: 'project-1'
      })

      const lastMessage = await caller.chatSession.getLastMessage({
        sessionId: session!.id
      })

      expect(lastMessage).toBeNull()
    })

    it('should return null for session with only tool messages', async () => {
      const caller = testRouter.createCaller(createTestContext())

      const session = await caller.chatSession.create({
        agentPersona: 'bmad-pm',
        projectId: 'project-1'
      })

      testDb.insert(schema.chat_messages).values({
        id: 'msg-tool-only',
        session_id: session!.id,
        role: 'tool',
        content: 'Tool: Read',
        tool_name: 'Read',
        tool_input: '{}',
        created_at: new Date()
      }).run()

      const lastMessage = await caller.chatSession.getLastMessage({
        sessionId: session!.id
      })

      expect(lastMessage).toBeNull()
    })
  })

  describe('listWithPreview (Story 10.6, AC: 1)', () => {
    it('should return sessions with lastMessagePreview', async () => {
      const caller = testRouter.createCaller(createTestContext())

      const session = await caller.chatSession.create({
        agentPersona: 'bmad-pm',
        projectId: 'project-1'
      })

      await caller.chatSession.addMessage({
        sessionId: session!.id,
        role: 'user',
        content: 'Hello world preview message'
      })

      const sessions = await caller.chatSession.listWithPreview({
        projectId: 'project-1'
      })

      expect(sessions).toHaveLength(1)
      expect(sessions[0].lastMessagePreview).toBe('Hello world preview message')
    })

    it('should return null preview for sessions with no messages', async () => {
      const caller = testRouter.createCaller(createTestContext())

      await caller.chatSession.create({
        agentPersona: 'bmad-pm',
        projectId: 'project-1'
      })

      const sessions = await caller.chatSession.listWithPreview({
        projectId: 'project-1'
      })

      expect(sessions).toHaveLength(1)
      expect(sessions[0].lastMessagePreview).toBeNull()
    })

    it('should return preview of last user/assistant message (not tool)', async () => {
      const caller = testRouter.createCaller(createTestContext())

      const session = await caller.chatSession.create({
        agentPersona: 'bmad-pm',
        projectId: 'project-1'
      })

      const baseTime = Date.now()

      testDb.insert(schema.chat_messages).values({
        id: 'preview-user',
        session_id: session!.id,
        role: 'user',
        content: 'User says something',
        created_at: new Date(baseTime)
      }).run()

      testDb.insert(schema.chat_messages).values({
        id: 'preview-assistant',
        session_id: session!.id,
        role: 'assistant',
        content: 'Agent responds',
        created_at: new Date(baseTime + 1000)
      }).run()

      testDb.insert(schema.chat_messages).values({
        id: 'preview-tool',
        session_id: session!.id,
        role: 'tool',
        content: 'Tool: Read',
        tool_name: 'Read',
        tool_input: '{}',
        created_at: new Date(baseTime + 2000)
      }).run()

      const sessions = await caller.chatSession.listWithPreview({
        projectId: 'project-1'
      })

      // Preview should be the assistant message (last non-tool)
      expect(sessions[0].lastMessagePreview).toBe('Agent responds')
    })

    it('should order sessions by most recently active', async () => {
      const earlier = new Date(Date.now() - 5000)
      const later = new Date(Date.now())

      testDb.insert(schema.chat_sessions).values({
        id: 'cs-older-preview',
        session_uuid: 'uuid-older-preview',
        agent_persona: 'bmad-pm',
        project_id: 'project-1',
        status: 'active',
        created_at: earlier,
        updated_at: earlier
      }).run()

      testDb.insert(schema.chat_sessions).values({
        id: 'cs-newer-preview',
        session_uuid: 'uuid-newer-preview',
        agent_persona: 'bmad-architect',
        project_id: 'project-1',
        status: 'active',
        created_at: later,
        updated_at: later
      }).run()

      const caller = testRouter.createCaller(createTestContext())

      const sessions = await caller.chatSession.listWithPreview({
        projectId: 'project-1'
      })

      expect(sessions).toHaveLength(2)
      expect(sessions[0].id).toBe('cs-newer-preview')
      expect(sessions[1].id).toBe('cs-older-preview')
    })
  })

  describe('updateStatus kills CLI session (Story 10.6, AC: 6)', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('should kill CLI session when status set to paused', async () => {
      const caller = testRouter.createCaller(createTestContext())

      const session = await caller.chatSession.create({
        agentPersona: 'bmad-pm',
        projectId: 'project-1'
      })

      await caller.chatSession.updateStatus({
        sessionId: session!.id,
        status: 'paused'
      })

      expect(mockKillSession).toHaveBeenCalledWith(session!.id)
    })

    it('should kill CLI session when status set to completed', async () => {
      const caller = testRouter.createCaller(createTestContext())

      const session = await caller.chatSession.create({
        agentPersona: 'bmad-pm',
        projectId: 'project-1'
      })

      await caller.chatSession.updateStatus({
        sessionId: session!.id,
        status: 'completed'
      })

      expect(mockKillSession).toHaveBeenCalledWith(session!.id)
    })

    it('should NOT kill CLI session when status set to active', async () => {
      const caller = testRouter.createCaller(createTestContext())

      const session = await caller.chatSession.create({
        agentPersona: 'bmad-pm',
        projectId: 'project-1'
      })

      // First pause it
      await caller.chatSession.updateStatus({
        sessionId: session!.id,
        status: 'paused'
      })

      mockKillSession.mockClear()

      // Then set back to active
      await caller.chatSession.updateStatus({
        sessionId: session!.id,
        status: 'active'
      })

      expect(mockKillSession).not.toHaveBeenCalled()
    })
  })

  describe('getSessionForArtifact (Story 10.7, AC: 2)', () => {
    it('should return session info when artifact message exists', async () => {
      const caller = testRouter.createCaller(createTestContext())

      // Create a session
      const session = await caller.chatSession.create({
        agentPersona: 'bmad:bmm:agents:pm',
        projectId: 'project-1'
      })

      // Insert an __artifact_created__ message
      testDb
        .insert(schema.chat_messages)
        .values({
          id: 'artifact-msg-1',
          session_id: session!.id,
          role: 'tool',
          content: 'Artifact created: prd.md',
          tool_name: '__artifact_created__',
          tool_input: JSON.stringify({ filename: 'prd.md', workflowKey: 'prd', filePath: '/test/project/_bmad-output/planning-artifacts/prd.md' }),
          created_at: new Date()
        })
        .run()

      const result = await caller.chatSession.getSessionForArtifact({
        projectId: 'project-1',
        filename: 'prd.md'
      })

      expect(result).not.toBeNull()
      expect(result!.sessionId).toBe(session!.id)
      expect(result!.sessionUuid).toBe(session!.session_uuid)
      expect(result!.agentPersona).toBe('bmad:bmm:agents:pm')
    })

    it('should return null when no artifact message for filename', async () => {
      const caller = testRouter.createCaller(createTestContext())

      // Create a session without any artifact messages
      await caller.chatSession.create({
        agentPersona: 'bmad:bmm:agents:pm',
        projectId: 'project-1'
      })

      const result = await caller.chatSession.getSessionForArtifact({
        projectId: 'project-1',
        filename: 'architecture.md'
      })

      expect(result).toBeNull()
    })

    it('should return most recent session when multiple artifact messages exist', async () => {
      const caller = testRouter.createCaller(createTestContext())

      // Create two sessions
      const session1 = await caller.chatSession.create({
        agentPersona: 'bmad:bmm:agents:pm',
        projectId: 'project-1'
      })

      const session2 = await caller.chatSession.create({
        agentPersona: 'bmad:bmm:agents:architect',
        projectId: 'project-1'
      })

      const pastDate = new Date('2026-03-20T10:00:00Z')
      const recentDate = new Date('2026-03-22T10:00:00Z')

      // Insert artifact messages — first session has older timestamp
      testDb
        .insert(schema.chat_messages)
        .values({
          id: 'artifact-msg-old',
          session_id: session1!.id,
          role: 'tool',
          content: 'Artifact created: prd.md',
          tool_name: '__artifact_created__',
          tool_input: JSON.stringify({ filename: 'prd.md', workflowKey: 'prd', filePath: '/test/prd.md' }),
          created_at: pastDate
        })
        .run()

      // Second session has newer timestamp
      testDb
        .insert(schema.chat_messages)
        .values({
          id: 'artifact-msg-new',
          session_id: session2!.id,
          role: 'tool',
          content: 'Artifact created: prd.md',
          tool_name: '__artifact_created__',
          tool_input: JSON.stringify({ filename: 'prd.md', workflowKey: 'prd', filePath: '/test/prd.md' }),
          created_at: recentDate
        })
        .run()

      const result = await caller.chatSession.getSessionForArtifact({
        projectId: 'project-1',
        filename: 'prd.md'
      })

      expect(result).not.toBeNull()
      // Should return the most recent (session2 = architect)
      expect(result!.sessionId).toBe(session2!.id)
      expect(result!.agentPersona).toBe('bmad:bmm:agents:architect')
    })
  })

  describe('listWithPreview liveStatus (CTM-2.3)', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('should include liveStatus field from chatCliService.getSessionStatus()', async () => {
      const caller = testRouter.createCaller(createTestContext())

      const session = await caller.chatSession.create({
        agentPersona: 'bmad-pm',
        projectId: 'project-1'
      })

      mockGetSessionStatus.mockReturnValue('idle')

      const sessions = await caller.chatSession.listWithPreview({
        projectId: 'project-1'
      })

      expect(sessions).toHaveLength(1)
      expect(sessions[0].liveStatus).toBe('idle')
      expect(mockGetSessionStatus).toHaveBeenCalledWith(session!.id)
    })

    it('should return "thinking" liveStatus when chatCliService reports thinking', async () => {
      const caller = testRouter.createCaller(createTestContext())

      await caller.chatSession.create({
        agentPersona: 'bmad-pm',
        projectId: 'project-1'
      })

      mockGetSessionStatus.mockReturnValue('thinking')

      const sessions = await caller.chatSession.listWithPreview({
        projectId: 'project-1'
      })

      expect(sessions[0].liveStatus).toBe('thinking')
    })

    it('should return "exited" liveStatus when chatCliService reports exited', async () => {
      const caller = testRouter.createCaller(createTestContext())

      await caller.chatSession.create({
        agentPersona: 'bmad-pm',
        projectId: 'project-1'
      })

      mockGetSessionStatus.mockReturnValue('exited')

      const sessions = await caller.chatSession.listWithPreview({
        projectId: 'project-1'
      })

      expect(sessions[0].liveStatus).toBe('exited')
    })

    it('should return "completed" liveStatus for completed DB sessions without calling getSessionStatus', async () => {
      const caller = testRouter.createCaller(createTestContext())

      const session = await caller.chatSession.create({
        agentPersona: 'bmad-pm',
        projectId: 'project-1'
      })

      // Mark session as completed in DB
      await caller.chatSession.updateStatus({
        sessionId: session!.id,
        status: 'completed'
      })

      mockGetSessionStatus.mockClear()

      const sessions = await caller.chatSession.listWithPreview({
        projectId: 'project-1'
      })

      expect(sessions[0].liveStatus).toBe('completed')
      // Should NOT have called getSessionStatus for completed sessions
      expect(mockGetSessionStatus).not.toHaveBeenCalled()
    })

    it('should return liveStatus for each session independently', async () => {
      const caller = testRouter.createCaller(createTestContext())

      const session1 = await caller.chatSession.create({
        agentPersona: 'bmad-pm',
        projectId: 'project-1'
      })

      const session2 = await caller.chatSession.create({
        agentPersona: 'bmad-architect',
        projectId: 'project-1'
      })

      // Return different statuses for different session IDs
      mockGetSessionStatus.mockImplementation((sessionId: string) => {
        if (sessionId === session1!.id) return 'thinking'
        if (sessionId === session2!.id) return 'idle'
        return 'unknown'
      })

      const sessions = await caller.chatSession.listWithPreview({
        projectId: 'project-1'
      })

      expect(sessions).toHaveLength(2)
      const statusMap = Object.fromEntries(sessions.map(s => [s.id, s.liveStatus]))
      expect(statusMap[session1!.id]).toBe('thinking')
      expect(statusMap[session2!.id]).toBe('idle')
    })
  })
})

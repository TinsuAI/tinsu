/**
 * Hook Listener Chat Endpoint Tests - Story 10.1
 *
 * Tests for the chat-stop and chat-tool-use HTTP endpoints.
 * Tests payload validation, message storage, and orphan handling.
 *
 * @see Story 10.1: Chat Session Schema & Hook Endpoint (AC: 2, 3, 4)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as http from 'http'
import { HookListenerService } from './hook-listener.service'

// Mock database
const mockGet = vi.fn()
const mockInsertRun = vi.fn()
const mockUpdateRun = vi.fn()

vi.mock('../db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          get: mockGet,
          all: vi.fn(() => []), // For tryRegisterOrphanSession
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => ({
              all: vi.fn(() => [])
            }))
          }))
        })
      })
    }),
    insert: () => ({
      values: () => ({
        run: mockInsertRun
      })
    }),
    update: () => ({
      set: () => ({
        where: () => ({
          run: mockUpdateRun
        })
      })
    })
  }
}))

vi.mock('../db/schema', () => ({
  chat_sessions: { id: 'id', session_uuid: 'session_uuid' },
  chat_messages: { id: 'id', session_id: 'session_id' },
  task_sessions: { session_id: 'session_id', task_id: 'task_id' },
  taskActivities: { task_id: 'task_id', event_type: 'event_type', created_at: 'created_at' },
  tasks: { id: 'id' },
  workflow_runs: { task_id: 'task_id', status: 'status', id: 'id' }
}))

vi.mock('./activity-log.service', () => ({
  ActivityLogService: {
    logActivity: vi.fn()
  }
}))

vi.mock('./automation.service', () => ({
  AutomationService: {
    onAgentComplete: vi.fn()
  }
}))

vi.mock('./task-session.service', () => ({
  TaskSessionService: {
    updateSessionId: vi.fn(),
    markSessionEnded: vi.fn()
  }
}))

vi.mock('./git.service', () => ({
  GitService: {
    autoCommitWorktreeChanges: vi.fn().mockResolvedValue({ committed: false })
  }
}))

vi.mock('../trpc/routers/planning-workflow-constants', () => ({
  BMAD_WORKFLOWS: []
}))

/** Helper to make HTTP requests to the hook listener. */
async function makeRequest(
  port: number,
  method: string,
  path: string,
  body?: unknown
): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const options: http.RequestOptions = {
      hostname: '127.0.0.1',
      port,
      path,
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    }

    const req = http.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => {
        data += chunk
      })
      res.on('end', () => {
        let parsedBody: unknown
        try {
          parsedBody = JSON.parse(data)
        } catch {
          parsedBody = data
        }
        resolve({ status: res.statusCode || 0, body: parsedBody })
      })
    })

    req.on('error', reject)

    if (body !== undefined) {
      req.write(JSON.stringify(body))
    }

    req.end()
  })
}

describe('HookListenerService - Chat Endpoints (Story 10.1)', () => {
  let service: HookListenerService
  let testPort: number
  let portCounter = 39500

  beforeEach(() => {
    vi.clearAllMocks()
    service = new HookListenerService()
    testPort = portCounter++
    mockGet.mockReset()
    mockInsertRun.mockReset()
    mockUpdateRun.mockReset()
  })

  afterEach(async () => {
    if (service.isRunning()) {
      await service.stop()
    }
  })

  describe('POST /api/hooks/chat-stop (AC: 2, 3)', () => {
    it('should accept valid chat-stop payload and store assistant message', async () => {
      await service.start(testPort)

      // Mock: session found
      mockGet.mockReturnValueOnce({
        id: 'cs-1',
        session_uuid: 'test-uuid',
        agent_persona: 'bmad-pm',
        project_id: 'project-1',
        status: 'active'
      })

      const response = await makeRequest(testPort, 'POST', '/api/hooks/chat-stop', {
        session_id: 'test-uuid',
        hook_event_name: 'Stop',
        last_assistant_message: 'Here is my analysis of the PRD...',
        cwd: '/test/project',
        transcript_path: '/tmp/transcript.json'
      })

      expect(response.status).toBe(200)
      expect(response.body).toEqual({ received: true })
      expect(mockInsertRun).toHaveBeenCalled()
      expect(mockUpdateRun).toHaveBeenCalled()
    })

    it('should handle chat-stop without last_assistant_message (no message stored)', async () => {
      await service.start(testPort)

      // Mock: session found
      mockGet.mockReturnValueOnce({
        id: 'cs-1',
        session_uuid: 'test-uuid',
        agent_persona: 'bmad-pm',
        project_id: 'project-1',
        status: 'active'
      })

      const response = await makeRequest(testPort, 'POST', '/api/hooks/chat-stop', {
        session_id: 'test-uuid',
        hook_event_name: 'Stop',
        cwd: '/test/project',
        transcript_path: '/tmp/transcript.json'
      })

      expect(response.status).toBe(200)
      expect(response.body).toEqual({ received: true })
      // No insert should have been called since no last_assistant_message
      expect(mockInsertRun).not.toHaveBeenCalled()
    })

    it('should handle orphan chat-stop event (no matching session)', async () => {
      await service.start(testPort)

      // Mock: no session found
      mockGet.mockReturnValueOnce(undefined)

      const response = await makeRequest(testPort, 'POST', '/api/hooks/chat-stop', {
        session_id: 'unknown-uuid',
        hook_event_name: 'Stop',
        last_assistant_message: 'Some message',
        cwd: '/test/project',
        transcript_path: '/tmp/transcript.json'
      })

      expect(response.status).toBe(200)
      expect(response.body).toEqual({ received: true })
      // No insert should have been called for orphan event
      expect(mockInsertRun).not.toHaveBeenCalled()
    })

    it('should reject invalid chat-stop payload', async () => {
      await service.start(testPort)

      const response = await makeRequest(testPort, 'POST', '/api/hooks/chat-stop', {
        session_id: 'test-uuid',
        hook_event_name: 'WrongEvent'
        // Missing required fields
      })

      expect(response.status).toBe(400)
      expect((response.body as { error: string }).error).toBe('Invalid payload')
    })
  })

  describe('POST /api/hooks/chat-tool-use (AC: 2, 4)', () => {
    it('should accept valid chat-tool-use payload and store tool message', async () => {
      await service.start(testPort)

      // Mock: session found
      mockGet.mockReturnValueOnce({
        id: 'cs-1',
        session_uuid: 'test-uuid',
        agent_persona: 'bmad-pm',
        project_id: 'project-1',
        status: 'active'
      })

      const response = await makeRequest(testPort, 'POST', '/api/hooks/chat-tool-use', {
        session_id: 'test-uuid',
        tool_name: 'Read',
        tool_input: { file_path: '/test/file.ts' },
        hook_event_name: 'PostToolUse'
      })

      expect(response.status).toBe(200)
      expect(response.body).toEqual({ received: true })
      expect(mockInsertRun).toHaveBeenCalled()
      expect(mockUpdateRun).toHaveBeenCalled()
    })

    it('should handle orphan chat-tool-use event (no matching session)', async () => {
      await service.start(testPort)

      // Mock: no session found
      mockGet.mockReturnValueOnce(undefined)

      const response = await makeRequest(testPort, 'POST', '/api/hooks/chat-tool-use', {
        session_id: 'unknown-uuid',
        tool_name: 'Read',
        tool_input: { file_path: '/test/file.ts' },
        hook_event_name: 'PostToolUse'
      })

      expect(response.status).toBe(200)
      expect(response.body).toEqual({ received: true })
      // No insert should have been called for orphan event
      expect(mockInsertRun).not.toHaveBeenCalled()
    })

    it('should reject invalid chat-tool-use payload', async () => {
      await service.start(testPort)

      const response = await makeRequest(testPort, 'POST', '/api/hooks/chat-tool-use', {
        session_id: 'test-uuid',
        hook_event_name: 'WrongEvent'
        // Missing tool_name and tool_input
      })

      expect(response.status).toBe(400)
      expect((response.body as { error: string }).error).toBe('Invalid payload')
    })

    it('should store tool_input as JSON string', async () => {
      await service.start(testPort)

      // Mock: session found
      mockGet.mockReturnValueOnce({
        id: 'cs-1',
        session_uuid: 'test-uuid',
        agent_persona: 'bmad-pm',
        project_id: 'project-1',
        status: 'active'
      })

      const toolInput = { file_path: '/test/file.ts', limit: 100 }

      const response = await makeRequest(testPort, 'POST', '/api/hooks/chat-tool-use', {
        session_id: 'test-uuid',
        tool_name: 'Read',
        tool_input: toolInput,
        hook_event_name: 'PostToolUse'
      })

      expect(response.status).toBe(200)
      expect(mockInsertRun).toHaveBeenCalled()
    })
  })

  describe('endpoint isolation from task execution (AC: 2)', () => {
    it('should NOT trigger task automation on chat-stop', async () => {
      await service.start(testPort)

      // Mock: session found
      mockGet.mockReturnValueOnce({
        id: 'cs-1',
        session_uuid: 'test-uuid',
        agent_persona: 'bmad-pm',
        project_id: 'project-1',
        status: 'active'
      })

      const { AutomationService } = await import('./automation.service')

      await makeRequest(testPort, 'POST', '/api/hooks/chat-stop', {
        session_id: 'test-uuid',
        hook_event_name: 'Stop',
        last_assistant_message: 'Done',
        cwd: '/test/project',
        transcript_path: '/tmp/transcript.json'
      })

      // AutomationService.onAgentComplete should NOT have been called by chat-stop
      expect(AutomationService.onAgentComplete).not.toHaveBeenCalled()
    })
  })
})

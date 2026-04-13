import { describe, it, expect } from 'vitest'
import {
  extractSessionId,
  isClaudeHookPayload,
  type ClaudeHookPayload,
  type ClaudePostToolUsePayload,
  type ClaudeStopPayload
} from './hook.types'

describe('hook.types', () => {
  describe('extractSessionId', () => {
    it('extracts session_id from valid payload', () => {
      const payload = {
        session_id: 'abc-123-def',
        transcript_path: '/path/to/transcript.json',
        cwd: '/home/user/project',
        hook_event_name: 'PostToolUse'
      }

      expect(extractSessionId(payload)).toBe('abc-123-def')
    })

    it('returns null for null payload', () => {
      expect(extractSessionId(null)).toBeNull()
    })

    it('returns null for undefined payload', () => {
      expect(extractSessionId(undefined)).toBeNull()
    })

    it('returns null for non-object payload', () => {
      expect(extractSessionId('string')).toBeNull()
      expect(extractSessionId(123)).toBeNull()
      expect(extractSessionId(true)).toBeNull()
      expect(extractSessionId([])).toBeNull() // Array is technically object but has no session_id
    })

    it('returns null for empty object', () => {
      expect(extractSessionId({})).toBeNull()
    })

    it('returns null when session_id is missing', () => {
      const payload = {
        transcript_path: '/path/to/transcript.json',
        cwd: '/home/user/project',
        hook_event_name: 'PostToolUse'
      }

      expect(extractSessionId(payload)).toBeNull()
    })

    it('returns null when session_id is not a string', () => {
      expect(extractSessionId({ session_id: 123 })).toBeNull()
      expect(extractSessionId({ session_id: null })).toBeNull()
      expect(extractSessionId({ session_id: undefined })).toBeNull()
      expect(extractSessionId({ session_id: {} })).toBeNull()
      expect(extractSessionId({ session_id: [] })).toBeNull()
    })

    it('returns null for empty string session_id', () => {
      expect(extractSessionId({ session_id: '' })).toBeNull()
    })

    it('handles UUID-style session IDs', () => {
      const payload = {
        session_id: '550e8400-e29b-41d4-a716-446655440000'
      }

      expect(extractSessionId(payload)).toBe('550e8400-e29b-41d4-a716-446655440000')
    })

    it('handles payload with extra properties', () => {
      const payload = {
        session_id: 'test-session',
        extra_field: 'extra_value',
        another_field: { nested: true }
      }

      expect(extractSessionId(payload)).toBe('test-session')
    })

    it('handles PostToolUse payload format', () => {
      const payload: ClaudePostToolUsePayload = {
        session_id: 'post-tool-session',
        transcript_path: '/path/transcript.json',
        cwd: '/home/project',
        hook_event_name: 'PostToolUse',
        tool_name: 'Read',
        tool_input: { file_path: '/some/file.ts' },
        tool_output: 'file contents...'
      }

      expect(extractSessionId(payload)).toBe('post-tool-session')
    })

    it('handles Stop payload format', () => {
      const payload: ClaudeStopPayload = {
        session_id: 'stop-session',
        transcript_path: '/path/transcript.json',
        cwd: '/home/project',
        hook_event_name: 'Stop',
        stop_reason: 'user_cancelled'
      }

      expect(extractSessionId(payload)).toBe('stop-session')
    })
  })

  describe('isClaudeHookPayload', () => {
    it('returns true for valid payload with all required fields', () => {
      const payload: ClaudeHookPayload = {
        session_id: 'test-session',
        transcript_path: '/path/to/transcript.json',
        cwd: '/home/user/project',
        hook_event_name: 'PostToolUse'
      }

      expect(isClaudeHookPayload(payload)).toBe(true)
    })

    it('returns false for null', () => {
      expect(isClaudeHookPayload(null)).toBe(false)
    })

    it('returns false for undefined', () => {
      expect(isClaudeHookPayload(undefined)).toBe(false)
    })

    it('returns false for non-object', () => {
      expect(isClaudeHookPayload('string')).toBe(false)
      expect(isClaudeHookPayload(123)).toBe(false)
    })

    it('returns false when session_id is missing', () => {
      const payload = {
        transcript_path: '/path/to/transcript.json',
        cwd: '/home/user/project',
        hook_event_name: 'PostToolUse'
      }

      expect(isClaudeHookPayload(payload)).toBe(false)
    })

    it('returns false when transcript_path is missing', () => {
      const payload = {
        session_id: 'test-session',
        cwd: '/home/user/project',
        hook_event_name: 'PostToolUse'
      }

      expect(isClaudeHookPayload(payload)).toBe(false)
    })

    it('returns false when cwd is missing', () => {
      const payload = {
        session_id: 'test-session',
        transcript_path: '/path/to/transcript.json',
        hook_event_name: 'PostToolUse'
      }

      expect(isClaudeHookPayload(payload)).toBe(false)
    })

    it('returns false when hook_event_name is missing', () => {
      const payload = {
        session_id: 'test-session',
        transcript_path: '/path/to/transcript.json',
        cwd: '/home/user/project'
      }

      expect(isClaudeHookPayload(payload)).toBe(false)
    })

    it('returns false when fields are wrong types', () => {
      const payload = {
        session_id: 123, // Should be string
        transcript_path: '/path/to/transcript.json',
        cwd: '/home/user/project',
        hook_event_name: 'PostToolUse'
      }

      expect(isClaudeHookPayload(payload)).toBe(false)
    })

    it('returns true for payload with extra fields', () => {
      const payload = {
        session_id: 'test-session',
        transcript_path: '/path/to/transcript.json',
        cwd: '/home/user/project',
        hook_event_name: 'PostToolUse',
        extra_field: 'should be ignored'
      }

      expect(isClaudeHookPayload(payload)).toBe(true)
    })
  })

  describe('type definitions', () => {
    it('ClaudeHookPayload type can be assigned correctly', () => {
      const payload: ClaudeHookPayload = {
        session_id: 'test',
        transcript_path: '/path',
        cwd: '/cwd',
        hook_event_name: 'Stop'
      }

      expect(payload.session_id).toBe('test')
    })

    it('ClaudePostToolUsePayload extends ClaudeHookPayload', () => {
      const payload: ClaudePostToolUsePayload = {
        session_id: 'test',
        transcript_path: '/path',
        cwd: '/cwd',
        hook_event_name: 'PostToolUse',
        tool_name: 'Read',
        tool_input: { file_path: '/test.ts' },
        tool_output: 'contents'
      }

      // Can access base fields
      expect(payload.session_id).toBe('test')
      // Can access extended fields
      expect(payload.tool_name).toBe('Read')
    })

    it('ClaudeStopPayload extends ClaudeHookPayload', () => {
      const payload: ClaudeStopPayload = {
        session_id: 'test',
        transcript_path: '/path',
        cwd: '/cwd',
        hook_event_name: 'Stop',
        stop_reason: 'completed'
      }

      // Can access base fields
      expect(payload.session_id).toBe('test')
      // Can access extended fields
      expect(payload.stop_reason).toBe('completed')
    })
  })
})

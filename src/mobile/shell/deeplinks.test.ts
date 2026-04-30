import { describe, it, expect } from 'vitest'
import { parseDeepLink } from './deeplinks'

describe('parseDeepLink', () => {
  // ── chat URIs ──────────────────────────────────────────────────────

  it('parses tinsu://chat/{sessionId}', () => {
    const result = parseDeepLink('tinsu://chat/session-abc-123')
    expect(result).toEqual({
      tab: 'planning',
      stack: ['sessions', 'chat:session-abc-123'],
    })
  })

  it('parses tinsu://chat/{sessionId} with UUID session ID', () => {
    const result = parseDeepLink('tinsu://chat/550e8400-e29b-41d4-a716-446655440000')
    expect(result).toEqual({
      tab: 'planning',
      stack: ['sessions', 'chat:550e8400-e29b-41d4-a716-446655440000'],
    })
  })

  // ── task URIs ──────────────────────────────────────────────────────

  it('parses tinsu://task/{taskId}', () => {
    const result = parseDeepLink('tinsu://task/task-xyz-456')
    expect(result).toEqual({
      tab: 'tasks',
      stack: ['list', 'workspace:task-xyz-456'],
    })
  })

  it('parses tinsu://task/{taskId}/diff', () => {
    const result = parseDeepLink('tinsu://task/task-xyz-456/diff')
    expect(result).toEqual({
      tab: 'tasks',
      stack: ['list', 'workspace:task-xyz-456', 'diff'],
    })
  })

  it('parses tinsu://task/{taskId} with numeric ID', () => {
    const result = parseDeepLink('tinsu://task/42')
    expect(result).toEqual({
      tab: 'tasks',
      stack: ['list', 'workspace:42'],
    })
  })

  // ── malformed / unknown URIs ───────────────────────────────────────

  it('returns null for tinsu:// with no path', () => {
    const result = parseDeepLink('tinsu://')
    expect(result).toBeNull()
  })

  it('returns null for tinsu://chat with no sessionId', () => {
    const result = parseDeepLink('tinsu://chat')
    expect(result).toBeNull()
  })

  it('returns null for tinsu://task with no taskId', () => {
    const result = parseDeepLink('tinsu://task')
    expect(result).toBeNull()
  })

  it('returns null for unknown host', () => {
    const result = parseDeepLink('tinsu://unknown/something')
    expect(result).toBeNull()
  })

  it('returns null for empty string', () => {
    const result = parseDeepLink('')
    expect(result).toBeNull()
  })

  it('returns null for non-uri string', () => {
    const result = parseDeepLink('not-a-uri')
    expect(result).toBeNull()
  })

  it('returns null for https:// scheme', () => {
    const result = parseDeepLink('https://example.com/chat/session-1')
    expect(result).toBeNull()
  })

  it('returns null for ftp:// scheme', () => {
    const result = parseDeepLink('ftp://tinsu/chat/session-1')
    expect(result).toBeNull()
  })

  // ── settings URIs (T3.5-7) ────────────────────────────────────────

  it('parses tinsu://settings/connections → settings tab with connections stack', () => {
    const result = parseDeepLink('tinsu://settings/connections')
    expect(result).toEqual({
      tab: 'settings',
      stack: ['home', 'connections'],
    })
  })

  it('returns null for tinsu://settings/foo (unknown sub-path, T3.5-8 scope)', () => {
    const result = parseDeepLink('tinsu://settings/foo')
    expect(result).toBeNull()
  })

  it('returns null for tinsu://settings (no sub-path)', () => {
    const result = parseDeepLink('tinsu://settings')
    expect(result).toBeNull()
  })
})

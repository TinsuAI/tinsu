import { describe, it, expect } from 'vitest'
import {
  eventTypeToCategory,
  eventTypeToTitle,
  eventTypeToIconClass,
  categoryFilterToEventTypes,
  payloadToSubtitle,
  relativeTime,
} from './activity-meta'
import type { Activity } from '@shared/types/activity.types'

describe('eventTypeToCategory', () => {
  it('maps status_change → Status', () => {
    expect(eventTypeToCategory('status_change')).toBe('Status')
  })
  it('maps agent_start → Agent', () => {
    expect(eventTypeToCategory('agent_start')).toBe('Agent')
  })
  it('maps agent_complete → Agent', () => {
    expect(eventTypeToCategory('agent_complete')).toBe('Agent')
  })
  it('maps tool_used → Tools', () => {
    expect(eventTypeToCategory('tool_used')).toBe('Tools')
  })
  it('maps error → Errors', () => {
    expect(eventTypeToCategory('error')).toBe('Errors')
  })
  it('maps stall_detected → Errors', () => {
    expect(eventTypeToCategory('stall_detected')).toBe('Errors')
  })
  it('maps user_command → User', () => {
    expect(eventTypeToCategory('user_command')).toBe('User')
  })
  it('maps rejection → User', () => {
    expect(eventTypeToCategory('rejection')).toBe('User')
  })
  it('maps automation_trigger → Auto', () => {
    expect(eventTypeToCategory('automation_trigger')).toBe('Auto')
  })
  it('maps session_ended → Auto', () => {
    expect(eventTypeToCategory('session_ended')).toBe('Auto')
  })
  it('maps auto_commit → Auto', () => {
    expect(eventTypeToCategory('auto_commit')).toBe('Auto')
  })
  it('maps stall_recovered → Auto', () => {
    expect(eventTypeToCategory('stall_recovered')).toBe('Auto')
  })
})

describe('eventTypeToTitle', () => {
  it('returns human-readable string for error', () => {
    expect(eventTypeToTitle('error')).toBe('Error')
  })
  it('returns human-readable string for agent_start', () => {
    expect(eventTypeToTitle('agent_start')).toBe('Agent Started')
  })
  it('returns human-readable string for auto_commit', () => {
    expect(eventTypeToTitle('auto_commit')).toBe('Auto Commit')
  })
})

describe('eventTypeToIconClass (AC-17 token discipline)', () => {
  it('returns text-destructive for error', () => {
    expect(eventTypeToIconClass('error')).toBe('text-destructive')
  })
  it('returns text-destructive for stall_detected', () => {
    expect(eventTypeToIconClass('stall_detected')).toBe('text-destructive')
  })
  it('returns text-primary for agent_start', () => {
    expect(eventTypeToIconClass('agent_start')).toBe('text-primary')
  })
  it('returns text-primary for agent_complete', () => {
    expect(eventTypeToIconClass('agent_complete')).toBe('text-primary')
  })
  it('never returns inline color classes', () => {
    const types = [
      'status_change', 'agent_start', 'agent_complete', 'tool_used',
      'user_command', 'automation_trigger', 'error', 'session_ended',
      'stall_detected', 'stall_recovered', 'auto_commit', 'rejection',
    ] as const
    const colorPattern = /(text|bg)-(red|blue|green|yellow|orange|purple|pink|gray|slate)-[0-9]/
    types.forEach((t) => {
      expect(colorPattern.test(eventTypeToIconClass(t))).toBe(false)
    })
  })
})

describe('categoryFilterToEventTypes', () => {
  it('returns null for All (no filter)', () => {
    expect(categoryFilterToEventTypes('All')).toBeNull()
  })
  it('returns ["status_change"] for Status', () => {
    expect(categoryFilterToEventTypes('Status')).toEqual(['status_change'])
  })
  it('returns agent types for Agent', () => {
    expect(categoryFilterToEventTypes('Agent')).toEqual(['agent_start', 'agent_complete'])
  })
  it('returns tool_used for Tools', () => {
    expect(categoryFilterToEventTypes('Tools')).toEqual(['tool_used'])
  })
  it('returns error types for Errors', () => {
    expect(categoryFilterToEventTypes('Errors')).toEqual(['error', 'stall_detected'])
  })
  it('returns user types for User', () => {
    expect(categoryFilterToEventTypes('User')).toEqual(['user_command', 'rejection'])
  })
  it('returns auto types for Auto', () => {
    const types = categoryFilterToEventTypes('Auto')!
    expect(types).toContain('automation_trigger')
    expect(types).toContain('auto_commit')
    expect(types).toContain('stall_recovered')
    expect(types).toContain('session_ended')
  })
})

describe('payloadToSubtitle', () => {
  const makeActivity = (event_type: Activity['event_type'], payload: string | null): Activity => ({
    id: '1',
    task_id: 'task-1',
    event_type,
    payload,
    created_at: Date.now(),
  })

  it('returns empty string for null payload', () => {
    const a = makeActivity('error', null)
    expect(payloadToSubtitle(a)).toBe('')
  })

  it('extracts status_change from → to', () => {
    const a = makeActivity('status_change', JSON.stringify({ from_status: 'todo', to_status: 'in-progress' }))
    expect(payloadToSubtitle(a)).toBe('todo → in-progress')
  })

  it('extracts tool name for tool_used', () => {
    const a = makeActivity('tool_used', JSON.stringify({ tool_name: 'Bash' }))
    expect(payloadToSubtitle(a)).toBe('Bash')
  })

  it('extracts error message for error', () => {
    const a = makeActivity('error', JSON.stringify({ message: 'Process exited with code 1' }))
    expect(payloadToSubtitle(a)).toBe('Process exited with code 1')
  })

  it('truncates fallback to 80 chars', () => {
    const long = 'a'.repeat(120)
    const a = makeActivity('session_ended', JSON.stringify({ detail: long }))
    const result = payloadToSubtitle(a)
    expect(result.length).toBeLessThanOrEqual(80)
  })

  it('handles invalid JSON gracefully', () => {
    const a = makeActivity('error', 'not-json')
    expect(payloadToSubtitle(a)).toBe('not-json')
  })
})

describe('relativeTime', () => {
  it('returns "now" for recent events', () => {
    expect(relativeTime(Date.now() - 30_000)).toBe('now')
  })
  it('returns "2m" for 2-minute-old events', () => {
    expect(relativeTime(Date.now() - 2 * 60_000)).toBe('2m')
  })
  it('returns "1h" for 1-hour-old events', () => {
    expect(relativeTime(Date.now() - 3600_000)).toBe('1h')
  })
  it('returns "yesterday" for ~25 hours ago', () => {
    expect(relativeTime(Date.now() - 25 * 3600_000)).toBe('yesterday')
  })
  it('returns "3d" for 3-day-old events', () => {
    expect(relativeTime(Date.now() - 3 * 24 * 3600_000)).toBe('3d')
  })
})

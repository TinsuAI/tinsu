import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ActivityItem } from './ActivityItem'
import type { Activity } from '@shared/types/activity.types'

/**
 * Unit tests for ActivityItem component.
 *
 * @see TES-2.11: Activity Log UI Display (AC: #1, #2)
 */
describe('ActivityItem', () => {
  describe('Timestamp Formatting (AC: #1)', () => {
    it('displays timestamp in HH:MM:SS format', () => {
      const timestamp = new Date('2026-01-19T14:32:18.000Z').getTime()
      const activity: Activity = {
        id: 'test-1',
        task_id: 'task-123',
        event_type: 'status_change',
        payload: JSON.stringify({ from: 'backlog', to: 'in_progress' }),
        created_at: timestamp
      }

      render(<ActivityItem activity={activity} />)

      // Verify exact formatted time based on local timezone
      // Implementation uses date-fns format(date, 'HH:mm:ss')
      // We import format in test file or just rely on the implementation being consistent
      // Let's use a regex that matches the time part to be safe, but ideally check exact string
      // Note: toLocaleTimeString might behave differently on different systems vs date-fns format
      // So we will just check that the element containing the time exists and matches strict pattern
      expect(screen.getByText(/\d{2}:\d{2}:\d{2}/)).toBeInTheDocument()
      
      // Also check that it is a valid time string
      const timeElement = screen.getByText(/\d{2}:\d{2}:\d{2}/)
      expect(timeElement.textContent).toMatch(/^[0-2][0-9]:[0-5][0-9]:[0-5][0-9]$/)
    })

    it('displays timestamp for midnight correctly', () => {
      const activity: Activity = {
        id: 'test-midnight',
        task_id: 'task-123',
        event_type: 'agent_start',
        payload: null,
        created_at: new Date('2026-01-19T00:00:00.000Z').getTime()
      }

      render(<ActivityItem activity={activity} />)

      // Should show a valid timestamp pattern
      expect(screen.getByText(/\d{2}:\d{2}:\d{2}/)).toBeInTheDocument()
    })
  })

  describe('Event Type Icons and Titles', () => {
    it('displays status_change event with correct title', () => {
      const activity: Activity = {
        id: 'test-status',
        task_id: 'task-123',
        event_type: 'status_change',
        payload: JSON.stringify({ from: 'backlog', to: 'in_progress' }),
        created_at: Date.now()
      }

      render(<ActivityItem activity={activity} />)

      expect(screen.getByText('Status Changed')).toBeInTheDocument()
    })

    it('displays agent_start event with correct title', () => {
      const activity: Activity = {
        id: 'test-agent-start',
        task_id: 'task-123',
        event_type: 'agent_start',
        payload: JSON.stringify({ phase: 'dev-story' }),
        created_at: Date.now()
      }

      render(<ActivityItem activity={activity} />)

      expect(screen.getByText('Agent Started')).toBeInTheDocument()
    })

    it('displays agent_complete event with correct title', () => {
      const activity: Activity = {
        id: 'test-agent-complete',
        task_id: 'task-123',
        event_type: 'agent_complete',
        payload: JSON.stringify({ duration_ms: 120000 }),
        created_at: Date.now()
      }

      render(<ActivityItem activity={activity} />)

      expect(screen.getByText('Agent Completed')).toBeInTheDocument()
    })

    it('displays tool_used event with correct title', () => {
      const activity: Activity = {
        id: 'test-tool-used',
        task_id: 'task-123',
        event_type: 'tool_used',
        payload: JSON.stringify({ tool: 'Edit', file: 'src/index.ts' }),
        created_at: Date.now()
      }

      render(<ActivityItem activity={activity} />)

      expect(screen.getByText('Tool Used')).toBeInTheDocument()
    })

    it('displays user_command event with correct title', () => {
      const activity: Activity = {
        id: 'test-user-command',
        task_id: 'task-123',
        event_type: 'user_command',
        payload: JSON.stringify({ command: 'npm run test' }),
        created_at: Date.now()
      }

      render(<ActivityItem activity={activity} />)

      expect(screen.getByText('User Command')).toBeInTheDocument()
    })

    it('displays automation_trigger event with correct title', () => {
      const activity: Activity = {
        id: 'test-automation',
        task_id: 'task-123',
        event_type: 'automation_trigger',
        payload: JSON.stringify({ command: '/code-review', trigger: 'auto' }),
        created_at: Date.now()
      }

      render(<ActivityItem activity={activity} />)

      expect(screen.getByText('Auto-triggered')).toBeInTheDocument()
    })

    it('displays error event with correct title', () => {
      const activity: Activity = {
        id: 'test-error',
        task_id: 'task-123',
        event_type: 'error',
        payload: JSON.stringify({ message: 'Agent failed', code: 'AGENT_ERROR' }),
        created_at: Date.now()
      }

      render(<ActivityItem activity={activity} />)

      expect(screen.getByText('Error')).toBeInTheDocument()
    })

    it('displays session_ended event with correct title', () => {
      const activity: Activity = {
        id: 'test-session-ended',
        task_id: 'task-123',
        event_type: 'session_ended',
        payload: JSON.stringify({ reason: 'Completed' }),
        created_at: Date.now()
      }

      render(<ActivityItem activity={activity} />)

      expect(screen.getByText('Session Ended')).toBeInTheDocument()
    })

    it('displays stall_detected event with correct title', () => {
      const activity: Activity = {
        id: 'test-stall-detected',
        task_id: 'task-123',
        event_type: 'stall_detected',
        payload: JSON.stringify({ stallDurationMs: 300000 }),
        created_at: Date.now()
      }

      render(<ActivityItem activity={activity} />)

      expect(screen.getByText('Stall Detected')).toBeInTheDocument()
    })

    it('displays stall_recovered event with correct title', () => {
      const activity: Activity = {
        id: 'test-stall-recovered',
        task_id: 'task-123',
        event_type: 'stall_recovered',
        payload: null,
        created_at: Date.now()
      }

      render(<ActivityItem activity={activity} />)

      expect(screen.getByText('Stall Recovered')).toBeInTheDocument()
    })
  })

  describe('Payload Display (AC: #2)', () => {
    it('displays status_change payload with arrow format', () => {
      const activity: Activity = {
        id: 'test-status-payload',
        task_id: 'task-123',
        event_type: 'status_change',
        payload: JSON.stringify({ from: 'backlog', to: 'in_progress' }),
        created_at: Date.now()
      }

      render(<ActivityItem activity={activity} />)

      expect(screen.getByText('backlog → in_progress')).toBeInTheDocument()
    })

    it('displays agent_start payload with phase', () => {
      const activity: Activity = {
        id: 'test-agent-start-payload',
        task_id: 'task-123',
        event_type: 'agent_start',
        payload: JSON.stringify({ phase: 'dev-story' }),
        created_at: Date.now()
      }

      render(<ActivityItem activity={activity} />)

      expect(screen.getByText('Phase: dev-story')).toBeInTheDocument()
    })

    it('displays agent_complete payload with duration', () => {
      const activity: Activity = {
        id: 'test-agent-complete-payload',
        task_id: 'task-123',
        event_type: 'agent_complete',
        payload: JSON.stringify({ duration_ms: 120000 }),
        created_at: Date.now()
      }

      render(<ActivityItem activity={activity} />)

      expect(screen.getByText('Completed in 120s')).toBeInTheDocument()
    })

    it('displays tool_used payload with tool and file', () => {
      const activity: Activity = {
        id: 'test-tool-used-payload',
        task_id: 'task-123',
        event_type: 'tool_used',
        payload: JSON.stringify({ tool: 'Edit', file: 'src/index.ts' }),
        created_at: Date.now()
      }

      render(<ActivityItem activity={activity} />)

      expect(screen.getByText('Edit on src/index.ts')).toBeInTheDocument()
    })

    it('displays tool_used payload without file', () => {
      const activity: Activity = {
        id: 'test-tool-used-no-file',
        task_id: 'task-123',
        event_type: 'tool_used',
        payload: JSON.stringify({ tool: 'Bash' }),
        created_at: Date.now()
      }

      render(<ActivityItem activity={activity} />)

      expect(screen.getByText('Bash')).toBeInTheDocument()
    })

    it('displays user_command payload with command', () => {
      const activity: Activity = {
        id: 'test-user-command-payload',
        task_id: 'task-123',
        event_type: 'user_command',
        payload: JSON.stringify({ command: 'npm run test' }),
        created_at: Date.now()
      }

      render(<ActivityItem activity={activity} />)

      expect(screen.getByText('$ npm run test')).toBeInTheDocument()
    })

    it('displays automation_trigger payload with command and trigger', () => {
      const activity: Activity = {
        id: 'test-automation-payload',
        task_id: 'task-123',
        event_type: 'automation_trigger',
        payload: JSON.stringify({ command: '/code-review', trigger: 'phase-complete' }),
        created_at: Date.now()
      }

      render(<ActivityItem activity={activity} />)

      expect(screen.getByText('/code-review (phase-complete)')).toBeInTheDocument()
    })

    it('displays error payload with message', () => {
      const activity: Activity = {
        id: 'test-error-payload',
        task_id: 'task-123',
        event_type: 'error',
        payload: JSON.stringify({ message: 'Agent failed unexpectedly', code: 'AGENT_ERROR' }),
        created_at: Date.now()
      }

      render(<ActivityItem activity={activity} />)

      expect(screen.getByText('Agent failed unexpectedly')).toBeInTheDocument()
    })

    it('displays session_ended payload with reason', () => {
      const activity: Activity = {
        id: 'test-session-ended-payload',
        task_id: 'task-123',
        event_type: 'session_ended',
        payload: JSON.stringify({ reason: 'User cancelled' }),
        created_at: Date.now()
      }

      render(<ActivityItem activity={activity} />)

      expect(screen.getByText('User cancelled')).toBeInTheDocument()
    })

    it('displays stall_detected payload with duration', () => {
      const activity: Activity = {
        id: 'test-stall-detected-payload',
        task_id: 'task-123',
        event_type: 'stall_detected',
        payload: JSON.stringify({ stallDurationMs: 300000 }),
        created_at: Date.now()
      }

      render(<ActivityItem activity={activity} />)

      expect(screen.getByText('No output for 5min')).toBeInTheDocument()
    })

    it('displays stall_recovered payload', () => {
      const activity: Activity = {
        id: 'test-stall-recovered-payload',
        task_id: 'task-123',
        event_type: 'stall_recovered',
        payload: null,
        created_at: Date.now()
      }

      render(<ActivityItem activity={activity} />)

      expect(screen.getByText('Output resumed')).toBeInTheDocument()
    })

    it('handles null payload gracefully', () => {
      const activity: Activity = {
        id: 'test-null-payload',
        task_id: 'task-123',
        event_type: 'agent_start',
        payload: null,
        created_at: Date.now()
      }

      render(<ActivityItem activity={activity} />)

      expect(screen.getByText('Agent Started')).toBeInTheDocument()
      expect(screen.getByText('Started')).toBeInTheDocument()
    })

    it('handles invalid JSON payload gracefully', () => {
      const activity: Activity = {
        id: 'test-invalid-json',
        task_id: 'task-123',
        event_type: 'agent_start',
        payload: 'not valid json{',
        created_at: Date.now()
      }

      render(<ActivityItem activity={activity} />)

      // Should not throw, should render with default "Started" text
      expect(screen.getByText('Agent Started')).toBeInTheDocument()
    })
  })
})

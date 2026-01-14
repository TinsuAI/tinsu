import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ActivityLogService, type ActivityEventType, type ActivityPayload } from './activity-log.service'

describe('ActivityLogService (TES-1.11)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  describe('logActivity', () => {
    it('logs session_ended event with reason and session name', async () => {
      await ActivityLogService.logActivity('task-123', 'session_ended', {
        reason: 'process_exit',
        sessionName: 'tinsu-project-task-123'
      })

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[ActivityLog]'),
        expect.objectContaining({
          reason: 'process_exit',
          sessionName: 'tinsu-project-task-123'
        })
      )
    })

    it('logs stall_detected event with timing information', async () => {
      const lastOutputTime = Date.now() - 300000 // 5 minutes ago

      await ActivityLogService.logActivity('task-456', 'stall_detected', {
        lastOutputTime,
        stallDurationMs: 300000
      })

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[ActivityLog]'),
        expect.objectContaining({
          lastOutputTime,
          stallDurationMs: 300000
        })
      )
    })

    it('logs stall_recovered event with stalled duration', async () => {
      await ActivityLogService.logActivity('task-789', 'stall_recovered', {
        stalledDurationMs: 180000 // 3 minutes
      })

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[ActivityLog]'),
        expect.objectContaining({
          stalledDurationMs: 180000
        })
      )
    })

    it('includes timestamp in log output', async () => {
      await ActivityLogService.logActivity('task-time', 'session_ended', {
        reason: 'session_killed',
        sessionName: 'test-session'
      })

      expect(console.log).toHaveBeenCalledWith(
        expect.stringMatching(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/),
        expect.anything()
      )
    })

    it('includes taskId and eventType in log output', async () => {
      await ActivityLogService.logActivity('my-task-id', 'session_ended', {
        reason: 'detected_stale',
        sessionName: 'session-name'
      })

      const logCall = vi.mocked(console.log).mock.calls[0]
      expect(logCall[0]).toContain('my-task-id')
      expect(logCall[0]).toContain('session_ended')
    })
  })
})

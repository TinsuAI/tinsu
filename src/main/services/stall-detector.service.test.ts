import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { StallDetectorService } from './stall-detector.service'
import { sessionEventEmitter } from '../lib/session-events'

// Mock session event emitter
vi.mock('../lib/session-events', () => ({
  sessionEventEmitter: {
    emitSessionEnded: vi.fn(),
    emitSessionStalled: vi.fn(),
    emitSessionRecovered: vi.fn()
  }
}))

// Mock activity log service
vi.mock('./activity-log.service', () => ({
  ActivityLogService: {
    logActivity: vi.fn()
  }
}))

describe('StallDetectorService (TES-1.11)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    StallDetectorService.clearAll()
    // Set a short threshold for testing (10 seconds)
    StallDetectorService.setStallThreshold(10000)
  })

  afterEach(() => {
    StallDetectorService.clearAll()
    vi.useRealTimers()
  })

  describe('startTracking', () => {
    it('starts tracking a session (AC: #3)', () => {
      StallDetectorService.startTracking('task-1')

      // Should not be stalled immediately
      expect(StallDetectorService.isStalled('task-1')).toBe(false)
    })

    it('does not duplicate tracking', () => {
      StallDetectorService.startTracking('task-1')
      StallDetectorService.startTracking('task-1') // Should be no-op

      // Still should be tracking
      expect(StallDetectorService.isStalled('task-1')).toBe(false)
    })
  })

  describe('stopTracking', () => {
    it('stops tracking a session', () => {
      StallDetectorService.startTracking('task-1')
      StallDetectorService.stopTracking('task-1')

      // Should no longer be tracked
      expect(StallDetectorService.isStalled('task-1')).toBe(false)
    })

    it('handles stopping non-existent session gracefully', () => {
      // Should not throw
      StallDetectorService.stopTracking('task-nonexistent')
    })
  })

  describe('stall detection', () => {
    it('detects stall after threshold passes (AC: #3)', async () => {
      StallDetectorService.startTracking('task-stall')

      // Advance time past threshold
      await vi.advanceTimersByTimeAsync(30000) // 30 seconds (check interval)

      expect(StallDetectorService.isStalled('task-stall')).toBe(true)
      expect(sessionEventEmitter.emitSessionStalled).toHaveBeenCalledWith({
        taskId: 'task-stall',
        lastOutputTime: expect.any(Number),
        stallDurationMs: 10000
      })
    })

    it('does not stall if output is received regularly', async () => {
      // Set threshold higher than check interval for this test
      StallDetectorService.setStallThreshold(60000) // 1 minute
      StallDetectorService.startTracking('task-active')

      // Record output every 20 seconds (well within threshold)
      await vi.advanceTimersByTimeAsync(20000)
      StallDetectorService.recordOutput('task-active')

      await vi.advanceTimersByTimeAsync(20000)
      StallDetectorService.recordOutput('task-active')

      // Advance to trigger check (30 seconds)
      await vi.advanceTimersByTimeAsync(30000)

      // Should not be stalled because we received output within threshold
      expect(StallDetectorService.isStalled('task-active')).toBe(false)
    })

    it('emits recovery event when output received after stall', async () => {
      StallDetectorService.startTracking('task-recover')

      // Let it stall
      await vi.advanceTimersByTimeAsync(30000)
      expect(StallDetectorService.isStalled('task-recover')).toBe(true)

      // Now receive output
      StallDetectorService.recordOutput('task-recover')

      // Should have recovered
      expect(StallDetectorService.isStalled('task-recover')).toBe(false)
      expect(sessionEventEmitter.emitSessionRecovered).toHaveBeenCalledWith({
        taskId: 'task-recover'
      })
    })
  })

  describe('recordOutput', () => {
    it('ignores output for non-tracked sessions', () => {
      // Should not throw
      StallDetectorService.recordOutput('task-unknown')
    })

    it('resets stall timer on output', async () => {
      StallDetectorService.startTracking('task-reset')

      // Advance 8 seconds (close to threshold)
      await vi.advanceTimersByTimeAsync(8000)

      // Record output - this resets the timer
      StallDetectorService.recordOutput('task-reset')

      // Advance 8 more seconds (would have been past threshold without reset)
      await vi.advanceTimersByTimeAsync(8000)

      // Should not be stalled yet (only 8 seconds since last output)
      expect(StallDetectorService.isStalled('task-reset')).toBe(false)
    })
  })

  describe('configuration', () => {
    it('allows setting stall threshold', () => {
      StallDetectorService.setStallThreshold(60000) // 1 minute
      expect(StallDetectorService.getStallThreshold()).toBe(60000)
    })
  })

  describe('clearAll', () => {
    it('clears all tracked sessions', () => {
      StallDetectorService.startTracking('task-1')
      StallDetectorService.startTracking('task-2')

      StallDetectorService.clearAll()

      expect(StallDetectorService.isStalled('task-1')).toBe(false)
      expect(StallDetectorService.isStalled('task-2')).toBe(false)
    })
  })
})

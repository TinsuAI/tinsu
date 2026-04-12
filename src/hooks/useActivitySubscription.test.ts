import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, cleanup } from '@testing-library/react'
import { useActivitySubscription } from './useActivitySubscription'

// Mock window.api
const mockUnsubscribe = vi.fn()
let mockOnActivityCreated: ReturnType<typeof vi.fn>

beforeEach(() => {
  mockUnsubscribe.mockClear()
  mockOnActivityCreated = vi.fn(() => mockUnsubscribe)

  Object.defineProperty(window, 'api', {
    writable: true,
    value: {
      onActivityCreated: mockOnActivityCreated,
      onFileChange: vi.fn(() => vi.fn())
    }
  })
})

afterEach(() => {
  cleanup()
})

/**
 * Unit tests for useActivitySubscription hook.
 *
 * @see TES-2.13: Real-Time Activity Streaming (AC: #4)
 */
describe('useActivitySubscription', () => {
  describe('subscription lifecycle', () => {
    it('subscribes to activity events when enabled', () => {
      const onActivity = vi.fn()

      renderHook(() =>
        useActivitySubscription({
          taskId: 'task-123',
          onActivity,
          enabled: true
        })
      )

      expect(mockOnActivityCreated).toHaveBeenCalledTimes(1)
      expect(mockOnActivityCreated).toHaveBeenCalledWith(expect.any(Function))
    })

    it('does not subscribe when enabled is false', () => {
      const onActivity = vi.fn()

      renderHook(() =>
        useActivitySubscription({
          taskId: 'task-123',
          onActivity,
          enabled: false
        })
      )

      expect(mockOnActivityCreated).not.toHaveBeenCalled()
    })

    it('unsubscribes when component unmounts', () => {
      const onActivity = vi.fn()

      const { unmount } = renderHook(() =>
        useActivitySubscription({
          taskId: 'task-123',
          onActivity,
          enabled: true
        })
      )

      unmount()

      expect(mockUnsubscribe).toHaveBeenCalledTimes(1)
    })

    it('unsubscribes when enabled changes to false', () => {
      const onActivity = vi.fn()

      const { rerender } = renderHook(
        ({ enabled }) =>
          useActivitySubscription({
            taskId: 'task-123',
            onActivity,
            enabled
          }),
        { initialProps: { enabled: true } }
      )

      expect(mockOnActivityCreated).toHaveBeenCalledTimes(1)

      // Disable subscription
      rerender({ enabled: false })

      expect(mockUnsubscribe).toHaveBeenCalledTimes(1)
    })

    it('resubscribes when taskId changes', () => {
      const onActivity = vi.fn()

      const { rerender } = renderHook(
        ({ taskId }) =>
          useActivitySubscription({
            taskId,
            onActivity,
            enabled: true
          }),
        { initialProps: { taskId: 'task-123' } }
      )

      expect(mockOnActivityCreated).toHaveBeenCalledTimes(1)

      // Change taskId
      rerender({ taskId: 'task-456' })

      // Should have unsubscribed from old and subscribed to new
      expect(mockUnsubscribe).toHaveBeenCalledTimes(1)
      expect(mockOnActivityCreated).toHaveBeenCalledTimes(2)
    })
  })

  describe('event filtering', () => {
    it('only calls onActivity for matching taskId', () => {
      const onActivity = vi.fn()

      renderHook(() =>
        useActivitySubscription({
          taskId: 'task-123',
          onActivity,
          enabled: true
        })
      )

      // Get the handler passed to onActivityCreated
      const handler = mockOnActivityCreated.mock.calls[0][0]

      // Simulate receiving an activity for the subscribed task
      act(() => {
        handler({
          taskId: 'task-123',
          activity: {
            id: 'act-1',
            task_id: 'task-123',
            event_type: 'status_change',
            payload: null,
            created_at: Date.now()
          }
        })
      })

      expect(onActivity).toHaveBeenCalledTimes(1)
      expect(onActivity).toHaveBeenCalledWith({
        id: 'act-1',
        task_id: 'task-123',
        event_type: 'status_change',
        payload: null,
        created_at: expect.any(Number)
      })
    })

    it('ignores activities for different taskId', () => {
      const onActivity = vi.fn()

      renderHook(() =>
        useActivitySubscription({
          taskId: 'task-123',
          onActivity,
          enabled: true
        })
      )

      // Get the handler
      const handler = mockOnActivityCreated.mock.calls[0][0]

      // Simulate receiving an activity for a DIFFERENT task
      act(() => {
        handler({
          taskId: 'task-456',
          activity: {
            id: 'act-2',
            task_id: 'task-456',
            event_type: 'agent_start',
            payload: null,
            created_at: Date.now()
          }
        })
      })

      expect(onActivity).not.toHaveBeenCalled()
    })
  })

  describe('callback handling', () => {
    it('calls onActivity with correctly typed Activity object', () => {
      const onActivity = vi.fn()

      renderHook(() =>
        useActivitySubscription({
          taskId: 'task-123',
          onActivity,
          enabled: true
        })
      )

      const handler = mockOnActivityCreated.mock.calls[0][0]

      const testPayload = JSON.stringify({ from: 'backlog', to: 'in_progress' })

      act(() => {
        handler({
          taskId: 'task-123',
          activity: {
            id: 'act-1',
            task_id: 'task-123',
            event_type: 'status_change',
            payload: testPayload,
            created_at: 1705678338000
          }
        })
      })

      expect(onActivity).toHaveBeenCalledWith({
        id: 'act-1',
        task_id: 'task-123',
        event_type: 'status_change',
        payload: testPayload,
        created_at: 1705678338000
      })
    })

    it('handles rapid events without issues', () => {
      const onActivity = vi.fn()

      renderHook(() =>
        useActivitySubscription({
          taskId: 'task-123',
          onActivity,
          enabled: true
        })
      )

      const handler = mockOnActivityCreated.mock.calls[0][0]

      // Simulate rapid events
      act(() => {
        for (let i = 0; i < 10; i++) {
          handler({
            taskId: 'task-123',
            activity: {
              id: `act-${i}`,
              task_id: 'task-123',
              event_type: 'tool_used',
              payload: JSON.stringify({ tool: `Tool${i}` }),
              created_at: Date.now() + i
            }
          })
        }
      })

      expect(onActivity).toHaveBeenCalledTimes(10)
    })

    it('uses latest callback reference (no stale closure)', () => {
      let callCount = 0
      const onActivity1 = vi.fn(() => {
        callCount = 1
      })
      const onActivity2 = vi.fn(() => {
        callCount = 2
      })

      const { rerender } = renderHook(
        ({ onActivity }) =>
          useActivitySubscription({
            taskId: 'task-123',
            onActivity,
            enabled: true
          }),
        { initialProps: { onActivity: onActivity1 } }
      )

      const handler = mockOnActivityCreated.mock.calls[0][0]

      // Update callback
      rerender({ onActivity: onActivity2 })

      // Trigger event
      act(() => {
        handler({
          taskId: 'task-123',
          activity: {
            id: 'act-1',
            task_id: 'task-123',
            event_type: 'agent_complete',
            payload: null,
            created_at: Date.now()
          }
        })
      })

      // Should use the new callback
      expect(callCount).toBe(2)
      expect(onActivity2).toHaveBeenCalled()
    })
  })

  describe('edge cases', () => {
    it('handles enabled toggling gracefully', () => {
      const onActivity = vi.fn()

      const { rerender } = renderHook(
        ({ enabled }) =>
          useActivitySubscription({
            taskId: 'task-123',
            onActivity,
            enabled
          }),
        { initialProps: { enabled: true } }
      )

      // Disable
      rerender({ enabled: false })
      expect(mockUnsubscribe).toHaveBeenCalledTimes(1)

      // Re-enable
      rerender({ enabled: true })
      expect(mockOnActivityCreated).toHaveBeenCalledTimes(2)

      // Disable again
      rerender({ enabled: false })
      expect(mockUnsubscribe).toHaveBeenCalledTimes(2)
    })

    it('defaults enabled to true', () => {
      const onActivity = vi.fn()

      renderHook(() =>
        useActivitySubscription({
          taskId: 'task-123',
          onActivity
          // enabled not specified
        })
      )

      expect(mockOnActivityCreated).toHaveBeenCalledTimes(1)
    })
  })
})

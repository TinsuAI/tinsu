import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, cleanup } from '@testing-library/react'
import { useActivitySubscription } from './useActivitySubscription'

// Mock @tauri-apps/api/event
const mockUnlisten = vi.fn()
let capturedListener: ((event: { payload: { task_id: string; activity: object } }) => void) | null = null

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn((_eventName: string, handler: (event: unknown) => void) => {
    capturedListener = handler as typeof capturedListener
    return Promise.resolve(mockUnlisten)
  }),
}))

import { listen } from '@tauri-apps/api/event'

beforeEach(() => {
  mockUnlisten.mockClear()
  capturedListener = null
  vi.mocked(listen).mockClear()
  vi.mocked(listen).mockImplementation((_eventName, handler) => {
    capturedListener = handler as typeof capturedListener
    return Promise.resolve(mockUnlisten)
  })
})

afterEach(() => {
  cleanup()
})

/**
 * Unit tests for useActivitySubscription hook (T1.7 migration).
 *
 * @see T1.7: Migrate Hook Listener HTTP Server to Rust (AC: #11)
 */
describe('useActivitySubscription', () => {
  describe('subscription lifecycle', () => {
    it('calls listen("activity:created") when enabled', async () => {
      const onActivity = vi.fn()

      renderHook(() =>
        useActivitySubscription({
          taskId: 'task-123',
          onActivity,
          enabled: true,
        })
      )

      // listen is async — wait a tick
      await act(async () => {
        await Promise.resolve()
      })

      expect(listen).toHaveBeenCalledTimes(1)
      expect(listen).toHaveBeenCalledWith('activity:created', expect.any(Function))
    })

    it('does not call listen when enabled is false', async () => {
      const onActivity = vi.fn()

      renderHook(() =>
        useActivitySubscription({
          taskId: 'task-123',
          onActivity,
          enabled: false,
        })
      )

      await act(async () => {
        await Promise.resolve()
      })

      expect(listen).not.toHaveBeenCalled()
    })

    it('calls unlisten when component unmounts', async () => {
      const onActivity = vi.fn()

      const { unmount } = renderHook(() =>
        useActivitySubscription({
          taskId: 'task-123',
          onActivity,
          enabled: true,
        })
      )

      await act(async () => {
        await Promise.resolve()
      })

      unmount()

      expect(mockUnlisten).toHaveBeenCalledTimes(1)
    })

    it('resubscribes when taskId changes', async () => {
      const onActivity = vi.fn()

      const { rerender } = renderHook(
        ({ taskId }) =>
          useActivitySubscription({
            taskId,
            onActivity,
            enabled: true,
          }),
        { initialProps: { taskId: 'task-123' } }
      )

      await act(async () => {
        await Promise.resolve()
      })

      expect(listen).toHaveBeenCalledTimes(1)

      rerender({ taskId: 'task-456' })

      await act(async () => {
        await Promise.resolve()
      })

      // Should have cleaned up old and subscribed to new
      expect(mockUnlisten).toHaveBeenCalledTimes(1)
      expect(listen).toHaveBeenCalledTimes(2)
    })

    it('defaults enabled to true and subscribes', async () => {
      const onActivity = vi.fn()

      renderHook(() =>
        useActivitySubscription({
          taskId: 'task-123',
          onActivity,
          // enabled not specified
        })
      )

      await act(async () => {
        await Promise.resolve()
      })

      expect(listen).toHaveBeenCalledTimes(1)
    })

    it('immediately calls unlisten if component unmounts before listen() resolves', async () => {
      const onActivity = vi.fn()
      let resolveUnlisten!: (fn: () => void) => void
      vi.mocked(listen).mockImplementationOnce((_name, handler) => {
        capturedListener = handler as typeof capturedListener
        return new Promise((resolve) => {
          resolveUnlisten = resolve
        })
      })

      const { unmount } = renderHook(() =>
        useActivitySubscription({ taskId: 'task-123', onActivity, enabled: true })
      )

      // Unmount before listen() resolves
      unmount()

      // Now resolve the listen() promise — the cancelled flag should cause immediate cleanup
      const earlyUnlisten = vi.fn()
      await act(async () => {
        resolveUnlisten(earlyUnlisten)
        await Promise.resolve()
      })

      expect(earlyUnlisten).toHaveBeenCalledTimes(1)
      expect(mockUnlisten).not.toHaveBeenCalled()
    })

    it('does not throw when listen() rejects', async () => {
      const onActivity = vi.fn()
      vi.mocked(listen).mockImplementationOnce(() => Promise.reject(new Error('unavailable')))

      expect(() => {
        renderHook(() =>
          useActivitySubscription({ taskId: 'task-123', onActivity, enabled: true })
        )
      }).not.toThrow()

      // Allow the rejection to be caught
      await act(async () => {
        await Promise.resolve()
      })
    })
  })

  describe('event filtering', () => {
    it('only calls onActivity for matching taskId', async () => {
      const onActivity = vi.fn()

      renderHook(() =>
        useActivitySubscription({
          taskId: 'task-123',
          onActivity,
          enabled: true,
        })
      )

      await act(async () => {
        await Promise.resolve()
      })

      // Simulate receiving a matching activity
      act(() => {
        capturedListener?.({
          payload: {
            task_id: 'task-123',
            activity: {
              id: 'act-1',
              task_id: 'task-123',
              event_type: 'status_change',
              payload: null,
              created_at: Date.now(),
            },
          },
        })
      })

      expect(onActivity).toHaveBeenCalledTimes(1)
    })

    it('ignores activities for a different taskId', async () => {
      const onActivity = vi.fn()

      renderHook(() =>
        useActivitySubscription({
          taskId: 'task-123',
          onActivity,
          enabled: true,
        })
      )

      await act(async () => {
        await Promise.resolve()
      })

      // Simulate receiving an activity for a DIFFERENT task
      act(() => {
        capturedListener?.({
          payload: {
            task_id: 'task-456',
            activity: {
              id: 'act-2',
              task_id: 'task-456',
              event_type: 'agent_start',
              payload: null,
              created_at: Date.now(),
            },
          },
        })
      })

      expect(onActivity).not.toHaveBeenCalled()
    })
  })

  describe('callback handling', () => {
    it('uses latest callback reference (no stale closure)', async () => {
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
            enabled: true,
          }),
        { initialProps: { onActivity: onActivity1 } }
      )

      await act(async () => {
        await Promise.resolve()
      })

      // Update callback (no resubscription expected since taskId/enabled unchanged)
      rerender({ onActivity: onActivity2 })

      act(() => {
        capturedListener?.({
          payload: {
            task_id: 'task-123',
            activity: {
              id: 'act-1',
              task_id: 'task-123',
              event_type: 'agent_complete',
              payload: null,
              created_at: Date.now(),
            },
          },
        })
      })

      // Should use the new callback
      expect(callCount).toBe(2)
      expect(onActivity2).toHaveBeenCalled()
    })

    it('handles rapid events without issues', async () => {
      const onActivity = vi.fn()

      renderHook(() =>
        useActivitySubscription({
          taskId: 'task-123',
          onActivity,
          enabled: true,
        })
      )

      await act(async () => {
        await Promise.resolve()
      })

      act(() => {
        for (let i = 0; i < 10; i++) {
          capturedListener?.({
            payload: {
              task_id: 'task-123',
              activity: {
                id: `act-${i}`,
                task_id: 'task-123',
                event_type: 'tool_used',
                payload: JSON.stringify({ tool: `Tool${i}` }),
                created_at: Date.now() + i,
              },
            },
          })
        }
      })

      expect(onActivity).toHaveBeenCalledTimes(10)
    })
  })
})

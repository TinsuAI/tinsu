import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useGlobalActivitySubscription } from './useGlobalActivitySubscription'
import type { Activity } from '@shared/types/activity.types'

/* ── Mocks ─────────────────────────────────────────────────────── */

type ListenPayload = { task_id: string; activity: Activity }
type ListenCallback = (event: { payload: ListenPayload }) => void

const mockListeners = new Map<string, ListenCallback>()
const mockUnlisten = vi.fn()

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(
    (event: string, cb: ListenCallback) => {
      mockListeners.set(event, cb)
      return Promise.resolve(mockUnlisten)
    }
  ),
}))

const makeActivity = (id: string, task_id = 'any-task'): Activity => ({
  id,
  task_id,
  event_type: 'agent_start',
  payload: null,
  created_at: Date.now(),
})

/* ── Tests ──────────────────────────────────────────────────────── */

beforeEach(() => {
  vi.clearAllMocks()
  mockListeners.clear()
})

describe('useGlobalActivitySubscription', () => {
  it('calls onActivity for any task_id (no filtering)', async () => {
    const onActivity = vi.fn()

    renderHook(() =>
      useGlobalActivitySubscription({ onActivity, enabled: true })
    )

    // Wait for listen to be called
    await act(async () => {
      await Promise.resolve()
    })

    const listener = mockListeners.get('activity:created')
    expect(listener).toBeDefined()

    // Simulate activity for task-A
    act(() => {
      listener?.({ payload: { task_id: 'task-A', activity: makeActivity('act-1', 'task-A') } })
    })

    // Simulate activity for task-B (different task)
    act(() => {
      listener?.({ payload: { task_id: 'task-B', activity: makeActivity('act-2', 'task-B') } })
    })

    // Both should be received (no filtering by task_id)
    expect(onActivity).toHaveBeenCalledTimes(2)
    expect(onActivity).toHaveBeenCalledWith(expect.objectContaining({ id: 'act-1' }))
    expect(onActivity).toHaveBeenCalledWith(expect.objectContaining({ id: 'act-2' }))
  })

  it('does NOT subscribe when enabled=false', async () => {
    const onActivity = vi.fn()

    renderHook(() =>
      useGlobalActivitySubscription({ onActivity, enabled: false })
    )

    await act(async () => {
      await Promise.resolve()
    })

    expect(mockListeners.get('activity:created')).toBeUndefined()
    expect(onActivity).not.toHaveBeenCalled()
  })

  it('cleans up listener on unmount', async () => {
    const onActivity = vi.fn()

    const { unmount } = renderHook(() =>
      useGlobalActivitySubscription({ onActivity, enabled: true })
    )

    await act(async () => {
      await Promise.resolve()
    })

    unmount()

    // unlisten should have been called
    expect(mockUnlisten).toHaveBeenCalled()
  })

  it('uses latest onActivity callback via ref (no stale closure)', async () => {
    const onActivity1 = vi.fn()
    const onActivity2 = vi.fn()

    const { rerender } = renderHook(
      ({ cb }) => useGlobalActivitySubscription({ onActivity: cb, enabled: true }),
      { initialProps: { cb: onActivity1 } }
    )

    await act(async () => {
      await Promise.resolve()
    })

    // Update the callback
    rerender({ cb: onActivity2 })

    const listener = mockListeners.get('activity:created')
    act(() => {
      listener?.({ payload: { task_id: 'task-X', activity: makeActivity('act-X') } })
    })

    // Only the latest callback should have been called
    expect(onActivity1).not.toHaveBeenCalled()
    expect(onActivity2).toHaveBeenCalledWith(expect.objectContaining({ id: 'act-X' }))
  })
})

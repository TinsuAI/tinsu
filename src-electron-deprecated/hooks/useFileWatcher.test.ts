import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFileWatcher } from './useFileWatcher'

// Mock useStorySync
const mockShowSyncNotification = vi.fn()
vi.mock('./useStorySync', () => ({
  useStorySync: () => ({
    showSyncNotification: mockShowSyncNotification
  })
}))

// Mock tRPC
const mockStartWatching = vi.fn()
const mockStopWatching = vi.fn()
vi.mock('@renderer/lib/trpc', () => ({
  trpc: {
    sync: {
      startWatching: {
        useMutation: () => ({ mutate: mockStartWatching })
      },
      stopWatching: {
        useMutation: () => ({ mutate: mockStopWatching })
      }
    }
  }
}))

// Mock window.api
const mockUnsubscribe = vi.fn()
const mockOnFileChange = vi.fn().mockReturnValue(mockUnsubscribe)

beforeEach(() => {
  ;(window as { api?: typeof window.api }).api = {
    onFileChange: mockOnFileChange
  } as unknown as typeof window.api
  vi.clearAllMocks()
})

afterEach(() => {
  // @ts-expect-error - cleaning up mock
  delete window.api
})

describe('useFileWatcher', () => {
  it('starts watching when projectPath is provided', () => {
    renderHook(() => useFileWatcher('/path/to/project'))

    expect(mockStartWatching).toHaveBeenCalledWith({ projectPath: '/path/to/project' })
  })

  it('subscribes to file change events when watching', () => {
    renderHook(() => useFileWatcher('/path/to/project'))

    expect(mockOnFileChange).toHaveBeenCalled()
  })

  it('shows sync notification when file change event received', () => {
    renderHook(() => useFileWatcher('/path/to/project'))

    // Get the callback passed to onFileChange
    const fileChangeCallback = mockOnFileChange.mock.calls[0][0]

    // Simulate a file change event
    act(() => {
      fileChangeCallback({
        taskId: 'task-123',
        taskTitle: 'My Story Task',
        filePath: '/path/to/story.md'
      })
    })

    expect(mockShowSyncNotification).toHaveBeenCalledWith('task-123', 'My Story Task')
  })

  it('does not start watching when projectPath is null', () => {
    renderHook(() => useFileWatcher(null))

    expect(mockStartWatching).not.toHaveBeenCalled()
    // Should stop any existing watcher
    expect(mockStopWatching).toHaveBeenCalled()
  })

  it('stops watching on unmount', () => {
    const { unmount } = renderHook(() => useFileWatcher('/path/to/project'))

    unmount()

    expect(mockStopWatching).toHaveBeenCalled()
    expect(mockUnsubscribe).toHaveBeenCalled()
  })

  it('restarts watching when projectPath changes', () => {
    const { rerender } = renderHook(({ path }) => useFileWatcher(path), {
      initialProps: { path: '/project1' as string | null }
    })

    expect(mockStartWatching).toHaveBeenCalledWith({ projectPath: '/project1' })

    // Change project
    rerender({ path: '/project2' })

    // Should stop old watcher and start new one
    expect(mockStopWatching).toHaveBeenCalled()
    expect(mockUnsubscribe).toHaveBeenCalled()
    expect(mockStartWatching).toHaveBeenCalledWith({ projectPath: '/project2' })
  })

  it('cleans up when switching to null project', () => {
    const { rerender } = renderHook(({ path }) => useFileWatcher(path), {
      initialProps: { path: '/project1' as string | null }
    })

    // Change to no project
    rerender({ path: null })

    expect(mockStopWatching).toHaveBeenCalled()
    expect(mockUnsubscribe).toHaveBeenCalled()
  })
})

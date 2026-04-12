import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { toast } from 'sonner'
import { showFileSyncNotification, useFileSyncNotification } from './FileSyncNotification'

// Mock toast
vi.mock('sonner', () => ({
  toast: vi.fn()
}))

// Mock useStorySync
const mockSyncFromFile = vi.fn()
vi.mock('@renderer/hooks/useStorySync', () => ({
  useStorySync: () => ({
    syncFromFile: mockSyncFromFile
  })
}))

describe('FileSyncNotification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('showFileSyncNotification', () => {
    it('shows toast with task title', () => {
      showFileSyncNotification({
        taskId: 'task-1',
        taskTitle: 'My Story Task',
        onSync: vi.fn()
      })

      expect(toast).toHaveBeenCalledWith(
        'Story file changed',
        expect.objectContaining({
          description: '"My Story Task" was modified externally',
          action: expect.objectContaining({
            label: 'Sync Now'
          }),
          duration: 30000
        })
      )
    })

    it('shows toast with file path when provided', () => {
      showFileSyncNotification({
        taskId: 'task-1',
        taskTitle: 'My Story',
        filePath: '/path/to/story.md',
        onSync: vi.fn()
      })

      expect(toast).toHaveBeenCalledWith(
        'Story file changed',
        expect.objectContaining({
          description: '"My Story" (/path/to/story.md) was modified externally'
        })
      )
    })

    it('calls onSync when action clicked', () => {
      const onSync = vi.fn()
      showFileSyncNotification({
        taskId: 'task-1',
        taskTitle: 'My Story',
        onSync
      })

      // Get the action onClick from the toast call
      const toastCall = (toast as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
      const options = toastCall[1]
      options.action.onClick()

      expect(onSync).toHaveBeenCalled()
    })
  })

  describe('useFileSyncNotification', () => {
    it('provides showSyncNotification function', () => {
      const { result } = renderHook(() => useFileSyncNotification())

      expect(result.current.showSyncNotification).toBeDefined()
      expect(typeof result.current.showSyncNotification).toBe('function')
    })

    it('shows toast when showSyncNotification is called', () => {
      const { result } = renderHook(() => useFileSyncNotification())

      act(() => {
        result.current.showSyncNotification({
          taskId: 'task-123',
          taskTitle: 'Test Story'
        })
      })

      expect(toast).toHaveBeenCalledWith(
        'Story file changed',
        expect.objectContaining({
          description: '"Test Story" was modified externally'
        })
      )
    })

    it('calls syncFromFile when action is clicked', () => {
      const { result } = renderHook(() => useFileSyncNotification())

      act(() => {
        result.current.showSyncNotification({
          taskId: 'task-456',
          taskTitle: 'Another Story'
        })
      })

      // Get the action onClick from the toast call
      const toastCall = (toast as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
      const options = toastCall[1]

      act(() => {
        options.action.onClick()
      })

      expect(mockSyncFromFile).toHaveBeenCalledWith('task-456')
    })
  })
})

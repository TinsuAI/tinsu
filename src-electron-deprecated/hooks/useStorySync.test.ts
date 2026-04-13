import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useStorySync } from './useStorySync'
import { toast } from 'sonner'

// Mock toast
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn()
  })
}))

// Mock tRPC with all required mutations
const mockSyncStatusMutateAsync = vi.fn()
const mockSyncFromFileMutateAsync = vi.fn()
const mockCheckFileChangesMutateAsync = vi.fn()
const mockDetectConflictMutateAsync = vi.fn()
const mockResolveConflictMutateAsync = vi.fn()
const mockSyncAllFromFilesMutateAsync = vi.fn()
const mockInvalidate = vi.fn()

vi.mock('@renderer/lib/trpc', () => ({
  trpc: {
    useUtils: () => ({
      tasks: {
        getById: { invalidate: mockInvalidate },
        getAll: { invalidate: mockInvalidate },
        getAllWithEpics: { invalidate: mockInvalidate }
      }
    }),
    sync: {
      syncStatusToFile: {
        useMutation: (options?: { onSuccess?: () => void; onError?: (error: Error) => void }) => ({
          mutateAsync: mockSyncStatusMutateAsync,
          isPending: false,
          onSuccess: options?.onSuccess,
          onError: options?.onError
        })
      },
      syncFromFile: {
        useMutation: (options?: {
          onSuccess?: (result: { synced: boolean }) => void
          onError?: (error: Error) => void
        }) => ({
          mutateAsync: mockSyncFromFileMutateAsync,
          isPending: false,
          onSuccess: options?.onSuccess,
          onError: options?.onError
        })
      },
      checkFileChanges: {
        useMutation: () => ({
          mutateAsync: mockCheckFileChangesMutateAsync,
          isPending: false
        })
      },
      detectConflict: {
        useMutation: () => ({
          mutateAsync: mockDetectConflictMutateAsync,
          isPending: false
        })
      },
      resolveConflict: {
        useMutation: (options?: {
          onSuccess?: (result: { resolved: boolean }) => void
          onError?: (error: Error) => void
        }) => ({
          mutateAsync: mockResolveConflictMutateAsync,
          isPending: false,
          onSuccess: options?.onSuccess,
          onError: options?.onError
        })
      },
      syncAllFromFiles: {
        useMutation: (options?: {
          onSuccess?: (result: { syncedCount: number; failedCount: number; importedCount?: number }) => void
          onError?: (error: Error) => void
        }) => ({
          mutateAsync: mockSyncAllFromFilesMutateAsync,
          isPending: false,
          onSuccess: options?.onSuccess,
          onError: options?.onError
        })
      }
    }
  }
}))

describe('useStorySync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSyncStatusMutateAsync.mockResolvedValue({ synced: true })
    mockSyncFromFileMutateAsync.mockResolvedValue({ synced: true, task: { id: 'task-1' } })
    mockCheckFileChangesMutateAsync.mockResolvedValue({ hasChanges: false })
    mockDetectConflictMutateAsync.mockResolvedValue({ hasConflict: false })
    mockResolveConflictMutateAsync.mockResolvedValue({ resolved: true })
    mockSyncAllFromFilesMutateAsync.mockResolvedValue({ syncedCount: 0, failedCount: 0 })
  })

  describe('syncStatusToFile', () => {
    it('should call mutation with taskId and newStatus', async () => {
      const { result } = renderHook(() => useStorySync())

      await act(async () => {
        await result.current.syncStatusToFile('task-123', 'in-progress')
      })

      expect(mockSyncStatusMutateAsync).toHaveBeenCalledWith({
        taskId: 'task-123',
        newStatus: 'in-progress'
      })
    })

    it('should return sync result', async () => {
      const { result } = renderHook(() => useStorySync())
      let syncResult: { synced: boolean }

      await act(async () => {
        syncResult = await result.current.syncStatusToFile('task-123', 'done')
      })

      expect(syncResult!.synced).toBe(true)
    })
  })

  describe('syncFromFile', () => {
    it('should call mutation with taskId', async () => {
      const { result } = renderHook(() => useStorySync())

      await act(async () => {
        await result.current.syncFromFile('task-456')
      })

      expect(mockSyncFromFileMutateAsync).toHaveBeenCalledWith({ taskId: 'task-456' })
    })

    it('should return task data on success', async () => {
      mockSyncFromFileMutateAsync.mockResolvedValue({
        synced: true,
        task: { id: 'task-456', status: 'in_progress' }
      })
      const { result } = renderHook(() => useStorySync())
      let syncResult: { synced: boolean; task?: { id: string } }

      await act(async () => {
        syncResult = await result.current.syncFromFile('task-456')
      })

      expect(syncResult!.synced).toBe(true)
      expect(syncResult!.task?.id).toBe('task-456')
    })
  })

  describe('checkChanges', () => {
    it('should return true when file has changes', async () => {
      mockCheckFileChangesMutateAsync.mockResolvedValue({ hasChanges: true })
      const { result } = renderHook(() => useStorySync())
      let hasChanges: boolean

      await act(async () => {
        hasChanges = await result.current.checkChanges('task-789')
      })

      expect(hasChanges!).toBe(true)
    })

    it('should return false when file has no changes', async () => {
      mockCheckFileChangesMutateAsync.mockResolvedValue({ hasChanges: false })
      const { result } = renderHook(() => useStorySync())
      let hasChanges: boolean

      await act(async () => {
        hasChanges = await result.current.checkChanges('task-789')
      })

      expect(hasChanges!).toBe(false)
    })

    it('should return false on error', async () => {
      mockCheckFileChangesMutateAsync.mockRejectedValue(new Error('Network error'))
      const { result } = renderHook(() => useStorySync())
      let hasChanges: boolean

      await act(async () => {
        hasChanges = await result.current.checkChanges('task-789')
      })

      expect(hasChanges!).toBe(false)
    })
  })

  describe('detectConflict', () => {
    it('should return conflict info when conflict exists', async () => {
      mockDetectConflictMutateAsync.mockResolvedValue({
        hasConflict: true,
        hasStatusConflict: true,
        hasContentConflict: false,
        kanbanStatus: 'in_progress',
        fileStatus: 'done'
      })
      const { result } = renderHook(() => useStorySync())
      let conflictInfo: { hasConflict: boolean; hasStatusConflict?: boolean }

      await act(async () => {
        conflictInfo = await result.current.detectConflict('task-conflict')
      })

      expect(conflictInfo!.hasConflict).toBe(true)
      expect(conflictInfo!.hasStatusConflict).toBe(true)
    })

    it('should return no conflict when everything matches', async () => {
      mockDetectConflictMutateAsync.mockResolvedValue({ hasConflict: false })
      const { result } = renderHook(() => useStorySync())
      let conflictInfo: { hasConflict: boolean }

      await act(async () => {
        conflictInfo = await result.current.detectConflict('task-no-conflict')
      })

      expect(conflictInfo!.hasConflict).toBe(false)
    })
  })

  describe('resolveConflict', () => {
    it('should call mutation with keepKanban=true', async () => {
      const { result } = renderHook(() => useStorySync())

      await act(async () => {
        await result.current.resolveConflict('task-resolve', true)
      })

      expect(mockResolveConflictMutateAsync).toHaveBeenCalledWith({
        taskId: 'task-resolve',
        keepKanban: true
      })
    })

    it('should call mutation with keepKanban=false', async () => {
      const { result } = renderHook(() => useStorySync())

      await act(async () => {
        await result.current.resolveConflict('task-resolve', false)
      })

      expect(mockResolveConflictMutateAsync).toHaveBeenCalledWith({
        taskId: 'task-resolve',
        keepKanban: false
      })
    })
  })

  describe('isTaskSyncing', () => {
    it('should track syncing state during sync operations', async () => {
      // Create a promise that we can control
      let resolveSync: (value: { synced: boolean }) => void
      mockSyncFromFileMutateAsync.mockReturnValue(
        new Promise((resolve) => {
          resolveSync = resolve
        })
      )

      const { result } = renderHook(() => useStorySync())

      // Before sync
      expect(result.current.isTaskSyncing('task-sync')).toBe(false)

      // Start sync
      let syncPromise: Promise<void>
      act(() => {
        syncPromise = result.current.syncFromFile('task-sync') as unknown as Promise<void>
      })

      // During sync
      expect(result.current.isTaskSyncing('task-sync')).toBe(true)

      // Complete sync
      await act(async () => {
        resolveSync!({ synced: true })
        await syncPromise
      })

      // After sync
      expect(result.current.isTaskSyncing('task-sync')).toBe(false)
    })

    it('should not affect other task syncing state', async () => {
      const { result } = renderHook(() => useStorySync())

      await act(async () => {
        await result.current.syncFromFile('task-a')
      })

      expect(result.current.isTaskSyncing('task-a')).toBe(false)
      expect(result.current.isTaskSyncing('task-b')).toBe(false)
    })
  })

  describe('showSyncNotification', () => {
    it('should show toast with task title and action', () => {
      const { result } = renderHook(() => useStorySync())

      act(() => {
        result.current.showSyncNotification('task-notify', 'My Story Task')
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
  })
})

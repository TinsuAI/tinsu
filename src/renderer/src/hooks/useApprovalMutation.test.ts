import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useApprovalMutation } from './useApprovalMutation'
import { toast } from 'sonner'

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn()
  }
}))

// Mock tRPC
const mockMutate = vi.fn()
const mockInvalidateGetById = vi.fn()
const mockInvalidateGetAllWithEpics = vi.fn()
const mockInvalidateGetAll = vi.fn()
let mockOnSuccess: (() => void) | undefined
let mockOnError: ((error: { data?: { code?: string }; message: string }) => void) | undefined

vi.mock('@renderer/lib/trpc', () => ({
  trpc: {
    useUtils: () => ({
      tasks: {
        getById: { invalidate: mockInvalidateGetById },
        getAllWithEpics: { invalidate: mockInvalidateGetAllWithEpics },
        getAll: { invalidate: mockInvalidateGetAll }
      }
    }),
    tasks: {
      updateStatus: {
        useMutation: (options?: {
          onSuccess?: () => void
          onError?: (error: { data?: { code?: string }; message: string }) => void
        }) => {
          mockOnSuccess = options?.onSuccess
          mockOnError = options?.onError
          return {
            mutate: mockMutate,
            isPending: false,
            isSuccess: false,
            isError: false,
            error: null
          }
        }
      }
    }
  }
}))

describe('useApprovalMutation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockOnSuccess = undefined
    mockOnError = undefined
  })

  describe('approve function', () => {
    it('should call updateStatus mutation with taskId and done status', () => {
      const { result } = renderHook(() =>
        useApprovalMutation({ taskId: 'task-123', storyNumber: 7 })
      )

      act(() => {
        result.current.approve()
      })

      expect(mockMutate).toHaveBeenCalledWith({
        id: 'task-123',
        status: 'done'
      })
    })

    it('should pass correct taskId on subsequent calls', () => {
      const { result } = renderHook(() =>
        useApprovalMutation({ taskId: 'task-456', storyNumber: 3 })
      )

      act(() => {
        result.current.approve()
      })

      expect(mockMutate).toHaveBeenCalledWith({
        id: 'task-456',
        status: 'done'
      })
    })
  })

  describe('onSuccess handler', () => {
    it('should show success toast with story number on successful merge', () => {
      renderHook(() =>
        useApprovalMutation({ taskId: 'task-123', storyNumber: 7 })
      )

      act(() => {
        mockOnSuccess?.()
      })

      expect(toast.success).toHaveBeenCalledWith('Story 7 approved and merged', {
        description: 'Code merged to main'
      })
    })

    it('should show success toast with "Task" when no story number', () => {
      renderHook(() =>
        useApprovalMutation({ taskId: 'task-123', storyNumber: null })
      )

      act(() => {
        mockOnSuccess?.()
      })

      expect(toast.success).toHaveBeenCalledWith('Task approved and merged', {
        description: 'Code merged to main'
      })
    })

    it('should invalidate task queries on success', () => {
      renderHook(() =>
        useApprovalMutation({ taskId: 'task-123', storyNumber: 7 })
      )

      act(() => {
        mockOnSuccess?.()
      })

      expect(mockInvalidateGetById).toHaveBeenCalledWith({ id: 'task-123' })
      expect(mockInvalidateGetAllWithEpics).toHaveBeenCalled()
      expect(mockInvalidateGetAll).toHaveBeenCalled()
    })

    it('should call onSuccess callback when provided', () => {
      const onSuccessCallback = vi.fn()
      renderHook(() =>
        useApprovalMutation({
          taskId: 'task-123',
          storyNumber: 7,
          onSuccess: onSuccessCallback
        })
      )

      act(() => {
        mockOnSuccess?.()
      })

      expect(onSuccessCallback).toHaveBeenCalled()
    })
  })

  describe('onError handler - merge conflict (PRECONDITION_FAILED)', () => {
    it('should show warning toast on merge conflict', () => {
      renderHook(() =>
        useApprovalMutation({ taskId: 'task-123', storyNumber: 7 })
      )

      act(() => {
        mockOnError?.({
          data: { code: 'PRECONDITION_FAILED' },
          message: 'Cannot complete task: merge conflict in src/main.ts, src/utils.ts'
        })
      })

      expect(toast.warning).toHaveBeenCalledWith('Merge conflict detected', {
        description: 'Cannot complete task: merge conflict in src/main.ts, src/utils.ts',
        duration: 6000
      })
    })

    it('should call onConflict callback on merge conflict', () => {
      const onConflictCallback = vi.fn()
      renderHook(() =>
        useApprovalMutation({
          taskId: 'task-123',
          storyNumber: 7,
          onConflict: onConflictCallback
        })
      )

      act(() => {
        mockOnError?.({
          data: { code: 'PRECONDITION_FAILED' },
          message: 'Merge conflict in file.ts'
        })
      })

      expect(onConflictCallback).toHaveBeenCalledWith('Merge conflict in file.ts')
    })

    it('should not call onError callback on merge conflict (uses onConflict instead)', () => {
      const onErrorCallback = vi.fn()
      const onConflictCallback = vi.fn()
      renderHook(() =>
        useApprovalMutation({
          taskId: 'task-123',
          storyNumber: 7,
          onError: onErrorCallback,
          onConflict: onConflictCallback
        })
      )

      act(() => {
        mockOnError?.({
          data: { code: 'PRECONDITION_FAILED' },
          message: 'Merge conflict detected'
        })
      })

      expect(onConflictCallback).toHaveBeenCalled()
      expect(onErrorCallback).not.toHaveBeenCalled()
    })
  })

  describe('onError handler - generic errors', () => {
    it('should show error toast on generic failure', () => {
      renderHook(() =>
        useApprovalMutation({ taskId: 'task-123', storyNumber: 7 })
      )

      act(() => {
        mockOnError?.({
          message: 'Internal server error'
        })
      })

      expect(toast.error).toHaveBeenCalledWith('Approval failed', {
        description: 'Internal server error'
      })
    })

    it('should call onError callback on generic failure', () => {
      const onErrorCallback = vi.fn()
      renderHook(() =>
        useApprovalMutation({
          taskId: 'task-123',
          storyNumber: 7,
          onError: onErrorCallback
        })
      )

      act(() => {
        mockOnError?.({
          message: 'Network error'
        })
      })

      expect(onErrorCallback).toHaveBeenCalledWith(expect.any(Error))
      expect(onErrorCallback).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Network error' })
      )
    })

    it('should handle error without data.code as generic error', () => {
      renderHook(() =>
        useApprovalMutation({ taskId: 'task-123', storyNumber: 7 })
      )

      act(() => {
        mockOnError?.({
          data: undefined,
          message: 'Unknown error'
        })
      })

      expect(toast.error).toHaveBeenCalledWith('Approval failed', {
        description: 'Unknown error'
      })
      expect(toast.warning).not.toHaveBeenCalled()
    })

    it('should handle error with non-PRECONDITION_FAILED code as generic error', () => {
      renderHook(() =>
        useApprovalMutation({ taskId: 'task-123', storyNumber: 7 })
      )

      act(() => {
        mockOnError?.({
          data: { code: 'INTERNAL_SERVER_ERROR' },
          message: 'Server crashed'
        })
      })

      expect(toast.error).toHaveBeenCalledWith('Approval failed', {
        description: 'Server crashed'
      })
      expect(toast.warning).not.toHaveBeenCalled()
    })
  })

  describe('returned state', () => {
    it('should return isPending from mutation', () => {
      const { result } = renderHook(() =>
        useApprovalMutation({ taskId: 'task-123', storyNumber: 7 })
      )

      expect(result.current.isPending).toBe(false)
    })

    it('should return isSuccess from mutation', () => {
      const { result } = renderHook(() =>
        useApprovalMutation({ taskId: 'task-123', storyNumber: 7 })
      )

      expect(result.current.isSuccess).toBe(false)
    })

    it('should return isError from mutation', () => {
      const { result } = renderHook(() =>
        useApprovalMutation({ taskId: 'task-123', storyNumber: 7 })
      )

      expect(result.current.isError).toBe(false)
    })

    it('should return error from mutation', () => {
      const { result } = renderHook(() =>
        useApprovalMutation({ taskId: 'task-123', storyNumber: 7 })
      )

      expect(result.current.error).toBe(null)
    })
  })
})

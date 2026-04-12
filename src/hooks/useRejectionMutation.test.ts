import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRejectionMutation } from './useRejectionMutation'
import { toast } from 'sonner'

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
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
      rejectWithFeedback: {
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

describe('useRejectionMutation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockOnSuccess = undefined
    mockOnError = undefined
  })

  describe('reject function', () => {
    it('should call rejectWithFeedback mutation with taskId and feedback', () => {
      const { result } = renderHook(() =>
        useRejectionMutation({ taskId: 'task-123', storyNumber: '7.4' })
      )

      act(() => {
        result.current.reject('Please fix the validation logic')
      })

      expect(mockMutate).toHaveBeenCalledWith({
        id: 'task-123',
        feedback: 'Please fix the validation logic'
      })
    })

    it('should call rejectWithFeedback with null feedback when empty', () => {
      const { result } = renderHook(() =>
        useRejectionMutation({ taskId: 'task-456', storyNumber: '3.2' })
      )

      act(() => {
        result.current.reject(null)
      })

      expect(mockMutate).toHaveBeenCalledWith({
        id: 'task-456',
        feedback: null
      })
    })

    it('should pass correct taskId on subsequent calls', () => {
      const { result } = renderHook(() =>
        useRejectionMutation({ taskId: 'task-789', storyNumber: '5.1' })
      )

      act(() => {
        result.current.reject('Different feedback')
      })

      expect(mockMutate).toHaveBeenCalledWith({
        id: 'task-789',
        feedback: 'Different feedback'
      })
    })
  })

  describe('onSuccess handler', () => {
    it('should show success toast with story number on successful rejection', () => {
      renderHook(() =>
        useRejectionMutation({ taskId: 'task-123', storyNumber: '7.4' })
      )

      act(() => {
        mockOnSuccess?.()
      })

      expect(toast.success).toHaveBeenCalledWith('Story 7.4 rejected, returning to In Progress', {
        description: 'Feedback saved for next attempt'
      })
    })

    it('should show success toast with "Task" when no story number', () => {
      renderHook(() =>
        useRejectionMutation({ taskId: 'task-123', storyNumber: null })
      )

      act(() => {
        mockOnSuccess?.()
      })

      expect(toast.success).toHaveBeenCalledWith('Task rejected, returning to In Progress', {
        description: 'Feedback saved for next attempt'
      })
    })

    it('should invalidate task queries on success', () => {
      renderHook(() =>
        useRejectionMutation({ taskId: 'task-123', storyNumber: '7.4' })
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
        useRejectionMutation({
          taskId: 'task-123',
          storyNumber: '7.4',
          onSuccess: onSuccessCallback
        })
      )

      act(() => {
        mockOnSuccess?.()
      })

      expect(onSuccessCallback).toHaveBeenCalled()
    })
  })

  describe('onError handler', () => {
    it('should show error toast on failure', () => {
      renderHook(() =>
        useRejectionMutation({ taskId: 'task-123', storyNumber: '7.4' })
      )

      act(() => {
        mockOnError?.({
          message: 'Internal server error'
        })
      })

      expect(toast.error).toHaveBeenCalledWith('Rejection failed', {
        description: 'Internal server error'
      })
    })

    it('should call onError callback on failure', () => {
      const onErrorCallback = vi.fn()
      renderHook(() =>
        useRejectionMutation({
          taskId: 'task-123',
          storyNumber: '7.4',
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

    it('should handle error without data as generic error', () => {
      renderHook(() =>
        useRejectionMutation({ taskId: 'task-123', storyNumber: '7.4' })
      )

      act(() => {
        mockOnError?.({
          data: undefined,
          message: 'Unknown error'
        })
      })

      expect(toast.error).toHaveBeenCalledWith('Rejection failed', {
        description: 'Unknown error'
      })
    })
  })

  describe('returned state', () => {
    it('should return isPending from mutation', () => {
      const { result } = renderHook(() =>
        useRejectionMutation({ taskId: 'task-123', storyNumber: '7.4' })
      )

      expect(result.current.isPending).toBe(false)
    })

    it('should return isSuccess from mutation', () => {
      const { result } = renderHook(() =>
        useRejectionMutation({ taskId: 'task-123', storyNumber: '7.4' })
      )

      expect(result.current.isSuccess).toBe(false)
    })

    it('should return isError from mutation', () => {
      const { result } = renderHook(() =>
        useRejectionMutation({ taskId: 'task-123', storyNumber: '7.4' })
      )

      expect(result.current.isError).toBe(false)
    })

    it('should return error from mutation', () => {
      const { result } = renderHook(() =>
        useRejectionMutation({ taskId: 'task-123', storyNumber: '7.4' })
      )

      expect(result.current.error).toBe(null)
    })
  })
})

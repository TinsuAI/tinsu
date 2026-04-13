import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useRejectionMutation } from './useRejectionMutation'
import { toast } from 'sonner'
import React from 'react'

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn()
  }
}))

// Mock commands
const mockRejectTask = vi.fn()

vi.mock('@renderer/lib/rspc', () => ({
  commands: {
    rejectTask: (...args: unknown[]) => mockRejectTask(...args)
  }
}))

describe('useRejectionMutation', () => {
  let queryClient: QueryClient

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } }
    })
  })

  describe('reject function', () => {
    it('should call commands.rejectTask with taskId and feedback', async () => {
      mockRejectTask.mockResolvedValue({ status: 'ok', data: null })

      const { result } = renderHook(
        () => useRejectionMutation({ taskId: 'task-123', storyNumber: '7.4' }),
        { wrapper }
      )

      await act(async () => {
        result.current.reject('Please fix the validation logic')
      })

      await waitFor(() =>
        expect(mockRejectTask).toHaveBeenCalledWith('task-123', 'Please fix the validation logic')
      )
    })

    it('should call rejectTask with empty string when feedback is null', async () => {
      mockRejectTask.mockResolvedValue({ status: 'ok', data: null })

      const { result } = renderHook(
        () => useRejectionMutation({ taskId: 'task-456', storyNumber: '3.2' }),
        { wrapper }
      )

      await act(async () => {
        result.current.reject(null)
      })

      await waitFor(() =>
        expect(mockRejectTask).toHaveBeenCalledWith('task-456', '')
      )
    })

    it('should pass correct taskId for different tasks', async () => {
      mockRejectTask.mockResolvedValue({ status: 'ok', data: null })

      const { result } = renderHook(
        () => useRejectionMutation({ taskId: 'task-789', storyNumber: '5.1' }),
        { wrapper }
      )

      await act(async () => {
        result.current.reject('Different feedback')
      })

      await waitFor(() =>
        expect(mockRejectTask).toHaveBeenCalledWith('task-789', 'Different feedback')
      )
    })
  })

  describe('onSuccess handler', () => {
    it('should show success toast with story number on successful rejection', async () => {
      mockRejectTask.mockResolvedValue({ status: 'ok', data: null })

      const { result } = renderHook(
        () => useRejectionMutation({ taskId: 'task-123', storyNumber: '7.4' }),
        { wrapper }
      )

      await act(async () => {
        result.current.reject('feedback')
      })

      await waitFor(() =>
        expect(toast.success).toHaveBeenCalledWith('Story 7.4 rejected, returning to In Progress', {
          description: 'Feedback saved for next attempt'
        })
      )
    })

    it('should show success toast with "Task" when no story number', async () => {
      mockRejectTask.mockResolvedValue({ status: 'ok', data: null })

      const { result } = renderHook(
        () => useRejectionMutation({ taskId: 'task-123', storyNumber: null }),
        { wrapper }
      )

      await act(async () => {
        result.current.reject('feedback')
      })

      await waitFor(() =>
        expect(toast.success).toHaveBeenCalledWith('Task rejected, returning to In Progress', {
          description: 'Feedback saved for next attempt'
        })
      )
    })

    it('should call onSuccess callback when provided', async () => {
      mockRejectTask.mockResolvedValue({ status: 'ok', data: null })
      const onSuccessCallback = vi.fn()

      const { result } = renderHook(
        () =>
          useRejectionMutation({
            taskId: 'task-123',
            storyNumber: '7.4',
            onSuccess: onSuccessCallback
          }),
        { wrapper }
      )

      await act(async () => {
        result.current.reject('feedback')
      })

      await waitFor(() => expect(onSuccessCallback).toHaveBeenCalled())
    })
  })

  describe('onError handler', () => {
    it('should show error toast on generic failure', async () => {
      mockRejectTask.mockResolvedValue({
        status: 'error',
        error: { Internal: 'Internal server error' }
      })

      const { result } = renderHook(
        () => useRejectionMutation({ taskId: 'task-123', storyNumber: '7.4' }),
        { wrapper }
      )

      await act(async () => {
        result.current.reject('feedback')
      })

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith('Rejection failed', expect.any(Object))
      )
    })

    it('should call onError callback on failure', async () => {
      mockRejectTask.mockResolvedValue({
        status: 'error',
        error: { Internal: 'Network error' }
      })
      const onErrorCallback = vi.fn()

      const { result } = renderHook(
        () =>
          useRejectionMutation({
            taskId: 'task-123',
            storyNumber: '7.4',
            onError: onErrorCallback
          }),
        { wrapper }
      )

      await act(async () => {
        result.current.reject('feedback')
      })

      await waitFor(() => expect(onErrorCallback).toHaveBeenCalledWith(expect.any(Error)))
    })
  })

  describe('returned state', () => {
    it('should return isPending from mutation', () => {
      const { result } = renderHook(
        () => useRejectionMutation({ taskId: 'task-123', storyNumber: '7.4' }),
        { wrapper }
      )
      expect(result.current.isPending).toBe(false)
    })

    it('should return isSuccess from mutation', () => {
      const { result } = renderHook(
        () => useRejectionMutation({ taskId: 'task-123', storyNumber: '7.4' }),
        { wrapper }
      )
      expect(result.current.isSuccess).toBe(false)
    })

    it('should return isError from mutation', () => {
      const { result } = renderHook(
        () => useRejectionMutation({ taskId: 'task-123', storyNumber: '7.4' }),
        { wrapper }
      )
      expect(result.current.isError).toBe(false)
    })

    it('should return error from mutation', () => {
      const { result } = renderHook(
        () => useRejectionMutation({ taskId: 'task-123', storyNumber: '7.4' }),
        { wrapper }
      )
      expect(result.current.error).toBe(null)
    })
  })
})

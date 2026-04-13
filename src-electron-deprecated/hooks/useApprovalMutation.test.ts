import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useApprovalMutation } from './useApprovalMutation'
import { toast } from 'sonner'
import React from 'react'

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn()
  }
}))

// Mock commands
const mockApproveTask = vi.fn()

vi.mock('@renderer/lib/rspc', () => ({
  commands: {
    approveTask: (...args: unknown[]) => mockApproveTask(...args)
  }
}))

describe('useApprovalMutation', () => {
  let queryClient: QueryClient

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } }
    })
  })

  describe('approve function', () => {
    it('should call commands.approveTask with taskId', async () => {
      mockApproveTask.mockResolvedValue({ status: 'ok', data: null })

      const { result } = renderHook(
        () => useApprovalMutation({ taskId: 'task-123', storyNumber: 7 }),
        { wrapper }
      )

      await act(async () => {
        result.current.approve()
      })

      await waitFor(() => expect(mockApproveTask).toHaveBeenCalledWith('task-123'))
    })

    it('should pass correct taskId for different tasks', async () => {
      mockApproveTask.mockResolvedValue({ status: 'ok', data: null })

      const { result } = renderHook(
        () => useApprovalMutation({ taskId: 'task-456', storyNumber: 3 }),
        { wrapper }
      )

      await act(async () => {
        result.current.approve()
      })

      await waitFor(() => expect(mockApproveTask).toHaveBeenCalledWith('task-456'))
    })
  })

  describe('onSuccess handler', () => {
    it('should show success toast with story number on successful merge', async () => {
      mockApproveTask.mockResolvedValue({ status: 'ok', data: null })

      const { result } = renderHook(
        () => useApprovalMutation({ taskId: 'task-123', storyNumber: 7 }),
        { wrapper }
      )

      await act(async () => {
        result.current.approve()
      })

      await waitFor(() =>
        expect(toast.success).toHaveBeenCalledWith('Story 7 approved and merged', {
          description: 'Code merged to main'
        })
      )
    })

    it('should show success toast with "Task" when no story number', async () => {
      mockApproveTask.mockResolvedValue({ status: 'ok', data: null })

      const { result } = renderHook(
        () => useApprovalMutation({ taskId: 'task-123', storyNumber: null }),
        { wrapper }
      )

      await act(async () => {
        result.current.approve()
      })

      await waitFor(() =>
        expect(toast.success).toHaveBeenCalledWith('Task approved and merged', {
          description: 'Code merged to main'
        })
      )
    })

    it('should call onSuccess callback when provided', async () => {
      mockApproveTask.mockResolvedValue({ status: 'ok', data: null })
      const onSuccessCallback = vi.fn()

      const { result } = renderHook(
        () =>
          useApprovalMutation({
            taskId: 'task-123',
            storyNumber: 7,
            onSuccess: onSuccessCallback
          }),
        { wrapper }
      )

      await act(async () => {
        result.current.approve()
      })

      await waitFor(() => expect(onSuccessCallback).toHaveBeenCalled())
    })
  })

  describe('onError handler - merge conflict (GitConflict)', () => {
    it('should show warning toast on merge conflict', async () => {
      mockApproveTask.mockResolvedValue({
        status: 'error',
        error: { GitConflict: 'Merge conflict in src/main.ts, src/utils.ts' }
      })

      const { result } = renderHook(
        () => useApprovalMutation({ taskId: 'task-123', storyNumber: 7 }),
        { wrapper }
      )

      await act(async () => {
        result.current.approve()
      })

      await waitFor(() =>
        expect(toast.warning).toHaveBeenCalledWith(
          'Merge conflict detected',
          expect.objectContaining({ duration: 6000 })
        )
      )
    })

    it('should call onConflict callback on merge conflict', async () => {
      mockApproveTask.mockResolvedValue({
        status: 'error',
        error: { GitConflict: 'Merge conflict in file.ts' }
      })
      const onConflictCallback = vi.fn()

      const { result } = renderHook(
        () =>
          useApprovalMutation({
            taskId: 'task-123',
            storyNumber: 7,
            onConflict: onConflictCallback
          }),
        { wrapper }
      )

      await act(async () => {
        result.current.approve()
      })

      await waitFor(() => expect(onConflictCallback).toHaveBeenCalled())
    })

    it('should not call onError callback on merge conflict', async () => {
      mockApproveTask.mockResolvedValue({
        status: 'error',
        error: { GitConflict: 'Conflict detected' }
      })
      const onErrorCallback = vi.fn()
      const onConflictCallback = vi.fn()

      const { result } = renderHook(
        () =>
          useApprovalMutation({
            taskId: 'task-123',
            storyNumber: 7,
            onError: onErrorCallback,
            onConflict: onConflictCallback
          }),
        { wrapper }
      )

      await act(async () => {
        result.current.approve()
      })

      await waitFor(() => expect(onConflictCallback).toHaveBeenCalled())
      expect(onErrorCallback).not.toHaveBeenCalled()
    })
  })

  describe('onError handler - generic errors', () => {
    it('should show error toast on generic failure', async () => {
      mockApproveTask.mockResolvedValue({
        status: 'error',
        error: { Internal: 'Internal server error' }
      })

      const { result } = renderHook(
        () => useApprovalMutation({ taskId: 'task-123', storyNumber: 7 }),
        { wrapper }
      )

      await act(async () => {
        result.current.approve()
      })

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith('Approval failed', expect.any(Object))
      )
    })

    it('should call onError callback on generic failure', async () => {
      mockApproveTask.mockResolvedValue({
        status: 'error',
        error: { Internal: 'Network error' }
      })
      const onErrorCallback = vi.fn()

      const { result } = renderHook(
        () =>
          useApprovalMutation({
            taskId: 'task-123',
            storyNumber: 7,
            onError: onErrorCallback
          }),
        { wrapper }
      )

      await act(async () => {
        result.current.approve()
      })

      await waitFor(() => expect(onErrorCallback).toHaveBeenCalledWith(expect.any(Error)))
    })
  })

  describe('returned state', () => {
    it('should return isPending from mutation', () => {
      const { result } = renderHook(
        () => useApprovalMutation({ taskId: 'task-123', storyNumber: 7 }),
        { wrapper }
      )
      expect(result.current.isPending).toBe(false)
    })

    it('should return isSuccess from mutation', () => {
      const { result } = renderHook(
        () => useApprovalMutation({ taskId: 'task-123', storyNumber: 7 }),
        { wrapper }
      )
      expect(result.current.isSuccess).toBe(false)
    })

    it('should return isError from mutation', () => {
      const { result } = renderHook(
        () => useApprovalMutation({ taskId: 'task-123', storyNumber: 7 }),
        { wrapper }
      )
      expect(result.current.isError).toBe(false)
    })

    it('should return error from mutation', () => {
      const { result } = renderHook(
        () => useApprovalMutation({ taskId: 'task-123', storyNumber: 7 }),
        { wrapper }
      )
      expect(result.current.error).toBe(null)
    })
  })
})

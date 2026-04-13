/**
 * useDiff Hook Tests - T1.8
 *
 * Tests for the useDiff React hook after migration from tRPC to Tauri commands.
 *
 * @see T1.8: Migrate Git Service to Rust
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useDiff } from './useDiff'
import React from 'react'

// Mock commands
const mockGetTaskDiff = vi.fn()

vi.mock('@renderer/lib/rspc', () => ({
  commands: {
    getTaskDiff: (...args: unknown[]) => mockGetTaskDiff(...args)
  }
}))

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn()
  }
}))

describe('useDiff', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false
        }
      }
    })
  })

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  describe('worktree mode', () => {
    it('should return null diff when taskId is null (query disabled)', () => {
      const { result } = renderHook(
        () =>
          useDiff({
            taskId: null,
            mode: 'worktree',
            worktreePath: '/path/to/worktree'
          }),
        { wrapper }
      )

      expect(result.current.diff).toBeNull()
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()
      expect(result.current.hasChanges).toBe(false)
    })

    it('should return loading state when fetching', async () => {
      mockGetTaskDiff.mockResolvedValue({ status: 'ok', data: null })

      const { result } = renderHook(
        () =>
          useDiff({
            taskId: 'task-123',
            mode: 'worktree',
            worktreePath: '/path/to/worktree'
          }),
        { wrapper }
      )

      // Initially loading
      expect(result.current.isLoading).toBe(true)
    })

    it('should return diff data when fetched successfully', async () => {
      const mockDiff = {
        files: [
          {
            path: 'src/index.ts',
            status: 'modified',
            additions: 5,
            deletions: 2,
            hunks: [],
            oldPath: null,
            isBinary: null
          }
        ],
        summary: {
          filesChanged: 1,
          linesAdded: 5,
          linesRemoved: 2
        }
      }

      mockGetTaskDiff.mockResolvedValue({ status: 'ok', data: mockDiff })

      const { result } = renderHook(
        () =>
          useDiff({
            taskId: 'task-123',
            mode: 'worktree',
            worktreePath: '/path/to/worktree'
          }),
        { wrapper }
      )

      await waitFor(() => expect(result.current.isLoading).toBe(false))

      expect(result.current.diff).toEqual(mockDiff)
      expect(result.current.hasChanges).toBe(true)
      expect(result.current.summary).toEqual(mockDiff.summary)
    })

    it('should return empty state when no changes', async () => {
      const emptyDiff = {
        files: [],
        summary: {
          filesChanged: 0,
          linesAdded: 0,
          linesRemoved: 0
        }
      }

      mockGetTaskDiff.mockResolvedValue({ status: 'ok', data: emptyDiff })

      const { result } = renderHook(
        () =>
          useDiff({
            taskId: 'task-456',
            mode: 'worktree',
            worktreePath: '/path/to/worktree'
          }),
        { wrapper }
      )

      await waitFor(() => expect(result.current.isLoading).toBe(false))

      expect(result.current.diff).toEqual(emptyDiff)
      expect(result.current.hasChanges).toBe(false)
    })

    it('should return error state when fetch fails', async () => {
      mockGetTaskDiff.mockResolvedValue({
        status: 'error',
        error: { NotFound: 'Task not found' }
      })

      const { result } = renderHook(
        () =>
          useDiff({
            taskId: 'task-789',
            mode: 'worktree',
            worktreePath: '/path/to/worktree'
          }),
        { wrapper }
      )

      await waitFor(() => expect(result.current.error).not.toBeNull())

      expect(result.current.diff).toBeNull()
    })

    it('should call commands.getTaskDiff with taskId', async () => {
      mockGetTaskDiff.mockResolvedValue({
        status: 'ok',
        data: { files: [], summary: { filesChanged: 0, linesAdded: 0, linesRemoved: 0 } }
      })

      renderHook(
        () =>
          useDiff({
            taskId: 'task-xyz',
            mode: 'worktree',
            worktreePath: '/path/to/worktree'
          }),
        { wrapper }
      )

      await waitFor(() => expect(mockGetTaskDiff).toHaveBeenCalledWith('task-xyz'))
    })
  })

  describe('historical mode (deferred to T1.10)', () => {
    it('should return null diff when in historical mode (query disabled)', () => {
      const { result } = renderHook(
        () =>
          useDiff({
            taskId: 'task-123',
            mode: 'historical',
            mergeCommitSha: 'abc123'
          }),
        { wrapper }
      )

      // Historical mode not enabled (deferred to T1.10)
      expect(result.current.diff).toBeNull()
      expect(result.current.isLoading).toBe(false)
    })
  })

  describe('baseline diff (Story 7.6 - deferred)', () => {
    it('should indicate baseline diff mode when baselineCommit is provided', () => {
      mockGetTaskDiff.mockResolvedValue({
        status: 'ok',
        data: { files: [], summary: { filesChanged: 0, linesAdded: 0, linesRemoved: 0 } }
      })

      const { result } = renderHook(
        () =>
          useDiff({
            taskId: 'task-review',
            mode: 'worktree',
            worktreePath: '/path/to/worktree',
            baselineCommit: 'baseline123'
          }),
        { wrapper }
      )

      expect(result.current.isBaselineDiff).toBe(true)
    })

    it('should not be baseline diff when no baselineCommit', () => {
      mockGetTaskDiff.mockResolvedValue({
        status: 'ok',
        data: { files: [], summary: { filesChanged: 0, linesAdded: 0, linesRemoved: 0 } }
      })

      const { result } = renderHook(
        () =>
          useDiff({
            taskId: 'task-review',
            mode: 'worktree',
            worktreePath: '/path/to/worktree'
          }),
        { wrapper }
      )

      expect(result.current.isBaselineDiff).toBe(false)
    })
  })

  describe('version comparison (Story 7.7 - deferred)', () => {
    it('should indicate version comparison mode when versionComparison is provided', () => {
      const { result } = renderHook(
        () =>
          useDiff({
            taskId: 'task-compare',
            mode: 'version',
            versionComparison: {
              taskId: 'task-compare',
              fromCommitSha: 'abc123',
              toCommitSha: 'def456',
              fromVersionNumber: 1,
              toVersionNumber: 2
            }
          }),
        { wrapper }
      )

      expect(result.current.isVersionComparison).toBe(true)
      expect(result.current.versionComparisonInfo).toEqual({
        fromVersionNumber: 1,
        toVersionNumber: 2
      })
    })

    it('should not be version comparison in worktree mode', () => {
      mockGetTaskDiff.mockResolvedValue({
        status: 'ok',
        data: { files: [], summary: { filesChanged: 0, linesAdded: 0, linesRemoved: 0 } }
      })

      const { result } = renderHook(
        () =>
          useDiff({
            taskId: 'task-active',
            mode: 'worktree',
            worktreePath: '/path/to/worktree'
          }),
        { wrapper }
      )

      expect(result.current.isVersionComparison).toBe(false)
      expect(result.current.versionComparisonInfo).toBeNull()
    })
  })

  describe('refresh', () => {
    it('should provide refresh function', () => {
      mockGetTaskDiff.mockResolvedValue({
        status: 'ok',
        data: { files: [], summary: { filesChanged: 0, linesAdded: 0, linesRemoved: 0 } }
      })

      const { result } = renderHook(
        () =>
          useDiff({
            taskId: 'task-abc',
            mode: 'worktree',
            worktreePath: '/path/to/worktree'
          }),
        { wrapper }
      )

      expect(typeof result.current.refresh).toBe('function')
    })
  })
})

/**
 * useDiff Hook Tests - TES-4.1, Story 8.11, Story 7.6, Story 7.7
 *
 * Tests for the useDiff React hook.
 *
 * @see TES-4.1: Git Diff Data Fetching
 * @see Story 8.11: Historical Diff View for Completed Tasks
 * @see Story 7.6: Agent Re-execution with Feedback Context
 * @see Story 7.7: Review History & Comparison
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { trpc } from '@renderer/lib/trpc'
import { useDiff } from './useDiff'
import React from 'react'

// Mock trpc with all the queries used by useDiff
vi.mock('@renderer/lib/trpc', () => ({
  trpc: {
    git: {
      getTaskDiff: {
        useQuery: vi.fn()
      },
      getTaskDiffWithBaseline: {
        useQuery: vi.fn()
      },
      getVersionDiff: {
        useQuery: vi.fn()
      }
    }
  }
}))

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn()
  }
}))

const mockGetTaskDiff = trpc.git.getTaskDiff.useQuery as ReturnType<typeof vi.fn>
const mockGetTaskDiffWithBaseline = trpc.git.getTaskDiffWithBaseline.useQuery as ReturnType<typeof vi.fn>
const mockGetVersionDiff = trpc.git.getVersionDiff.useQuery as ReturnType<typeof vi.fn>

// Default mock return value for disabled queries
const disabledQueryReturn = {
  data: undefined,
  isLoading: false,
  error: null,
  refetch: vi.fn(),
  isFetching: false
}

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

    // Default to disabled query return for all mocks
    mockGetTaskDiff.mockReturnValue(disabledQueryReturn)
    mockGetTaskDiffWithBaseline.mockReturnValue(disabledQueryReturn)
    mockGetVersionDiff.mockReturnValue(disabledQueryReturn)
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

    it('should return null diff when worktreePath is null (query disabled)', () => {
      const { result } = renderHook(
        () =>
          useDiff({
            taskId: 'task-123',
            mode: 'worktree',
            worktreePath: null
          }),
        { wrapper }
      )

      expect(result.current.diff).toBeNull()
    })

    it('should return loading state when fetching', () => {
      mockGetTaskDiff.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
        refetch: vi.fn(),
        isFetching: true
      })

      const { result } = renderHook(
        () =>
          useDiff({
            taskId: 'task-123',
            mode: 'worktree',
            worktreePath: '/path/to/worktree'
          }),
        { wrapper }
      )

      expect(result.current.isLoading).toBe(true)
      expect(result.current.diff).toBeNull()
    })

    it('should return diff data when fetched successfully', () => {
      const mockDiff = {
        files: [
          {
            path: 'src/index.ts',
            status: 'modified',
            additions: 5,
            deletions: 2,
            hunks: []
          }
        ],
        summary: {
          filesChanged: 1,
          linesAdded: 5,
          linesRemoved: 2
        }
      }

      mockGetTaskDiff.mockReturnValue({
        data: mockDiff,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
        isFetching: false
      })

      const { result } = renderHook(
        () =>
          useDiff({
            taskId: 'task-123',
            mode: 'worktree',
            worktreePath: '/path/to/worktree'
          }),
        { wrapper }
      )

      expect(result.current.diff).toEqual(mockDiff)
      expect(result.current.hasChanges).toBe(true)
      expect(result.current.summary).toEqual(mockDiff.summary)
    })

    it('should return empty state when no changes', () => {
      const emptyDiff = {
        files: [],
        summary: {
          filesChanged: 0,
          linesAdded: 0,
          linesRemoved: 0
        }
      }

      mockGetTaskDiff.mockReturnValue({
        data: emptyDiff,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
        isFetching: false
      })

      const { result } = renderHook(
        () =>
          useDiff({
            taskId: 'task-456',
            mode: 'worktree',
            worktreePath: '/path/to/worktree'
          }),
        { wrapper }
      )

      expect(result.current.diff).toEqual(emptyDiff)
      expect(result.current.hasChanges).toBe(false)
    })

    it('should return error state when fetch fails', () => {
      mockGetTaskDiff.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: { message: 'Failed to fetch diff' },
        refetch: vi.fn(),
        isFetching: false
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

      expect(result.current.error).toBe('Failed to fetch diff')
      expect(result.current.diff).toBeNull()
    })
  })

  describe('historical mode (Story 8.11)', () => {
    it('should return null diff when mergeCommitSha is null (query disabled)', () => {
      const { result } = renderHook(
        () =>
          useDiff({
            taskId: 'task-123',
            mode: 'historical',
            mergeCommitSha: null
          }),
        { wrapper }
      )

      expect(result.current.diff).toBeNull()
    })

    it('should fetch diff using mergeCommitSha in historical mode', () => {
      const mockDiff = {
        files: [{ path: 'file.ts', status: 'added', additions: 10, deletions: 0, hunks: [] }],
        summary: { filesChanged: 1, linesAdded: 10, linesRemoved: 0 }
      }

      mockGetTaskDiff.mockReturnValue({
        data: mockDiff,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
        isFetching: false
      })

      const { result } = renderHook(
        () =>
          useDiff({
            taskId: 'task-done',
            mode: 'historical',
            mergeCommitSha: 'abc123def456'
          }),
        { wrapper }
      )

      expect(result.current.diff).toEqual(mockDiff)
      expect(mockGetTaskDiff).toHaveBeenCalledWith(
        { mergeCommitSha: 'abc123def456' },
        expect.any(Object)
      )
    })
  })

  describe('baseline diff (Story 7.6)', () => {
    it('should indicate baseline diff mode when baselineCommit is provided', () => {
      mockGetTaskDiffWithBaseline.mockReturnValue({
        data: { files: [], summary: { filesChanged: 0, linesAdded: 0, linesRemoved: 0 } },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
        isFetching: false
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
      mockGetTaskDiff.mockReturnValue({
        data: { files: [], summary: { filesChanged: 0, linesAdded: 0, linesRemoved: 0 } },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
        isFetching: false
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

  describe('version comparison (Story 7.7)', () => {
    it('should indicate version comparison mode when versionComparison is provided', () => {
      mockGetVersionDiff.mockReturnValue({
        data: { files: [], summary: { filesChanged: 0, linesAdded: 0, linesRemoved: 0 } },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
        isFetching: false
      })

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
      mockGetTaskDiff.mockReturnValue({
        data: { files: [], summary: { filesChanged: 0, linesAdded: 0, linesRemoved: 0 } },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
        isFetching: false
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

    it('should fetch version diff using getVersionDiff query', () => {
      const mockDiff = {
        files: [{ path: 'changed.ts', status: 'modified', additions: 3, deletions: 1, hunks: [] }],
        summary: { filesChanged: 1, linesAdded: 3, linesRemoved: 1 }
      }

      mockGetVersionDiff.mockReturnValue({
        data: mockDiff,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
        isFetching: false
      })

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

      expect(result.current.diff).toEqual(mockDiff)
      expect(mockGetVersionDiff).toHaveBeenCalledWith(
        {
          taskId: 'task-compare',
          fromCommitSha: 'abc123',
          toCommitSha: 'def456'
        },
        expect.any(Object)
      )
    })
  })

  describe('refresh', () => {
    it('should provide refresh function', () => {
      const mockRefetch = vi.fn().mockResolvedValue({})

      mockGetTaskDiff.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
        refetch: mockRefetch,
        isFetching: false
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

    it('should indicate refreshing state', () => {
      mockGetTaskDiff.mockReturnValue({
        data: { files: [], summary: { filesChanged: 0, linesAdded: 0, linesRemoved: 0 } },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
        isFetching: true // Refetching after initial load
      })

      const { result } = renderHook(
        () =>
          useDiff({
            taskId: 'task-def',
            mode: 'worktree',
            worktreePath: '/path/to/worktree'
          }),
        { wrapper }
      )

      expect(result.current.isLoading).toBe(false)
      expect(result.current.isRefreshing).toBe(true)
    })
  })
})

/**
 * useDiff Hook Tests - TES-4.1
 *
 * Tests for the useDiff React hook.
 *
 * @see TES-4.1: Git Diff Data Fetching
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { trpc } from '@renderer/lib/trpc'
import { useDiff } from './useDiff'
import React from 'react'

// Mock trpc
vi.mock('@renderer/lib/trpc', () => ({
  trpc: {
    git: {
      getDiff: {
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

const mockUseQuery = trpc.git.getDiff.useQuery as ReturnType<typeof vi.fn>

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

  it('should return null diff when taskId is null (query disabled)', () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      isFetching: false
    })

    const { result } = renderHook(() => useDiff(null), { wrapper })

    // Query should be disabled when taskId is null
    expect(mockUseQuery).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({
        enabled: false
      })
    )
    expect(result.current.diff).toBeNull()
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.hasChanges).toBe(false)
  })

  it('should return loading state when fetching', () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
      isFetching: true
    })

    const { result } = renderHook(() => useDiff('task-123'), { wrapper })

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

    mockUseQuery.mockReturnValue({
      data: mockDiff,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      isFetching: false
    })

    const { result } = renderHook(() => useDiff('task-123'), { wrapper })

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

    mockUseQuery.mockReturnValue({
      data: emptyDiff,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      isFetching: false
    })

    const { result } = renderHook(() => useDiff('task-456'), { wrapper })

    expect(result.current.diff).toEqual(emptyDiff)
    expect(result.current.hasChanges).toBe(false)
  })

  it('should return error state when fetch fails', () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { message: 'Failed to fetch diff' },
      refetch: vi.fn(),
      isFetching: false
    })

    const { result } = renderHook(() => useDiff('task-789'), { wrapper })

    expect(result.current.error).toBe('Failed to fetch diff')
    expect(result.current.diff).toBeNull()
  })

  it('should provide refresh function', () => {
    const mockRefetch = vi.fn().mockResolvedValue({})

    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
      refetch: mockRefetch,
      isFetching: false
    })

    const { result } = renderHook(() => useDiff('task-abc'), { wrapper })

    expect(typeof result.current.refresh).toBe('function')
  })

  it('should indicate refreshing state', () => {
    mockUseQuery.mockReturnValue({
      data: { files: [], summary: { filesChanged: 0, linesAdded: 0, linesRemoved: 0 } },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      isFetching: true // Refetching after initial load
    })

    const { result } = renderHook(() => useDiff('task-def'), { wrapper })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.isRefreshing).toBe(true)
  })
})

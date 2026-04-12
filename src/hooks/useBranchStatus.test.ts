/**
 * useBranchStatus Hook Tests - T1.8
 *
 * Tests for the useBranchStatus hook after migration from tRPC to Tauri commands.
 *
 * @see T1.8: Migrate Git Service to Rust
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useBranchStatus } from './useBranchStatus'
import React from 'react'
import type { Task } from '@shared/types/task.types'

// Mock commands
const mockGetBranchStatus = vi.fn()

vi.mock('@renderer/lib/rspc', () => ({
  commands: {
    getBranchStatus: (...args: unknown[]) => mockGetBranchStatus(...args)
  }
}))

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Test Task',
    description: null,
    status: 'in_progress',
    sort_order: 0,
    epic_id: null,
    sprint_id: null,
    task_type: 'basic',
    phase_number: null,
    phase_name: null,
    bmad_agent: null,
    bmad_workflow: null,
    is_start_here: null,
    artifact_path: null,
    story_number: null,
    story_file_path: null,
    full_content: null,
    story_file_status: null,
    context_notes: null,
    project_id: 'proj-1',
    worktree_path: '/path/to/worktree',
    branch_name: 'tinsu/story-task-1-test-task',
    merge_commit_sha: null,
    has_merge_conflict: 0,
    conflict_files: null,
    worktree_skipped: 0,
    rejection_feedback: null,
    rejected_agent_run_id: null,
    inline_comments: null,
    rejection_count: 0,
    last_review_commit: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides
  } as Task
}

describe('useBranchStatus', () => {
  let queryClient: QueryClient

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    React.createElement(QueryClientProvider, { client: queryClient }, children)
  )

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false }
      }
    })
  })

  it('should return empty map when no tasks have branches', () => {
    const tasks = [makeTask({ branch_name: null })]

    const { result } = renderHook(() => useBranchStatus(tasks), { wrapper })

    expect(result.current.branchStatuses).toEqual({})
    expect(result.current.isLoading).toBe(false)
  })

  it('should return empty map when tasks are already merged', () => {
    const tasks = [makeTask({ merge_commit_sha: 'abc123' })]

    const { result } = renderHook(() => useBranchStatus(tasks), { wrapper })

    expect(result.current.branchStatuses).toEqual({})
  })

  it('should fetch branch status for tasks with branches', async () => {
    const mockStatus = {
      commitsAhead: 3,
      commitsBehind: 0,
      hasUncommittedChanges: false
    }
    mockGetBranchStatus.mockResolvedValue({ status: 'ok', data: mockStatus })

    const tasks = [makeTask({ id: 'task-1', branch_name: 'tinsu/story-task-1-test' })]

    const { result } = renderHook(() => useBranchStatus(tasks), { wrapper })

    await waitFor(() =>
      expect(result.current.branchStatuses['task-1']).toBeDefined()
    )

    expect(result.current.branchStatuses['task-1']).toEqual({
      commitsAhead: 3,
      commitsBehind: 0,
      hasUncommittedChanges: false
    })
    expect(mockGetBranchStatus).toHaveBeenCalledWith('task-1')
  })

  it('should fetch parallel status for multiple tasks', async () => {
    mockGetBranchStatus.mockImplementation((taskId: string) =>
      Promise.resolve({
        status: 'ok',
        data: {
          commitsAhead: taskId === 'task-a' ? 1 : 2,
          commitsBehind: 0,
          hasUncommittedChanges: false
        }
      })
    )

    const tasks = [
      makeTask({ id: 'task-a', branch_name: 'tinsu/story-a' }),
      makeTask({ id: 'task-b', branch_name: 'tinsu/story-b' })
    ]

    const { result } = renderHook(() => useBranchStatus(tasks), { wrapper })

    await waitFor(() => {
      expect(result.current.branchStatuses['task-a']).toBeDefined()
      expect(result.current.branchStatuses['task-b']).toBeDefined()
    })

    expect(result.current.branchStatuses['task-a'].commitsAhead).toBe(1)
    expect(result.current.branchStatuses['task-b'].commitsAhead).toBe(2)
  })

  it('should return empty status map on error', async () => {
    mockGetBranchStatus.mockResolvedValue({
      status: 'error',
      error: { NotFound: 'Task not found' }
    })

    const tasks = [makeTask()]

    const { result } = renderHook(() => useBranchStatus(tasks), { wrapper })

    await waitFor(() => !result.current.isLoading)

    expect(result.current.branchStatuses).toEqual({})
  })

  it('should not fetch when disabled', () => {
    const tasks = [makeTask()]

    renderHook(() => useBranchStatus(tasks, { enabled: false }), { wrapper })

    expect(mockGetBranchStatus).not.toHaveBeenCalled()
  })

  it('should provide a refetch function', () => {
    const tasks = [makeTask()]
    mockGetBranchStatus.mockResolvedValue({ status: 'ok', data: { commitsAhead: 0, commitsBehind: 0, hasUncommittedChanges: false } })

    const { result } = renderHook(() => useBranchStatus(tasks), { wrapper })

    expect(typeof result.current.refetch).toBe('function')
  })
})

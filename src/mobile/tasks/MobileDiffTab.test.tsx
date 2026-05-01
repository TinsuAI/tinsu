import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MobileDiffTab } from './MobileDiffTab'
import type { Task } from '@shared/types/task.types'

// Mock MobileDiffViewer — cross-tree component (AC 16, AC 9)
vi.mock('@renderer/components/review/MobileDiffViewer', () => ({
  MobileDiffViewer: ({ taskId }: { taskId: string }) => (
    <div data-testid="mobile-diff-viewer-mock" data-task-id={taskId} />
  ),
}))

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-abc123',
    title: 'Test Task',
    description: null,
    status: 'backlog',
    sort_order: 0,
    epic_id: null,
    sprint_id: null,
    task_type: 'story',
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
    worktree_path: null,
    branch_name: null,
    merge_commit_sha: null,
    has_merge_conflict: null,
    conflict_files: null,
    rejection_feedback: null,
    rejected_agent_run_id: null,
    inline_comments: null,
    rejection_count: null,
    last_review_commit: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  }
}

describe('MobileDiffTab', () => {
  it('renders loading skeleton when task is null', () => {
    render(<MobileDiffTab task={null} />)
    expect(screen.getByTestId('mobile-loading-skeleton-card')).toBeInTheDocument()
  })

  it('renders empty state for backlog task with no worktree', () => {
    const task = makeTask({ status: 'backlog', worktree_path: null })
    render(<MobileDiffTab task={task} />)
    expect(screen.getByText('No changes yet')).toBeInTheDocument()
    expect(screen.getByText(/Diffs appear once/)).toBeInTheDocument()
  })

  it('renders empty state for in_progress task with no worktree', () => {
    const task = makeTask({ status: 'in_progress', worktree_path: null })
    render(<MobileDiffTab task={task} />)
    expect(screen.getByText('No changes yet')).toBeInTheDocument()
  })

  it('renders MobileDiffViewer for review status', () => {
    const task = makeTask({ status: 'review' })
    render(<MobileDiffTab task={task} />)
    const viewer = screen.getByTestId('mobile-diff-viewer-mock')
    expect(viewer).toBeInTheDocument()
    expect(viewer).toHaveAttribute('data-task-id', 'task-abc123')
  })

  it('renders MobileDiffViewer for done status', () => {
    const task = makeTask({ status: 'done' })
    render(<MobileDiffTab task={task} />)
    expect(screen.getByTestId('mobile-diff-viewer-mock')).toBeInTheDocument()
  })

  it('renders MobileDiffViewer when task has worktree_path even if backlog', () => {
    const task = makeTask({ status: 'backlog', worktree_path: '/path/to/worktree' })
    render(<MobileDiffTab task={task} />)
    expect(screen.getByTestId('mobile-diff-viewer-mock')).toBeInTheDocument()
  })

  it('does NOT render MobileDiffViewer for backlog with no worktree', () => {
    const task = makeTask({ status: 'backlog', worktree_path: null })
    render(<MobileDiffTab task={task} />)
    expect(screen.queryByTestId('mobile-diff-viewer-mock')).not.toBeInTheDocument()
  })

  it('wraps MobileDiffViewer in mobile-diff-tab testid', () => {
    const task = makeTask({ status: 'review' })
    render(<MobileDiffTab task={task} />)
    expect(screen.getByTestId('mobile-diff-tab')).toBeInTheDocument()
  })
})

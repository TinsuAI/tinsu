import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MobileContentTab } from './MobileContentTab'
import type { Task } from '@shared/types/task.types'

// Mock markdown dependencies to avoid complex bundling in tests
vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => (
    <div data-testid="react-markdown">{children}</div>
  ),
}))

vi.mock('remark-gfm', () => ({ default: () => {} }))

vi.mock('@renderer/components/task/MarkdownComponents', () => ({
  markdownComponents: {},
}))

vi.mock('@renderer/components/ui/badge', () => ({
  Badge: ({ children, variant }: { children: React.ReactNode; variant?: string }) => (
    <span data-testid="badge" data-variant={variant}>{children}</span>
  ),
}))

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-abc123',
    title: 'Test Task Title',
    description: 'Task **description** content',
    status: 'in_progress',
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

describe('MobileContentTab', () => {
  it('renders loading skeleton when task is null', () => {
    render(<MobileContentTab task={null} />)
    // MobileLoadingSkeleton with variant="card" renders data-testid="mobile-loading-skeleton-card"
    const skeletons = screen.getAllByTestId('mobile-loading-skeleton-card')
    expect(skeletons.length).toBeGreaterThanOrEqual(1)
  })

  it('renders task title as h2', () => {
    const task = makeTask({ title: 'My Story Task' })
    render(<MobileContentTab task={task} />)
    const h2 = screen.getByRole('heading', { level: 2 })
    expect(h2).toHaveTextContent('My Story Task')
  })

  it('renders status badge with correct status label', () => {
    const task = makeTask({ status: 'in_progress' })
    render(<MobileContentTab task={task} />)
    const badge = screen.getByTestId('mobile-content-tab-status')
    expect(badge).toHaveTextContent('In Progress')
  })

  it('renders status badge for "review" status', () => {
    const task = makeTask({ status: 'review' })
    render(<MobileContentTab task={task} />)
    expect(screen.getByTestId('mobile-content-tab-status')).toHaveTextContent('Review')
  })

  it('renders status badge for "backlog" status', () => {
    const task = makeTask({ status: 'backlog' })
    render(<MobileContentTab task={task} />)
    expect(screen.getByTestId('mobile-content-tab-status')).toHaveTextContent('Backlog')
  })

  it('renders markdown description when description is set', () => {
    const task = makeTask({ description: 'Task **description** content' })
    render(<MobileContentTab task={task} />)
    const desc = screen.getByTestId('mobile-content-tab-description')
    expect(desc).toBeInTheDocument()
  })

  it('shows "No description provided" when description is null', () => {
    const task = makeTask({ description: null })
    render(<MobileContentTab task={task} />)
    expect(screen.getByText('No description provided.')).toBeInTheDocument()
  })

  it('renders collapsible Story File when story_number and full_content are set', () => {
    const task = makeTask({
      story_number: '3.5',
      full_content: '# Story content here',
    })
    render(<MobileContentTab task={task} />)
    const storyFile = screen.getByTestId('mobile-content-tab-story-file')
    expect(storyFile).toBeInTheDocument()
    // Should have a summary element
    const summary = storyFile.querySelector('summary')
    expect(summary).toBeInTheDocument()
    expect(summary).toHaveTextContent('Story File')
  })

  it('does NOT render Story File section when story_number is null', () => {
    const task = makeTask({ story_number: null, full_content: '# content' })
    render(<MobileContentTab task={task} />)
    expect(screen.queryByTestId('mobile-content-tab-story-file')).not.toBeInTheDocument()
  })

  it('does NOT render Story File section when full_content is null', () => {
    const task = makeTask({ story_number: '3.5', full_content: null })
    render(<MobileContentTab task={task} />)
    expect(screen.queryByTestId('mobile-content-tab-story-file')).not.toBeInTheDocument()
  })

  it('falls back to Task #<id> when title is empty', () => {
    const task = makeTask({ title: '', id: 'abcdef123456' })
    render(<MobileContentTab task={task} />)
    const h2 = screen.getByRole('heading', { level: 2 })
    expect(h2.textContent).toMatch(/Task #abcde/)
  })

  it('wraps content in mobile-content-tab testid', () => {
    const task = makeTask()
    render(<MobileContentTab task={task} />)
    expect(screen.getByTestId('mobile-content-tab')).toBeInTheDocument()
  })
})

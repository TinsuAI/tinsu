import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StoryDetailDialog } from './StoryDetailDialog'
import type { StoryTask } from '@shared/types/task.types'
import { trpc } from '@renderer/lib/trpc'

// Mock the tRPC hook used for task session check
vi.mock('@renderer/lib/trpc', () => ({
  trpc: {
    agent: {
      getTaskSession: {
        useQuery: vi.fn().mockReturnValue({ data: null, isLoading: false })
      }
    }
  }
}))

// Mock TaskTerminal component
vi.mock('@renderer/components/task/TaskTerminal', () => ({
  TaskTerminal: vi.fn(({ taskId }: { taskId: string }) => (
    <div data-testid="task-terminal" data-task-id={taskId}>
      Mock TaskTerminal
    </div>
  ))
}))

// Mock story task data for testing
const mockStoryTask: StoryTask = {
  id: 'story-1',
  title: '1.1: Initialize Project',
  description:
    'As a developer,\nI want to initialize the project,\nSo that I can start development.\n\n## Acceptance Criteria\n\n**Given** nothing\n**When** I setup\n**Then** done',
  status: 'backlog',
  sort_order: 0,
  epic_id: 'epic-1',
  sprint_id: null,
  project_id: 'proj-1',
  task_type: 'story',
  story_number: 1,
  story_file_path: null,
  story_file_status: null,
  full_content: null,
  phase_number: null,
  phase_name: null,
  bmad_agent: null,
  bmad_workflow: null,
  is_start_here: null,
  artifact_path: null,
  created_at: new Date('2026-01-01'),
  updated_at: new Date('2026-01-01')
}

describe('StoryDetailDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: no session
    vi.mocked(trpc.agent.getTaskSession.useQuery).mockReturnValue({
      data: null,
      isLoading: false
    } as ReturnType<typeof trpc.agent.getTaskSession.useQuery>)
  })

  it('renders nothing when task is null', () => {
    const { container } = render(
      <StoryDetailDialog open={true} onOpenChange={vi.fn()} task={null} />
    )

    expect(container.textContent).toBe('')
  })

  it('renders story title in dialog header', () => {
    render(
      <StoryDetailDialog open={true} onOpenChange={vi.fn()} task={mockStoryTask} />
    )

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('1.1: Initialize Project')).toBeInTheDocument()
  })

  it('displays story number', () => {
    render(
      <StoryDetailDialog open={true} onOpenChange={vi.fn()} task={mockStoryTask} />
    )

    expect(screen.getByText('Story #1')).toBeInTheDocument()
  })

  it('displays epic badge when epicName is provided', () => {
    render(
      <StoryDetailDialog
        open={true}
        onOpenChange={vi.fn()}
        task={mockStoryTask}
        epicName="Foundation"
        epicColor="blue"
      />
    )

    expect(screen.getByTestId('epic-badge')).toBeInTheDocument()
    expect(screen.getByText('Foundation')).toBeInTheDocument()
  })

  it('does not display epic badge when epicName is not provided', () => {
    render(
      <StoryDetailDialog open={true} onOpenChange={vi.fn()} task={mockStoryTask} />
    )

    expect(screen.queryByTestId('epic-badge')).not.toBeInTheDocument()
  })

  it('displays full description with user story and acceptance criteria', () => {
    render(
      <StoryDetailDialog open={true} onOpenChange={vi.fn()} task={mockStoryTask} />
    )

    expect(screen.getByText(/As a developer/)).toBeInTheDocument()
    expect(screen.getByText(/Acceptance Criteria/)).toBeInTheDocument()
  })

  it('shows placeholder when description is empty', () => {
    const taskWithoutDescription = { ...mockStoryTask, description: null }
    render(
      <StoryDetailDialog open={true} onOpenChange={vi.fn()} task={taskWithoutDescription} />
    )

    expect(screen.getByText('No description available.')).toBeInTheDocument()
  })

  it('displays task status', () => {
    render(
      <StoryDetailDialog open={true} onOpenChange={vi.fn()} task={mockStoryTask} />
    )

    expect(screen.getByText('Status')).toBeInTheDocument()
    expect(screen.getByText('backlog')).toBeInTheDocument()
  })

  it('formats status with underscores replaced by spaces', () => {
    const taskInProgress = { ...mockStoryTask, status: 'in_progress' as const }
    render(
      <StoryDetailDialog open={true} onOpenChange={vi.fn()} task={taskInProgress} />
    )

    expect(screen.getByText('in progress')).toBeInTheDocument()
  })

  it('calls onOpenChange when dialog is closed', async () => {
    const onOpenChange = vi.fn()
    const user = userEvent.setup()

    render(
      <StoryDetailDialog open={true} onOpenChange={onOpenChange} task={mockStoryTask} />
    )

    // Click the close button (X)
    const closeButton = screen.getByRole('button', { name: /close/i })
    await user.click(closeButton)

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('does not render when open is false', () => {
    render(
      <StoryDetailDialog open={false} onOpenChange={vi.fn()} task={mockStoryTask} />
    )

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('StoryDetailDialog terminal tab (TES-1.4)', () => {
  const mockSessionData = {
    id: 'session-1',
    task_id: 'story-1',
    tmux_session: 'tinsu-test-story-1',
    session_id: null,
    current_phase: null,
    created_at: new Date()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not show tab buttons when no session exists', () => {
    vi.mocked(trpc.agent.getTaskSession.useQuery).mockReturnValue({
      data: null,
      isLoading: false
    } as ReturnType<typeof trpc.agent.getTaskSession.useQuery>)

    render(
      <StoryDetailDialog open={true} onOpenChange={vi.fn()} task={mockStoryTask} />
    )

    expect(screen.queryByRole('button', { name: /content/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /terminal/i })).not.toBeInTheDocument()
  })

  it('shows tab buttons when session exists', () => {
    vi.mocked(trpc.agent.getTaskSession.useQuery).mockReturnValue({
      data: mockSessionData,
      isLoading: false
    } as ReturnType<typeof trpc.agent.getTaskSession.useQuery>)

    render(
      <StoryDetailDialog open={true} onOpenChange={vi.fn()} task={mockStoryTask} />
    )

    expect(screen.getByRole('button', { name: /content/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /terminal/i })).toBeInTheDocument()
  })

  it('defaults to content tab when session exists', () => {
    vi.mocked(trpc.agent.getTaskSession.useQuery).mockReturnValue({
      data: mockSessionData,
      isLoading: false
    } as ReturnType<typeof trpc.agent.getTaskSession.useQuery>)

    render(
      <StoryDetailDialog open={true} onOpenChange={vi.fn()} task={mockStoryTask} />
    )

    // Content tab should be active (has different styling)
    const contentTab = screen.getByRole('button', { name: /content/i })
    expect(contentTab).toHaveClass('bg-zinc-700')

    // Content should be visible
    expect(screen.getByText(/As a developer/)).toBeInTheDocument()

    // Terminal should not be visible
    expect(screen.queryByTestId('task-terminal')).not.toBeInTheDocument()
  })

  it('switches to terminal tab when clicked', async () => {
    const user = userEvent.setup()

    vi.mocked(trpc.agent.getTaskSession.useQuery).mockReturnValue({
      data: mockSessionData,
      isLoading: false
    } as ReturnType<typeof trpc.agent.getTaskSession.useQuery>)

    render(
      <StoryDetailDialog open={true} onOpenChange={vi.fn()} task={mockStoryTask} />
    )

    // Click terminal tab
    await user.click(screen.getByRole('button', { name: /terminal/i }))

    // Terminal should now be visible
    expect(screen.getByTestId('task-terminal')).toBeInTheDocument()

    // Content should not be visible
    expect(screen.queryByText(/As a developer/)).not.toBeInTheDocument()
  })

  it('passes correct taskId to TaskTerminal', async () => {
    const user = userEvent.setup()

    vi.mocked(trpc.agent.getTaskSession.useQuery).mockReturnValue({
      data: mockSessionData,
      isLoading: false
    } as ReturnType<typeof trpc.agent.getTaskSession.useQuery>)

    render(
      <StoryDetailDialog open={true} onOpenChange={vi.fn()} task={mockStoryTask} />
    )

    // Switch to terminal tab
    await user.click(screen.getByRole('button', { name: /terminal/i }))

    // Verify TaskTerminal received correct taskId
    const terminal = screen.getByTestId('task-terminal')
    expect(terminal.getAttribute('data-task-id')).toBe(mockStoryTask.id)
  })

  it('switches back to content tab when clicked', async () => {
    const user = userEvent.setup()

    vi.mocked(trpc.agent.getTaskSession.useQuery).mockReturnValue({
      data: mockSessionData,
      isLoading: false
    } as ReturnType<typeof trpc.agent.getTaskSession.useQuery>)

    render(
      <StoryDetailDialog open={true} onOpenChange={vi.fn()} task={mockStoryTask} />
    )

    // Switch to terminal tab
    await user.click(screen.getByRole('button', { name: /terminal/i }))
    expect(screen.getByTestId('task-terminal')).toBeInTheDocument()

    // Switch back to content tab
    await user.click(screen.getByRole('button', { name: /content/i }))

    // Content should be visible again
    expect(screen.getByText(/As a developer/)).toBeInTheDocument()
    expect(screen.queryByTestId('task-terminal')).not.toBeInTheDocument()
  })

  it('queries session for any task status, not just in_progress', () => {
    const taskInReview = { ...mockStoryTask, status: 'review' as const }

    vi.mocked(trpc.agent.getTaskSession.useQuery).mockReturnValue({
      data: mockSessionData,
      isLoading: false
    } as ReturnType<typeof trpc.agent.getTaskSession.useQuery>)

    render(
      <StoryDetailDialog open={true} onOpenChange={vi.fn()} task={taskInReview} />
    )

    // Verify query was called (enabled)
    expect(trpc.agent.getTaskSession.useQuery).toHaveBeenCalledWith(
      { taskId: taskInReview.id },
      { enabled: true }
    )

    // Tab buttons should appear since session exists
    expect(screen.getByRole('button', { name: /terminal/i })).toBeInTheDocument()
  })
})

describe('StoryDetailDialog accessibility', () => {
  it('has proper dialog role', () => {
    render(
      <StoryDetailDialog open={true} onOpenChange={vi.fn()} task={mockStoryTask} />
    )

    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('has accessible title', () => {
    render(
      <StoryDetailDialog open={true} onOpenChange={vi.fn()} task={mockStoryTask} />
    )

    // The dialog title should be accessible
    expect(screen.getByRole('heading', { name: '1.1: Initialize Project' })).toBeInTheDocument()
  })
})

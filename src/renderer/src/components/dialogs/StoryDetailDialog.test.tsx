import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StoryDetailDialog } from './StoryDetailDialog'
import type { StoryTask } from '@shared/types/task.types'

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

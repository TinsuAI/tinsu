import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DevStoryConfirmDialog } from './DevStoryConfirmDialog'
import type { Task } from '@shared/types/task.types'

describe('DevStoryConfirmDialog', () => {
  const mockOnOpenChange = vi.fn()
  const mockOnConfirm = vi.fn()

  const mockTask: Task = {
    id: 'task-123',
    title: 'Implement user authentication',
    description: 'Add login and registration',
    status: 'in_progress',
    sort_order: 1,
    epic_id: 'epic-1',
    sprint_id: null,
    task_type: 'story',
    phase_number: null,
    phase_name: null,
    bmad_agent: null,
    bmad_workflow: null,
    is_start_here: null,
    artifact_path: null,
    story_number: 3,
    story_file_path: '/path/to/5-3-story.md',
    full_content: null,
    story_file_status: 'story_ready',
    project_id: 'project-1',
    created_at: new Date(),
    updated_at: new Date()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders dialog when open', () => {
    render(
      <DevStoryConfirmDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        task={mockTask}
        onConfirm={mockOnConfirm}
      />
    )

    expect(screen.getByRole('heading', { name: /Start Development/i })).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    render(
      <DevStoryConfirmDialog
        open={false}
        onOpenChange={mockOnOpenChange}
        task={mockTask}
        onConfirm={mockOnConfirm}
      />
    )

    expect(screen.queryByText('Start Development')).not.toBeInTheDocument()
  })

  it('displays task title in dialog', () => {
    render(
      <DevStoryConfirmDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        task={mockTask}
        onConfirm={mockOnConfirm}
      />
    )

    expect(screen.getByText(/Implement user authentication/i)).toBeInTheDocument()
  })

  it('explains the dev-story workflow steps', () => {
    render(
      <DevStoryConfirmDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        task={mockTask}
        onConfirm={mockOnConfirm}
      />
    )

    // Should explain what will happen
    expect(screen.getByText(/Spawn Claude Code with BMAD/i)).toBeInTheDocument()
    expect(screen.getByText(/Read story requirements/i)).toBeInTheDocument()
    expect(screen.getByText(/Implement tasks and subtasks/i)).toBeInTheDocument()
    expect(screen.getByText(/Update story status on completion/i)).toBeInTheDocument()
  })

  it('calls onOpenChange with false when Cancel is clicked', () => {
    render(
      <DevStoryConfirmDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        task={mockTask}
        onConfirm={mockOnConfirm}
      />
    )

    fireEvent.click(screen.getByTestId('cancel-dev-story'))
    expect(mockOnOpenChange).toHaveBeenCalledWith(false)
  })

  it('calls onConfirm when Start Dev Story is clicked', () => {
    render(
      <DevStoryConfirmDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        task={mockTask}
        onConfirm={mockOnConfirm}
      />
    )

    fireEvent.click(screen.getByTestId('confirm-dev-story'))
    expect(mockOnConfirm).toHaveBeenCalled()
  })

  it('closes dialog after confirmation', () => {
    render(
      <DevStoryConfirmDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        task={mockTask}
        onConfirm={mockOnConfirm}
      />
    )

    fireEvent.click(screen.getByTestId('confirm-dev-story'))
    expect(mockOnOpenChange).toHaveBeenCalledWith(false)
  })

  it('shows Code icon in title', () => {
    render(
      <DevStoryConfirmDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        task={mockTask}
        onConfirm={mockOnConfirm}
      />
    )

    // The Code icon should be present in the heading
    const heading = screen.getByRole('heading', { name: /Start Development/i })
    expect(heading.querySelector('svg')).toBeInTheDocument()
  })

  it('has accessible Cancel and Start Dev Story buttons', () => {
    render(
      <DevStoryConfirmDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        task={mockTask}
        onConfirm={mockOnConfirm}
      />
    )

    expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Start Dev Story/i })).toBeInTheDocument()
  })

  it('displays story file path when available (AC 3)', () => {
    render(
      <DevStoryConfirmDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        task={mockTask}
        onConfirm={mockOnConfirm}
      />
    )

    // Should show the filename from the story_file_path
    expect(screen.getByText('5-3-story.md')).toBeInTheDocument()
    expect(screen.getByText('Story file:')).toBeInTheDocument()
  })

  it('does not display story file section when path is null', () => {
    const taskWithoutPath = { ...mockTask, story_file_path: null }
    render(
      <DevStoryConfirmDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        task={taskWithoutPath}
        onConfirm={mockOnConfirm}
      />
    )

    expect(screen.queryByText('Story file:')).not.toBeInTheDocument()
  })
})

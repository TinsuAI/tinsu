import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BasicTaskConfirmDialog } from './BasicTaskConfirmDialog'
import type { Task } from '@shared/types/task.types'

describe('BasicTaskConfirmDialog', () => {
  const mockOnOpenChange = vi.fn()
  const mockOnConfirm = vi.fn()

  const mockTask: Task = {
    id: 'task-123',
    title: 'Fix login bug',
    description: 'The login button does not work on mobile Safari',
    status: 'backlog',
    sort_order: 1,
    epic_id: null,
    sprint_id: null,
    task_type: 'story',
    phase_number: null,
    phase_name: null,
    bmad_agent: null,
    bmad_workflow: null,
    is_start_here: null,
    artifact_path: null,
    story_number: null, // Basic task - no story_number
    story_file_path: null,
    full_content: null,
    story_file_status: null,
    context_notes: null,
    project_id: 'project-1',
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
    updated_at: new Date()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders dialog when open', () => {
    render(
      <BasicTaskConfirmDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        task={mockTask}
        onConfirm={mockOnConfirm}
      />
    )

    expect(screen.getByRole('heading', { name: /Start Task/i })).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    render(
      <BasicTaskConfirmDialog
        open={false}
        onOpenChange={mockOnOpenChange}
        task={mockTask}
        onConfirm={mockOnConfirm}
      />
    )

    expect(screen.queryByText('Start Task')).not.toBeInTheDocument()
  })

  it('displays task title in dialog description', () => {
    render(
      <BasicTaskConfirmDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        task={mockTask}
        onConfirm={mockOnConfirm}
      />
    )

    expect(screen.getByText(/Fix login bug/i)).toBeInTheDocument()
  })

  it('displays task description when present', () => {
    render(
      <BasicTaskConfirmDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        task={mockTask}
        onConfirm={mockOnConfirm}
      />
    )

    expect(screen.getByText(/login button does not work on mobile Safari/i)).toBeInTheDocument()
  })

  it('does not show description block when description is null', () => {
    const taskWithoutDescription: Task = {
      ...mockTask,
      description: null
    }

    render(
      <BasicTaskConfirmDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        task={taskWithoutDescription}
        onConfirm={mockOnConfirm}
      />
    )

    // Should not have the bordered description container
    expect(screen.queryByText(/login button does not work/i)).not.toBeInTheDocument()
  })

  it('explains that no BMAD workflow will be used', () => {
    render(
      <BasicTaskConfirmDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        task={mockTask}
        onConfirm={mockOnConfirm}
      />
    )

    expect(screen.getByText(/No BMAD workflow will be used/i)).toBeInTheDocument()
  })

  it('explains that Claude Code will be spawned', () => {
    render(
      <BasicTaskConfirmDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        task={mockTask}
        onConfirm={mockOnConfirm}
      />
    )

    expect(screen.getByText(/spawn Claude Code with the task description/i)).toBeInTheDocument()
  })

  it('calls onOpenChange with false when Cancel is clicked', () => {
    render(
      <BasicTaskConfirmDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        task={mockTask}
        onConfirm={mockOnConfirm}
      />
    )

    fireEvent.click(screen.getByTestId('cancel-basic-task'))
    expect(mockOnOpenChange).toHaveBeenCalledWith(false)
  })

  it('calls onConfirm when Start Task is clicked', () => {
    render(
      <BasicTaskConfirmDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        task={mockTask}
        onConfirm={mockOnConfirm}
      />
    )

    fireEvent.click(screen.getByTestId('confirm-basic-task'))
    expect(mockOnConfirm).toHaveBeenCalled()
  })

  it('closes dialog after confirmation', () => {
    render(
      <BasicTaskConfirmDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        task={mockTask}
        onConfirm={mockOnConfirm}
      />
    )

    fireEvent.click(screen.getByTestId('confirm-basic-task'))
    expect(mockOnOpenChange).toHaveBeenCalledWith(false)
  })

  it('shows Play icon in title', () => {
    render(
      <BasicTaskConfirmDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        task={mockTask}
        onConfirm={mockOnConfirm}
      />
    )

    // The Play icon should be present in the heading
    const heading = screen.getByRole('heading', { name: /Start Task/i })
    expect(heading.querySelector('svg')).toBeInTheDocument()
  })

  it('has accessible Cancel and Start Task buttons', () => {
    render(
      <BasicTaskConfirmDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        task={mockTask}
        onConfirm={mockOnConfirm}
      />
    )

    expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Start Task/i })).toBeInTheDocument()
  })
})

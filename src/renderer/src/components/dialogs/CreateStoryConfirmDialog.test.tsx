import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CreateStoryConfirmDialog } from './CreateStoryConfirmDialog'
import type { Task } from '@shared/types/task.types'

describe('CreateStoryConfirmDialog', () => {
  const mockOnOpenChange = vi.fn()
  const mockOnConfirm = vi.fn()

  const mockTask: Task = {
    id: 'task-123',
    title: 'Implement user authentication',
    description: 'Add login and registration',
    status: 'create_story',
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
    story_file_path: null,
    full_content: null,
    story_file_status: 'summary_only',
    project_id: 'project-1',
    created_at: new Date(),
    updated_at: new Date()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders dialog when open', () => {
    render(
      <CreateStoryConfirmDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        task={mockTask}
        onConfirm={mockOnConfirm}
      />
    )

    expect(screen.getByRole('heading', { name: /Create Story File/i })).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    render(
      <CreateStoryConfirmDialog
        open={false}
        onOpenChange={mockOnOpenChange}
        task={mockTask}
        onConfirm={mockOnConfirm}
      />
    )

    expect(screen.queryByText('Create Story File')).not.toBeInTheDocument()
  })

  it('displays task title in dialog', () => {
    render(
      <CreateStoryConfirmDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        task={mockTask}
        onConfirm={mockOnConfirm}
      />
    )

    expect(screen.getByText(/Implement user authentication/i)).toBeInTheDocument()
  })

  it('explains the create-story workflow steps', () => {
    render(
      <CreateStoryConfirmDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        task={mockTask}
        onConfirm={mockOnConfirm}
      />
    )

    // Should explain what will happen
    expect(screen.getByText(/Spawn Claude Code with BMAD/i)).toBeInTheDocument()
    expect(screen.getByText(/Analyze requirements from epics/i)).toBeInTheDocument()
    expect(screen.getByText(/Create detailed story file/i)).toBeInTheDocument()
    expect(screen.getByText(/Mark task as "Story Ready"/i)).toBeInTheDocument()
  })

  it('calls onOpenChange with false when Cancel is clicked', () => {
    render(
      <CreateStoryConfirmDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        task={mockTask}
        onConfirm={mockOnConfirm}
      />
    )

    fireEvent.click(screen.getByTestId('cancel-create-story'))
    expect(mockOnOpenChange).toHaveBeenCalledWith(false)
  })

  it('calls onConfirm when Start Create Story is clicked', () => {
    render(
      <CreateStoryConfirmDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        task={mockTask}
        onConfirm={mockOnConfirm}
      />
    )

    fireEvent.click(screen.getByTestId('confirm-create-story'))
    expect(mockOnConfirm).toHaveBeenCalled()
  })

  it('closes dialog after confirmation', () => {
    render(
      <CreateStoryConfirmDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        task={mockTask}
        onConfirm={mockOnConfirm}
      />
    )

    fireEvent.click(screen.getByTestId('confirm-create-story'))
    expect(mockOnOpenChange).toHaveBeenCalledWith(false)
  })

  it('shows FileText icon in title', () => {
    render(
      <CreateStoryConfirmDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        task={mockTask}
        onConfirm={mockOnConfirm}
      />
    )

    // The FileText icon should be present in the heading
    const heading = screen.getByRole('heading', { name: /Create Story File/i })
    expect(heading.querySelector('svg')).toBeInTheDocument()
  })

  it('has accessible Cancel and Start Create Story buttons', () => {
    render(
      <CreateStoryConfirmDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        task={mockTask}
        onConfirm={mockOnConfirm}
      />
    )

    expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Start Create Story/i })).toBeInTheDocument()
  })
})

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TaskCard } from './TaskCard'
import type { Task } from '@shared/types/task.types'

// Helper to render with userEvent for keyboard testing
function renderWithUser(ui: React.ReactElement) {
  return {
    user: userEvent.setup(),
    ...render(ui)
  }
}

// Mock task data for testing
const mockTask: Task = {
  id: 'task-1',
  title: 'Implement feature X',
  description: 'A detailed description that explains what needs to be done for this task',
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
  story_file_status: null,
  full_content: null,
  context_notes: null,
  project_id: null,
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
  created_at: new Date('2026-01-01'),
  updated_at: new Date('2026-01-01')
}

describe('TaskCard', () => {
  it('should render task title prominently', () => {
    render(<TaskCard task={mockTask} />)

    const title = screen.getByText('Implement feature X')
    expect(title).toBeInTheDocument()
    expect(title).toHaveClass('font-medium')
  })

  it('should render truncated description (first paragraph only)', () => {
    const taskWithLongDesc = {
      ...mockTask,
      description: 'First paragraph.\n\nSecond paragraph.'
    }
    render(<TaskCard task={taskWithLongDesc} />)

    const description = screen.getByTestId('task-description')
    expect(description).toBeInTheDocument()
    expect(description).toHaveTextContent('First paragraph.')
    expect(description).not.toHaveTextContent('Second paragraph.')
  })

  it('should handle null description gracefully', () => {
    const taskWithoutDescription: Task = {
      ...mockTask,
      description: null
    }

    render(<TaskCard task={taskWithoutDescription} />)

    expect(screen.getByText('Implement feature X')).toBeInTheDocument()
    // No description should be rendered
    expect(screen.queryByTestId('task-description')).not.toBeInTheDocument()
  })

  it('should render with kanban-card styling', () => {
    render(<TaskCard task={mockTask} />)

    const card = screen.getByTestId('task-card-task-1')
    expect(card).toHaveClass('kanban-card')
  })

  it('should have data-testid for testing', () => {
    render(<TaskCard task={mockTask} />)

    expect(screen.getByTestId('task-card-task-1')).toBeInTheDocument()
  })

  it('should render with proper text styling', () => {
    render(<TaskCard task={mockTask} />)

    const title = screen.getByText('Implement feature X')
    expect(title).toHaveClass('text-sm')

    const description = screen.getByText(/A detailed description/)
    expect(description).toHaveClass('text-muted-foreground')
  })

  it('should have rounded corners', () => {
    render(<TaskCard task={mockTask} />)

    const card = screen.getByTestId('task-card-task-1')
    expect(card).toHaveClass('rounded-xl')
  })
})

describe('TaskCard accessibility', () => {
  it('should have role="option" for listbox pattern', () => {
    render(<TaskCard task={mockTask} />)

    const card = screen.getByTestId('task-card-task-1')
    expect(card).toHaveAttribute('role', 'option')
  })

  it('should be focusable with tabIndex', () => {
    render(<TaskCard task={mockTask} />)

    const card = screen.getByTestId('task-card-task-1')
    expect(card).toHaveAttribute('tabIndex', '0')
  })
})

describe('TaskCard with epic', () => {
  it('should display epic name when epicName is provided', () => {
    render(<TaskCard task={mockTask} epicName="Epic 1: Foundation" />)

    expect(screen.getByText('Epic 1: Foundation')).toBeInTheDocument()
  })

  it('should render epic badge with proper styling', () => {
    render(<TaskCard task={mockTask} epicName="Epic 1: Foundation" epicColor="blue" />)

    const epicBadgeContainer = screen.getByTestId('task-epic-label')
    expect(epicBadgeContainer).toBeInTheDocument()
    // EpicBadge component is now used instead of plain text
    const epicBadge = screen.getByTestId('epic-badge')
    expect(epicBadge).toBeInTheDocument()
    expect(epicBadge).toHaveClass('text-xs')
  })

  it('should not render epic label when epicName is not provided', () => {
    render(<TaskCard task={mockTask} />)

    expect(screen.queryByTestId('task-epic-label')).not.toBeInTheDocument()
  })

  it('should handle null epic_id gracefully', () => {
    const taskWithoutEpic: Task = {
      ...mockTask,
      epic_id: null
    }

    render(<TaskCard task={taskWithoutEpic} />)

    expect(screen.queryByTestId('task-epic-label')).not.toBeInTheDocument()
  })
})

describe('TaskCard with AgentStatusBadge', () => {
  it('should display AgentStatusBadge', () => {
    render(<TaskCard task={mockTask} />)

    // Default agent status is idle
    expect(screen.getByTestId('agent-status-idle')).toBeInTheDocument()
  })

  it('should display custom agent status', () => {
    render(<TaskCard task={mockTask} agentStatus="running" />)

    expect(screen.getByTestId('agent-status-running')).toBeInTheDocument()
  })

  it('should display all agent status variants', () => {
    const statuses = ['idle', 'running', 'stalled', 'review', 'done', 'error'] as const

    statuses.forEach((status) => {
      const { unmount } = render(<TaskCard task={mockTask} agentStatus={status} />)
      expect(screen.getByTestId(`agent-status-${status}`)).toBeInTheDocument()
      unmount()
    })
  })
})

describe('TaskCard keyboard navigation', () => {
  it('should have focus-visible:outline-none to use ring instead', () => {
    render(<TaskCard task={mockTask} />)

    const card = screen.getByTestId('task-card-task-1')
    expect(card).toHaveClass('focus-visible:outline-none')
  })

  it('should call onNavigate with "up" when ArrowUp is pressed', async () => {
    const onNavigate = vi.fn()
    const { user } = renderWithUser(<TaskCard task={mockTask} onNavigate={onNavigate} />)

    const card = screen.getByTestId('task-card-task-1')
    card.focus()
    await user.keyboard('{ArrowUp}')

    expect(onNavigate).toHaveBeenCalledWith('up')
  })

  it('should call onNavigate with "down" when ArrowDown is pressed', async () => {
    const onNavigate = vi.fn()
    const { user } = renderWithUser(<TaskCard task={mockTask} onNavigate={onNavigate} />)

    const card = screen.getByTestId('task-card-task-1')
    card.focus()
    await user.keyboard('{ArrowDown}')

    expect(onNavigate).toHaveBeenCalledWith('down')
  })

  it('should call onNavigate with "left" when ArrowLeft is pressed', async () => {
    const onNavigate = vi.fn()
    const { user } = renderWithUser(<TaskCard task={mockTask} onNavigate={onNavigate} />)

    const card = screen.getByTestId('task-card-task-1')
    card.focus()
    await user.keyboard('{ArrowLeft}')

    expect(onNavigate).toHaveBeenCalledWith('left')
  })

  it('should call onNavigate with "right" when ArrowRight is pressed', async () => {
    const onNavigate = vi.fn()
    const { user } = renderWithUser(<TaskCard task={mockTask} onNavigate={onNavigate} />)

    const card = screen.getByTestId('task-card-task-1')
    card.focus()
    await user.keyboard('{ArrowRight}')

    expect(onNavigate).toHaveBeenCalledWith('right')
  })

  it('should not throw when onNavigate is not provided', async () => {
    const { user } = renderWithUser(<TaskCard task={mockTask} />)

    const card = screen.getByTestId('task-card-task-1')
    card.focus()

    // Should not throw
    await expect(user.keyboard('{ArrowUp}')).resolves.not.toThrow()
  })
})

describe('TaskCard aria-label', () => {
  it('should have aria-label with task title', () => {
    render(<TaskCard task={mockTask} />)

    const card = screen.getByTestId('task-card-task-1')
    expect(card).toHaveAttribute('aria-label', 'Task: Implement feature X')
  })

  it('should include epic name in aria-label when provided', () => {
    render(<TaskCard task={mockTask} epicName="Epic 1: Foundation" />)

    const card = screen.getByTestId('task-card-task-1')
    expect(card).toHaveAttribute('aria-label', 'Task: Implement feature X, Epic: Epic 1: Foundation')
  })
})

// Story 5.2c: Task type indicator tests
describe('TaskCard with task type indicator', () => {
  it('should display imported story icon for tasks with story_number', () => {
    const importedStoryTask: Task = {
      ...mockTask,
      story_number: '1',
      story_file_status: 'summary_only'
    }

    render(<TaskCard task={importedStoryTask} />)

    expect(screen.getByTestId('task-type-imported')).toBeInTheDocument()
  })

  it('should display basic task icon for tasks without story_number', () => {
    const basicTask: Task = {
      ...mockTask,
      story_number: null,
      story_file_status: null
    }

    render(<TaskCard task={basicTask} />)

    expect(screen.getByTestId('task-type-basic')).toBeInTheDocument()
  })

  it('should not display task type indicator for planning tasks', () => {
    const planningTask: Task = {
      ...mockTask,
      task_type: 'planning',
      phase_number: 1,
      phase_name: 'Product Brief',
      bmad_agent: 'bmad:bmm:agents:pm',
      bmad_workflow: '_bmad/workflow.yaml',
      story_number: null
    }

    render(<TaskCard task={planningTask} />)

    expect(screen.queryByTestId('task-type-imported')).not.toBeInTheDocument()
    expect(screen.queryByTestId('task-type-basic')).not.toBeInTheDocument()
  })
})

// Story 5.2c: Story file status badge tests
describe('TaskCard with StoryFileStatusBadge', () => {
  it('should display story file status badge for summary_only', () => {
    const importedStoryTask: Task = {
      ...mockTask,
      story_number: '1',
      story_file_status: 'summary_only'
    }

    render(<TaskCard task={importedStoryTask} />)

    expect(screen.getByTestId('task-story-file-status')).toBeInTheDocument()
    expect(screen.getByText('Summary Only')).toBeInTheDocument()
  })

  it('should display story file status badge for story_ready', () => {
    const readyStoryTask: Task = {
      ...mockTask,
      story_number: '1',
      story_file_status: 'story_ready',
      story_file_path: '/path/to/1-1-story.md'
    }

    render(<TaskCard task={readyStoryTask} />)

    expect(screen.getByTestId('task-story-file-status')).toBeInTheDocument()
    expect(screen.getByText('Story Ready')).toBeInTheDocument()
  })

  it('should not display story file status badge for basic tasks (null status)', () => {
    const basicTask: Task = {
      ...mockTask,
      story_number: null,
      story_file_status: null
    }

    render(<TaskCard task={basicTask} />)

    expect(screen.queryByTestId('task-story-file-status')).not.toBeInTheDocument()
  })

  it('should display story file link when story_ready with path', () => {
    const readyStoryTask: Task = {
      ...mockTask,
      story_number: '2',
      story_file_status: 'story_ready',
      story_file_path: '/path/to/1-2-feature-story.md'
    }

    render(<TaskCard task={readyStoryTask} />)

    expect(screen.getByTestId('story-file-link')).toBeInTheDocument()
    expect(screen.getByText('1-2-feature-story.md')).toBeInTheDocument()
  })
})

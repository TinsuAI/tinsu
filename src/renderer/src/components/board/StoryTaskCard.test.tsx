import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StoryTaskCard } from './StoryTaskCard'
import type { StoryTask } from '@shared/types/task.types'

// Helper to render with userEvent for keyboard testing
function renderWithUser(ui: React.ReactElement) {
  return {
    user: userEvent.setup(),
    ...render(ui)
  }
}

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
  // Story 5.5: Context notes for DEV agent
  context_notes: null,
  created_at: new Date('2026-01-01'),
  updated_at: new Date('2026-01-01')
}

describe('StoryTaskCard', () => {
  it('renders story title prominently', () => {
    render(<StoryTaskCard task={mockStoryTask} />)

    const title = screen.getByText('1.1: Initialize Project')
    expect(title).toBeInTheDocument()
    expect(title).toHaveClass('font-medium')
  })

  it('displays epic badge when epicName is provided', () => {
    render(<StoryTaskCard task={mockStoryTask} epicName="Foundation" epicColor="blue" />)

    expect(screen.getByTestId('epic-badge')).toBeInTheDocument()
    expect(screen.getByText('Foundation')).toBeInTheDocument()
  })

  it('does not display epic badge when epicName is not provided', () => {
    render(<StoryTaskCard task={mockStoryTask} />)

    expect(screen.queryByTestId('epic-badge')).not.toBeInTheDocument()
  })

  it('shows story indicator to distinguish from other task types', () => {
    render(<StoryTaskCard task={mockStoryTask} />)

    // Story cards should have a visible indicator (e.g., story icon or story badge)
    expect(screen.getByTestId('story-indicator')).toBeInTheDocument()
  })

  it('displays truncated description', () => {
    render(<StoryTaskCard task={mockStoryTask} />)

    const description = screen.getByTestId('task-description')
    expect(description).toBeInTheDocument()
    expect(description).toHaveClass('line-clamp-2')
  })

  it('has proper base styling', () => {
    render(<StoryTaskCard task={mockStoryTask} />)

    const card = screen.getByTestId(`story-task-card-${mockStoryTask.id}`)
    // Uses kanban card styling from CSS
    expect(card).toHaveClass('kanban-card')
    expect(card).toHaveClass('kanban-card-story')
    expect(card).toHaveClass('rounded-xl')
    expect(card).toHaveClass('p-3.5')
  })

  it('has distinct styling for story tasks via kanban-card-story class', () => {
    render(<StoryTaskCard task={mockStoryTask} />)

    const card = screen.getByTestId(`story-task-card-${mockStoryTask.id}`)
    // Story tasks use kanban-card-story class for distinct styling (cyan left border in CSS)
    expect(card).toHaveClass('kanban-card-story')
  })

  it('has data-testid for testing', () => {
    render(<StoryTaskCard task={mockStoryTask} />)

    expect(screen.getByTestId('story-task-card-story-1')).toBeInTheDocument()
  })
})

describe('StoryTaskCard accessibility', () => {
  it('has correct aria-label for screen readers', () => {
    render(<StoryTaskCard task={mockStoryTask} epicName="Foundation" />)

    const card = screen.getByTestId(`story-task-card-${mockStoryTask.id}`)
    expect(card).toHaveAttribute('aria-label', 'Story: 1.1: Initialize Project, Epic: Foundation')
  })

  it('has correct aria-label without epic', () => {
    render(<StoryTaskCard task={mockStoryTask} />)

    const card = screen.getByTestId(`story-task-card-${mockStoryTask.id}`)
    expect(card).toHaveAttribute('aria-label', 'Story: 1.1: Initialize Project')
  })

  it('has role="option" for listbox pattern', () => {
    render(<StoryTaskCard task={mockStoryTask} />)

    const card = screen.getByTestId(`story-task-card-${mockStoryTask.id}`)
    expect(card).toHaveAttribute('role', 'option')
  })

  it('is focusable with tabIndex', () => {
    render(<StoryTaskCard task={mockStoryTask} />)

    const card = screen.getByTestId(`story-task-card-${mockStoryTask.id}`)
    expect(card).toHaveAttribute('tabIndex', '0')
  })

  it('has focus visible styling', () => {
    render(<StoryTaskCard task={mockStoryTask} />)

    const card = screen.getByTestId(`story-task-card-${mockStoryTask.id}`)
    // Focus styles handled by CSS (focus-visible:outline-none with kanban-card styles)
    expect(card).toHaveClass('focus-visible:outline-none')
  })
})

describe('StoryTaskCard keyboard navigation', () => {
  it('calls onNavigate with "up" when ArrowUp is pressed', async () => {
    const onNavigate = vi.fn()
    const { user } = renderWithUser(<StoryTaskCard task={mockStoryTask} onNavigate={onNavigate} />)

    const card = screen.getByTestId(`story-task-card-${mockStoryTask.id}`)
    card.focus()
    await user.keyboard('{ArrowUp}')

    expect(onNavigate).toHaveBeenCalledWith('up')
  })

  it('calls onNavigate with "down" when ArrowDown is pressed', async () => {
    const onNavigate = vi.fn()
    const { user } = renderWithUser(<StoryTaskCard task={mockStoryTask} onNavigate={onNavigate} />)

    const card = screen.getByTestId(`story-task-card-${mockStoryTask.id}`)
    card.focus()
    await user.keyboard('{ArrowDown}')

    expect(onNavigate).toHaveBeenCalledWith('down')
  })

  it('calls onNavigate with "left" when ArrowLeft is pressed', async () => {
    const onNavigate = vi.fn()
    const { user } = renderWithUser(<StoryTaskCard task={mockStoryTask} onNavigate={onNavigate} />)

    const card = screen.getByTestId(`story-task-card-${mockStoryTask.id}`)
    card.focus()
    await user.keyboard('{ArrowLeft}')

    expect(onNavigate).toHaveBeenCalledWith('left')
  })

  it('calls onNavigate with "right" when ArrowRight is pressed', async () => {
    const onNavigate = vi.fn()
    const { user } = renderWithUser(<StoryTaskCard task={mockStoryTask} onNavigate={onNavigate} />)

    const card = screen.getByTestId(`story-task-card-${mockStoryTask.id}`)
    card.focus()
    await user.keyboard('{ArrowRight}')

    expect(onNavigate).toHaveBeenCalledWith('right')
  })

  it('does not throw when onNavigate is not provided', async () => {
    const { user } = renderWithUser(<StoryTaskCard task={mockStoryTask} />)

    const card = screen.getByTestId(`story-task-card-${mockStoryTask.id}`)
    card.focus()

    await expect(user.keyboard('{ArrowUp}')).resolves.not.toThrow()
  })
})

// Story 3.9: Sync indicator tests
describe('StoryTaskCard sync indicator', () => {
  it('does not show sync indicator when isSyncing is false', () => {
    render(<StoryTaskCard task={mockStoryTask} isSyncing={false} />)

    expect(screen.queryByTestId('sync-indicator')).not.toBeInTheDocument()
  })

  it('shows sync indicator when isSyncing is true', () => {
    render(<StoryTaskCard task={mockStoryTask} isSyncing={true} />)

    expect(screen.getByTestId('sync-indicator')).toBeInTheDocument()
  })

  it('has reduced opacity when syncing', () => {
    render(<StoryTaskCard task={mockStoryTask} isSyncing={true} />)

    const card = screen.getByTestId(`story-task-card-${mockStoryTask.id}`)
    // Card should have pointer-events-none when syncing
    expect(card).toHaveClass('pointer-events-none')
  })

  it('includes syncing status in aria-label when syncing', () => {
    render(<StoryTaskCard task={mockStoryTask} epicName="Foundation" isSyncing={true} />)

    const card = screen.getByTestId(`story-task-card-${mockStoryTask.id}`)
    expect(card).toHaveAttribute(
      'aria-label',
      expect.stringContaining('Syncing')
    )
  })
})

// Story 5.5: DEV Agent Progress Indicator tests
describe('StoryTaskCard DEV progress indicator', () => {
  it('shows progress indicator when agent is running and task is in_progress', () => {
    const inProgressTask = { ...mockStoryTask, status: 'in_progress' as const }
    render(<StoryTaskCard task={inProgressTask} isAgentRunning={true} agentProgressStep="dev" />)

    expect(screen.getByTestId('task-dev-progress')).toBeInTheDocument()
  })

  it('does not show progress indicator when agent is not running', () => {
    const inProgressTask = { ...mockStoryTask, status: 'in_progress' as const }
    render(<StoryTaskCard task={inProgressTask} isAgentRunning={false} />)

    expect(screen.queryByTestId('task-dev-progress')).not.toBeInTheDocument()
  })

  it('does not show progress indicator when task is not in_progress', () => {
    render(<StoryTaskCard task={mockStoryTask} isAgentRunning={true} agentProgressStep="dev" />)

    expect(screen.queryByTestId('task-dev-progress')).not.toBeInTheDocument()
  })

  it('shows summary text when task status is review and agent not running', () => {
    const reviewTask = { ...mockStoryTask, status: 'review' as const }
    render(<StoryTaskCard task={reviewTask} isAgentRunning={false} />)

    expect(screen.getByTestId('task-review-summary')).toBeInTheDocument()
    expect(screen.getByText('Ready for human review')).toBeInTheDocument()
  })

  it('does not show summary when agent is running', () => {
    const reviewTask = { ...mockStoryTask, status: 'review' as const }
    render(<StoryTaskCard task={reviewTask} isAgentRunning={true} agentProgressStep="review" />)

    // Should show progress indicator instead of summary
    expect(screen.queryByTestId('task-review-summary')).not.toBeInTheDocument()
  })
})

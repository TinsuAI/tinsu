import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PlanningTaskCard } from './PlanningTaskCard'
import type { PlanningTask } from '@shared/types/task.types'

// Helper to render with userEvent for keyboard testing
function renderWithUser(ui: React.ReactElement) {
  return {
    user: userEvent.setup(),
    ...render(ui)
  }
}

// Mock planning task data for testing
const mockPlanningTask: PlanningTask = {
  id: 'planning-1',
  title: 'Product Brief',
  description: null,
  status: 'backlog',
  sort_order: 0,
  epic_id: null,
  sprint_id: null,
  project_id: 'proj-1',
  task_type: 'planning',
  phase_number: 1,
  phase_name: 'Product Brief',
  bmad_agent: 'business-analyst',
  bmad_workflow: '/path/to/workflow.yaml',
  is_start_here: true,
  artifact_path: null,
  story_number: null,
  story_file_path: null,
  story_file_status: null,
  full_content: null,
  context_notes: null,
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

describe('PlanningTaskCard', () => {
  it('renders phase name prominently', () => {
    render(<PlanningTaskCard task={mockPlanningTask} />)

    const title = screen.getByText('Product Brief')
    expect(title).toBeInTheDocument()
    expect(title).toHaveClass('font-medium')
  })

  it('displays phase badge with correct number', () => {
    render(<PlanningTaskCard task={mockPlanningTask} />)

    const badge = screen.getByTestId('phase-badge')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveTextContent('1/5')
  })

  it('shows phase description', () => {
    render(<PlanningTaskCard task={mockPlanningTask} />)

    expect(screen.getByText('Define your product vision and target users')).toBeInTheDocument()
  })

  it('renders different phase descriptions correctly', () => {
    const phases: Array<{ phase: 1 | 2 | 3 | 4 | 5; description: string }> = [
      { phase: 1, description: 'Define your product vision and target users' },
      { phase: 2, description: 'Document detailed requirements and features' },
      { phase: 3, description: 'Design technical architecture and stack' },
      { phase: 4, description: 'Plan user experience and interface design' },
      { phase: 5, description: 'Break down work into implementable stories' }
    ]

    phases.forEach(({ phase, description }) => {
      const task: PlanningTask = {
        ...mockPlanningTask,
        phase_number: phase,
        phase_name: `Phase ${phase}`
      }
      const { unmount } = render(<PlanningTaskCard task={task} />)
      expect(screen.getByText(description)).toBeInTheDocument()
      unmount()
    })
  })

  it('has proper base styling', () => {
    render(<PlanningTaskCard task={mockPlanningTask} />)

    const card = screen.getByTestId('planning-task-card-planning-1')
    expect(card).toHaveClass('rounded-xl')
    expect(card).toHaveClass('kanban-card')
    expect(card).toHaveClass('p-3.5')
  })

  it('has hover states', () => {
    render(<PlanningTaskCard task={mockPlanningTask} />)

    const card = screen.getByTestId('planning-task-card-planning-1')
    expect(card).toHaveClass('kanban-card')
  })

  it('has data-testid for testing', () => {
    render(<PlanningTaskCard task={mockPlanningTask} />)

    expect(screen.getByTestId('planning-task-card-planning-1')).toBeInTheDocument()
  })
})

describe('PlanningTaskCard Start Here effect', () => {
  it('shows glow effect when isStartHere=true', () => {
    render(<PlanningTaskCard task={mockPlanningTask} isStartHere />)

    const card = screen.getByTestId('planning-task-card-planning-1')
    expect(card).toHaveClass('start-here')
  })

  it('shows "Start here" text when isStartHere=true', () => {
    render(<PlanningTaskCard task={mockPlanningTask} isStartHere />)

    expect(screen.getByText('Start here')).toBeInTheDocument()
  })

  it('has tooltip title on Start here text', () => {
    render(<PlanningTaskCard task={mockPlanningTask} isStartHere />)

    const startHereText = screen.getByText('Start here')
    expect(startHereText).toHaveAttribute('title', 'Recommended next step in planning workflow')
  })

  it('does not show glow when isStartHere=false', () => {
    render(<PlanningTaskCard task={mockPlanningTask} isStartHere={false} />)

    const card = screen.getByTestId('planning-task-card-planning-1')
    expect(card).not.toHaveClass('ring-cyan-500/50')
  })

  it('does not show glow when isStartHere but also isCompleted', () => {
    render(<PlanningTaskCard task={mockPlanningTask} isStartHere isCompleted />)

    const card = screen.getByTestId('planning-task-card-planning-1')
    expect(card).not.toHaveClass('ring-cyan-500/50')
    expect(screen.queryByText('Start here')).not.toBeInTheDocument()
  })
})

describe('PlanningTaskCard completed state', () => {
  it('shows checkmark when isCompleted=true', () => {
    render(<PlanningTaskCard task={mockPlanningTask} isCompleted />)

    // CheckCircle2 icon should be present
    const card = screen.getByTestId('planning-task-card-planning-1')
    const svg = card.querySelector('svg.text-green-500')
    expect(svg).toBeInTheDocument()
  })

  it('displays artifact path when completed with path', () => {
    render(
      <PlanningTaskCard
        task={mockPlanningTask}
        isCompleted
        artifactPath="_bmad-output/product-brief.md"
      />
    )

    expect(screen.getByText('_bmad-output/product-brief.md')).toBeInTheDocument()
  })

  it('does not show artifact path when not completed', () => {
    render(
      <PlanningTaskCard
        task={mockPlanningTask}
        isCompleted={false}
        artifactPath="_bmad-output/product-brief.md"
      />
    )

    expect(screen.queryByText('_bmad-output/product-brief.md')).not.toBeInTheDocument()
  })

  it('does not show artifact path when completed but path is null', () => {
    render(<PlanningTaskCard task={mockPlanningTask} isCompleted artifactPath={null} />)

    // FileText icon should not be present
    const card = screen.getByTestId('planning-task-card-planning-1')
    const fileIcon = card.querySelector('svg.text-cyan-400')
    expect(fileIcon).not.toBeInTheDocument()
  })

  it('calls onOpenArtifact when completed card clicked', async () => {
    const onOpenArtifact = vi.fn()
    const { user } = renderWithUser(
      <PlanningTaskCard
        task={mockPlanningTask}
        isCompleted
        artifactPath="_bmad-output/product-brief.md"
        onOpenArtifact={onOpenArtifact}
      />
    )

    const card = screen.getByTestId('planning-task-card-planning-1')
    await user.click(card)

    expect(onOpenArtifact).toHaveBeenCalledTimes(1)
  })

  it('does not call onOpenArtifact when not completed', async () => {
    const onOpenArtifact = vi.fn()
    const { user } = renderWithUser(
      <PlanningTaskCard
        task={mockPlanningTask}
        isCompleted={false}
        artifactPath="_bmad-output/product-brief.md"
        onOpenArtifact={onOpenArtifact}
      />
    )

    const card = screen.getByTestId('planning-task-card-planning-1')
    await user.click(card)

    expect(onOpenArtifact).not.toHaveBeenCalled()
  })

  it('has cursor-pointer when completed with artifact path', () => {
    render(
      <PlanningTaskCard
        task={mockPlanningTask}
        isCompleted
        artifactPath="_bmad-output/product-brief.md"
      />
    )

    const card = screen.getByTestId('planning-task-card-planning-1')
    expect(card).toHaveClass('cursor-pointer')
  })

  it('shows full path in title attribute for long paths', () => {
    const longPath = '_bmad-output/very-long-path-to-the-artifact-file/product-brief.md'
    render(<PlanningTaskCard task={mockPlanningTask} isCompleted artifactPath={longPath} />)

    const pathElement = screen.getByText(longPath)
    expect(pathElement).toHaveAttribute('title', longPath)
  })
})

describe('PlanningTaskCard accessibility', () => {
  it('has correct aria-label for screen readers', () => {
    render(<PlanningTaskCard task={mockPlanningTask} />)

    const card = screen.getByTestId('planning-task-card-planning-1')
    expect(card).toHaveAttribute('aria-label', 'Planning phase 1 of 5: Product Brief')
  })

  it('has correct aria-label for different phases', () => {
    const task: PlanningTask = {
      ...mockPlanningTask,
      phase_number: 3,
      phase_name: 'Architecture'
    }
    render(<PlanningTaskCard task={task} />)

    const card = screen.getByTestId('planning-task-card-planning-1')
    expect(card).toHaveAttribute('aria-label', 'Planning phase 3 of 5: Architecture')
  })

  it('has role="option" for listbox pattern', () => {
    render(<PlanningTaskCard task={mockPlanningTask} />)

    const card = screen.getByTestId('planning-task-card-planning-1')
    expect(card).toHaveAttribute('role', 'option')
  })

  it('is focusable with tabIndex', () => {
    render(<PlanningTaskCard task={mockPlanningTask} />)

    const card = screen.getByTestId('planning-task-card-planning-1')
    expect(card).toHaveAttribute('tabIndex', '0')
  })

  it('has visible focus ring styles', () => {
    render(<PlanningTaskCard task={mockPlanningTask} />)

    const card = screen.getByTestId('planning-task-card-planning-1')
    expect(card).toHaveClass('focus-visible:outline-none')
  })
})

describe('PlanningTaskCard keyboard navigation', () => {
  it('calls onNavigate with "up" when ArrowUp is pressed', async () => {
    const onNavigate = vi.fn()
    const { user } = renderWithUser(
      <PlanningTaskCard task={mockPlanningTask} onNavigate={onNavigate} />
    )

    const card = screen.getByTestId('planning-task-card-planning-1')
    card.focus()
    await user.keyboard('{ArrowUp}')

    expect(onNavigate).toHaveBeenCalledWith('up')
  })

  it('calls onNavigate with "down" when ArrowDown is pressed', async () => {
    const onNavigate = vi.fn()
    const { user } = renderWithUser(
      <PlanningTaskCard task={mockPlanningTask} onNavigate={onNavigate} />
    )

    const card = screen.getByTestId('planning-task-card-planning-1')
    card.focus()
    await user.keyboard('{ArrowDown}')

    expect(onNavigate).toHaveBeenCalledWith('down')
  })

  it('calls onNavigate with "left" when ArrowLeft is pressed', async () => {
    const onNavigate = vi.fn()
    const { user } = renderWithUser(
      <PlanningTaskCard task={mockPlanningTask} onNavigate={onNavigate} />
    )

    const card = screen.getByTestId('planning-task-card-planning-1')
    card.focus()
    await user.keyboard('{ArrowLeft}')

    expect(onNavigate).toHaveBeenCalledWith('left')
  })

  it('calls onNavigate with "right" when ArrowRight is pressed', async () => {
    const onNavigate = vi.fn()
    const { user } = renderWithUser(
      <PlanningTaskCard task={mockPlanningTask} onNavigate={onNavigate} />
    )

    const card = screen.getByTestId('planning-task-card-planning-1')
    card.focus()
    await user.keyboard('{ArrowRight}')

    expect(onNavigate).toHaveBeenCalledWith('right')
  })

  it('does not throw when onNavigate is not provided', async () => {
    const { user } = renderWithUser(<PlanningTaskCard task={mockPlanningTask} />)

    const card = screen.getByTestId('planning-task-card-planning-1')
    card.focus()

    await expect(user.keyboard('{ArrowUp}')).resolves.not.toThrow()
  })
})

describe('PlanningTaskCard with AgentStatusBadge', () => {
  it('displays AgentStatusBadge with default idle status', () => {
    render(<PlanningTaskCard task={mockPlanningTask} />)

    expect(screen.getByTestId('agent-status-idle')).toBeInTheDocument()
  })

  it('displays custom agent status', () => {
    render(<PlanningTaskCard task={mockPlanningTask} agentStatus="running" />)

    expect(screen.getByTestId('agent-status-running')).toBeInTheDocument()
  })
})

// Story 9.8: Agent Persona Badge tests
describe('PlanningTaskCard persona badge (Story 9.8)', () => {
  it('shows persona badge when task has bmad_agent and agentStatus is running', () => {
    const task: PlanningTask = {
      ...mockPlanningTask,
      bmad_agent: 'bmad-agent-pm'
    }
    render(<PlanningTaskCard task={task} agentStatus="running" />)

    const badge = screen.getByTestId('agent-persona-badge')
    expect(badge).toBeInTheDocument()
    expect(badge).toHaveTextContent('PM')
  })

  it('does NOT show persona badge when agentStatus is not running', () => {
    const task: PlanningTask = {
      ...mockPlanningTask,
      bmad_agent: 'bmad-agent-pm'
    }
    render(<PlanningTaskCard task={task} agentStatus="idle" />)

    expect(screen.queryByTestId('agent-persona-badge')).not.toBeInTheDocument()
  })

  it('does NOT show persona badge when bmad_agent is null', () => {
    const task = {
      ...mockPlanningTask,
      bmad_agent: null
    } as unknown as PlanningTask
    render(<PlanningTaskCard task={task} agentStatus="running" />)

    expect(screen.queryByTestId('agent-persona-badge')).not.toBeInTheDocument()
  })

  it('does NOT show persona badge for unknown agent', () => {
    const task: PlanningTask = {
      ...mockPlanningTask,
      bmad_agent: 'bmad-agent-unknown'
    }
    render(<PlanningTaskCard task={task} agentStatus="running" />)

    expect(screen.queryByTestId('agent-persona-badge')).not.toBeInTheDocument()
  })

  it('persona badge color matches agent mapping for PM (green)', () => {
    const task: PlanningTask = {
      ...mockPlanningTask,
      bmad_agent: 'bmad-agent-pm'
    }
    render(<PlanningTaskCard task={task} agentStatus="running" />)

    const badge = screen.getByTestId('agent-persona-badge')
    expect(badge).toHaveClass('text-green-400')
    expect(badge).toHaveClass('bg-green-500/20')
    expect(badge).toHaveClass('border-green-500/30')
  })

  it('persona badge color matches agent mapping for Architect (orange)', () => {
    const task: PlanningTask = {
      ...mockPlanningTask,
      bmad_agent: 'bmad-agent-architect'
    }
    render(<PlanningTaskCard task={task} agentStatus="running" />)

    const badge = screen.getByTestId('agent-persona-badge')
    expect(badge).toHaveClass('text-orange-400')
    expect(badge).toHaveClass('bg-orange-500/20')
  })

  it('persona badge color matches agent mapping for UX Designer (purple)', () => {
    const task: PlanningTask = {
      ...mockPlanningTask,
      bmad_agent: 'bmad-agent-ux-designer'
    }
    render(<PlanningTaskCard task={task} agentStatus="running" />)

    const badge = screen.getByTestId('agent-persona-badge')
    expect(badge).toHaveClass('text-purple-400')
    expect(badge).toHaveClass('bg-purple-500/20')
  })

  it('persona badge color matches agent mapping for Analyst (blue)', () => {
    const task: PlanningTask = {
      ...mockPlanningTask,
      bmad_agent: 'bmad-agent-analyst'
    }
    render(<PlanningTaskCard task={task} agentStatus="running" />)

    const badge = screen.getByTestId('agent-persona-badge')
    expect(badge).toHaveClass('text-blue-400')
    expect(badge).toHaveClass('bg-blue-500/20')
  })
})

// Story 3.7: Import Stories button tests
describe('PlanningTaskCard Import Stories button', () => {
  const phase5Task: PlanningTask = {
    ...mockPlanningTask,
    id: 'planning-5',
    phase_number: 5,
    phase_name: 'Epics & Stories',
    artifact_path: '_bmad-output/planning-artifacts/epics.md'
  }

  it('shows Import Stories button on phase 5 when completed', () => {
    render(<PlanningTaskCard task={phase5Task} isCompleted artifactPath={phase5Task.artifact_path} />)

    expect(screen.getByTestId('import-stories-button')).toBeInTheDocument()
    expect(screen.getByText('Import Stories')).toBeInTheDocument()
  })

  it('does not show Import Stories button on phase 5 when not completed', () => {
    render(<PlanningTaskCard task={phase5Task} isCompleted={false} />)

    expect(screen.queryByTestId('import-stories-button')).not.toBeInTheDocument()
  })

  it('does not show Import Stories button on other phases even when completed', () => {
    const phase3Task: PlanningTask = {
      ...mockPlanningTask,
      phase_number: 3,
      phase_name: 'Architecture'
    }
    render(<PlanningTaskCard task={phase3Task} isCompleted artifactPath="_bmad-output/arch.md" />)

    expect(screen.queryByTestId('import-stories-button')).not.toBeInTheDocument()
  })

  it('calls onImportStories when Import Stories button clicked', async () => {
    const onImportStories = vi.fn()
    const { user } = renderWithUser(
      <PlanningTaskCard
        task={phase5Task}
        isCompleted
        artifactPath={phase5Task.artifact_path}
        onImportStories={onImportStories}
      />
    )

    await user.click(screen.getByTestId('import-stories-button'))

    expect(onImportStories).toHaveBeenCalledTimes(1)
  })

  it('does not propagate click to card when button clicked', async () => {
    const onOpenArtifact = vi.fn()
    const onImportStories = vi.fn()
    const { user } = renderWithUser(
      <PlanningTaskCard
        task={phase5Task}
        isCompleted
        artifactPath={phase5Task.artifact_path}
        onOpenArtifact={onOpenArtifact}
        onImportStories={onImportStories}
      />
    )

    await user.click(screen.getByTestId('import-stories-button'))

    expect(onImportStories).toHaveBeenCalledTimes(1)
    expect(onOpenArtifact).not.toHaveBeenCalled()
  })
})

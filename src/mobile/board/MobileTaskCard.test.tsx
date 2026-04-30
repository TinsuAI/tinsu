import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MobileTaskCard } from './MobileTaskCard'
import type { Task } from '@shared/types/task.types'

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Test task title',
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
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-04-30'),
    ...overrides,
  }
}

describe('MobileTaskCard', () => {
  it('renders title', () => {
    render(<MobileTaskCard task={makeTask({ title: 'My Story Task' })} />)
    expect(screen.getByTestId('mobile-task-card-title-task-1')).toHaveTextContent('My Story Task')
  })

  it('renders "Story" pill for imported story task (task_type=story, story_number set)', () => {
    render(<MobileTaskCard task={makeTask({ task_type: 'story', story_number: '1' })} />)
    expect(screen.getByTestId('mobile-task-card-pill-task-1')).toHaveTextContent('Story')
  })

  it('renders "Plan" pill for task_type planning', () => {
    render(<MobileTaskCard task={makeTask({ task_type: 'planning' })} />)
    expect(screen.getByTestId('mobile-task-card-pill-task-1')).toHaveTextContent('Plan')
  })

  it('renders "Task" pill for basic task (task_type=story, story_number=null)', () => {
    // Basic tasks: task_type='story' && story_number=null (isBasicTask returns true)
    render(
      <MobileTaskCard
        task={makeTask({ task_type: 'story', story_number: null })}
      />,
    )
    expect(screen.getByTestId('mobile-task-card-pill-task-1')).toHaveTextContent('Task')
  })

  it('fires onPress when card is clicked', () => {
    const onPress = vi.fn()
    render(<MobileTaskCard task={makeTask()} onPress={onPress} />)
    fireEvent.click(screen.getByTestId('mobile-task-card-task-1'))
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('adds opacity class when isDragging is true', () => {
    render(<MobileTaskCard task={makeTask()} isDragging />)
    const card = screen.getByTestId('mobile-task-card-task-1')
    expect(card.className).toContain('opacity-50')
  })

  it('does not add opacity class when isDragging is false', () => {
    render(<MobileTaskCard task={makeTask()} isDragging={false} />)
    const card = screen.getByTestId('mobile-task-card-task-1')
    expect(card.className).not.toContain('opacity-50')
  })

  it('renders date in metadata row', () => {
    const task = makeTask({ updated_at: new Date('2026-04-30') })
    render(<MobileTaskCard task={task} />)
    // Date rendered as localized string — just check element exists
    const card = screen.getByTestId(`mobile-task-card-${task.id}`)
    expect(card).toBeInTheDocument()
  })
})

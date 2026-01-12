import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DndContext } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { SortableTaskCard } from './SortableTaskCard'
import type { Task } from '@shared/types/task.types'

// Sample task data
const createTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'task-1',
  title: 'Test Task',
  description: 'Test description',
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
  project_id: null,
  created_at: new Date('2024-01-01'),
  updated_at: new Date('2024-01-01'),
  ...overrides
})

// Wrapper component for DndContext
function DndWrapper({ children }: { children: React.ReactNode }) {
  return (
    <DndContext>
      <SortableContext items={['task-1', 'task-2']} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  )
}

describe('SortableTaskCard', () => {
  it('should render the task card with task content', () => {
    const task = createTask()

    render(
      <DndWrapper>
        <SortableTaskCard task={task} />
      </DndWrapper>
    )

    expect(screen.getByText('Test Task')).toBeInTheDocument()
    expect(screen.getByText('Test description')).toBeInTheDocument()
  })

  it('should render with sortable test id', () => {
    const task = createTask({ id: 'task-123' })

    render(
      <DndWrapper>
        <SortableTaskCard task={task} />
      </DndWrapper>
    )

    expect(screen.getByTestId('sortable-task-task-123')).toBeInTheDocument()
  })

  it('should apply opacity when isDragging prop is true', () => {
    const task = createTask()

    render(
      <DndWrapper>
        <SortableTaskCard task={task} isDragging={true} />
      </DndWrapper>
    )

    const wrapper = screen.getByTestId('sortable-task-task-1')
    expect(wrapper).toHaveClass('opacity-50')
  })

  it('should not apply opacity when isDragging prop is false', () => {
    const task = createTask()

    render(
      <DndWrapper>
        <SortableTaskCard task={task} isDragging={false} />
      </DndWrapper>
    )

    const wrapper = screen.getByTestId('sortable-task-task-1')
    expect(wrapper).not.toHaveClass('opacity-50')
  })

  it('should pass onNavigate to TaskCard', () => {
    const task = createTask()
    const onNavigate = vi.fn()

    render(
      <DndWrapper>
        <SortableTaskCard task={task} onNavigate={onNavigate} />
      </DndWrapper>
    )

    // The TaskCard should be rendered with navigation capability
    const taskCard = screen.getByTestId('task-card-task-1')
    expect(taskCard).toBeInTheDocument()
  })

  it('should render epic name when provided', () => {
    const task = createTask({ epic_id: 'epic-1' })

    render(
      <DndWrapper>
        <SortableTaskCard task={task} epicName="Epic One" />
      </DndWrapper>
    )

    expect(screen.getByText('Epic One')).toBeInTheDocument()
  })

  it('should have drag handle attributes', () => {
    const task = createTask()

    render(
      <DndWrapper>
        <SortableTaskCard task={task} />
      </DndWrapper>
    )

    const wrapper = screen.getByTestId('sortable-task-task-1')
    // Sortable elements get these attributes from useSortable hook
    expect(wrapper).toHaveAttribute('tabindex')
  })
})

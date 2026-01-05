import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { KanbanBoard } from './KanbanBoard'
import type { Task } from '@shared/types/task.types'

// Mock tasks for testing
const mockTasks: Task[] = [
  {
    id: '1',
    title: 'Task 1',
    description: 'Description 1',
    status: 'backlog',
    epic_id: null,
    sprint_id: null,
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    id: '2',
    title: 'Task 2',
    description: 'Description 2',
    status: 'backlog',
    epic_id: null,
    sprint_id: null,
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    id: '3',
    title: 'Task 3',
    description: 'Description 3',
    status: 'in_progress',
    epic_id: null,
    sprint_id: null,
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    id: '4',
    title: 'Task 4',
    description: null,
    status: 'review',
    epic_id: null,
    sprint_id: null,
    created_at: new Date(),
    updated_at: new Date()
  },
  {
    id: '5',
    title: 'Task 5',
    description: null,
    status: 'done',
    epic_id: null,
    sprint_id: null,
    created_at: new Date(),
    updated_at: new Date()
  }
]

describe('KanbanBoard', () => {
  it('should render four columns', () => {
    render(<KanbanBoard tasks={[]} />)

    expect(screen.getByTestId('column-backlog')).toBeInTheDocument()
    expect(screen.getByTestId('column-in_progress')).toBeInTheDocument()
    expect(screen.getByTestId('column-review')).toBeInTheDocument()
    expect(screen.getByTestId('column-done')).toBeInTheDocument()
  })

  it('should render columns with correct headers', () => {
    render(<KanbanBoard tasks={[]} />)

    expect(screen.getByText('Backlog')).toBeInTheDocument()
    expect(screen.getByText('In Progress')).toBeInTheDocument()
    expect(screen.getByText('Review')).toBeInTheDocument()
    expect(screen.getByText('Done')).toBeInTheDocument()
  })

  it('should render columns in correct left-to-right order', () => {
    render(<KanbanBoard tasks={[]} />)

    const board = screen.getByTestId('kanban-board')
    const columns = board.querySelectorAll('[data-testid^="column-"]')

    expect(columns[0]).toHaveAttribute('data-testid', 'column-backlog')
    expect(columns[1]).toHaveAttribute('data-testid', 'column-in_progress')
    expect(columns[2]).toHaveAttribute('data-testid', 'column-review')
    expect(columns[3]).toHaveAttribute('data-testid', 'column-done')
  })

  it('should use 4-column grid layout', () => {
    render(<KanbanBoard tasks={[]} />)

    const board = screen.getByTestId('kanban-board')
    expect(board).toHaveClass('grid', 'grid-cols-4')
  })

  it('should display correct task counts per column', () => {
    render(<KanbanBoard tasks={mockTasks} />)

    expect(screen.getByTestId('count-backlog')).toHaveTextContent('2')
    expect(screen.getByTestId('count-in_progress')).toHaveTextContent('1')
    expect(screen.getByTestId('count-review')).toHaveTextContent('1')
    expect(screen.getByTestId('count-done')).toHaveTextContent('1')
  })

  it('should show loading state when isLoading is true', () => {
    render(<KanbanBoard tasks={[]} isLoading={true} />)

    expect(screen.getByText('Loading tasks...')).toBeInTheDocument()
    expect(screen.queryByTestId('kanban-board')).not.toBeInTheDocument()
  })

  it('should show "No tasks" message for empty columns', () => {
    render(<KanbanBoard tasks={[]} />)

    const noTasksMessages = screen.getAllByText('No tasks')
    expect(noTasksMessages).toHaveLength(4) // All 4 columns should show "No tasks"
  })

  it('should have 16px gap between columns', () => {
    render(<KanbanBoard tasks={[]} />)

    const board = screen.getByTestId('kanban-board')
    expect(board).toHaveClass('gap-4') // gap-4 = 16px
  })

  it('should have 16px padding around the board', () => {
    render(<KanbanBoard tasks={[]} />)

    const board = screen.getByTestId('kanban-board')
    expect(board).toHaveClass('p-4') // p-4 = 16px
  })

  it('should fill available space with flex-1', () => {
    render(<KanbanBoard tasks={[]} />)

    const board = screen.getByTestId('kanban-board')
    expect(board).toHaveClass('flex-1')
  })
})

describe('KanbanBoard task grouping', () => {
  it('should correctly group tasks by status', () => {
    const tasksWithMultipleInProgress: Task[] = [
      ...mockTasks,
      {
        id: '6',
        title: 'Task 6',
        description: null,
        status: 'in_progress',
        epic_id: null,
        sprint_id: null,
        created_at: new Date(),
        updated_at: new Date()
      }
    ]

    render(<KanbanBoard tasks={tasksWithMultipleInProgress} />)

    // Now in_progress should have 2 tasks
    expect(screen.getByTestId('count-in_progress')).toHaveTextContent('2')
  })
})

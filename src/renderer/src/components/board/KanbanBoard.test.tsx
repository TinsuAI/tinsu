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

describe('KanbanBoard TaskCard rendering', () => {
  it('should render task cards for each task', () => {
    render(<KanbanBoard tasks={mockTasks} />)

    expect(screen.getByTestId('task-card-1')).toBeInTheDocument()
    expect(screen.getByTestId('task-card-2')).toBeInTheDocument()
    expect(screen.getByTestId('task-card-3')).toBeInTheDocument()
    expect(screen.getByTestId('task-card-4')).toBeInTheDocument()
    expect(screen.getByTestId('task-card-5')).toBeInTheDocument()
  })

  it('should render task titles in cards', () => {
    render(<KanbanBoard tasks={mockTasks} />)

    expect(screen.getByText('Task 1')).toBeInTheDocument()
    expect(screen.getByText('Task 2')).toBeInTheDocument()
    expect(screen.getByText('Task 3')).toBeInTheDocument()
    expect(screen.getByText('Task 4')).toBeInTheDocument()
    expect(screen.getByText('Task 5')).toBeInTheDocument()
  })

  it('should render task cards in their correct columns', () => {
    render(<KanbanBoard tasks={mockTasks} />)

    // Tasks 1 and 2 should be in backlog column
    const backlogColumn = screen.getByTestId('column-backlog')
    expect(backlogColumn).toContainElement(screen.getByTestId('task-card-1'))
    expect(backlogColumn).toContainElement(screen.getByTestId('task-card-2'))

    // Task 3 should be in in_progress column
    const inProgressColumn = screen.getByTestId('column-in_progress')
    expect(inProgressColumn).toContainElement(screen.getByTestId('task-card-3'))

    // Task 4 should be in review column
    const reviewColumn = screen.getByTestId('column-review')
    expect(reviewColumn).toContainElement(screen.getByTestId('task-card-4'))

    // Task 5 should be in done column
    const doneColumn = screen.getByTestId('column-done')
    expect(doneColumn).toContainElement(screen.getByTestId('task-card-5'))
  })

  it('should render descriptions in task cards', () => {
    render(<KanbanBoard tasks={mockTasks} />)

    expect(screen.getByText('Description 1')).toBeInTheDocument()
    expect(screen.getByText('Description 2')).toBeInTheDocument()
    expect(screen.getByText('Description 3')).toBeInTheDocument()
  })

  it('should not show "No tasks" when tasks exist in column', () => {
    render(<KanbanBoard tasks={mockTasks} />)

    // Should not have any "No tasks" messages since all columns have tasks
    expect(screen.queryByText('No tasks')).not.toBeInTheDocument()
  })
})

describe('KanbanBoard card spacing', () => {
  it('should have 12px gap between task cards', () => {
    render(<KanbanBoard tasks={mockTasks} />)

    // The task container should have gap-3 (12px) class
    const backlogColumn = screen.getByTestId('column-backlog')
    const taskContainer = backlogColumn.querySelector('[data-testid="task-list"]')
    expect(taskContainer).toHaveClass('gap-3') // gap-3 = 12px
  })
})

describe('KanbanBoard epicNames', () => {
  it('should pass epicName to TaskCard when epicNames map is provided', () => {
    const tasksWithEpic: Task[] = [
      {
        id: '1',
        title: 'Task with Epic',
        description: null,
        status: 'backlog',
        epic_id: 'epic-1',
        sprint_id: null,
        created_at: new Date(),
        updated_at: new Date()
      }
    ]

    const epicNames = { 'epic-1': 'Epic 1: Foundation' }

    render(<KanbanBoard tasks={tasksWithEpic} epicNames={epicNames} />)

    // The epic name should be displayed in the TaskCard
    expect(screen.getByText('Epic 1: Foundation')).toBeInTheDocument()
  })

  it('should not show epic label when epic_id is null', () => {
    render(<KanbanBoard tasks={mockTasks} epicNames={{}} />)

    // No epic labels should be visible for tasks without epic_id
    expect(screen.queryByTestId('task-epic-label')).not.toBeInTheDocument()
  })
})

describe('KanbanBoard keyboard navigation', () => {
  it('should pass onNavigate callback to TaskCards', () => {
    render(<KanbanBoard tasks={mockTasks} />)

    // TaskCards should receive onNavigate prop (verified by having aria-label)
    const card = screen.getByTestId('task-card-1')
    expect(card).toHaveAttribute('aria-label')
  })
})

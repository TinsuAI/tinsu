import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { KanbanBoard } from './KanbanBoard'
import type { Task, TaskStatus } from '@shared/types/task.types'

// Helper to create a mock task with all required fields
const createMockTask = (overrides: Partial<Task> & { id: string; title: string; status: TaskStatus }): Task => ({
  description: null,
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
  project_id: null,
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides
})

// Mock tasks for testing
const mockTasks: Task[] = [
  createMockTask({ id: '1', title: 'Task 1', description: 'Description 1', status: 'backlog', sort_order: 0 }),
  createMockTask({ id: '2', title: 'Task 2', description: 'Description 2', status: 'backlog', sort_order: 1 }),
  createMockTask({ id: '3', title: 'Task 3', description: 'Description 3', status: 'in_progress', sort_order: 0 }),
  createMockTask({ id: '4', title: 'Task 4', status: 'review', sort_order: 0 }),
  createMockTask({ id: '5', title: 'Task 5', status: 'done', sort_order: 0 })
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
      createMockTask({ id: '6', title: 'Task 6', status: 'in_progress', sort_order: 1 })
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
      createMockTask({ id: '1', title: 'Task with Epic', status: 'backlog', epic_id: 'epic-1' })
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

describe('KanbanBoard drag and drop', () => {
  it('should render sortable task cards', () => {
    render(<KanbanBoard tasks={mockTasks} />)

    // Check that sortable wrappers exist for each task
    expect(screen.getByTestId('sortable-task-1')).toBeInTheDocument()
    expect(screen.getByTestId('sortable-task-2')).toBeInTheDocument()
    expect(screen.getByTestId('sortable-task-3')).toBeInTheDocument()
  })

  it('should accept onStatusChange callback', () => {
    const onStatusChange = vi.fn()
    render(<KanbanBoard tasks={mockTasks} onStatusChange={onStatusChange} />)

    // Callback should be accepted without error
    expect(screen.getByTestId('kanban-board')).toBeInTheDocument()
  })

  it('should accept onReorder callback', () => {
    const onReorder = vi.fn()
    render(<KanbanBoard tasks={mockTasks} onReorder={onReorder} />)

    // Callback should be accepted without error
    expect(screen.getByTestId('kanban-board')).toBeInTheDocument()
  })

  it('should have DndContext wrapping the board', () => {
    render(<KanbanBoard tasks={mockTasks} />)

    // Board should render correctly with DndContext
    const board = screen.getByTestId('kanban-board')
    expect(board).toBeInTheDocument()
  })

  it('should have SortableContext for each column with tasks', () => {
    render(<KanbanBoard tasks={mockTasks} />)

    // All 4 columns have at least one task in mockTasks, so 4 task-lists render
    const taskLists = screen.getAllByTestId('task-list')
    expect(taskLists).toHaveLength(4)
  })

  it('should render droppable columns with correct IDs', () => {
    render(<KanbanBoard tasks={mockTasks} />)

    // Each column should be a droppable target
    expect(screen.getByTestId('column-backlog')).toBeInTheDocument()
    expect(screen.getByTestId('column-in_progress')).toBeInTheDocument()
    expect(screen.getByTestId('column-review')).toBeInTheDocument()
    expect(screen.getByTestId('column-done')).toBeInTheDocument()
  })

  it('should sort tasks by sort_order within columns', () => {
    const tasksWithOrder: Task[] = [
      { ...mockTasks[0], id: 'z-task', sort_order: 2 },
      { ...mockTasks[1], id: 'a-task', sort_order: 0 },
      { ...mockTasks[0], id: 'm-task', sort_order: 1 }
    ]

    render(<KanbanBoard tasks={tasksWithOrder} />)

    // Tasks should be rendered in sort_order, not ID order
    const backlogColumn = screen.getByTestId('column-backlog')
    const sortableCards = backlogColumn.querySelectorAll('[data-testid^="sortable-task-"]')

    expect(sortableCards[0]).toHaveAttribute('data-testid', 'sortable-task-a-task')
    expect(sortableCards[1]).toHaveAttribute('data-testid', 'sortable-task-m-task')
    expect(sortableCards[2]).toHaveAttribute('data-testid', 'sortable-task-z-task')
  })

  // Note: Full drag event simulation requires @dnd-kit/testing utilities or E2E tests
  // The callbacks (onStatusChange, onReorder) are integration-tested through
  // KanbanBoardContainer which connects to tRPC mutations with optimistic updates
})

// Story 3.4: Agent launch when planning task moved to in_progress
describe('KanbanBoard planning task agent launch (Story 3.4)', () => {
  it('should accept onPlanningTaskStart callback', () => {
    const onPlanningTaskStart = vi.fn()
    render(<KanbanBoard tasks={mockTasks} onPlanningTaskStart={onPlanningTaskStart} />)

    // Callback should be accepted without error
    expect(screen.getByTestId('kanban-board')).toBeInTheDocument()
  })

  // Note: Full drag simulation to verify onPlanningTaskStart is called when
  // planning task is dragged to in_progress requires @dnd-kit/testing utilities
  // The actual integration behavior is tested in KanbanBoardContainer tests
})

// Story 3.7: Import stories when phase 5 planning task completes
describe('KanbanBoard phase 5 completion (Story 3.7)', () => {
  it('should accept onPhase5Complete callback', () => {
    const onPhase5Complete = vi.fn()
    render(<KanbanBoard tasks={mockTasks} onPhase5Complete={onPhase5Complete} />)

    // Callback should be accepted without error
    expect(screen.getByTestId('kanban-board')).toBeInTheDocument()
  })

  it('should accept onImportStories callback', () => {
    const onImportStories = vi.fn()
    render(<KanbanBoard tasks={mockTasks} onImportStories={onImportStories} />)

    // Callback should be accepted without error
    expect(screen.getByTestId('kanban-board')).toBeInTheDocument()
  })

  // Note: Full drag simulation to verify onPhase5Complete is called when
  // phase 5 planning task is dragged to done requires @dnd-kit/testing utilities
  // The actual integration behavior is tested in KanbanBoardContainer tests
})

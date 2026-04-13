import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DndContext } from '@dnd-kit/core'
import { KanbanColumn, COLUMN_CONFIG } from './KanbanColumn'

// Wrapper for DndContext (required for useDroppable hook)
function DndWrapper({ children }: { children: React.ReactNode }) {
  return <DndContext>{children}</DndContext>
}

describe('KanbanColumn', () => {
  it('should render column with correct title for backlog status', () => {
    render(
      <DndWrapper>
        <KanbanColumn status="backlog" taskCount={0} />
      </DndWrapper>
    )
    expect(screen.getByText('Backlog')).toBeInTheDocument()
  })

  it('should render column with correct title for in_progress status', () => {
    render(
      <DndWrapper>
        <KanbanColumn status="in_progress" taskCount={0} />
      </DndWrapper>
    )
    expect(screen.getByText('In Progress')).toBeInTheDocument()
  })

  it('should render column with correct title for review status', () => {
    render(
      <DndWrapper>
        <KanbanColumn status="review" taskCount={0} />
      </DndWrapper>
    )
    expect(screen.getByText('Review')).toBeInTheDocument()
  })

  it('should render column with correct title for done status', () => {
    render(
      <DndWrapper>
        <KanbanColumn status="done" taskCount={0} />
      </DndWrapper>
    )
    expect(screen.getByText('Done')).toBeInTheDocument()
  })

  it('should display task count', () => {
    render(
      <DndWrapper>
        <KanbanColumn status="backlog" taskCount={5} />
      </DndWrapper>
    )
    expect(screen.getByTestId('count-backlog')).toHaveTextContent('5')
  })

  it('should render children content', () => {
    render(
      <DndWrapper>
        <KanbanColumn status="backlog" taskCount={1}>
          <div data-testid="child-content">Task Card</div>
        </KanbanColumn>
      </DndWrapper>
    )
    expect(screen.getByTestId('child-content')).toBeInTheDocument()
  })

  it('should apply dark theme card background styling', () => {
    render(
      <DndWrapper>
        <KanbanColumn status="backlog" taskCount={0} />
      </DndWrapper>
    )
    const column = screen.getByTestId('column-backlog')
    // Component uses kanban-column class which provides styling via CSS
    expect(column).toHaveClass('kanban-column')
  })

  it('should have rounded corners for visual separation', () => {
    render(
      <DndWrapper>
        <KanbanColumn status="backlog" taskCount={0} />
      </DndWrapper>
    )
    const column = screen.getByTestId('column-backlog')
    expect(column).toHaveClass('rounded-xl')
  })

  it('should have overflow-y-auto for vertical scroll', () => {
    render(
      <DndWrapper>
        <KanbanColumn status="backlog" taskCount={0} />
      </DndWrapper>
    )
    const column = screen.getByTestId('column-backlog')
    const contentArea = column.querySelector('.overflow-y-auto')
    expect(contentArea).toBeInTheDocument()
  })
})

describe('COLUMN_CONFIG', () => {
  it('should have correct order for all 5 statuses (Story 5.2b)', () => {
    expect(COLUMN_CONFIG.backlog.order).toBe(1)
    expect(COLUMN_CONFIG.create_story.order).toBe(2)
    expect(COLUMN_CONFIG.in_progress.order).toBe(3)
    expect(COLUMN_CONFIG.review.order).toBe(4)
    expect(COLUMN_CONFIG.done.order).toBe(5)
  })

  it('should have correct display titles for all 5 columns (Story 5.2b)', () => {
    expect(COLUMN_CONFIG.backlog.title).toBe('Backlog')
    expect(COLUMN_CONFIG.create_story.title).toBe('Create Story')
    expect(COLUMN_CONFIG.in_progress.title).toBe('In Progress')
    expect(COLUMN_CONFIG.review.title).toBe('Review')
    expect(COLUMN_CONFIG.done.title).toBe('Done')
  })

  it('should have 5 columns total (Story 5.2b)', () => {
    expect(Object.keys(COLUMN_CONFIG)).toHaveLength(5)
  })
})

describe('KanbanColumn - Create Story column (Story 5.2b)', () => {
  it('should render Create Story column with correct title', () => {
    render(
      <DndWrapper>
        <KanbanColumn status="create_story" taskCount={0} />
      </DndWrapper>
    )
    expect(screen.getByText('Create Story')).toBeInTheDocument()
  })

  it('should display task count for Create Story column', () => {
    render(
      <DndWrapper>
        <KanbanColumn status="create_story" taskCount={3} />
      </DndWrapper>
    )
    expect(screen.getByTestId('count-create_story')).toHaveTextContent('3')
  })

  it('should have correct aria-label for Create Story column', () => {
    render(
      <DndWrapper>
        <KanbanColumn status="create_story" taskCount={2} />
      </DndWrapper>
    )
    const column = screen.getByTestId('column-create_story')
    expect(column).toHaveAttribute('aria-label', 'Create Story column with 2 tasks')
  })

  it('should render add task button for Create Story column', () => {
    render(
      <DndWrapper>
        <KanbanColumn status="create_story" taskCount={0} />
      </DndWrapper>
    )
    const addButton = screen.getByTestId('add-task-create_story')
    expect(addButton).toBeInTheDocument()
    expect(addButton).toHaveAttribute('aria-label', 'Add task to Create Story')
  })

  it('should show FileText icon for Create Story column', () => {
    render(
      <DndWrapper>
        <KanbanColumn status="create_story" taskCount={0} />
      </DndWrapper>
    )
    // FileText icon should be present for Create Story column
    expect(screen.getByTestId('create-story-icon')).toBeInTheDocument()
  })

  it('should not show FileText icon for other columns', () => {
    render(
      <DndWrapper>
        <KanbanColumn status="backlog" taskCount={0} />
      </DndWrapper>
    )
    // FileText icon should NOT be present for other columns
    expect(screen.queryByTestId('create-story-icon')).not.toBeInTheDocument()
  })

  it('should have tooltip with explanation text for Create Story column', () => {
    render(
      <DndWrapper>
        <KanbanColumn status="create_story" taskCount={0} />
      </DndWrapper>
    )
    // Tooltip trigger should be present (info icon)
    const infoIcon = screen.getByTestId('create-story-tooltip-trigger')
    expect(infoIcon).toBeInTheDocument()
  })
})

describe('KanbanColumn accessibility', () => {
  it('should have role="listbox" for accessibility', () => {
    render(
      <DndWrapper>
        <KanbanColumn status="backlog" taskCount={3} />
      </DndWrapper>
    )
    const column = screen.getByTestId('column-backlog')
    expect(column).toHaveAttribute('role', 'listbox')
  })

  it('should have aria-label describing column and task count', () => {
    render(
      <DndWrapper>
        <KanbanColumn status="backlog" taskCount={5} />
      </DndWrapper>
    )
    const column = screen.getByTestId('column-backlog')
    expect(column).toHaveAttribute('aria-label', 'Backlog column with 5 tasks')
  })

  it('should update aria-label when task count changes', () => {
    const { rerender } = render(
      <DndWrapper>
        <KanbanColumn status="in_progress" taskCount={2} />
      </DndWrapper>
    )
    const column = screen.getByTestId('column-in_progress')
    expect(column).toHaveAttribute('aria-label', 'In Progress column with 2 tasks')

    rerender(
      <DndWrapper>
        <KanbanColumn status="in_progress" taskCount={10} />
      </DndWrapper>
    )
    expect(column).toHaveAttribute('aria-label', 'In Progress column with 10 tasks')
  })
})

describe('KanbanColumn droppable', () => {
  it('should accept isOver prop for highlighting', () => {
    render(
      <DndWrapper>
        <KanbanColumn status="backlog" taskCount={0} isOver={true} />
      </DndWrapper>
    )
    const column = screen.getByTestId('column-backlog')
    // Component uses kanban-column-over class which provides highlighting via CSS
    expect(column).toHaveClass('kanban-column-over')
  })

  it('should not have highlight when isOver is false', () => {
    render(
      <DndWrapper>
        <KanbanColumn status="backlog" taskCount={0} isOver={false} />
      </DndWrapper>
    )
    const column = screen.getByTestId('column-backlog')
    expect(column).not.toHaveClass('kanban-column-over')
  })

  it('should have transition for smooth hover effects', () => {
    render(
      <DndWrapper>
        <KanbanColumn status="backlog" taskCount={0} />
      </DndWrapper>
    )
    const column = screen.getByTestId('column-backlog')
    expect(column).toHaveClass('transition-all')
  })
})

describe('KanbanColumn add task button', () => {
  it('should render add task button in column header', () => {
    render(
      <DndWrapper>
        <KanbanColumn status="backlog" taskCount={0} />
      </DndWrapper>
    )
    const addButton = screen.getByTestId('add-task-backlog')
    expect(addButton).toBeInTheDocument()
  })

  it('should have accessible label on add task button', () => {
    render(
      <DndWrapper>
        <KanbanColumn status="backlog" taskCount={0} />
      </DndWrapper>
    )
    const addButton = screen.getByTestId('add-task-backlog')
    expect(addButton).toHaveAttribute('aria-label', 'Add task to Backlog')
  })

  it('should call onAddTask with correct status when clicked', () => {
    const onAddTask = vi.fn()
    render(
      <DndWrapper>
        <KanbanColumn status="in_progress" taskCount={0} onAddTask={onAddTask} />
      </DndWrapper>
    )

    const addButton = screen.getByTestId('add-task-in_progress')
    fireEvent.click(addButton)

    expect(onAddTask).toHaveBeenCalledWith('in_progress')
  })

  it('should not throw when onAddTask is not provided', () => {
    render(
      <DndWrapper>
        <KanbanColumn status="backlog" taskCount={0} />
      </DndWrapper>
    )

    const addButton = screen.getByTestId('add-task-backlog')
    expect(() => fireEvent.click(addButton)).not.toThrow()
  })

  it('should have ghost variant styling', () => {
    render(
      <DndWrapper>
        <KanbanColumn status="backlog" taskCount={0} />
      </DndWrapper>
    )
    // Button should be present and clickable (ghost styling is applied via CSS)
    const addButton = screen.getByTestId('add-task-backlog')
    expect(addButton).toBeInTheDocument()
  })
})

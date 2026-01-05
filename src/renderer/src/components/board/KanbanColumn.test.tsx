import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { KanbanColumn, COLUMN_CONFIG } from './KanbanColumn'

describe('KanbanColumn', () => {
  it('should render column with correct title for backlog status', () => {
    render(<KanbanColumn status="backlog" taskCount={0} />)
    expect(screen.getByText('Backlog')).toBeInTheDocument()
  })

  it('should render column with correct title for in_progress status', () => {
    render(<KanbanColumn status="in_progress" taskCount={0} />)
    expect(screen.getByText('In Progress')).toBeInTheDocument()
  })

  it('should render column with correct title for review status', () => {
    render(<KanbanColumn status="review" taskCount={0} />)
    expect(screen.getByText('Review')).toBeInTheDocument()
  })

  it('should render column with correct title for done status', () => {
    render(<KanbanColumn status="done" taskCount={0} />)
    expect(screen.getByText('Done')).toBeInTheDocument()
  })

  it('should display task count', () => {
    render(<KanbanColumn status="backlog" taskCount={5} />)
    expect(screen.getByTestId('count-backlog')).toHaveTextContent('5')
  })

  it('should render children content', () => {
    render(
      <KanbanColumn status="backlog" taskCount={1}>
        <div data-testid="child-content">Task Card</div>
      </KanbanColumn>
    )
    expect(screen.getByTestId('child-content')).toBeInTheDocument()
  })

  it('should apply dark theme card background styling', () => {
    render(<KanbanColumn status="backlog" taskCount={0} />)
    const column = screen.getByTestId('column-backlog')
    expect(column).toHaveClass('bg-card')
  })

  it('should have border for visual separation', () => {
    render(<KanbanColumn status="backlog" taskCount={0} />)
    const column = screen.getByTestId('column-backlog')
    expect(column).toHaveClass('border', 'border-border')
  })

  it('should have overflow-y-auto for vertical scroll', () => {
    render(<KanbanColumn status="backlog" taskCount={0} />)
    const column = screen.getByTestId('column-backlog')
    const contentArea = column.querySelector('.overflow-y-auto')
    expect(contentArea).toBeInTheDocument()
  })
})

describe('COLUMN_CONFIG', () => {
  it('should have correct order for all statuses', () => {
    expect(COLUMN_CONFIG.backlog.order).toBe(1)
    expect(COLUMN_CONFIG.in_progress.order).toBe(2)
    expect(COLUMN_CONFIG.review.order).toBe(3)
    expect(COLUMN_CONFIG.done.order).toBe(4)
  })

  it('should have correct display titles', () => {
    expect(COLUMN_CONFIG.backlog.title).toBe('Backlog')
    expect(COLUMN_CONFIG.in_progress.title).toBe('In Progress')
    expect(COLUMN_CONFIG.review.title).toBe('Review')
    expect(COLUMN_CONFIG.done.title).toBe('Done')
  })
})

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MobileColumnHeader } from './MobileColumnHeader'

describe('MobileColumnHeader', () => {
  it('renders column title from COLUMN_CONFIG', () => {
    render(<MobileColumnHeader status="in_progress" count={3} onAddTask={vi.fn()} />)
    expect(screen.getByTestId('mobile-column-header-title-in_progress')).toHaveTextContent(
      'In Progress',
    )
  })

  it('renders task count badge', () => {
    render(<MobileColumnHeader status="backlog" count={7} onAddTask={vi.fn()} />)
    expect(screen.getByTestId('mobile-column-header-count-backlog')).toHaveTextContent('7')
  })

  it('fires onAddTask when Plus button is clicked', () => {
    const onAddTask = vi.fn()
    render(<MobileColumnHeader status="review" count={2} onAddTask={onAddTask} />)
    fireEvent.click(screen.getByTestId('mobile-column-header-add-review'))
    expect(onAddTask).toHaveBeenCalledTimes(1)
  })

  it('renders FileText icon only for create_story status', () => {
    const { rerender } = render(
      <MobileColumnHeader status="create_story" count={0} onAddTask={vi.fn()} />,
    )
    expect(screen.getByTestId('mobile-column-header-file-text-icon')).toBeInTheDocument()

    rerender(<MobileColumnHeader status="backlog" count={0} onAddTask={vi.fn()} />)
    expect(
      screen.queryByTestId('mobile-column-header-file-text-icon'),
    ).not.toBeInTheDocument()
  })

  it('Plus button has accessible aria-label', () => {
    render(<MobileColumnHeader status="done" count={5} onAddTask={vi.fn()} />)
    expect(screen.getByLabelText('Add task to Done')).toBeInTheDocument()
  })
})

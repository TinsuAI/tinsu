import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MobileEmptyState } from './MobileEmptyState'

describe('MobileEmptyState', () => {
  it('renders required title', () => {
    render(<MobileEmptyState title="No tasks" />)
    expect(screen.getByText('No tasks')).toBeInTheDocument()
  })

  it('renders optional subtitle', () => {
    render(<MobileEmptyState title="Empty" subtitle="Create something to get started." />)
    expect(screen.getByText('Create something to get started.')).toBeInTheDocument()
  })

  it('renders optional icon', () => {
    render(
      <MobileEmptyState
        title="Empty"
        icon={<span data-testid="icon">📭</span>}
      />,
    )
    expect(screen.getByTestId('icon')).toBeInTheDocument()
  })

  it('renders optional action and fires click', () => {
    const onClick = vi.fn()
    render(
      <MobileEmptyState
        title="Empty"
        action={<button onClick={onClick} data-testid="cta">Create</button>}
      />,
    )
    fireEvent.click(screen.getByTestId('cta'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('does not render subtitle when not provided', () => {
    render(<MobileEmptyState title="Empty" />)
    expect(screen.queryByRole('paragraph')).not.toBeInTheDocument()
  })
})

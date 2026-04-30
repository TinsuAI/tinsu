import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MobileTopAppBar } from './MobileTopAppBar'

describe('MobileTopAppBar', () => {
  it('renders projectName in the left slot', () => {
    render(<MobileTopAppBar projectName="TinSu" />)
    expect(screen.getByTestId('mobile-top-bar-project-name')).toHaveTextContent('TinSu')
  })

  it('renders title instead of projectName when both provided', () => {
    render(<MobileTopAppBar projectName="TinSu" title="Task Detail" />)
    expect(screen.getByTestId('mobile-top-bar-project-name')).toHaveTextContent('Task Detail')
  })

  it('renders back button and fires onClick when provided', () => {
    const onClick = vi.fn()
    render(<MobileTopAppBar backButton={{ onClick, ariaLabel: 'Go back' }} />)
    const btn = screen.getByTestId('mobile-top-bar-back-button')
    expect(btn).toBeInTheDocument()
    fireEvent.click(btn)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('renders status pill slot when provided', () => {
    render(
      <MobileTopAppBar
        projectName="TinSu"
        statusPill={<span data-testid="pill">Online</span>}
      />,
    )
    expect(screen.getByTestId('mobile-top-bar-status-pill')).toBeInTheDocument()
    expect(screen.getByTestId('pill')).toBeInTheDocument()
  })

  it('renders trailing actions slot when provided', () => {
    render(
      <MobileTopAppBar
        projectName="TinSu"
        trailingActions={<button data-testid="action">More</button>}
      />,
    )
    expect(screen.getByTestId('mobile-top-bar-trailing-actions')).toBeInTheDocument()
  })

  it('does not render back button when not provided', () => {
    render(<MobileTopAppBar projectName="TinSu" />)
    expect(screen.queryByTestId('mobile-top-bar-back-button')).not.toBeInTheDocument()
  })
})

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Header } from './Header'

describe('Header', () => {
  it('should render with TinSu title', () => {
    render(<Header />)
    expect(screen.getByText('TinSu')).toBeInTheDocument()
  })

  it('should render as a header element', () => {
    render(<Header />)
    const header = screen.getByRole('banner')
    expect(header).toBeInTheDocument()
  })

  it('should have sticky positioning classes', () => {
    render(<Header />)
    const header = screen.getByRole('banner')
    expect(header).toHaveClass('sticky', 'top-0')
  })

  it('should have 48px height (h-12)', () => {
    render(<Header />)
    const header = screen.getByRole('banner')
    expect(header).toHaveClass('h-12')
  })

  it('should accept custom className', () => {
    render(<Header className="custom-class" />)
    const header = screen.getByRole('banner')
    expect(header).toHaveClass('custom-class')
  })
})

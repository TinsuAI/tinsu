import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MainContent } from './MainContent'

describe('MainContent', () => {
  it('should render as main element', () => {
    render(<MainContent />)
    const main = screen.getByRole('main')
    expect(main).toBeInTheDocument()
  })

  it('should display default placeholder text when no children', () => {
    render(<MainContent />)
    expect(screen.getByText('Ready for development')).toBeInTheDocument()
  })

  it('should render children when provided', () => {
    render(<MainContent><div data-testid="child">Custom content</div></MainContent>)
    expect(screen.getByTestId('child')).toBeInTheDocument()
    expect(screen.getByText('Custom content')).toBeInTheDocument()
    expect(screen.queryByText('Ready for development')).not.toBeInTheDocument()
  })

  it('should have flex-1 class to fill available space', () => {
    render(<MainContent />)
    const main = screen.getByRole('main')
    expect(main).toHaveClass('flex-1')
  })

  it('should have overflow-auto for scrolling', () => {
    render(<MainContent />)
    const main = screen.getByRole('main')
    expect(main).toHaveClass('overflow-auto')
  })

  it('should accept custom className', () => {
    render(<MainContent className="custom-class" />)
    const main = screen.getByRole('main')
    expect(main).toHaveClass('custom-class')
  })
})

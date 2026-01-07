import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PhaseBadge } from './PhaseBadge'

describe('PhaseBadge', () => {
  it('renders phase number with total', () => {
    render(<PhaseBadge phaseNumber={1} totalPhases={5} />)

    expect(screen.getByText('1/5')).toBeInTheDocument()
  })

  it('uses default total of 5', () => {
    render(<PhaseBadge phaseNumber={3} />)

    expect(screen.getByText('3/5')).toBeInTheDocument()
  })

  it('renders all phase numbers correctly', () => {
    const phases: Array<1 | 2 | 3 | 4 | 5> = [1, 2, 3, 4, 5]

    phases.forEach((phase) => {
      const { unmount } = render(<PhaseBadge phaseNumber={phase} />)
      expect(screen.getByText(`${phase}/5`)).toBeInTheDocument()
      unmount()
    })
  })

  it('has correct styling classes', () => {
    render(<PhaseBadge phaseNumber={1} />)

    const badge = screen.getByTestId('phase-badge')
    expect(badge).toHaveClass('inline-flex')
    expect(badge).toHaveClass('items-center')
    expect(badge).toHaveClass('rounded-md')
    expect(badge).toHaveClass('border')
    expect(badge).toHaveClass('px-2')
    expect(badge).toHaveClass('py-0.5')
    expect(badge).toHaveClass('text-xs')
    expect(badge).toHaveClass('font-medium')
  })

  it('has planning-specific color classes (cyan theme)', () => {
    render(<PhaseBadge phaseNumber={1} />)

    const badge = screen.getByTestId('phase-badge')
    expect(badge).toHaveClass('bg-cyan-600/20')
    expect(badge).toHaveClass('text-cyan-400')
    expect(badge).toHaveClass('border-cyan-600/30')
  })

  it('has data-testid attribute', () => {
    render(<PhaseBadge phaseNumber={1} />)

    expect(screen.getByTestId('phase-badge')).toBeInTheDocument()
  })

  it('accepts custom className', () => {
    render(<PhaseBadge phaseNumber={1} className="custom-class" />)

    const badge = screen.getByTestId('phase-badge')
    expect(badge).toHaveClass('custom-class')
  })

  it('allows custom totalPhases', () => {
    render(<PhaseBadge phaseNumber={2} totalPhases={3} />)

    expect(screen.getByText('2/3')).toBeInTheDocument()
  })
})

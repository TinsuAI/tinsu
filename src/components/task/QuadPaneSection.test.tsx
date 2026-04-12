import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Terminal } from 'lucide-react'
import { QuadPaneSection } from './QuadPaneSection'

describe('QuadPaneSection', () => {
  const defaultProps = {
    title: 'Terminal',
    icon: Terminal,
    children: <div data-testid="section-content">Content</div>
  }

  it('renders section with title', () => {
    render(<QuadPaneSection {...defaultProps} />)

    expect(screen.getByText('Terminal')).toBeInTheDocument()
  })

  it('renders section content', () => {
    render(<QuadPaneSection {...defaultProps} />)

    expect(screen.getByTestId('section-content')).toBeInTheDocument()
  })

  it('renders with data-testid for section container', () => {
    render(<QuadPaneSection {...defaultProps} />)

    expect(screen.getByTestId('quad-pane-section')).toBeInTheDocument()
  })

  it('renders with data-section attribute', () => {
    render(<QuadPaneSection {...defaultProps} />)

    const section = screen.getByTestId('quad-pane-section')
    expect(section).toHaveAttribute('data-section', 'terminal')
  })

  it('renders header with data-testid', () => {
    render(<QuadPaneSection {...defaultProps} />)

    expect(screen.getByTestId('quad-pane-section-header')).toBeInTheDocument()
  })

  it('renders content area with data-testid', () => {
    render(<QuadPaneSection {...defaultProps} />)

    expect(screen.getByTestId('quad-pane-section-content')).toBeInTheDocument()
  })

  it('renders expand button when onExpand is provided', () => {
    const onExpand = vi.fn()
    render(<QuadPaneSection {...defaultProps} onExpand={onExpand} />)

    expect(screen.getByTestId('quad-pane-section-expand')).toBeInTheDocument()
  })

  it('does not render expand button when onExpand is not provided', () => {
    render(<QuadPaneSection {...defaultProps} />)

    expect(screen.queryByTestId('quad-pane-section-expand')).not.toBeInTheDocument()
  })

  it('calls onExpand when expand button is clicked', () => {
    const onExpand = vi.fn()
    render(<QuadPaneSection {...defaultProps} onExpand={onExpand} />)

    fireEvent.click(screen.getByTestId('quad-pane-section-expand'))
    expect(onExpand).toHaveBeenCalledTimes(1)
  })

  it('expand button has correct aria-label', () => {
    const onExpand = vi.fn()
    render(<QuadPaneSection {...defaultProps} onExpand={onExpand} />)

    const expandButton = screen.getByTestId('quad-pane-section-expand')
    expect(expandButton).toHaveAttribute('aria-label', 'Expand Terminal section')
  })

  it('applies custom className when provided', () => {
    render(<QuadPaneSection {...defaultProps} className="custom-class" />)

    const section = screen.getByTestId('quad-pane-section')
    expect(section).toHaveClass('custom-class')
  })

  it('applies expanded styling when isExpanded is true', () => {
    render(<QuadPaneSection {...defaultProps} isExpanded={true} />)

    const section = screen.getByTestId('quad-pane-section')
    expect(section).toHaveClass('border-cyan-500/40')
    expect(section).toHaveClass('bg-card/50')
  })

  it('does not apply expanded styling when isExpanded is false', () => {
    render(<QuadPaneSection {...defaultProps} isExpanded={false} />)

    const section = screen.getByTestId('quad-pane-section')
    expect(section).not.toHaveClass('border-cyan-500/40')
  })

  it('applies border and background styling', () => {
    render(<QuadPaneSection {...defaultProps} />)

    const section = screen.getByTestId('quad-pane-section')
    expect(section).toHaveClass('rounded-lg')
    expect(section).toHaveClass('border')
    expect(section).toHaveClass('border-border/30')
    expect(section).toHaveClass('bg-card/30')
  })

  it('content area is scrollable', () => {
    render(<QuadPaneSection {...defaultProps} />)

    const content = screen.getByTestId('quad-pane-section-content')
    expect(content).toHaveClass('overflow-auto')
    expect(content).toHaveClass('min-h-0')
    expect(content).toHaveClass('flex-1')
  })
})

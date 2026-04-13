import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { QuadPaneLayout } from './QuadPaneLayout'

describe('QuadPaneLayout', () => {
  const defaultProps = {
    terminal: <div data-testid="terminal-content">Terminal</div>,
    activities: <div data-testid="activities-content">Activities</div>,
    diff: <div data-testid="diff-content">Diff</div>,
    content: <div data-testid="content-content">Content</div>
  }

  it('renders all four sections', () => {
    render(<QuadPaneLayout {...defaultProps} />)

    expect(screen.getByTestId('terminal-content')).toBeInTheDocument()
    expect(screen.getByTestId('activities-content')).toBeInTheDocument()
    expect(screen.getByTestId('diff-content')).toBeInTheDocument()
    expect(screen.getByTestId('content-content')).toBeInTheDocument()
  })

  it('renders with data-testid for layout container', () => {
    render(<QuadPaneLayout {...defaultProps} />)

    expect(screen.getByTestId('quad-pane-layout')).toBeInTheDocument()
  })

  it('renders terminal in top-left position', () => {
    render(<QuadPaneLayout {...defaultProps} />)

    const terminalPane = screen.getByTestId('quad-pane-terminal')
    expect(terminalPane).toBeInTheDocument()
    expect(terminalPane).toContainElement(screen.getByTestId('terminal-content'))
  })

  it('renders activities in top-right position', () => {
    render(<QuadPaneLayout {...defaultProps} />)

    const activitiesPane = screen.getByTestId('quad-pane-activities')
    expect(activitiesPane).toBeInTheDocument()
    expect(activitiesPane).toContainElement(screen.getByTestId('activities-content'))
  })

  it('renders diff in bottom-left position', () => {
    render(<QuadPaneLayout {...defaultProps} />)

    const diffPane = screen.getByTestId('quad-pane-diff')
    expect(diffPane).toBeInTheDocument()
    expect(diffPane).toContainElement(screen.getByTestId('diff-content'))
  })

  it('renders content in bottom-right position', () => {
    render(<QuadPaneLayout {...defaultProps} />)

    const contentPane = screen.getByTestId('quad-pane-content')
    expect(contentPane).toBeInTheDocument()
    expect(contentPane).toContainElement(screen.getByTestId('content-content'))
  })

  it('applies custom className when provided', () => {
    render(<QuadPaneLayout {...defaultProps} className="custom-class" />)

    const layout = screen.getByTestId('quad-pane-layout')
    expect(layout).toHaveClass('custom-class')
  })

  it('applies CSS Grid layout classes', () => {
    render(<QuadPaneLayout {...defaultProps} />)

    const layout = screen.getByTestId('quad-pane-layout')
    expect(layout).toHaveClass('grid')
    expect(layout).toHaveClass('grid-cols-2')
    expect(layout).toHaveClass('grid-rows-2')
    expect(layout).toHaveClass('h-full')
    expect(layout).toHaveClass('gap-3')
  })

  it('applies min-h-0 to all pane containers', () => {
    render(<QuadPaneLayout {...defaultProps} />)

    const terminalPane = screen.getByTestId('quad-pane-terminal')
    const activitiesPane = screen.getByTestId('quad-pane-activities')
    const diffPane = screen.getByTestId('quad-pane-diff')
    const contentPane = screen.getByTestId('quad-pane-content')

    expect(terminalPane).toHaveClass('min-h-0')
    expect(activitiesPane).toHaveClass('min-h-0')
    expect(diffPane).toHaveClass('min-h-0')
    expect(contentPane).toHaveClass('min-h-0')
  })
})

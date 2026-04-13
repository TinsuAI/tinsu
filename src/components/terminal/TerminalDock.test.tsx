import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TerminalDock } from './TerminalDock'
import { useTerminalStore } from '@renderer/stores/terminal.store'

// Mock the useTerminal hook
vi.mock('@renderer/hooks/useTerminal', () => ({
  useTerminal: () => ({
    spawn: vi.fn(),
    write: vi.fn(),
    kill: vi.fn(),
    resize: vi.fn(),
    isRunning: false,
    processId: null
  })
}))

// Mock XTerminal component to avoid xterm.js DOM requirements
vi.mock('./XTerminal', () => ({
  XTerminal: vi.fn(() => <div data-testid="mock-xterminal">Mock XTerminal</div>)
}))

describe('TerminalDock', () => {
  beforeEach(() => {
    // Reset store to default state
    useTerminalStore.setState({
      isExpanded: true,
      height: 300,
      activeProcessId: null
    })
  })

  it('should render the terminal dock', () => {
    render(<TerminalDock />)
    expect(screen.getByTestId('terminal-dock')).toBeInTheDocument()
  })

  it('should render Terminal header text', () => {
    render(<TerminalDock />)
    expect(screen.getByText('Terminal')).toBeInTheDocument()
  })

  it('should render collapse/expand toggle button', () => {
    render(<TerminalDock />)
    expect(screen.getByTestId('terminal-toggle')).toBeInTheDocument()
    expect(screen.getByLabelText('Collapse terminal')).toBeInTheDocument()
  })

  it('should show expand button when collapsed', () => {
    useTerminalStore.setState({ isExpanded: false })
    render(<TerminalDock />)
    expect(screen.getByLabelText('Expand terminal')).toBeInTheDocument()
  })

  it('should toggle expanded state when toggle button is clicked', () => {
    render(<TerminalDock />)
    const toggle = screen.getByTestId('terminal-toggle')

    expect(useTerminalStore.getState().isExpanded).toBe(true)

    fireEvent.click(toggle)
    expect(useTerminalStore.getState().isExpanded).toBe(false)

    fireEvent.click(toggle)
    expect(useTerminalStore.getState().isExpanded).toBe(true)
  })

  it('should render resize handle when expanded', () => {
    render(<TerminalDock />)
    expect(screen.getByTestId('terminal-resize-handle')).toBeInTheDocument()
  })

  it('should not render resize handle when collapsed', () => {
    useTerminalStore.setState({ isExpanded: false })
    render(<TerminalDock />)
    expect(screen.queryByTestId('terminal-resize-handle')).not.toBeInTheDocument()
  })

  it('should render XTerminal when expanded', () => {
    render(<TerminalDock />)
    expect(screen.getByTestId('mock-xterminal')).toBeInTheDocument()
  })

  it('should not render XTerminal when collapsed', () => {
    useTerminalStore.setState({ isExpanded: false })
    render(<TerminalDock />)
    expect(screen.queryByTestId('mock-xterminal')).not.toBeInTheDocument()
  })

  it('should apply height from store when expanded', () => {
    useTerminalStore.setState({ height: 400 })
    render(<TerminalDock />)
    const dock = screen.getByTestId('terminal-dock')
    expect(dock).toHaveStyle({ height: '400px' })
  })

  it('should apply minimum height (80px) when collapsed', () => {
    useTerminalStore.setState({ isExpanded: false, height: 400 })
    render(<TerminalDock />)
    const dock = screen.getByTestId('terminal-dock')
    expect(dock).toHaveStyle({ height: '80px' })
  })

  it('should render start shell button when not running', () => {
    render(<TerminalDock />)
    expect(screen.getByLabelText('Start shell')).toBeInTheDocument()
  })

  it('should have accessible aria attributes on toggle button', () => {
    render(<TerminalDock />)
    const toggle = screen.getByTestId('terminal-toggle')
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(toggle).toHaveAttribute('aria-label', 'Collapse terminal')
  })

  it('should have accessible aria attributes on resize handle', () => {
    render(<TerminalDock />)
    const resizeHandle = screen.getByTestId('terminal-resize-handle')
    expect(resizeHandle).toHaveAttribute('role', 'separator')
    expect(resizeHandle).toHaveAttribute('aria-label', 'Resize terminal')
    expect(resizeHandle).toHaveAttribute('aria-orientation', 'horizontal')
  })

  describe('resize functionality', () => {
    it('should update height on drag', () => {
      useTerminalStore.setState({ height: 300 })
      render(<TerminalDock />)

      const resizeHandle = screen.getByTestId('terminal-resize-handle')

      // Simulate drag up (increasing height)
      fireEvent.mouseDown(resizeHandle, { clientY: 500 })

      // Simulate mouse move
      const mouseMoveEvent = new MouseEvent('mousemove', {
        clientY: 400, // 100px up
        bubbles: true
      })
      document.dispatchEvent(mouseMoveEvent)

      // Simulate mouse up
      const mouseUpEvent = new MouseEvent('mouseup', { bubbles: true })
      document.dispatchEvent(mouseUpEvent)

      // Height should have increased
      expect(useTerminalStore.getState().height).toBeGreaterThan(300)
    })

    it('should constrain height to minimum 80px', () => {
      useTerminalStore.setState({ height: 100 })
      render(<TerminalDock />)

      const resizeHandle = screen.getByTestId('terminal-resize-handle')

      // Simulate drag down (decreasing height)
      fireEvent.mouseDown(resizeHandle, { clientY: 500 })

      const mouseMoveEvent = new MouseEvent('mousemove', {
        clientY: 600, // 100px down
        bubbles: true
      })
      document.dispatchEvent(mouseMoveEvent)

      const mouseUpEvent = new MouseEvent('mouseup', { bubbles: true })
      document.dispatchEvent(mouseUpEvent)

      // Height should be at minimum
      expect(useTerminalStore.getState().height).toBeGreaterThanOrEqual(80)
    })
  })
})

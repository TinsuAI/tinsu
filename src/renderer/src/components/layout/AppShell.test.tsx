import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AppShell } from './AppShell'
import { useUIStore } from '@renderer/stores/ui.store'
import { useTerminalStore } from '@renderer/stores/terminal.store'

// Mock the TerminalDock to avoid xterm.js and tRPC dependencies
vi.mock('@renderer/components/terminal', () => ({
  TerminalDock: () => <div data-testid="terminal-dock">Mock TerminalDock</div>
}))

describe('AppShell', () => {
  beforeEach(() => {
    useUIStore.setState({ sidebarCollapsed: false })
    useTerminalStore.setState({
      isExpanded: true,
      height: 300,
      activeProcessId: null
    })
  })

  it('should render header with TinSu title', () => {
    render(<AppShell />)
    expect(screen.getByText('TinSu')).toBeInTheDocument()
  })

  it('should render sidebar', () => {
    render(<AppShell />)
    const sidebar = screen.getByRole('complementary')
    expect(sidebar).toBeInTheDocument()
  })

  it('should render main content area', () => {
    render(<AppShell />)
    const main = screen.getByRole('main')
    expect(main).toBeInTheDocument()
  })

  it('should display default placeholder text', () => {
    render(<AppShell />)
    expect(screen.getByText('Ready for development')).toBeInTheDocument()
  })

  it('should render children in main content', () => {
    render(
      <AppShell>
        <div data-testid="child">Custom content</div>
      </AppShell>
    )
    expect(screen.getByTestId('child')).toBeInTheDocument()
    expect(screen.queryByText('Ready for development')).not.toBeInTheDocument()
  })

  it('should have min-width of 1024px', () => {
    render(<AppShell />)
    const container = screen.getByRole('banner').parentElement
    expect(container).toHaveClass('min-w-[1024px]')
  })

  it('should have min-h-screen for full viewport height', () => {
    render(<AppShell />)
    const container = screen.getByRole('banner').parentElement
    expect(container).toHaveClass('min-h-screen')
  })

  it('should have correct layout structure', () => {
    render(<AppShell />)
    const header = screen.getByRole('banner')
    const sidebar = screen.getByRole('complementary')
    const main = screen.getByRole('main')

    // All elements should be in the document
    expect(header).toBeInTheDocument()
    expect(sidebar).toBeInTheDocument()
    expect(main).toBeInTheDocument()
  })

  it('should render terminal dock', () => {
    render(<AppShell />)
    expect(screen.getByTestId('terminal-dock')).toBeInTheDocument()
  })

  it('should apply bottom padding based on terminal height', () => {
    useTerminalStore.setState({ isExpanded: true, height: 350 })
    render(<AppShell />)
    // The flex container should have padding-bottom equal to terminal height
    const flexContainer = screen.getByRole('complementary').parentElement
    expect(flexContainer).toHaveStyle({ paddingBottom: '350px' })
  })

  it('should apply minimum padding when terminal is collapsed', () => {
    useTerminalStore.setState({ isExpanded: false, height: 350 })
    render(<AppShell />)
    // When collapsed, minimum height is 80px
    const flexContainer = screen.getByRole('complementary').parentElement
    expect(flexContainer).toHaveStyle({ paddingBottom: '80px' })
  })
})

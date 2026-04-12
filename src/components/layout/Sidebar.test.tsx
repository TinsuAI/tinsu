import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Sidebar } from './Sidebar'
import { useUIStore } from '@renderer/stores/ui.store'
import { usePlanningWorkspaceStore } from '@renderer/stores'

// Mock SprintList to avoid tRPC dependency
vi.mock('@renderer/components/sidebar/SprintList', () => ({
  SprintList: () => <div data-testid="sprint-list">Sprint List</div>
}))


describe('Sidebar', () => {
  beforeEach(() => {
    // Reset store state before each test
    useUIStore.setState({ sidebarCollapsed: false, selectedSprintId: null })
    usePlanningWorkspaceStore.setState({ isOpen: false, activePhase: 'analysis', selectedWorkflowKey: null })
  })

  it('should render as aside element', () => {
    render(<Sidebar />)
    const sidebar = screen.getByRole('complementary')
    expect(sidebar).toBeInTheDocument()
  })

  it('should render with 240px width (w-60) when expanded', () => {
    render(<Sidebar />)
    const sidebar = screen.getByRole('complementary')
    expect(sidebar).toHaveClass('w-60')
    expect(sidebar).not.toHaveClass('w-16')
  })

  it('should render with 64px width (w-16) when collapsed', () => {
    useUIStore.setState({ sidebarCollapsed: true, selectedSprintId: null })
    render(<Sidebar />)
    const sidebar = screen.getByRole('complementary')
    expect(sidebar).toHaveClass('w-16')
    expect(sidebar).not.toHaveClass('w-60')
  })

  it('should have toggle button with correct aria-label when expanded', () => {
    render(<Sidebar />)
    const button = screen.getByRole('button', { name: 'Collapse sidebar' })
    expect(button).toBeInTheDocument()
    expect(button).toHaveAttribute('aria-expanded', 'true')
  })

  it('should have toggle button with correct aria-label when collapsed', () => {
    useUIStore.setState({ sidebarCollapsed: true, selectedSprintId: null })
    render(<Sidebar />)
    const button = screen.getByRole('button', { name: 'Expand sidebar' })
    expect(button).toBeInTheDocument()
    expect(button).toHaveAttribute('aria-expanded', 'false')
  })

  it('should toggle sidebar when button is clicked', () => {
    render(<Sidebar />)
    const button = screen.getByRole('button', { name: 'Collapse sidebar' })

    fireEvent.click(button)
    expect(useUIStore.getState().sidebarCollapsed).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Expand sidebar' }))
    expect(useUIStore.getState().sidebarCollapsed).toBe(false)
  })

  it('should be keyboard accessible (button handles Enter/Space natively)', () => {
    render(<Sidebar />)
    const button = screen.getByRole('button', { name: 'Collapse sidebar' })
    // Native button elements automatically handle Enter/Space key events
    expect(button.tagName).toBe('BUTTON')
  })

  it('should have visible focus ring classes on toggle button', () => {
    render(<Sidebar />)
    const button = screen.getByRole('button', { name: 'Collapse sidebar' })
    expect(button).toHaveClass('focus-visible:ring-2')
  })

  it('should have transition animation classes with reduced motion support', () => {
    render(<Sidebar />)
    const sidebar = screen.getByRole('complementary')
    expect(sidebar).toHaveClass(
      'transition-[width]',
      'duration-150',
      'ease-in-out',
      'motion-reduce:transition-none'
    )
  })

  // Story 9.1: Planning button tests
  describe('Planning button (Story 9.1)', () => {
    it('should render Planning button with text when expanded', () => {
      render(<Sidebar />)
      const planningButton = screen.getByTestId('sidebar-planning-button')
      expect(planningButton).toBeInTheDocument()
      expect(screen.getByText('Planning')).toBeInTheDocument()
    })

    it('should render Planning button without text when collapsed', () => {
      useUIStore.setState({ sidebarCollapsed: true, selectedSprintId: null })
      render(<Sidebar />)
      const planningButton = screen.getByTestId('sidebar-planning-button')
      expect(planningButton).toBeInTheDocument()
      expect(screen.queryByText('Planning')).not.toBeInTheDocument()
    })

    it('should call openWorkspace when Planning button is clicked', () => {
      render(<Sidebar />)
      const planningButton = screen.getByTestId('sidebar-planning-button')

      fireEvent.click(planningButton)

      expect(usePlanningWorkspaceStore.getState().isOpen).toBe(true)
    })

    it('should have active styling when planning workspace is open', () => {
      usePlanningWorkspaceStore.setState({ isOpen: true })
      render(<Sidebar />)
      const planningButton = screen.getByTestId('sidebar-planning-button')
      expect(planningButton).toHaveClass('bg-accent')
    })
  })
})

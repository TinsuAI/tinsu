import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Sidebar } from './Sidebar'
import { useUIStore } from '@renderer/stores/ui.store'

// Mock tRPC for SprintList
vi.mock('@renderer/lib/trpc', () => ({
  trpc: {
    sprints: {
      getAll: {
        useQuery: () => ({
          data: [],
          isLoading: false
        })
      }
    }
  }
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('Sidebar', () => {
  beforeEach(() => {
    // Reset store state before each test
    useUIStore.setState({ sidebarCollapsed: false, selectedSprintId: null })
  })

  it('should render as aside element', () => {
    render(<Sidebar />, { wrapper: createWrapper() })
    const sidebar = screen.getByRole('complementary')
    expect(sidebar).toBeInTheDocument()
  })

  it('should render with 240px width (w-60) when expanded', () => {
    render(<Sidebar />, { wrapper: createWrapper() })
    const sidebar = screen.getByRole('complementary')
    expect(sidebar).toHaveClass('w-60')
    expect(sidebar).not.toHaveClass('w-16')
  })

  it('should render with 64px width (w-16) when collapsed', () => {
    useUIStore.setState({ sidebarCollapsed: true, selectedSprintId: null })
    render(<Sidebar />, { wrapper: createWrapper() })
    const sidebar = screen.getByRole('complementary')
    expect(sidebar).toHaveClass('w-16')
    expect(sidebar).not.toHaveClass('w-60')
  })

  it('should have toggle button with correct aria-label when expanded', () => {
    render(<Sidebar />, { wrapper: createWrapper() })
    const button = screen.getByRole('button', { name: 'Collapse sidebar' })
    expect(button).toBeInTheDocument()
    expect(button).toHaveAttribute('aria-expanded', 'true')
  })

  it('should have toggle button with correct aria-label when collapsed', () => {
    useUIStore.setState({ sidebarCollapsed: true, selectedSprintId: null })
    render(<Sidebar />, { wrapper: createWrapper() })
    const button = screen.getByRole('button', { name: 'Expand sidebar' })
    expect(button).toBeInTheDocument()
    expect(button).toHaveAttribute('aria-expanded', 'false')
  })

  it('should toggle sidebar when button is clicked', () => {
    render(<Sidebar />, { wrapper: createWrapper() })
    const button = screen.getByRole('button', { name: 'Collapse sidebar' })

    fireEvent.click(button)
    expect(useUIStore.getState().sidebarCollapsed).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Expand sidebar' }))
    expect(useUIStore.getState().sidebarCollapsed).toBe(false)
  })

  it('should be keyboard accessible (button handles Enter/Space natively)', () => {
    render(<Sidebar />, { wrapper: createWrapper() })
    const button = screen.getByRole('button', { name: 'Collapse sidebar' })
    // Native button elements automatically handle Enter/Space key events
    expect(button.tagName).toBe('BUTTON')
  })

  it('should have visible focus ring classes on toggle button', () => {
    render(<Sidebar />, { wrapper: createWrapper() })
    const button = screen.getByRole('button', { name: 'Collapse sidebar' })
    expect(button).toHaveClass('focus-visible:ring-2')
  })

  it('should have transition animation classes with reduced motion support', () => {
    render(<Sidebar />, { wrapper: createWrapper() })
    const sidebar = screen.getByRole('complementary')
    expect(sidebar).toHaveClass(
      'transition-[width]',
      'duration-150',
      'ease-in-out',
      'motion-reduce:transition-none'
    )
  })
})

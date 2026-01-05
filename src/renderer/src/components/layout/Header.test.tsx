import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Header } from './Header'
import { useProjectStore } from '@renderer/stores/project.store'

describe('Header', () => {
  beforeEach(() => {
    // Reset project store before each test
    useProjectStore.setState({
      projectPath: null,
      projectName: null
    })
  })

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

  it('should display project name when loaded', () => {
    useProjectStore.setState({ projectName: 'MyProject' })

    render(<Header />)

    expect(screen.getByText('TinSu')).toBeInTheDocument()
    expect(screen.getByText('- MyProject')).toBeInTheDocument()
  })

  it('should not display project name when no project loaded', () => {
    render(<Header />)

    expect(screen.getByText('TinSu')).toBeInTheDocument()
    expect(screen.queryByText(/-/)).not.toBeInTheDocument()
  })

  it('should render Open Project button when onOpenProject is provided', () => {
    const onOpenProject = vi.fn()

    render(<Header onOpenProject={onOpenProject} />)

    const button = screen.getByText('Open Project...')
    expect(button).toBeInTheDocument()
  })

  it('should call onOpenProject when button is clicked', () => {
    const onOpenProject = vi.fn()

    render(<Header onOpenProject={onOpenProject} />)

    const button = screen.getByText('Open Project...')
    fireEvent.click(button)

    expect(onOpenProject).toHaveBeenCalled()
  })

  it('should not render Open Project button when onOpenProject is not provided', () => {
    render(<Header />)

    expect(screen.queryByText('Open Project...')).not.toBeInTheDocument()
  })
})

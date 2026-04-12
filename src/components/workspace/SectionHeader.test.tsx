import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FileText } from 'lucide-react'
import { SectionHeader } from './SectionHeader'

describe('SectionHeader', () => {
  it('renders title and icon', () => {
    render(<SectionHeader icon={FileText} title="Content" />)

    expect(screen.getByText('Content')).toBeInTheDocument()
    // Icon should be present (SVG element)
    const header = screen.getByTestId('section-header-content')
    expect(header.querySelector('svg')).toBeInTheDocument()
  })

  it('renders expand button when onExpand is provided', () => {
    const onExpand = vi.fn()
    render(<SectionHeader icon={FileText} title="Content" onExpand={onExpand} />)

    const expandButton = screen.getByLabelText('Expand Content')
    expect(expandButton).toBeInTheDocument()
  })

  it('does not render expand button when onExpand is not provided', () => {
    render(<SectionHeader icon={FileText} title="Content" />)

    expect(screen.queryByLabelText('Expand Content')).not.toBeInTheDocument()
  })

  it('calls onExpand when expand button is clicked', () => {
    const onExpand = vi.fn()
    render(<SectionHeader icon={FileText} title="Content" onExpand={onExpand} />)

    const expandButton = screen.getByLabelText('Expand Content')
    fireEvent.click(expandButton)

    expect(onExpand).toHaveBeenCalledTimes(1)
  })

  it('calls onCollapse when collapse button is clicked in expanded state', () => {
    const onCollapse = vi.fn()
    render(
      <SectionHeader icon={FileText} title="Content" isExpanded onCollapse={onCollapse} />
    )

    const collapseButton = screen.getByLabelText('Collapse Content')
    fireEvent.click(collapseButton)

    expect(onCollapse).toHaveBeenCalledTimes(1)
  })

  it('shows minimize icon when expanded', () => {
    const onCollapse = vi.fn()
    render(
      <SectionHeader icon={FileText} title="Content" isExpanded onCollapse={onCollapse} />
    )

    // Should show collapse button with minimize icon
    expect(screen.getByLabelText('Collapse Content')).toBeInTheDocument()
  })

  it('shows maximize icon when not expanded', () => {
    const onExpand = vi.fn()
    render(<SectionHeader icon={FileText} title="Content" onExpand={onExpand} />)

    // Should show expand button with maximize icon
    expect(screen.getByLabelText('Expand Content')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    render(<SectionHeader icon={FileText} title="Content" className="custom-class" />)

    const header = screen.getByTestId('section-header-content')
    expect(header).toHaveClass('custom-class')
  })

  it('has compact height (h-8)', () => {
    render(<SectionHeader icon={FileText} title="Content" />)

    const header = screen.getByTestId('section-header-content')
    expect(header).toHaveClass('h-8')
  })
})

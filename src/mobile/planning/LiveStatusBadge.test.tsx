import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LiveStatusBadge } from './LiveStatusBadge'

describe('LiveStatusBadge', () => {
  it('renders "Thinking" for thinking status with animate-pulse', () => {
    render(<LiveStatusBadge liveStatus="thinking" />)
    const badge = screen.getByText('Thinking').closest('span')
    expect(badge).toBeInTheDocument()
    expect(badge?.className).toContain('animate-pulse')
  })

  it('renders "Idle" for idle status (emerald color)', () => {
    render(<LiveStatusBadge liveStatus="idle" />)
    const badge = screen.getByText('Idle').closest('span')
    expect(badge).toBeInTheDocument()
    expect(badge?.className).toContain('emerald')
  })

  it('renders "Done" for completed status', () => {
    render(<LiveStatusBadge liveStatus="completed" />)
    expect(screen.getByText('Done')).toBeInTheDocument()
  })

  it('renders "Exited" for exited status (amber)', () => {
    render(<LiveStatusBadge liveStatus="exited" />)
    const badge = screen.getByText('Exited').closest('span')
    expect(badge).toBeInTheDocument()
    expect(badge?.className).toContain('amber')
  })

  it('renders nothing for "unknown" status', () => {
    const { container } = render(<LiveStatusBadge liveStatus="unknown" />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing for undefined status', () => {
    const { container } = render(<LiveStatusBadge liveStatus={undefined} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing for an unrecognized status', () => {
    const { container } = render(<LiveStatusBadge liveStatus="some-random-status" />)
    expect(container.firstChild).toBeNull()
  })
})

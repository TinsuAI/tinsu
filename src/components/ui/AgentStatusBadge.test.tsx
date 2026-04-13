import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AgentStatusBadge, type AgentStatus } from './AgentStatusBadge'

describe('AgentStatusBadge', () => {
  const statuses: AgentStatus[] = ['idle', 'running', 'stalled', 'review', 'done', 'error']

  it.each(statuses)('should render %s status badge', (status) => {
    render(<AgentStatusBadge status={status} />)

    const badge = screen.getByTestId(`agent-status-${status}`)
    expect(badge).toBeInTheDocument()
  })

  describe('Idle status', () => {
    it('should render with gray/muted styling', () => {
      render(<AgentStatusBadge status="idle" />)

      const badge = screen.getByTestId('agent-status-idle')
      expect(badge).toHaveClass('text-muted-foreground')
    })

    it('should have an icon (not color alone for accessibility)', () => {
      render(<AgentStatusBadge status="idle" />)

      // Check for SVG icon presence
      const badge = screen.getByTestId('agent-status-idle')
      expect(badge.querySelector('svg')).toBeInTheDocument()
    })
  })

  describe('Running status', () => {
    it('should render with green styling', () => {
      render(<AgentStatusBadge status="running" />)

      const badge = screen.getByTestId('agent-status-running')
      expect(badge).toHaveClass('text-green-500')
    })

    it('should have an icon', () => {
      render(<AgentStatusBadge status="running" />)

      const badge = screen.getByTestId('agent-status-running')
      expect(badge.querySelector('svg')).toBeInTheDocument()
    })
  })

  describe('Stalled status', () => {
    it('should render with yellow/amber styling', () => {
      render(<AgentStatusBadge status="stalled" />)

      const badge = screen.getByTestId('agent-status-stalled')
      expect(badge).toHaveClass('text-amber-500')
    })

    it('should have an icon', () => {
      render(<AgentStatusBadge status="stalled" />)

      const badge = screen.getByTestId('agent-status-stalled')
      expect(badge.querySelector('svg')).toBeInTheDocument()
    })
  })

  describe('Review status', () => {
    it('should render with purple styling', () => {
      render(<AgentStatusBadge status="review" />)

      const badge = screen.getByTestId('agent-status-review')
      expect(badge).toHaveClass('text-purple-500')
    })

    it('should have an icon', () => {
      render(<AgentStatusBadge status="review" />)

      const badge = screen.getByTestId('agent-status-review')
      expect(badge.querySelector('svg')).toBeInTheDocument()
    })
  })

  describe('Done status', () => {
    it('should render with green styling', () => {
      render(<AgentStatusBadge status="done" />)

      const badge = screen.getByTestId('agent-status-done')
      expect(badge).toHaveClass('text-green-500')
    })

    it('should have a checkmark icon', () => {
      render(<AgentStatusBadge status="done" />)

      const badge = screen.getByTestId('agent-status-done')
      expect(badge.querySelector('svg')).toBeInTheDocument()
    })
  })

  describe('Error status', () => {
    it('should render with red/destructive styling', () => {
      render(<AgentStatusBadge status="error" />)

      const badge = screen.getByTestId('agent-status-error')
      expect(badge).toHaveClass('text-destructive')
    })

    it('should have an icon', () => {
      render(<AgentStatusBadge status="error" />)

      const badge = screen.getByTestId('agent-status-error')
      expect(badge.querySelector('svg')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it.each(statuses)('should have title attribute for %s status', (status) => {
      render(<AgentStatusBadge status={status} />)

      const badge = screen.getByTestId(`agent-status-${status}`)
      expect(badge).toHaveAttribute('title')
    })

    it('should use icon + color (not color alone) for accessibility', () => {
      render(<AgentStatusBadge status="running" />)

      const badge = screen.getByTestId('agent-status-running')
      // Must have both an icon and color styling
      expect(badge.querySelector('svg')).toBeInTheDocument()
      expect(badge.className).toMatch(/text-/)
    })
  })

  describe('Styling', () => {
    it('should have consistent size for all statuses', () => {
      const { container } = render(
        <>
          {statuses.map((status) => (
            <AgentStatusBadge key={status} status={status} />
          ))}
        </>
      )

      // All badges should have icon size class
      const badges = container.querySelectorAll('[data-testid^="agent-status-"]')
      badges.forEach((badge) => {
        expect(badge.querySelector('svg')).toHaveClass('size-4')
      })
    })

    it('should accept additional className', () => {
      render(<AgentStatusBadge status="idle" className="custom-class" />)

      const badge = screen.getByTestId('agent-status-idle')
      expect(badge).toHaveClass('custom-class')
    })
  })
})

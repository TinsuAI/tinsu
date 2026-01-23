import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ApproveButton } from './ApproveButton'

describe('ApproveButton', () => {
  describe('rendering', () => {
    it('should render with Approve label', () => {
      render(<ApproveButton onClick={vi.fn()} />)

      expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument()
    })

    it('should render keyboard shortcut indicator "A"', () => {
      render(<ApproveButton onClick={vi.fn()} />)

      expect(screen.getByText('A')).toBeInTheDocument()
    })

    it('should render CheckCircle2 icon when not pending', () => {
      render(<ApproveButton onClick={vi.fn()} isPending={false} />)

      // The button should contain the CheckCircle2 icon (SVG)
      const button = screen.getByRole('button')
      const svg = button.querySelector('svg')
      expect(svg).toBeInTheDocument()
      // Verify it's not the loading spinner (animate-spin class)
      expect(svg).not.toHaveClass('animate-spin')
    })

    it('should render loading spinner when pending', () => {
      render(<ApproveButton onClick={vi.fn()} isPending={true} />)

      const button = screen.getByRole('button')
      const svg = button.querySelector('svg')
      expect(svg).toBeInTheDocument()
      // Verify it's the loading spinner (has animate-spin class)
      expect(svg).toHaveClass('animate-spin')
    })
  })

  describe('styling', () => {
    it('should have emerald/green background styling', () => {
      render(<ApproveButton onClick={vi.fn()} />)

      const button = screen.getByRole('button')
      expect(button).toHaveClass('bg-emerald-600')
    })

    it('should have white text', () => {
      render(<ApproveButton onClick={vi.fn()} />)

      const button = screen.getByRole('button')
      expect(button).toHaveClass('text-white')
    })

    it('should apply hover styling class', () => {
      render(<ApproveButton onClick={vi.fn()} />)

      const button = screen.getByRole('button')
      expect(button).toHaveClass('hover:bg-emerald-700')
    })

    it('should apply custom className', () => {
      render(<ApproveButton onClick={vi.fn()} className="my-custom-class" />)

      const button = screen.getByRole('button')
      expect(button).toHaveClass('my-custom-class')
    })
  })

  describe('disabled state', () => {
    it('should be disabled when disabled prop is true', () => {
      render(<ApproveButton onClick={vi.fn()} disabled={true} />)

      const button = screen.getByRole('button')
      expect(button).toBeDisabled()
    })

    it('should be disabled when isPending is true', () => {
      render(<ApproveButton onClick={vi.fn()} isPending={true} />)

      const button = screen.getByRole('button')
      expect(button).toBeDisabled()
    })

    it('should be enabled when not disabled and not pending', () => {
      render(<ApproveButton onClick={vi.fn()} disabled={false} isPending={false} />)

      const button = screen.getByRole('button')
      expect(button).not.toBeDisabled()
    })
  })

  describe('click handling', () => {
    it('should call onClick when clicked', () => {
      const handleClick = vi.fn()
      render(<ApproveButton onClick={handleClick} />)

      fireEvent.click(screen.getByRole('button'))

      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('should not call onClick when disabled', () => {
      const handleClick = vi.fn()
      render(<ApproveButton onClick={handleClick} disabled={true} />)

      fireEvent.click(screen.getByRole('button'))

      expect(handleClick).not.toHaveBeenCalled()
    })

    it('should not call onClick when pending', () => {
      const handleClick = vi.fn()
      render(<ApproveButton onClick={handleClick} isPending={true} />)

      fireEvent.click(screen.getByRole('button'))

      expect(handleClick).not.toHaveBeenCalled()
    })
  })

  describe('conflict state styling (MEDIUM-5 fix)', () => {
    it('should apply amber warning styling when hasConflict is true', () => {
      render(<ApproveButton onClick={vi.fn()} hasConflict={true} disabled={true} />)

      const button = screen.getByRole('button')
      expect(button).toHaveClass('bg-amber-600/20')
      expect(button).toHaveClass('border-amber-500/50')
      expect(button).toHaveClass('text-amber-300')
    })

    it('should apply emerald styling when hasConflict is false', () => {
      render(<ApproveButton onClick={vi.fn()} hasConflict={false} />)

      const button = screen.getByRole('button')
      expect(button).toHaveClass('bg-emerald-600')
      expect(button).not.toHaveClass('bg-amber-600/20')
    })

    it('should show tooltip explaining conflict when hasConflict is true', () => {
      render(<ApproveButton onClick={vi.fn()} hasConflict={true} disabled={true} />)

      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('title', 'Resolve merge conflicts before approving')
    })

    it('should not show tooltip when hasConflict is false', () => {
      render(<ApproveButton onClick={vi.fn()} hasConflict={false} />)

      const button = screen.getByRole('button')
      expect(button).not.toHaveAttribute('title')
    })
  })
})

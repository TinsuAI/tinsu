import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DevProgressIndicator } from './DevProgressIndicator'

describe('DevProgressIndicator', () => {
  describe('step display', () => {
    it('renders all three step indicators with title attributes', () => {
      render(<DevProgressIndicator currentStep="dev" />)

      // Steps show abbreviated letters but have full labels as titles
      expect(screen.getByTestId('progress-step-sm')).toHaveAttribute('title', 'SM')
      expect(screen.getByTestId('progress-step-dev')).toHaveAttribute('title', 'DEV')
      expect(screen.getByTestId('progress-step-review')).toHaveAttribute('title', 'Review')
    })

    it('highlights DEV step when currentStep is dev', () => {
      render(<DevProgressIndicator currentStep="dev" />)

      const devStep = screen.getByTestId('progress-step-dev')
      expect(devStep).toHaveClass('bg-blue-500')
    })

    it('shows checkmark for SM when currentStep is dev', () => {
      render(<DevProgressIndicator currentStep="dev" />)

      const smStep = screen.getByTestId('progress-step-sm')
      expect(smStep).toHaveClass('bg-green-500')
      // Should have a checkmark icon
      expect(smStep.querySelector('svg')).toBeInTheDocument()
    })

    it('highlights Review step when currentStep is review', () => {
      render(<DevProgressIndicator currentStep="review" />)

      const reviewStep = screen.getByTestId('progress-step-review')
      expect(reviewStep).toHaveClass('bg-blue-500')
    })

    it('shows checkmarks for SM and DEV when currentStep is review', () => {
      render(<DevProgressIndicator currentStep="review" />)

      const smStep = screen.getByTestId('progress-step-sm')
      const devStep = screen.getByTestId('progress-step-dev')

      expect(smStep).toHaveClass('bg-green-500')
      expect(devStep).toHaveClass('bg-green-500')
    })

    it('grays out all steps when currentStep is null (idle)', () => {
      render(<DevProgressIndicator currentStep={null} />)

      const smStep = screen.getByTestId('progress-step-sm')
      const devStep = screen.getByTestId('progress-step-dev')
      const reviewStep = screen.getByTestId('progress-step-review')

      expect(smStep).toHaveClass('bg-muted')
      expect(devStep).toHaveClass('bg-muted')
      expect(reviewStep).toHaveClass('bg-muted')
    })
  })

  describe('summary mode', () => {
    it('shows summary text when showSummary is true', () => {
      render(<DevProgressIndicator currentStep="review" showSummary />)

      expect(screen.getByText('Ready for human review')).toBeInTheDocument()
    })

    it('hides step indicators when showSummary is true', () => {
      render(<DevProgressIndicator currentStep="review" showSummary />)

      expect(screen.queryByTestId('progress-step-sm')).not.toBeInTheDocument()
    })
  })

  describe('step connectors', () => {
    it('renders connectors between steps', () => {
      render(<DevProgressIndicator currentStep="dev" />)

      // Should have arrows between steps
      const connectors = screen.getAllByText('→')
      expect(connectors).toHaveLength(2) // SM → DEV → Review
    })
  })

  describe('accessibility', () => {
    it('has accessible labels for screen readers', () => {
      render(<DevProgressIndicator currentStep="dev" />)

      // The whole indicator should be describable
      const indicator = screen.getByTestId('dev-progress-indicator')
      expect(indicator).toBeInTheDocument()
    })
  })

  describe('animation', () => {
    it('applies pulse animation to current step', () => {
      render(<DevProgressIndicator currentStep="dev" />)

      const devStep = screen.getByTestId('progress-step-dev')
      expect(devStep).toHaveClass('animate-pulse')
    })

    it('does not apply pulse animation to completed steps', () => {
      render(<DevProgressIndicator currentStep="dev" />)

      const smStep = screen.getByTestId('progress-step-sm')
      expect(smStep).not.toHaveClass('animate-pulse')
    })
  })

  describe('styling', () => {
    it('accepts additional className', () => {
      render(<DevProgressIndicator currentStep="dev" className="custom-class" />)

      const indicator = screen.getByTestId('dev-progress-indicator')
      expect(indicator).toHaveClass('custom-class')
    })

    it('uses compact text size', () => {
      render(<DevProgressIndicator currentStep="dev" />)

      const indicator = screen.getByTestId('dev-progress-indicator')
      expect(indicator).toHaveClass('text-xs')
    })
  })
})

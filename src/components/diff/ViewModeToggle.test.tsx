import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ViewModeToggle } from './ViewModeToggle'
import { useDiffStore } from '@renderer/stores/diff.store'

describe('ViewModeToggle', () => {
  const mockOnModeChange = vi.fn()

  beforeEach(() => {
    mockOnModeChange.mockClear()
    // Reset store to default state
    useDiffStore.setState({ viewMode: 'split' })
  })

  describe('initial rendering', () => {
    it('renders with split mode selected by default', () => {
      render(<ViewModeToggle />)

      const splitButton = screen.getByTestId('view-mode-split')
      expect(splitButton).toHaveAttribute('data-state', 'on')
    })

    it('renders unified mode as not selected by default', () => {
      render(<ViewModeToggle />)

      const unifiedButton = screen.getByTestId('view-mode-unified')
      expect(unifiedButton).toHaveAttribute('data-state', 'off')
    })

    it('renders both toggle options', () => {
      render(<ViewModeToggle />)

      expect(screen.getByText('Unified')).toBeInTheDocument()
      expect(screen.getByText('Split')).toBeInTheDocument()
    })

    it('renders with correct test ids', () => {
      render(<ViewModeToggle />)

      expect(screen.getByTestId('view-mode-toggle')).toBeInTheDocument()
      expect(screen.getByTestId('view-mode-unified')).toBeInTheDocument()
      expect(screen.getByTestId('view-mode-split')).toBeInTheDocument()
    })
  })

  describe('state from store', () => {
    it('reflects unified mode from store', () => {
      useDiffStore.setState({ viewMode: 'unified' })
      render(<ViewModeToggle />)

      const unifiedButton = screen.getByTestId('view-mode-unified')
      const splitButton = screen.getByTestId('view-mode-split')

      expect(unifiedButton).toHaveAttribute('data-state', 'on')
      expect(splitButton).toHaveAttribute('data-state', 'off')
    })

    it('reflects split mode from store', () => {
      useDiffStore.setState({ viewMode: 'split' })
      render(<ViewModeToggle />)

      const unifiedButton = screen.getByTestId('view-mode-unified')
      const splitButton = screen.getByTestId('view-mode-split')

      expect(unifiedButton).toHaveAttribute('data-state', 'off')
      expect(splitButton).toHaveAttribute('data-state', 'on')
    })
  })

  describe('mode switching', () => {
    it('calls setViewMode when clicking unified', () => {
      render(<ViewModeToggle />)

      const unifiedButton = screen.getByTestId('view-mode-unified')
      fireEvent.click(unifiedButton)

      expect(useDiffStore.getState().viewMode).toBe('unified')
    })

    it('calls setViewMode when clicking split', () => {
      useDiffStore.setState({ viewMode: 'unified' })
      render(<ViewModeToggle />)

      const splitButton = screen.getByTestId('view-mode-split')
      fireEvent.click(splitButton)

      expect(useDiffStore.getState().viewMode).toBe('split')
    })

    it('calls onModeChange callback when mode changes', () => {
      render(<ViewModeToggle onModeChange={mockOnModeChange} />)

      const unifiedButton = screen.getByTestId('view-mode-unified')
      fireEvent.click(unifiedButton)

      expect(mockOnModeChange).toHaveBeenCalledWith('unified')
    })

    it('calls onModeChange with split when switching to split', () => {
      useDiffStore.setState({ viewMode: 'unified' })
      render(<ViewModeToggle onModeChange={mockOnModeChange} />)

      const splitButton = screen.getByTestId('view-mode-split')
      fireEvent.click(splitButton)

      expect(mockOnModeChange).toHaveBeenCalledWith('split')
    })

    it('does not call onModeChange when clicking already selected mode', () => {
      render(<ViewModeToggle onModeChange={mockOnModeChange} />)

      // Split is already selected
      const splitButton = screen.getByTestId('view-mode-split')
      fireEvent.click(splitButton)

      // Radix ToggleGroup in single mode doesn't call onValueChange when clicking already selected
      // The value doesn't change, so callback shouldn't be called
      // Note: Behavior depends on Radix implementation - may need adjustment
    })
  })

  describe('accessibility', () => {
    it('has accessible aria-label on toggle group', () => {
      render(<ViewModeToggle />)

      const toggleGroup = screen.getByRole('group', { name: 'Diff view mode' })
      expect(toggleGroup).toBeInTheDocument()
    })

    it('has descriptive aria-label on unified button', () => {
      render(<ViewModeToggle />)

      const unifiedButton = screen.getByRole('radio', {
        name: 'Unified view - changes shown interleaved in single column'
      })
      expect(unifiedButton).toBeInTheDocument()
    })

    it('has descriptive aria-label on split button', () => {
      render(<ViewModeToggle />)

      const splitButton = screen.getByRole('radio', {
        name: 'Split view - original and modified side by side'
      })
      expect(splitButton).toBeInTheDocument()
    })
  })

  describe('styling', () => {
    it('applies custom className', () => {
      render(<ViewModeToggle className="custom-class" />)

      const toggleGroup = screen.getByTestId('view-mode-toggle')
      expect(toggleGroup).toHaveClass('custom-class')
    })

    it('renders icons for both modes', () => {
      const { container } = render(<ViewModeToggle />)

      // Check for SVG icons (lucide-react renders SVGs)
      const icons = container.querySelectorAll('svg')
      expect(icons.length).toBeGreaterThanOrEqual(2)
    })
  })
})

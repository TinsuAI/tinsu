import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DiffSummaryBar } from './DiffSummaryBar'

describe('DiffSummaryBar', () => {
  const mockOnRefresh = vi.fn()

  beforeEach(() => {
    mockOnRefresh.mockClear()
  })

  describe('summary format', () => {
    it('displays formatted summary with file and line counts', () => {
      render(
        <DiffSummaryBar
          summary={{ filesChanged: 3, linesAdded: 45, linesRemoved: 12 }}
          onRefresh={mockOnRefresh}
          isRefreshing={false}
        />
      )

      const summaryText = screen.getByTestId('diff-summary-text')
      expect(summaryText).toHaveTextContent('3 files changed')
      expect(summaryText).toHaveTextContent('+45 lines')
      expect(summaryText).toHaveTextContent('-12 lines')
    })

    it('includes new files in total count with all their lines as additions (AC2)', () => {
      // Simulates summary after GitService includes untracked files
      // Example: 2 modified files + 1 new file = 3 total
      // Modified: +20/-10, New file: +50/-0 = +70/-10 total
      render(
        <DiffSummaryBar
          summary={{ filesChanged: 3, linesAdded: 70, linesRemoved: 10 }}
          onRefresh={mockOnRefresh}
          isRefreshing={false}
        />
      )

      const summaryText = screen.getByTestId('diff-summary-text')
      // New files should be included in total file count
      expect(summaryText).toHaveTextContent('3 files changed')
      // All lines from new files should count as additions
      expect(summaryText).toHaveTextContent('+70 lines')
      expect(summaryText).toHaveTextContent('-10 lines')
    })

    it('handles singular file count', () => {
      render(
        <DiffSummaryBar
          summary={{ filesChanged: 1, linesAdded: 5, linesRemoved: 2 }}
          onRefresh={mockOnRefresh}
          isRefreshing={false}
        />
      )

      const summaryText = screen.getByTestId('diff-summary-text')
      expect(summaryText).toHaveTextContent('1 file changed')
      expect(summaryText).not.toHaveTextContent('1 files')
    })

    it('handles singular line counts', () => {
      render(
        <DiffSummaryBar
          summary={{ filesChanged: 2, linesAdded: 1, linesRemoved: 1 }}
          onRefresh={mockOnRefresh}
          isRefreshing={false}
        />
      )

      const summaryText = screen.getByTestId('diff-summary-text')
      expect(summaryText).toHaveTextContent('+1 line')
      expect(summaryText).toHaveTextContent('-1 line')
      expect(summaryText).not.toHaveTextContent('+1 lines')
      expect(summaryText).not.toHaveTextContent('-1 lines')
    })

    it('uses middle dot separator', () => {
      render(
        <DiffSummaryBar
          summary={{ filesChanged: 3, linesAdded: 45, linesRemoved: 12 }}
          onRefresh={mockOnRefresh}
          isRefreshing={false}
        />
      )

      const summaryText = screen.getByTestId('diff-summary-text')
      // Middle dot character (U+00B7)
      expect(summaryText.textContent).toContain('\u00B7')
    })
  })

  describe('edge cases', () => {
    it('handles zero files', () => {
      render(
        <DiffSummaryBar
          summary={{ filesChanged: 0, linesAdded: 0, linesRemoved: 0 }}
          onRefresh={mockOnRefresh}
          isRefreshing={false}
        />
      )

      const summaryText = screen.getByTestId('diff-summary-text')
      expect(summaryText).toHaveTextContent('0 files changed')
      expect(summaryText).toHaveTextContent('+0 lines')
      expect(summaryText).toHaveTextContent('-0 lines')
    })

    it('handles zero additions but non-zero deletions', () => {
      render(
        <DiffSummaryBar
          summary={{ filesChanged: 2, linesAdded: 0, linesRemoved: 15 }}
          onRefresh={mockOnRefresh}
          isRefreshing={false}
        />
      )

      const summaryText = screen.getByTestId('diff-summary-text')
      expect(summaryText).toHaveTextContent('+0 lines')
      expect(summaryText).toHaveTextContent('-15 lines')
    })

    it('handles zero deletions but non-zero additions', () => {
      render(
        <DiffSummaryBar
          summary={{ filesChanged: 3, linesAdded: 100, linesRemoved: 0 }}
          onRefresh={mockOnRefresh}
          isRefreshing={false}
        />
      )

      const summaryText = screen.getByTestId('diff-summary-text')
      expect(summaryText).toHaveTextContent('+100 lines')
      expect(summaryText).toHaveTextContent('-0 lines')
    })

    it('handles large numbers', () => {
      render(
        <DiffSummaryBar
          summary={{ filesChanged: 1234, linesAdded: 56789, linesRemoved: 98765 }}
          onRefresh={mockOnRefresh}
          isRefreshing={false}
        />
      )

      const summaryText = screen.getByTestId('diff-summary-text')
      expect(summaryText).toHaveTextContent('1234 files changed')
      expect(summaryText).toHaveTextContent('+56789 lines')
      expect(summaryText).toHaveTextContent('-98765 lines')
    })

    it('handles null summary gracefully', () => {
      render(<DiffSummaryBar summary={null} onRefresh={mockOnRefresh} isRefreshing={false} />)

      const summaryText = screen.getByTestId('diff-summary-text')
      expect(summaryText).toHaveTextContent('0 files changed')
      expect(summaryText).toHaveTextContent('+0 lines')
      expect(summaryText).toHaveTextContent('-0 lines')
    })

    it('handles undefined summary gracefully', () => {
      render(<DiffSummaryBar summary={undefined} onRefresh={mockOnRefresh} isRefreshing={false} />)

      const summaryText = screen.getByTestId('diff-summary-text')
      expect(summaryText).toHaveTextContent('0 files changed')
    })

    it('handles malformed summary with missing fields', () => {
      // Test partial data from malformed backend response
      const malformedSummary = {
        filesChanged: 2,
        linesAdded: undefined as any,
        linesRemoved: 5
      }
      render(<DiffSummaryBar summary={malformedSummary} onRefresh={mockOnRefresh} isRefreshing={false} />)

      const summaryText = screen.getByTestId('diff-summary-text')
      expect(summaryText).toHaveTextContent('2 files changed')
      expect(summaryText).toHaveTextContent('+0 lines') // Should default to 0, not NaN
      expect(summaryText).toHaveTextContent('-5 lines')
    })
  })

  describe('refresh button', () => {
    it('calls onRefresh when clicked', () => {
      render(
        <DiffSummaryBar
          summary={{ filesChanged: 3, linesAdded: 45, linesRemoved: 12 }}
          onRefresh={mockOnRefresh}
          isRefreshing={false}
        />
      )

      const refreshButton = screen.getByTestId('diff-refresh-button')
      fireEvent.click(refreshButton)

      expect(mockOnRefresh).toHaveBeenCalledTimes(1)
    })

    it('is disabled when isRefreshing is true', () => {
      render(
        <DiffSummaryBar
          summary={{ filesChanged: 3, linesAdded: 45, linesRemoved: 12 }}
          onRefresh={mockOnRefresh}
          isRefreshing={true}
        />
      )

      const refreshButton = screen.getByTestId('diff-refresh-button')
      expect(refreshButton).toBeDisabled()
    })

    it('is enabled when isRefreshing is false', () => {
      render(
        <DiffSummaryBar
          summary={{ filesChanged: 3, linesAdded: 45, linesRemoved: 12 }}
          onRefresh={mockOnRefresh}
          isRefreshing={false}
        />
      )

      const refreshButton = screen.getByTestId('diff-refresh-button')
      expect(refreshButton).not.toBeDisabled()
    })

    it('does not call onRefresh when clicked while refreshing', () => {
      render(
        <DiffSummaryBar
          summary={{ filesChanged: 3, linesAdded: 45, linesRemoved: 12 }}
          onRefresh={mockOnRefresh}
          isRefreshing={true}
        />
      )

      const refreshButton = screen.getByTestId('diff-refresh-button')
      fireEvent.click(refreshButton)

      expect(mockOnRefresh).not.toHaveBeenCalled()
    })

    it('has accessible aria-label', () => {
      render(
        <DiffSummaryBar
          summary={{ filesChanged: 3, linesAdded: 45, linesRemoved: 12 }}
          onRefresh={mockOnRefresh}
          isRefreshing={false}
        />
      )

      const refreshButton = screen.getByRole('button', { name: 'Refresh diff' })
      expect(refreshButton).toBeInTheDocument()
    })

    it('shows spinner animation when refreshing', () => {
      const { container } = render(
        <DiffSummaryBar
          summary={{ filesChanged: 3, linesAdded: 45, linesRemoved: 12 }}
          onRefresh={mockOnRefresh}
          isRefreshing={true}
        />
      )

      // The spinner should have animate-spin class
      const spinner = container.querySelector('.animate-spin')
      expect(spinner).toBeInTheDocument()
    })

    it('does not show spinner animation when not refreshing', () => {
      const { container } = render(
        <DiffSummaryBar
          summary={{ filesChanged: 3, linesAdded: 45, linesRemoved: 12 }}
          onRefresh={mockOnRefresh}
          isRefreshing={false}
        />
      )

      const spinner = container.querySelector('.animate-spin')
      expect(spinner).not.toBeInTheDocument()
    })
  })

  describe('styling', () => {
    it('applies custom className', () => {
      render(
        <DiffSummaryBar
          summary={{ filesChanged: 3, linesAdded: 45, linesRemoved: 12 }}
          onRefresh={mockOnRefresh}
          isRefreshing={false}
          className="custom-class"
        />
      )

      const summaryBar = screen.getByTestId('diff-summary-bar')
      expect(summaryBar).toHaveClass('custom-class')
    })

    it('renders with default test id', () => {
      render(
        <DiffSummaryBar
          summary={{ filesChanged: 3, linesAdded: 45, linesRemoved: 12 }}
          onRefresh={mockOnRefresh}
          isRefreshing={false}
        />
      )

      expect(screen.getByTestId('diff-summary-bar')).toBeInTheDocument()
    })

    it('applies green color to additions', () => {
      const { container } = render(
        <DiffSummaryBar
          summary={{ filesChanged: 3, linesAdded: 45, linesRemoved: 12 }}
          onRefresh={mockOnRefresh}
          isRefreshing={false}
        />
      )

      const greenText = container.querySelector('.text-green-500')
      expect(greenText).toBeInTheDocument()
      expect(greenText?.textContent).toContain('+45')
    })

    it('applies red color to deletions', () => {
      const { container } = render(
        <DiffSummaryBar
          summary={{ filesChanged: 3, linesAdded: 45, linesRemoved: 12 }}
          onRefresh={mockOnRefresh}
          isRefreshing={false}
        />
      )

      const redText = container.querySelector('.text-red-500')
      expect(redText).toBeInTheDocument()
      expect(redText?.textContent).toContain('-12')
    })
  })
})

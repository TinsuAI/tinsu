/**
 * ConflictWarningBanner Component Tests
 * Story 8.7: Merge Conflict Detection (AC: 3)
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConflictWarningBanner } from './ConflictWarningBanner'

describe('ConflictWarningBanner', () => {
  describe('Rendering (AC: 3, Task 6.3-6.5)', () => {
    it('should render warning banner with conflict count', () => {
      const conflictFiles = ['src/main.ts', 'package.json']
      render(<ConflictWarningBanner conflictFiles={conflictFiles} />)

      expect(screen.getByTestId('conflict-warning-banner')).toBeInTheDocument()
      expect(screen.getByText('Merge Conflicts Detected')).toBeInTheDocument()
      expect(screen.getByText(/2 conflicting files/i)).toBeInTheDocument()
    })

    it('should render singular "file" text for single conflict', () => {
      const conflictFiles = ['src/main.ts']
      render(<ConflictWarningBanner conflictFiles={conflictFiles} />)

      expect(screen.getByText(/1 conflicting file:/i)).toBeInTheDocument()
    })

    it('should display all conflicting file paths (AC: 3, Task 6.5)', () => {
      const conflictFiles = ['src/main.ts', 'package.json', 'README.md']
      render(<ConflictWarningBanner conflictFiles={conflictFiles} />)

      expect(screen.getByText('src/main.ts')).toBeInTheDocument()
      expect(screen.getByText('package.json')).toBeInTheDocument()
      expect(screen.getByText('README.md')).toBeInTheDocument()
    })

    it('should show Resolve Conflicts button when onResolveClick provided (Story 8.8)', () => {
      const conflictFiles = ['src/main.ts']
      const onResolveClick = vi.fn()
      render(
        <ConflictWarningBanner conflictFiles={conflictFiles} onResolveClick={onResolveClick} />
      )

      expect(screen.getByTestId('resolve-conflicts-btn')).toBeInTheDocument()
      expect(screen.getByText('Resolve Conflicts')).toBeInTheDocument()
    })

    it('should not show Resolve Conflicts button when onResolveClick not provided', () => {
      const conflictFiles = ['src/main.ts']
      render(<ConflictWarningBanner conflictFiles={conflictFiles} />)

      expect(screen.queryByTestId('resolve-conflicts-btn')).not.toBeInTheDocument()
    })

    it('should render with amber warning styling', () => {
      const conflictFiles = ['src/main.ts']
      render(<ConflictWarningBanner conflictFiles={conflictFiles} />)

      const banner = screen.getByTestId('conflict-warning-banner')
      expect(banner).toHaveClass('bg-gradient-to-br')
      expect(banner).toHaveAttribute('role', 'alert')
      expect(banner).toHaveAttribute('aria-live', 'polite')
    })

    it('should return null when no conflict files provided', () => {
      const { container } = render(<ConflictWarningBanner conflictFiles={[]} />)
      expect(container.firstChild).toBeNull()
    })
  })

  describe('Dismiss functionality (AC: 3, Task 6.6, Task 8.4)', () => {
    it('should render dismiss button when onDismiss provided', () => {
      const conflictFiles = ['src/main.ts']
      const onDismiss = vi.fn()

      render(<ConflictWarningBanner conflictFiles={conflictFiles} onDismiss={onDismiss} />)

      expect(screen.getByTestId('conflict-banner-dismiss')).toBeInTheDocument()
      expect(screen.getByLabelText('Dismiss warning')).toBeInTheDocument()
    })

    it('should not render dismiss button when onDismiss not provided', () => {
      const conflictFiles = ['src/main.ts']

      render(<ConflictWarningBanner conflictFiles={conflictFiles} />)

      expect(screen.queryByTestId('conflict-banner-dismiss')).not.toBeInTheDocument()
    })

    it('should call onDismiss when dismiss button clicked', () => {
      const conflictFiles = ['src/main.ts']
      const onDismiss = vi.fn()

      render(<ConflictWarningBanner conflictFiles={conflictFiles} onDismiss={onDismiss} />)

      fireEvent.click(screen.getByTestId('conflict-banner-dismiss'))

      expect(onDismiss).toHaveBeenCalledTimes(1)
    })

    it('should call onResolveClick when Resolve Conflicts button clicked (Story 8.8)', () => {
      const conflictFiles = ['src/main.ts']
      const onResolveClick = vi.fn()

      render(
        <ConflictWarningBanner conflictFiles={conflictFiles} onResolveClick={onResolveClick} />
      )

      fireEvent.click(screen.getByTestId('resolve-conflicts-btn'))

      expect(onResolveClick).toHaveBeenCalledTimes(1)
    })
  })

  describe('Custom styling', () => {
    it('should apply custom className when provided', () => {
      const conflictFiles = ['src/main.ts']

      render(<ConflictWarningBanner conflictFiles={conflictFiles} className="custom-class" />)

      const banner = screen.getByTestId('conflict-warning-banner')
      expect(banner).toHaveClass('custom-class')
    })
  })

  describe('File list scrolling', () => {
    it('should handle long file lists with scrollable container', () => {
      const conflictFiles = Array.from({ length: 10 }, (_, i) => `src/file-${i}.ts`)

      render(<ConflictWarningBanner conflictFiles={conflictFiles} />)

      // All files should be in the document (scrollable but rendered)
      conflictFiles.forEach((file) => {
        expect(screen.getByText(file)).toBeInTheDocument()
      })
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      const conflictFiles = ['src/main.ts']

      render(<ConflictWarningBanner conflictFiles={conflictFiles} />)

      const banner = screen.getByTestId('conflict-warning-banner')
      expect(banner).toHaveAttribute('role', 'alert')
      expect(banner).toHaveAttribute('aria-live', 'polite')
    })

    it('should have accessible dismiss button label', () => {
      const conflictFiles = ['src/main.ts']
      const onDismiss = vi.fn()

      render(<ConflictWarningBanner conflictFiles={conflictFiles} onDismiss={onDismiss} />)

      expect(screen.getByLabelText('Dismiss warning')).toBeInTheDocument()
    })
  })
})

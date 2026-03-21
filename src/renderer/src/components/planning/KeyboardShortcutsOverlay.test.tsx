import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { KeyboardShortcutsOverlay } from './KeyboardShortcutsOverlay'

describe('KeyboardShortcutsOverlay', () => {
  it('renders all shortcut descriptions when isOpen=true', () => {
    render(<KeyboardShortcutsOverlay isOpen={true} onClose={vi.fn()} />)

    expect(screen.getByText('Analysis')).toBeInTheDocument()
    expect(screen.getByText('Planning')).toBeInTheDocument()
    expect(screen.getByText('Solutioning')).toBeInTheDocument()
    expect(screen.getByText('What Next?')).toBeInTheDocument()
    expect(screen.getByText('Recent Runs')).toBeInTheDocument()
    expect(screen.getByText('Readiness Gate')).toBeInTheDocument()
    expect(screen.getByText('Toggle this help')).toBeInTheDocument()
    expect(screen.getByText('Close workspace')).toBeInTheDocument()
    expect(screen.getByText('Cycle focus')).toBeInTheDocument()
  })

  it('does not render when isOpen=false', () => {
    render(<KeyboardShortcutsOverlay isOpen={false} onClose={vi.fn()} />)

    expect(screen.queryByTestId('keyboard-shortcuts-overlay')).not.toBeInTheDocument()
  })

  it('calls onClose when Escape pressed', () => {
    const onClose = vi.fn()
    render(<KeyboardShortcutsOverlay isOpen={true} onClose={onClose} />)

    fireEvent.keyDown(screen.getByTestId('keyboard-shortcuts-overlay'), { key: 'Escape' })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when clicking outside the panel', () => {
    const onClose = vi.fn()
    render(<KeyboardShortcutsOverlay isOpen={true} onClose={onClose} />)

    // Click on the backdrop (the outer container)
    fireEvent.click(screen.getByTestId('keyboard-shortcuts-overlay'))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does NOT close when clicking inside the panel', () => {
    const onClose = vi.fn()
    render(<KeyboardShortcutsOverlay isOpen={true} onClose={onClose} />)

    fireEvent.click(screen.getByText('Keyboard Shortcuts'))

    expect(onClose).not.toHaveBeenCalled()
  })

  it('displays correct key labels (1, 2, 3, N, R, G, ?, Esc, Tab)', () => {
    render(<KeyboardShortcutsOverlay isOpen={true} onClose={vi.fn()} />)

    const expectedKeys = ['1', '2', '3', 'N', 'R', 'G', '?', 'Esc', 'Tab']
    for (const key of expectedKeys) {
      expect(screen.getByText(key)).toBeInTheDocument()
    }
  })

  it('has role="dialog" and aria-label', () => {
    render(<KeyboardShortcutsOverlay isOpen={true} onClose={vi.fn()} />)

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-label', 'Keyboard shortcuts')
  })

  it('renders section headings', () => {
    render(<KeyboardShortcutsOverlay isOpen={true} onClose={vi.fn()} />)

    expect(screen.getByText('Phase Navigation')).toBeInTheDocument()
    expect(screen.getByText('Panels')).toBeInTheDocument()
    expect(screen.getByText('General')).toBeInTheDocument()
  })

  it('has data-testid on container', () => {
    render(<KeyboardShortcutsOverlay isOpen={true} onClose={vi.fn()} />)

    expect(screen.getByTestId('keyboard-shortcuts-overlay')).toBeInTheDocument()
  })

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn()
    render(<KeyboardShortcutsOverlay isOpen={true} onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

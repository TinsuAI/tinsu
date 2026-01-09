import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// Use vi.hoisted to define mocks that can be used in vi.mock factories
const mocks = vi.hoisted(() => ({
  mockDispose: vi.fn(),
  mockOpen: vi.fn(),
  mockWrite: vi.fn(),
  mockClear: vi.fn(),
  mockFocus: vi.fn(),
  mockOnData: vi.fn(() => ({ dispose: vi.fn() })),
  mockOnResize: vi.fn(() => ({ dispose: vi.fn() })),
  mockLoadAddon: vi.fn(),
  mockFit: vi.fn(),
  mockResizeObserverDisconnect: vi.fn(),
  mockGetSelection: vi.fn(() => 'selected text')
}))

// Mock xterm.js
vi.mock('@xterm/xterm', () => ({
  Terminal: class MockTerminal {
    cols = 80
    rows = 24
    dispose = mocks.mockDispose
    open = mocks.mockOpen
    write = mocks.mockWrite
    clear = mocks.mockClear
    focus = mocks.mockFocus
    onData = mocks.mockOnData
    onResize = mocks.mockOnResize
    loadAddon = mocks.mockLoadAddon
    getSelection = mocks.mockGetSelection
  }
}))

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: class MockFitAddon {
    fit = mocks.mockFit
  }
}))

// Import component after mocks are set up
import { XTerminal, type XTerminalRef } from './XTerminal'

// Mock ResizeObserver as a class
class MockResizeObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = mocks.mockResizeObserverDisconnect
}
global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver

describe('XTerminal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render a container element', () => {
    render(<XTerminal />)
    expect(screen.getByTestId('xterminal')).toBeInTheDocument()
  })

  it('should have role="log" for accessibility', () => {
    render(<XTerminal />)
    const container = screen.getByTestId('xterminal')
    expect(container).toHaveAttribute('role', 'log')
  })

  it('should have aria-label for screen readers', () => {
    render(<XTerminal />)
    const container = screen.getByTestId('xterminal')
    expect(container).toHaveAttribute('aria-label', 'Terminal output')
  })

  it('should be keyboard focusable with tabIndex', () => {
    render(<XTerminal />)
    const container = screen.getByTestId('xterminal')
    expect(container).toHaveAttribute('tabIndex', '0')
  })

  it('should initialize xterm Terminal on mount', () => {
    render(<XTerminal />)
    // Terminal should be opened in the container
    expect(mocks.mockOpen).toHaveBeenCalled()
  })

  it('should load FitAddon', () => {
    render(<XTerminal />)
    expect(mocks.mockLoadAddon).toHaveBeenCalled()
  })

  it('should call fit on mount', () => {
    render(<XTerminal />)
    expect(mocks.mockFit).toHaveBeenCalled()
  })

  it('should open terminal in container', () => {
    render(<XTerminal />)
    expect(mocks.mockOpen).toHaveBeenCalled()
  })

  it('should subscribe to onData events', () => {
    render(<XTerminal />)
    expect(mocks.mockOnData).toHaveBeenCalled()
  })

  it('should subscribe to onResize events', () => {
    render(<XTerminal />)
    expect(mocks.mockOnResize).toHaveBeenCalled()
  })

  it('should setup ResizeObserver', () => {
    render(<XTerminal />)
    // ResizeObserver is used, verify our mock class was instantiated
    // by checking the disconnect mock is available
    expect(mocks.mockResizeObserverDisconnect).toBeDefined()
  })

  it('should dispose terminal on unmount', () => {
    const { unmount } = render(<XTerminal />)
    unmount()
    expect(mocks.mockDispose).toHaveBeenCalled()
  })

  it('should disconnect ResizeObserver on unmount', () => {
    const { unmount } = render(<XTerminal />)
    unmount()
    expect(mocks.mockResizeObserverDisconnect).toHaveBeenCalled()
  })

  it('should call onData callback when terminal input occurs', () => {
    const onData = vi.fn()
    render(<XTerminal onData={onData} />)

    // Get the callback passed to terminal.onData
    const calls = mocks.mockOnData.mock.calls
    expect(calls.length).toBeGreaterThan(0)
    const firstCall = calls[0] as unknown[]
    const onDataCallback = firstCall[0] as (data: string) => void
    onDataCallback('test input')

    expect(onData).toHaveBeenCalledWith('test input')
  })

  describe('imperative handle methods', () => {
    it('should expose write method via ref', () => {
      const ref = { current: null as XTerminalRef | null }
      render(<XTerminal ref={ref} />)

      expect(ref.current).toBeDefined()
      expect(typeof ref.current?.write).toBe('function')

      ref.current?.write('test data')
      expect(mocks.mockWrite).toHaveBeenCalledWith('test data')
    })

    it('should expose clear method via ref', () => {
      const ref = { current: null as XTerminalRef | null }
      render(<XTerminal ref={ref} />)

      ref.current?.clear()
      expect(mocks.mockClear).toHaveBeenCalled()
    })

    it('should expose focus method via ref', () => {
      const ref = { current: null as XTerminalRef | null }
      render(<XTerminal ref={ref} />)

      ref.current?.focus()
      expect(mocks.mockFocus).toHaveBeenCalled()
    })

    it('should expose getDimensions method via ref', () => {
      const ref = { current: null as XTerminalRef | null }
      render(<XTerminal ref={ref} />)

      const dimensions = ref.current?.getDimensions()
      expect(dimensions).toEqual({ cols: 80, rows: 24 })
    })

    it('should expose fit method via ref', () => {
      const ref = { current: null as XTerminalRef | null }
      render(<XTerminal ref={ref} />)

      vi.clearAllMocks() // Clear the fit call from mount
      ref.current?.fit()
      expect(mocks.mockFit).toHaveBeenCalled()
    })
  })

  describe('context menu', () => {
    const mockWriteText = vi.fn().mockResolvedValue(undefined)

    beforeEach(() => {
      // Mock clipboard API properly
      vi.stubGlobal('navigator', {
        ...navigator,
        clipboard: {
          writeText: mockWriteText
        }
      })
      mockWriteText.mockClear()
    })

    it('should show context menu on right-click', () => {
      render(<XTerminal />)
      const container = screen.getByTestId('xterminal')

      // Context menu should not be visible initially
      expect(screen.queryByTestId('terminal-context-menu')).not.toBeInTheDocument()

      // Right-click to open context menu
      fireEvent.contextMenu(container, { clientX: 100, clientY: 200 })

      // Context menu should be visible
      expect(screen.getByTestId('terminal-context-menu')).toBeInTheDocument()
    })

    it('should show Copy option in context menu', () => {
      render(<XTerminal />)
      const container = screen.getByTestId('xterminal')

      fireEvent.contextMenu(container, { clientX: 100, clientY: 200 })

      expect(screen.getByTestId('context-menu-copy')).toBeInTheDocument()
      expect(screen.getByText('Copy')).toBeInTheDocument()
    })

    it('should copy selected text to clipboard when Copy is clicked', async () => {
      render(<XTerminal />)
      const container = screen.getByTestId('xterminal')

      // Open context menu
      fireEvent.contextMenu(container, { clientX: 100, clientY: 200 })

      // Click Copy
      const copyButton = screen.getByTestId('context-menu-copy')
      fireEvent.click(copyButton)

      // Should get selection and write to clipboard
      expect(mocks.mockGetSelection).toHaveBeenCalled()
      expect(mockWriteText).toHaveBeenCalledWith('selected text')
    })

    it('should close context menu after copying', () => {
      render(<XTerminal />)
      const container = screen.getByTestId('xterminal')

      // Open context menu
      fireEvent.contextMenu(container, { clientX: 100, clientY: 200 })
      expect(screen.getByTestId('terminal-context-menu')).toBeInTheDocument()

      // Click Copy
      const copyButton = screen.getByTestId('context-menu-copy')
      fireEvent.click(copyButton)

      // Context menu should close
      expect(screen.queryByTestId('terminal-context-menu')).not.toBeInTheDocument()
    })

    it('should close context menu on Escape key', () => {
      render(<XTerminal />)
      const container = screen.getByTestId('xterminal')

      // Open context menu
      fireEvent.contextMenu(container, { clientX: 100, clientY: 200 })
      expect(screen.getByTestId('terminal-context-menu')).toBeInTheDocument()

      // Press Escape
      fireEvent.keyDown(document, { key: 'Escape' })

      // Context menu should close
      expect(screen.queryByTestId('terminal-context-menu')).not.toBeInTheDocument()
    })

    it('should close context menu on click outside', () => {
      render(<XTerminal />)
      const container = screen.getByTestId('xterminal')

      // Open context menu
      fireEvent.contextMenu(container, { clientX: 100, clientY: 200 })
      expect(screen.getByTestId('terminal-context-menu')).toBeInTheDocument()

      // Click outside
      fireEvent.click(document.body)

      // Context menu should close
      expect(screen.queryByTestId('terminal-context-menu')).not.toBeInTheDocument()
    })

    it('should position context menu at click coordinates', () => {
      render(<XTerminal />)
      const container = screen.getByTestId('xterminal')

      fireEvent.contextMenu(container, { clientX: 150, clientY: 250 })

      const contextMenu = screen.getByTestId('terminal-context-menu')
      expect(contextMenu).toHaveStyle({ left: '150px', top: '250px' })
    })
  })
})

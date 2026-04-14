import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MobileTerminal, type MobileTerminalRef } from './MobileTerminal'

// Use vi.hoisted to define mocks that can be used in vi.mock factories
const mocks = vi.hoisted(() => ({
  mockDispose: vi.fn(),
  mockOpen: vi.fn(),
  mockWrite: vi.fn(),
  mockClear: vi.fn(),
  mockFocus: vi.fn(),
  mockOnData: vi.fn(() => ({ dispose: vi.fn() })),
  mockOnResize: vi.fn(() => ({ dispose: vi.fn() })),
  mockOnFocus: vi.fn(() => ({ dispose: vi.fn() })),
  mockOnBlur: vi.fn(() => ({ dispose: vi.fn() })),
  mockLoadAddon: vi.fn(),
  mockFit: vi.fn(),
  mockSerialize: vi.fn(() => 'serialized-buffer'),
  mockScrollToLine: vi.fn(),
  mockScrollToBottom: vi.fn(),
  mockResizeObserverDisconnect: vi.fn()
}))

// Mock xterm.js
vi.mock('@xterm/xterm', () => ({
  Terminal: class MockTerminal {
    cols = 80
    rows = 24
    buffer = { active: { viewportY: 42 } }
    dispose = mocks.mockDispose
    open = mocks.mockOpen
    write = mocks.mockWrite
    clear = mocks.mockClear
    focus = mocks.mockFocus
    onData = mocks.mockOnData
    onResize = mocks.mockOnResize
    onFocus = mocks.mockOnFocus
    onBlur = mocks.mockOnBlur
    loadAddon = mocks.mockLoadAddon
    scrollToLine = mocks.mockScrollToLine
    scrollToBottom = mocks.mockScrollToBottom
  }
}))

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: class MockFitAddon {
    fit = mocks.mockFit
  }
}))

vi.mock('@xterm/addon-serialize', () => ({
  SerializeAddon: class MockSerializeAddon {
    serialize = mocks.mockSerialize
  }
}))

// Mock ResizeObserver as a class
class MockResizeObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = mocks.mockResizeObserverDisconnect
}
global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver

describe('MobileTerminal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    
    // Mock visualViewport
    Object.defineProperty(window, 'visualViewport', {
      value: {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        height: 600,
        width: 400
      },
      writable: true,
      configurable: true
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders terminal container', () => {
    render(<MobileTerminal />)
    expect(screen.getByRole('log')).toBeDefined()
    expect(mocks.mockOpen).toHaveBeenCalled()
  })

  it('toggles full-screen on double-tap', () => {
    const { container } = render(<MobileTerminal />)
    const terminalDiv = container.firstChild as HTMLElement
    
    // First double-tap to enter full-screen
    fireEvent.touchEnd(terminalDiv)
    vi.advanceTimersByTime(100)
    fireEvent.touchEnd(terminalDiv)
    
    expect(terminalDiv.className).toContain('fixed inset-0')
    
    // Second double-tap to exit full-screen
    // Need a gap between double-taps so the third tap isn't seen as second
    vi.advanceTimersByTime(500) 
    
    fireEvent.touchEnd(terminalDiv)
    vi.advanceTimersByTime(100)
    fireEvent.touchEnd(terminalDiv)
    
    expect(terminalDiv.className).not.toContain('fixed inset-0')
  })

  it('renders accessory bar with buttons', () => {
    render(<MobileTerminal />)
    expect(screen.getByText('Tab')).toBeDefined()
    expect(screen.getByText('Ctrl')).toBeDefined()
    expect(screen.getByText('Alt')).toBeDefined()
    expect(screen.getByText('Esc')).toBeDefined()
    
    // Arrows by aria-label
    expect(screen.getByLabelText('Up')).toBeDefined()
    expect(screen.getByLabelText('Down')).toBeDefined()
    expect(screen.getByLabelText('Left')).toBeDefined()
    expect(screen.getByLabelText('Right')).toBeDefined()
  })

  it('calls onData when accessory keys are pressed', () => {
    const onData = vi.fn()
    render(<MobileTerminal onData={onData} />)
    
    fireEvent.click(screen.getByText('Tab'))
    expect(onData).toHaveBeenCalledWith('\t')
    
    fireEvent.click(screen.getByLabelText('Up'))
    expect(onData).toHaveBeenCalledWith('\x1b[A')
  })

  it('handles Ctrl modifier from accessory bar', () => {
    const onData = vi.fn()
    render(<MobileTerminal onData={onData} />)
    
    // Activate Ctrl
    fireEvent.click(screen.getByText('Ctrl'))
    
    // Check if the UI shows CTRL indicator
    expect(screen.getByText('CTRL')).toBeDefined()
  })

  describe('imperative handle methods', () => {
    it('should expose write method via ref', () => {
      const ref = { current: null as MobileTerminalRef | null }
      render(<MobileTerminal ref={ref} />)

      expect(ref.current).toBeDefined()
      ref.current?.write('test data')
      expect(mocks.mockWrite).toHaveBeenCalledWith('test data')
    })

    it('should expose clear method via ref', () => {
      const ref = { current: null as MobileTerminalRef | null }
      render(<MobileTerminal ref={ref} />)

      ref.current?.clear()
      expect(mocks.mockClear).toHaveBeenCalled()
    })

    it('should expose serialize method via ref', () => {
      const ref = { current: null as MobileTerminalRef | null }
      render(<MobileTerminal ref={ref} />)

      const serialized = ref.current?.serialize()
      expect(serialized).toBe('serialized-buffer')
      expect(mocks.mockSerialize).toHaveBeenCalled()
    })

    it('should expose getScrollPosition method via ref', () => {
      const ref = { current: null as MobileTerminalRef | null }
      render(<MobileTerminal ref={ref} />)

      const scrollPos = ref.current?.getScrollPosition()
      expect(scrollPos).toBe(42) // Mock buffer.active.viewportY
    })
  })
})

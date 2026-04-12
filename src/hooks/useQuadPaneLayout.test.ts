import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useQuadPaneLayout } from './useQuadPaneLayout'
import { useQuadPaneStore } from '@renderer/stores/quad-pane.store'

describe('useQuadPaneLayout', () => {
  let matchMediaMock: ReturnType<typeof vi.fn>
  let addEventListenerMock: ReturnType<typeof vi.fn>
  let removeEventListenerMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    // Reset store state
    useQuadPaneStore.setState({
      expandedSection: null,
      layoutMode: 'quad'
    })

    // Mock matchMedia
    addEventListenerMock = vi.fn()
    removeEventListenerMock = vi.fn()

    matchMediaMock = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('1024') ? window.innerWidth >= 1024 : false,
      media: query,
      addEventListener: addEventListenerMock,
      removeEventListener: removeEventListenerMock
    }))

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: matchMediaMock
    })

    // Set default window width to large screen
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      value: 1440
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns quad mode when viewport is >= 1024px', () => {
    const { result } = renderHook(() => useQuadPaneLayout())

    expect(result.current).toBe('quad')
  })

  it('returns tabbed mode when viewport is < 1024px', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      value: 800
    })

    matchMediaMock.mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: addEventListenerMock,
      removeEventListener: removeEventListenerMock
    }))

    const { result } = renderHook(() => useQuadPaneLayout())

    expect(result.current).toBe('tabbed')
  })

  it('adds event listener for media query changes', () => {
    renderHook(() => useQuadPaneLayout())

    expect(addEventListenerMock).toHaveBeenCalledWith('change', expect.any(Function))
  })

  it('removes event listener on unmount', () => {
    const { unmount } = renderHook(() => useQuadPaneLayout())

    unmount()

    expect(removeEventListenerMock).toHaveBeenCalledWith('change', expect.any(Function))
  })

  it('updates store layoutMode when viewport changes', () => {
    matchMediaMock.mockImplementation((query: string) => ({
      matches: true,
      media: query,
      addEventListener: addEventListenerMock,
      removeEventListener: removeEventListenerMock
    }))

    renderHook(() => useQuadPaneLayout())

    const { layoutMode } = useQuadPaneStore.getState()
    expect(layoutMode).toBe('quad')
  })

  it('responds to media query change events', () => {
    let changeHandler: ((e: MediaQueryListEvent) => void) | null = null

    addEventListenerMock.mockImplementation((event: string, handler: (e: MediaQueryListEvent) => void) => {
      if (event === 'change') {
        changeHandler = handler
      }
    })

    matchMediaMock.mockImplementation((query: string) => ({
      matches: true,
      media: query,
      addEventListener: addEventListenerMock,
      removeEventListener: removeEventListenerMock
    }))

    const { result } = renderHook(() => useQuadPaneLayout())

    expect(result.current).toBe('quad')

    // Simulate media query change to small screen
    act(() => {
      if (changeHandler) {
        changeHandler({ matches: false } as MediaQueryListEvent)
      }
    })

    expect(result.current).toBe('tabbed')
  })

  it('uses correct breakpoint value (1024px)', () => {
    renderHook(() => useQuadPaneLayout())

    expect(matchMediaMock).toHaveBeenCalledWith('(min-width: 1024px)')
  })
})

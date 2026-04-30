import { describe, it, expect, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useViewportClass } from './useViewportClass'

function setWindowWidth(width: number): void {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: width })
}

describe('useViewportClass', () => {
  const originalUA = navigator.userAgent

  afterEach(() => {
    // Restore user-agent after tests that override it
    Object.defineProperty(navigator, 'userAgent', {
      writable: true,
      configurable: true,
      value: originalUA,
    })
    // Restore window width
    setWindowWidth(1024)
  })

  it('returns "desktop" at width 1024', async () => {
    setWindowWidth(1024)
    const { result } = renderHook(() => useViewportClass())
    // Wait for any async Tauri checks to settle
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(result.current).toBe('desktop')
  })

  it('returns "mobile" at width 800', async () => {
    setWindowWidth(800)
    const { result } = renderHook(() => useViewportClass())
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(result.current).toBe('mobile')
  })

  it('returns "mobile" at width 1023 (just below breakpoint)', async () => {
    setWindowWidth(1023)
    const { result } = renderHook(() => useViewportClass())
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(result.current).toBe('mobile')
  })

  it('reacts to resize event — switches from desktop to mobile', async () => {
    setWindowWidth(1200)
    const { result } = renderHook(() => useViewportClass())
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(result.current).toBe('desktop')

    act(() => {
      setWindowWidth(600)
      window.dispatchEvent(new Event('resize'))
    })
    expect(result.current).toBe('mobile')
  })

  it('reacts to resize event — switches from mobile to desktop', async () => {
    setWindowWidth(600)
    const { result } = renderHook(() => useViewportClass())
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(result.current).toBe('mobile')

    act(() => {
      setWindowWidth(1200)
      window.dispatchEvent(new Event('resize'))
    })
    expect(result.current).toBe('desktop')
  })

  it('returns "mobile" when Android user-agent detected', async () => {
    Object.defineProperty(navigator, 'userAgent', {
      writable: true,
      configurable: true,
      value:
        'Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36',
    })
    setWindowWidth(1200) // Wide viewport, but UA indicates Android

    const { result } = renderHook(() => useViewportClass())
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
    expect(result.current).toBe('mobile')
  })

  it('returns "mobile" when __TAURI_INTERNALS__ platform is android', () => {
    setWindowWidth(1200)
    Object.defineProperty(navigator, 'userAgent', {
      writable: true,
      configurable: true,
      value: 'Mozilla/5.0',  // Neutral UA, no mobile hint
    })
    // Simulate Tauri android WebView
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      writable: true,
      configurable: true,
      value: { platform: 'android' },
    })

    const { result } = renderHook(() => useViewportClass())
    expect(result.current).toBe('mobile')

    // Restore
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      writable: true,
      configurable: true,
      value: undefined,
    })
  })
})

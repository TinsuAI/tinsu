import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MobileBottomActionBar } from './MobileBottomActionBar'

// happy-dom does not implement navigator.vibrate — define a stub so vi.spyOn works
beforeAll(() => {
  if (!('vibrate' in navigator)) {
    Object.defineProperty(navigator, 'vibrate', {
      value: () => true,
      writable: true,
      configurable: true,
    })
  }
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('MobileBottomActionBar', () => {
  it('primary button fires onPress and haptic', () => {
    const onPress = vi.fn()
    const vibrateSpy = vi.spyOn(navigator, 'vibrate').mockReturnValue(true)
    render(<MobileBottomActionBar primary={{ label: 'Approve', onPress }} />)
    fireEvent.click(screen.getByTestId('mobile-bottom-action-primary'))
    expect(onPress).toHaveBeenCalledTimes(1)
    expect(vibrateSpy).toHaveBeenCalledWith(10)
  })

  it('secondary button fires onPress without haptic', () => {
    const onPress = vi.fn()
    const vibrateSpy = vi.spyOn(navigator, 'vibrate').mockReturnValue(true)
    render(<MobileBottomActionBar secondary={{ label: 'Cancel', onPress }} />)
    fireEvent.click(screen.getByTestId('mobile-bottom-action-secondary'))
    expect(onPress).toHaveBeenCalledTimes(1)
    expect(vibrateSpy).not.toHaveBeenCalled()
  })

  it('disabled primary button blocks press', () => {
    const onPress = vi.fn()
    render(
      <MobileBottomActionBar primary={{ label: 'Approve', onPress, disabled: true }} />,
    )
    const btn = screen.getByTestId('mobile-bottom-action-primary')
    expect(btn).toBeDisabled()
  })

  it('renders children escape hatch instead of buttons', () => {
    render(
      <MobileBottomActionBar>
        <div data-testid="custom">Custom content</div>
      </MobileBottomActionBar>,
    )
    expect(screen.getByTestId('custom')).toBeInTheDocument()
    expect(screen.queryByTestId('mobile-bottom-action-primary')).not.toBeInTheDocument()
  })

  it('reduced-motion suppresses haptic', () => {
    const vibrateSpy = vi.spyOn(navigator, 'vibrate').mockReturnValue(true)
    vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    }))
    const onPress = vi.fn()
    render(<MobileBottomActionBar primary={{ label: 'Approve', onPress }} />)
    fireEvent.click(screen.getByTestId('mobile-bottom-action-primary'))
    expect(vibrateSpy).not.toHaveBeenCalled()
  })
})

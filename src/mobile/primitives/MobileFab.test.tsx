import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MobileFab } from './MobileFab'
import { Plus } from 'lucide-react'

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

describe('MobileFab', () => {
  it('renders icon-only FAB with ariaLabel', () => {
    render(
      <MobileFab
        icon={<Plus className="h-6 w-6" />}
        ariaLabel="Create task"
        onPress={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: 'Create task' })).toBeInTheDocument()
  })

  it('renders extended FAB with label', () => {
    render(
      <MobileFab
        icon={<Plus className="h-6 w-6" />}
        label="New Task"
        ariaLabel="Create task"
        onPress={vi.fn()}
      />,
    )
    expect(screen.getByText('New Task')).toBeInTheDocument()
  })

  it('fires onPress and haptic on click', () => {
    const onPress = vi.fn()
    const vibrateSpy = vi.spyOn(navigator, 'vibrate').mockReturnValue(true)
    render(
      <MobileFab
        icon={<Plus />}
        ariaLabel="Create"
        onPress={onPress}
      />,
    )
    fireEvent.click(screen.getByTestId('mobile-fab'))
    expect(onPress).toHaveBeenCalledTimes(1)
    expect(vibrateSpy).toHaveBeenCalledWith(10)
  })

  it('reduced-motion disables haptic', () => {
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
    render(
      <MobileFab icon={<Plus />} ariaLabel="Create" onPress={vi.fn()} />,
    )
    fireEvent.click(screen.getByTestId('mobile-fab'))
    expect(vibrateSpy).not.toHaveBeenCalled()
  })

  it('disabled FAB blocks press', () => {
    const onPress = vi.fn()
    render(
      <MobileFab icon={<Plus />} ariaLabel="Create" onPress={onPress} disabled />,
    )
    expect(screen.getByTestId('mobile-fab')).toBeDisabled()
  })
})

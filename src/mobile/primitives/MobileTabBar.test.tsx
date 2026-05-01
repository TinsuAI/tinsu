import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MobileTabBar } from './MobileTabBar'
import type { MobileTabId } from '../shell/mobile-nav.store'

const allTabs: MobileTabId[] = ['board', 'planning', 'tasks', 'activity', 'settings']

function renderBar(props?: Partial<Parameters<typeof MobileTabBar>[0]>) {
  const onTabPress = vi.fn()
  const onLongPress = vi.fn()
  render(
    <MobileTabBar
      activeTab="board"
      onTabPress={onTabPress}
      onLongPressActiveTab={onLongPress}
      {...props}
    />,
  )
  return { onTabPress, onLongPress }
}

describe('MobileTabBar', () => {
  it('renders all 5 tabs', () => {
    renderBar()
    allTabs.forEach((id) => {
      expect(screen.getByTestId(`mobile-tab-${id}`)).toBeInTheDocument()
    })
  })

  it('active tab has aria-selected=true', () => {
    renderBar({ activeTab: 'planning' })
    expect(screen.getByTestId('mobile-tab-planning').getAttribute('aria-selected')).toBe('true')
    expect(screen.getByTestId('mobile-tab-board').getAttribute('aria-selected')).toBe('false')
  })

  it('tapping a tab fires onTabPress', () => {
    const { onTabPress } = renderBar()
    const btn = screen.getByTestId('mobile-tab-planning')
    fireEvent.pointerDown(btn)
    fireEvent.pointerUp(btn)
    expect(onTabPress).toHaveBeenCalledWith('planning')
  })

  it('renders numeric badge when badges prop provided', () => {
    renderBar({ badges: { planning: 3 } })
    expect(screen.getByTestId('mobile-tab-badge-planning')).toHaveTextContent('3')
  })

  it('shows "9+" for badge value >= 10', () => {
    renderBar({ badges: { tasks: 15 } })
    expect(screen.getByTestId('mobile-tab-badge-tasks')).toHaveTextContent('9+')
  })

  it('does not render badge for zero value', () => {
    renderBar({ badges: { board: 0 } })
    expect(screen.queryByTestId('mobile-tab-badge-board')).not.toBeInTheDocument()
  })

  it('long-press fires onLongPressActiveTab for active tab', async () => {
    vi.useFakeTimers()
    const { onLongPress } = renderBar({ activeTab: 'board' })
    const btn = screen.getByTestId('mobile-tab-board')
    fireEvent.pointerDown(btn)
    act(() => { vi.advanceTimersByTime(600) })
    expect(onLongPress).toHaveBeenCalledWith('board')
    vi.useRealTimers()
  })
})

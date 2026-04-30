import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MobileListItem } from './MobileListItem'

describe('MobileListItem', () => {
  it('renders title', () => {
    render(<MobileListItem title="Settings" />)
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('renders chevron trailing', () => {
    render(<MobileListItem title="Nav" trailing="chevron" onPress={() => {}} />)
    expect(screen.getByTestId('mobile-list-item')).toBeInTheDocument()
    // SVG chevron is present in DOM
    const svgs = screen.getByTestId('mobile-list-item').querySelectorAll('svg')
    expect(svgs.length).toBeGreaterThan(0)
  })

  it('renders toggle trailing and fires onToggleChange', () => {
    const onChange = vi.fn()
    render(
      <MobileListItem
        title="Notifications"
        trailing="toggle"
        toggleValue={false}
        onToggleChange={onChange}
      />,
    )
    fireEvent.click(screen.getByTestId('mobile-list-item-toggle'))
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('fires onPress when tapped', () => {
    const onPress = vi.fn()
    render(<MobileListItem title="Tap me" onPress={onPress} />)
    fireEvent.click(screen.getByTestId('mobile-list-item'))
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('applies text-destructive when destructive=true', () => {
    render(<MobileListItem title="Delete" destructive />)
    const title = screen.getByText('Delete')
    expect(title.className).toContain('text-destructive')
  })

  it('disabled item blocks click', () => {
    const onPress = vi.fn()
    render(<MobileListItem title="Disabled" onPress={onPress} disabled />)
    const btn = screen.getByTestId('mobile-list-item')
    expect(btn).toBeDisabled()
  })

  it('renders subtitle when provided', () => {
    render(<MobileListItem title="Profile" subtitle="Manage your profile" />)
    expect(screen.getByText('Manage your profile')).toBeInTheDocument()
  })
})

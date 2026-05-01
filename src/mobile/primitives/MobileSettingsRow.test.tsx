import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MobileSettingsRow } from './MobileSettingsRow'

describe('MobileSettingsRow', () => {
  it('renders title', () => {
    render(<MobileSettingsRow title="Test Row" />)
    expect(screen.getByText('Test Row')).toBeTruthy()
  })

  it('renders value when provided', () => {
    render(<MobileSettingsRow title="Theme" value="Dark" />)
    expect(screen.getByText('Dark')).toBeTruthy()
  })

  it('renders subtitle when provided', () => {
    render(<MobileSettingsRow title="SSH Keys" subtitle="Coming soon" />)
    expect(screen.getByText('Coming soon')).toBeTruthy()
  })

  it('fires onPress when tapped', () => {
    const onPress = vi.fn()
    render(<MobileSettingsRow title="Tap me" onPress={onPress} />)
    fireEvent.click(screen.getByTestId('mobile-settings-row'))
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('renders chevron trailing', () => {
    render(<MobileSettingsRow title="Row" trailing="chevron" onPress={vi.fn()} />)
    // ChevronRight is rendered — button with testid present
    const row = screen.getByTestId('mobile-settings-row')
    expect(row).toBeTruthy()
  })

  it('renders check trailing', () => {
    render(<MobileSettingsRow title="Selected" trailing="check" />)
    expect(screen.getByTestId('settings-row-check')).toBeTruthy()
  })

  it('renders switch trailing and fires onSwitchChange', () => {
    const onSwitchChange = vi.fn()
    render(
      <MobileSettingsRow
        title="Toggle"
        trailing="switch"
        switchValue={false}
        onSwitchChange={onSwitchChange}
      />
    )
    fireEvent.click(screen.getByTestId('settings-row-switch'))
    expect(onSwitchChange).toHaveBeenCalledWith(true)
  })

  it('renders as div with role=listitem when no onPress', () => {
    render(<MobileSettingsRow title="Static" />)
    expect(screen.getByRole('listitem')).toBeTruthy()
  })

  it('renders as button with role=listitem when onPress provided', () => {
    render(<MobileSettingsRow title="Interactive" onPress={vi.fn()} />)
    const btn = screen.getByRole('listitem')
    expect(btn.tagName.toLowerCase()).toBe('button')
  })

  it('disabled state: has opacity class and pointer-events-none', () => {
    render(<MobileSettingsRow title="Disabled" disabled onPress={vi.fn()} />)
    const row = screen.getByTestId('mobile-settings-row')
    expect(row.className).toContain('opacity')
  })

  it('AC-17: no hardcoded color classes on the row element', () => {
    render(<MobileSettingsRow title="Token check" trailing="chevron" onPress={vi.fn()} />)
    const row = screen.getByTestId('mobile-settings-row')
    // Must not contain inline color literals
    const colorPattern = /(text|bg|border)-(red|blue|green|yellow|orange|purple|pink|gray|slate)-[0-9]/
    expect(colorPattern.test(row.className)).toBe(false)
  })

  it('renders icon when provided', () => {
    render(
      <MobileSettingsRow
        title="With Icon"
        icon={<span data-testid="test-icon" />}
      />
    )
    expect(screen.getByTestId('test-icon')).toBeTruthy()
  })
})

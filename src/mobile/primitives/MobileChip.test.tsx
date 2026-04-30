import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MobileChip } from './MobileChip'

describe('MobileChip', () => {
  it('renders label', () => {
    render(<MobileChip label="React" />)
    expect(screen.getByText('React')).toBeInTheDocument()
  })

  it('selected chip has primary token classes', () => {
    render(<MobileChip label="Selected" selected />)
    expect(screen.getByTestId('mobile-chip').className).toContain('bg-primary/15')
  })

  it('unselected chip has muted token classes', () => {
    render(<MobileChip label="Unselected" />)
    expect(screen.getByTestId('mobile-chip').className).toContain('bg-muted/40')
  })

  it('fires onPress when clicked', () => {
    const onPress = vi.fn()
    render(<MobileChip label="Click me" onPress={onPress} />)
    fireEvent.click(screen.getByTestId('mobile-chip'))
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('dismiss button fires onDismiss', () => {
    const onDismiss = vi.fn()
    render(<MobileChip label="JS" onDismiss={onDismiss} />)
    fireEvent.click(screen.getByTestId('mobile-chip-dismiss'))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('disabled chip blocks interaction', () => {
    const onPress = vi.fn()
    render(<MobileChip label="Disabled" onPress={onPress} disabled />)
    const chip = screen.getByTestId('mobile-chip')
    expect(chip).toBeDisabled()
  })
})

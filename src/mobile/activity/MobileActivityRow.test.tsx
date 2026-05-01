import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MobileActivityRow } from './MobileActivityRow'
import type { Activity } from '@shared/types/activity.types'

// Mock useReducedMotion
vi.mock('../hooks/useReducedMotion', () => ({
  useReducedMotion: () => false,
}))

const makeActivity = (overrides: Partial<Activity> = {}): Activity => ({
  id: 'act-1',
  task_id: 'task-1',
  event_type: 'agent_start',
  payload: JSON.stringify({ tool: 'bash' }),
  created_at: Date.now() - 2 * 60_000, // 2 min ago
  ...overrides,
})

describe('MobileActivityRow', () => {
  it('renders the humanised event type title', () => {
    render(<MobileActivityRow activity={makeActivity()} onPress={vi.fn()} />)
    expect(screen.getByText('Agent Started')).toBeTruthy()
  })

  it('renders relative time', () => {
    render(<MobileActivityRow activity={makeActivity()} onPress={vi.fn()} />)
    // 2 min ago → "2m"
    expect(screen.getByText('2m')).toBeTruthy()
  })

  it('calls onPress with the activity when tapped', () => {
    const onPress = vi.fn()
    const activity = makeActivity()
    render(<MobileActivityRow activity={activity} onPress={onPress} />)
    fireEvent.click(screen.getByTestId('mobile-activity-row'))
    expect(onPress).toHaveBeenCalledWith(activity)
  })

  it('AC-17: no hardcoded inline color classes on the row', () => {
    render(<MobileActivityRow activity={makeActivity()} onPress={vi.fn()} />)
    const row = screen.getByTestId('mobile-activity-row')
    const colorPattern = /(text|bg|border)-(red|blue|green|yellow|orange|purple|pink|gray|slate)-[0-9]/
    expect(colorPattern.test(row.className)).toBe(false)
  })

  it('renders payload subtitle when payload is set', () => {
    const activity = makeActivity({
      event_type: 'tool_used',
      payload: JSON.stringify({ tool_name: 'Bash' }),
    })
    render(<MobileActivityRow activity={activity} onPress={vi.fn()} />)
    expect(screen.getByText('Bash')).toBeTruthy()
  })

  it('adds animate-activity-glow class when highlight=true and motion allowed', () => {
    render(<MobileActivityRow activity={makeActivity()} onPress={vi.fn()} highlight />)
    const row = screen.getByTestId('mobile-activity-row')
    expect(row.className).toContain('animate-activity-glow')
  })

  it('does NOT add glow class when highlight=false', () => {
    render(<MobileActivityRow activity={makeActivity()} onPress={vi.fn()} highlight={false} />)
    const row = screen.getByTestId('mobile-activity-row')
    expect(row.className).not.toContain('animate-activity-glow')
  })

  it('has min-h-11 touch target class', () => {
    render(<MobileActivityRow activity={makeActivity()} onPress={vi.fn()} />)
    const row = screen.getByTestId('mobile-activity-row')
    expect(row.className).toContain('min-h-11')
  })
})

describe('MobileActivityRow — prefers-reduced-motion', () => {
  it('skips glow class when reduced motion is active', async () => {
    // Reset module cache so the new mock is picked up
    vi.resetModules()
    vi.doMock('../hooks/useReducedMotion', () => ({
      useReducedMotion: () => true,
    }))
    const { MobileActivityRow: ReducedRow } = await import('./MobileActivityRow')
    const activity = makeActivity()
    render(<ReducedRow activity={activity} onPress={vi.fn()} highlight />)
    const row = screen.getByTestId('mobile-activity-row')
    expect(row.className).not.toContain('animate-activity-glow')
    vi.resetModules()
    vi.doUnmock('../hooks/useReducedMotion')
  })
})

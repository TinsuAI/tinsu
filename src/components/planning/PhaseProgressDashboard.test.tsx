// T1.9: PhaseProgressDashboard is stubbed pending full implementation in T1.10.
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PhaseProgressDashboard } from './PhaseProgressDashboard'

describe('PhaseProgressDashboard (T1.9 stub)', () => {
  it('renders placeholder', () => {
    render(<PhaseProgressDashboard />)
    expect(screen.getByTestId('phase-progress-dashboard')).toBeDefined()
  })
})

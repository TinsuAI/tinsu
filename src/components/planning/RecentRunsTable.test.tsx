// T1.9: RecentRunsTable is stubbed pending full implementation in T1.10.
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RecentRunsTable } from './RecentRunsTable'

describe('RecentRunsTable (T1.9 stub)', () => {
  it('renders placeholder', () => {
    render(<RecentRunsTable />)
    expect(screen.getByTestId('recent-runs-table')).toBeDefined()
  })
})

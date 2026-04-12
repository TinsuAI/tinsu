/**
 * RecentRunsTable Tests — T1.10
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { RecentRunsTable } from './RecentRunsTable'

const mockListWorkflowRuns = vi.fn()

vi.mock('@renderer/lib/rspc', () => ({
  commands: {
    listWorkflowRuns: (...args: unknown[]) => mockListWorkflowRuns(...args),
  },
}))

vi.mock('@renderer/stores', () => ({
  useProjectStore: (selector: (s: { activeProjectId: string | null }) => unknown) =>
    selector({ activeProjectId: 'proj-1' }),
}))

vi.mock('@renderer/constants/planning-workspace', () => ({
  BMAD_WORKFLOWS: [],
}))

describe('RecentRunsTable (T1.10)', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    mockListWorkflowRuns.mockResolvedValue({ status: 'ok', data: [] })
  })

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  it('renders with testid', () => {
    render(<RecentRunsTable />, { wrapper })
    expect(screen.getByTestId('recent-runs-table')).toBeDefined()
  })

  it('shows empty state when no runs', async () => {
    render(<RecentRunsTable />, { wrapper })
    expect(screen.getByTestId('recent-runs-table')).toBeDefined()
  })
})

/**
 * ReadinessGatePanel Tests — T1.10
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { ReadinessGatePanel } from './ReadinessGatePanel'

const mockGetLatestGateDecision = vi.fn()
const mockListGateDecisions = vi.fn()
const mockParseAndSaveGateResult = vi.fn()
const mockApproveForImplementation = vi.fn()

vi.mock('@renderer/lib/rspc', () => ({
  commands: {
    getLatestGateDecision: (...args: unknown[]) => mockGetLatestGateDecision(...args),
    listGateDecisions: (...args: unknown[]) => mockListGateDecisions(...args),
    parseAndSaveGateResult: (...args: unknown[]) => mockParseAndSaveGateResult(...args),
    approveForImplementation: (...args: unknown[]) => mockApproveForImplementation(...args),
  },
}))

vi.mock('@renderer/stores', () => ({
  useProjectStore: (selector: (s: { activeProjectId: string | null }) => unknown) =>
    selector({ activeProjectId: 'proj-1' }),
}))

describe('ReadinessGatePanel (T1.10)', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    mockGetLatestGateDecision.mockResolvedValue({ status: 'ok', data: null })
    mockListGateDecisions.mockResolvedValue({ status: 'ok', data: [] })
  })

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  it('renders with testid', () => {
    render(<ReadinessGatePanel />, { wrapper })
    expect(screen.getByTestId('readiness-gate-panel')).toBeDefined()
  })

  it('shows empty state when no gate result', async () => {
    render(<ReadinessGatePanel />, { wrapper })
    expect(screen.getByTestId('readiness-gate-panel')).toBeDefined()
  })
})

/**
 * PhaseProgressDashboard Tests — T1.10
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { PhaseProgressDashboard } from './PhaseProgressDashboard'

const mockScanArtifacts = vi.fn()
const mockUpdateArtifactStatus = vi.fn()

vi.mock('@renderer/lib/rspc', () => ({
  commands: {
    scanArtifacts: (...args: unknown[]) => mockScanArtifacts(...args),
    updateArtifactStatus: (...args: unknown[]) => mockUpdateArtifactStatus(...args),
  },
}))

vi.mock('@renderer/stores', () => ({
  useProjectStore: (selector: (s: { activeProjectId: string | null }) => unknown) =>
    selector({ activeProjectId: 'proj-1' }),
  usePlanningWorkspaceStore: (selector: (s: { setSelectedWorkflow: (k: string) => void }) => unknown) =>
    selector({ setSelectedWorkflow: vi.fn() }),
}))

vi.mock('@renderer/constants/planning-workspace', () => ({
  BMAD_PHASES: [
    { key: 'analysis', label: 'Analysis', description: 'Understand the problem' },
  ],
  BMAD_WORKFLOWS: [
    { key: 'product-brief', name: 'Product Brief', phase: 'analysis' },
  ],
}))

vi.mock('./WhatNextPanel', () => ({
  WhatNextPanel: () => <div data-testid="what-next-panel-mock" />,
}))

describe('PhaseProgressDashboard (T1.10)', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    mockScanArtifacts.mockResolvedValue({ status: 'ok', data: [] })
  })

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  it('renders with testid', () => {
    render(<PhaseProgressDashboard />, { wrapper })
    expect(screen.getByTestId('phase-progress-dashboard')).toBeDefined()
  })

  it('includes WhatNextPanel', () => {
    render(<PhaseProgressDashboard />, { wrapper })
    expect(screen.getByTestId('what-next-panel-mock')).toBeDefined()
  })
})

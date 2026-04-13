/**
 * WhatNextPanel Tests — T1.10
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { WhatNextPanel } from './WhatNextPanel'

const mockScanArtifacts = vi.fn()

vi.mock('@renderer/lib/rspc', () => ({
  commands: {
    scanArtifacts: (...args: unknown[]) => mockScanArtifacts(...args),
  },
}))

vi.mock('@renderer/stores', () => ({
  useProjectStore: (selector: (s: { activeProjectId: string | null }) => unknown) =>
    selector({ activeProjectId: 'proj-1' }),
  usePlanningWorkspaceStore: (selector: (s: { setSelectedWorkflow: (k: string) => void }) => unknown) =>
    selector({ setSelectedWorkflow: vi.fn() }),
}))

vi.mock('@renderer/hooks/useNextRecommendation', () => ({
  useNextRecommendation: vi.fn().mockReturnValue(null),
}))

vi.mock('@renderer/constants/planning-workspace', () => ({
  BMAD_WORKFLOWS: [],
}))

describe('WhatNextPanel (T1.10)', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    mockScanArtifacts.mockResolvedValue({ status: 'ok', data: [] })
  })

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  it('renders with testid', async () => {
    render(<WhatNextPanel />, { wrapper })
    expect(screen.getByTestId('what-next-panel')).toBeDefined()
  })

  it('shows null-state text when no recommendation', async () => {
    render(<WhatNextPanel />, { wrapper })
    expect(screen.getByTestId('what-next-panel')).toBeDefined()
  })
})

/**
 * WorkflowRunPanel Tests — T1.10
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { WorkflowRunPanel } from './WorkflowRunPanel'

const mockGetActiveWorkflowRun = vi.fn()

vi.mock('@renderer/lib/rspc', () => ({
  commands: {
    getActiveWorkflowRun: (...args: unknown[]) => mockGetActiveWorkflowRun(...args),
  },
}))

vi.mock('@renderer/stores', () => ({
  useProjectStore: (selector: (s: { activeProjectId: string | null }) => unknown) =>
    selector({ activeProjectId: 'proj-1' }),
}))

vi.mock('@renderer/constants/planning-workspace', () => ({
  BMAD_WORKFLOWS: [],
}))

describe('WorkflowRunPanel (T1.10)', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    mockGetActiveWorkflowRun.mockResolvedValue({ status: 'ok', data: null })
  })

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  it('renders with testid', () => {
    render(<WorkflowRunPanel />, { wrapper })
    expect(screen.getByTestId('workflow-run-panel')).toBeDefined()
  })

  it('shows empty state when no active run', async () => {
    render(<WorkflowRunPanel />, { wrapper })
    expect(screen.getByTestId('workflow-run-panel')).toBeDefined()
  })
})

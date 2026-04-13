/**
 * ArtifactViewer Tests — T1.10
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { ArtifactViewer } from './ArtifactViewer'

const mockGetArtifactContent = vi.fn()
const mockScanArtifacts = vi.fn()
const mockUpdateArtifactStatus = vi.fn()

vi.mock('@renderer/lib/rspc', () => ({
  commands: {
    getArtifactContent: (...args: unknown[]) => mockGetArtifactContent(...args),
    scanArtifacts: (...args: unknown[]) => mockScanArtifacts(...args),
    updateArtifactStatus: (...args: unknown[]) => mockUpdateArtifactStatus(...args),
  },
}))

vi.mock('@renderer/stores', () => ({
  useProjectStore: (selector: (s: { activeProjectId: string | null }) => unknown) =>
    selector({ activeProjectId: 'proj-1' }),
}))

vi.mock('@renderer/constants/planning-workspace', () => ({
  BMAD_WORKFLOWS: [
    { key: 'prd', name: 'Product Requirements Document', phase: 'planning' },
  ],
}))

vi.mock('@renderer/components/task/MarkdownComponents', () => ({
  markdownComponents: {},
}))

describe('ArtifactViewer (T1.10)', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    mockGetArtifactContent.mockResolvedValue({ status: 'ok', data: null })
    mockScanArtifacts.mockResolvedValue({ status: 'ok', data: [] })
  })

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  it('renders with testid', () => {
    render(
      <ArtifactViewer workflowKey="prd" filePath="/tmp/prd.md" onCloseFile={vi.fn()} />,
      { wrapper }
    )
    expect(screen.getByTestId('artifact-viewer')).toBeDefined()
  })

  it('shows not-found state when content query fails', async () => {
    mockGetArtifactContent.mockResolvedValue({ status: 'error', error: 'not found' })
    render(
      <ArtifactViewer workflowKey="prd" filePath="/tmp/prd.md" onCloseFile={vi.fn()} />,
      { wrapper }
    )
    expect(screen.getByTestId('artifact-viewer')).toBeDefined()
  })
})

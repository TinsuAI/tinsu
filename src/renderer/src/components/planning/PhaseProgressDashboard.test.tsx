import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PhaseProgressDashboard } from './PhaseProgressDashboard'

// Mock data
const mockScanData = [
  { workflowKey: 'brainstorming', filename: 'product-brief.md', exists: true, lastModified: 1700000000000, sizeBytes: 1024, status: 'draft' as const },
  { workflowKey: 'product-brief', filename: 'product-brief.md', exists: true, lastModified: 1700000000000, sizeBytes: 1024, status: 'draft' as const },
  { workflowKey: 'market-research', filename: 'market-research.md', exists: false, lastModified: null, sizeBytes: null, status: 'missing' as const },
  { workflowKey: 'domain-research', filename: 'domain-research.md', exists: false, lastModified: null, sizeBytes: null, status: 'missing' as const },
  { workflowKey: 'prd', filename: 'prd.md', exists: true, lastModified: 1700000000000, sizeBytes: 2048, status: 'approved' as const },
  { workflowKey: 'ux-design', filename: 'ux-design-specification.md', exists: false, lastModified: null, sizeBytes: null, status: 'missing' as const },
  { workflowKey: 'architecture', filename: 'architecture.md', exists: true, lastModified: 1700000000000, sizeBytes: 4096, status: 'draft' as const },
  { workflowKey: 'epics-stories', filename: 'epics.md', exists: false, lastModified: null, sizeBytes: null, status: 'missing' as const },
  { workflowKey: 'readiness-check', filename: 'readiness-check.md', exists: false, lastModified: null, sizeBytes: null, status: 'missing' as const }
]

const mockAllMissing = mockScanData.map((a) => ({
  ...a,
  exists: false,
  lastModified: null,
  sizeBytes: null,
  status: 'missing' as const
}))

// Mock tRPC
const mockRefetch = vi.fn()
const mockMutate = vi.fn()

vi.mock('@renderer/lib/trpc', () => ({
  trpc: {
    project: {
      getCurrent: {
        useQuery: vi.fn(() => ({
          data: { id: 'project-1', path: '/test', config: { projectName: 'Test' }, isNewProject: false }
        }))
      }
    },
    planning: {
      scanArtifacts: {
        useQuery: vi.fn(() => ({
          data: mockScanData,
          refetch: mockRefetch
        }))
      },
      updateArtifactStatus: {
        useMutation: vi.fn(() => ({
          mutate: mockMutate
        }))
      }
    }
  }
}))

// Mock stores
const mockSetSelectedWorkflow = vi.fn()
vi.mock('@renderer/stores', () => ({
  usePlanningWorkspaceStore: vi.fn((selector: any) => {
    const state = {
      setSelectedWorkflow: mockSetSelectedWorkflow,
      activePhase: 'analysis',
      selectedWorkflowKey: null,
      isOpen: true
    }
    return selector ? selector(state) : state
  })
}))

vi.mock('@renderer/stores/project.store', () => ({
  useProjectStore: vi.fn((selector: any) => {
    const state = { projectName: 'TestProject', projectPath: '/test' }
    return selector ? selector(state) : state
  })
}))

// Import after mocks
import { trpc } from '@renderer/lib/trpc'

// Mock WhatNextPanel to isolate PhaseProgressDashboard tests
vi.mock('./WhatNextPanel', () => ({
  WhatNextPanel: () => <div data-testid="what-next-panel">WhatNextPanel</div>
}))

describe('PhaseProgressDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset to default scan data
    vi.mocked(trpc.planning.scanArtifacts.useQuery).mockReturnValue({
      data: mockScanData,
      refetch: mockRefetch
    } as any)
  })

  describe('normal state with artifacts', () => {
    it('renders the Project Health section', () => {
      render(<PhaseProgressDashboard />)
      expect(screen.getByText('Project Health')).toBeInTheDocument()
    })

    it('renders the Planning Phases section', () => {
      render(<PhaseProgressDashboard />)
      expect(screen.getByText('Planning Phases')).toBeInTheDocument()
    })

    it('shows all 3 phase cards', () => {
      render(<PhaseProgressDashboard />)
      expect(screen.getByText('Analysis')).toBeInTheDocument()
      expect(screen.getByText('Planning')).toBeInTheDocument()
      expect(screen.getByText('Solutioning')).toBeInTheDocument()
    })

    it('shows health checklist items', () => {
      render(<PhaseProgressDashboard />)
      // These appear in both the health panel and phase cards
      expect(screen.getAllByText('Product Brief').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('PRD').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Architecture').length).toBeGreaterThanOrEqual(1)
    })

    it('shows optional label for UX Spec', () => {
      render(<PhaseProgressDashboard />)
      expect(screen.getByText('(optional)')).toBeInTheDocument()
    })

    it('displays Draft badges for draft artifacts', () => {
      render(<PhaseProgressDashboard />)
      const draftBadges = screen.getAllByText('Draft')
      expect(draftBadges.length).toBeGreaterThan(0)
    })

    it('displays Approved badges for approved artifacts', () => {
      render(<PhaseProgressDashboard />)
      const approvedBadges = screen.getAllByText('Approved')
      expect(approvedBadges.length).toBeGreaterThan(0)
    })

    it('displays Missing badges for missing artifacts', () => {
      render(<PhaseProgressDashboard />)
      const missingBadges = screen.getAllByText('Missing')
      expect(missingBadges.length).toBeGreaterThan(0)
    })

    it('shows artifact count in health panel', () => {
      render(<PhaseProgressDashboard />)
      // 3 artifacts exist out of 6 health items
      expect(screen.getByText('3/6 artifacts')).toBeInTheDocument()
    })
  })

  describe('status badge interaction', () => {
    it('calls updateArtifactStatus when clicking a Draft badge', () => {
      render(<PhaseProgressDashboard />)

      const draftBadges = screen.getAllByText('Draft')
      fireEvent.click(draftBadges[0])

      expect(mockMutate).toHaveBeenCalledWith({
        projectId: 'project-1',
        artifactKey: expect.any(String),
        status: 'in-review'
      })
    })

    it('calls updateArtifactStatus when clicking an Approved badge', () => {
      render(<PhaseProgressDashboard />)

      const approvedBadges = screen.getAllByText('Approved')
      fireEvent.click(approvedBadges[0])

      expect(mockMutate).toHaveBeenCalledWith({
        projectId: 'project-1',
        artifactKey: expect.any(String),
        status: 'draft'
      })
    })
  })

  describe('empty state', () => {
    beforeEach(() => {
      vi.mocked(trpc.planning.scanArtifacts.useQuery).mockReturnValue({
        data: mockAllMissing,
        refetch: mockRefetch
      } as any)
    })

    it('shows empty state message when all artifacts are missing', () => {
      render(<PhaseProgressDashboard />)
      expect(
        screen.getByText('No artifacts yet. Start with brainstorming or create a product brief.')
      ).toBeInTheDocument()
    })

    it('shows guidance text in empty state', () => {
      render(<PhaseProgressDashboard />)
      expect(
        screen.getByText(/No artifacts yet\. Start with brainstorming or create a product brief\./)
      ).toBeInTheDocument()
    })

    it('shows Start Planning button in empty state', () => {
      render(<PhaseProgressDashboard />)
      const button = screen.getByText('Start Planning')
      expect(button).toBeInTheDocument()
    })

    it('calls setSelectedWorkflow when Start Planning is clicked', () => {
      render(<PhaseProgressDashboard />)
      fireEvent.click(screen.getByText('Start Planning'))
      expect(mockSetSelectedWorkflow).toHaveBeenCalledWith('product-brief')
    })
  })

  describe('loading state', () => {
    it('shows loading spinner when data is not yet available', () => {
      vi.mocked(trpc.project.getCurrent.useQuery).mockReturnValue({
        data: undefined
      } as any)

      render(<PhaseProgressDashboard />)
      expect(screen.getByText('Scanning artifacts...')).toBeInTheDocument()
    })
  })

  describe('error state', () => {
    it('shows error message when scan query fails', () => {
      vi.mocked(trpc.planning.scanArtifacts.useQuery).mockReturnValue({
        data: undefined,
        refetch: mockRefetch,
        isError: true
      } as any)

      render(<PhaseProgressDashboard />)
      expect(screen.getByText(/unable to scan artifacts/i)).toBeInTheDocument()
    })
  })

  describe('WhatNextPanel integration (Story 9.4)', () => {
    beforeEach(() => {
      vi.mocked(trpc.project.getCurrent.useQuery).mockReturnValue({
        data: { id: 'project-1', path: '/test', config: { projectName: 'Test' }, isNewProject: false }
      } as any)
      vi.mocked(trpc.planning.scanArtifacts.useQuery).mockReturnValue({
        data: mockScanData,
        refetch: mockRefetch
      } as any)
    })

    it('renders WhatNextPanel above the Project Health section', () => {
      render(<PhaseProgressDashboard />)
      const whatNext = screen.getByTestId('what-next-panel')
      expect(whatNext).toBeInTheDocument()

      // Verify WhatNextPanel appears before Project Health in DOM order
      const projectHealth = screen.getByText('Project Health')
      expect(whatNext.compareDocumentPosition(projectHealth) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })
  })
})

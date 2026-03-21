import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WhatNextPanel } from './WhatNextPanel'

// Mock scan data — product-brief exists, prd is next
const mockScanData = [
  { workflowKey: 'brainstorming', filename: 'product-brief.md', exists: true, lastModified: 1700000000000, sizeBytes: 1024, status: 'draft' as const },
  { workflowKey: 'product-brief', filename: 'product-brief.md', exists: true, lastModified: 1700000000000, sizeBytes: 1024, status: 'draft' as const },
  { workflowKey: 'market-research', filename: 'market-research.md', exists: false, lastModified: null, sizeBytes: null, status: 'missing' as const },
  { workflowKey: 'domain-research', filename: 'domain-research.md', exists: false, lastModified: null, sizeBytes: null, status: 'missing' as const },
  { workflowKey: 'prd', filename: 'prd.md', exists: false, lastModified: null, sizeBytes: null, status: 'missing' as const },
  { workflowKey: 'ux-design', filename: 'ux-design-specification.md', exists: false, lastModified: null, sizeBytes: null, status: 'missing' as const },
  { workflowKey: 'architecture', filename: 'architecture.md', exists: false, lastModified: null, sizeBytes: null, status: 'missing' as const },
  { workflowKey: 'epics-stories', filename: 'epics.md', exists: false, lastModified: null, sizeBytes: null, status: 'missing' as const },
  { workflowKey: 'readiness-check', filename: 'readiness-check.md', exists: false, lastModified: null, sizeBytes: null, status: 'missing' as const }
]

// All artifacts exist → completion state
const mockAllExist = mockScanData.map((a) => ({
  ...a,
  exists: true,
  lastModified: 1700000000000,
  sizeBytes: 1024,
  status: 'draft' as const
}))

// Artifacts up to architecture exist, UX missing → optional ux-design recommended
const mockUxOptional = mockScanData.map((a) => ({
  ...a,
  exists: ['brainstorming', 'product-brief', 'prd', 'architecture'].includes(a.workflowKey),
  lastModified: ['brainstorming', 'product-brief', 'prd', 'architecture'].includes(a.workflowKey) ? 1700000000000 : null,
  sizeBytes: ['brainstorming', 'product-brief', 'prd', 'architecture'].includes(a.workflowKey) ? 1024 : null,
  status: ['brainstorming', 'product-brief', 'prd', 'architecture'].includes(a.workflowKey) ? 'draft' as const : 'missing' as const
}))

// Mock tRPC
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
          data: mockScanData
        }))
      }
    }
  }
}))

// Mock stores
const mockSetActivePhase = vi.fn()
const mockSetSelectedWorkflow = vi.fn()

vi.mock('@renderer/stores', () => ({
  usePlanningWorkspaceStore: vi.fn((selector: any) => {
    const state = {
      setActivePhase: mockSetActivePhase,
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

describe('WhatNextPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(trpc.planning.scanArtifacts.useQuery).mockReturnValue({
      data: mockScanData
    } as any)
    vi.mocked(trpc.project.getCurrent.useQuery).mockReturnValue({
      data: { id: 'project-1', path: '/test', config: { projectName: 'Test' }, isNewProject: false }
    } as any)
  })

  describe('recommendation state', () => {
    it('renders the Next Step heading', () => {
      render(<WhatNextPanel />)
      expect(screen.getByText('Next Step')).toBeInTheDocument()
    })

    it('shows the recommended workflow name', () => {
      render(<WhatNextPanel />)
      expect(screen.getByText('Create PRD')).toBeInTheDocument()
    })

    it('shows the reason text', () => {
      render(<WhatNextPanel />)
      expect(
        screen.getByText('Product Brief is complete. PRD defines requirements before solutioning.')
      ).toBeInTheDocument()
    })

    it('shows the produces filename', () => {
      render(<WhatNextPanel />)
      expect(screen.getByText('prd.md')).toBeInTheDocument()
    })

    it('renders a Start button', () => {
      render(<WhatNextPanel />)
      expect(screen.getByText('Start')).toBeInTheDocument()
    })

    it('navigates to the correct phase and workflow on Start click', () => {
      render(<WhatNextPanel />)
      fireEvent.click(screen.getByText('Start'))
      expect(mockSetActivePhase).toHaveBeenCalledWith('planning')
      expect(mockSetSelectedWorkflow).toHaveBeenCalledWith('prd')
    })
  })

  describe('optional step with skip', () => {
    beforeEach(() => {
      vi.mocked(trpc.planning.scanArtifacts.useQuery).mockReturnValue({
        data: mockUxOptional
      } as any)
    })

    it('shows optional badge for UX Design', () => {
      render(<WhatNextPanel />)
      expect(screen.getByText('optional')).toBeInTheDocument()
    })

    it('shows Skip button for optional steps', () => {
      render(<WhatNextPanel />)
      expect(screen.getByText('Skip')).toBeInTheDocument()
    })

    it('shows UX Design as the recommended workflow', () => {
      render(<WhatNextPanel />)
      expect(screen.getByText('UX Design')).toBeInTheDocument()
    })

    it('advances to next recommendation when Skip is clicked', () => {
      render(<WhatNextPanel />)
      fireEvent.click(screen.getByText('Skip'))
      // After skipping ux-design, should show epics-stories
      expect(screen.getByText('Create Epics & Stories')).toBeInTheDocument()
    })
  })

  describe('completion state', () => {
    beforeEach(() => {
      vi.mocked(trpc.planning.scanArtifacts.useQuery).mockReturnValue({
        data: mockAllExist
      } as any)
    })

    it('shows All Planning Complete heading', () => {
      render(<WhatNextPanel />)
      expect(screen.getByText('All Planning Complete')).toBeInTheDocument()
    })

    it('shows completion message', () => {
      render(<WhatNextPanel />)
      expect(screen.getByText('All planning artifacts are complete!')).toBeInTheDocument()
    })

    it('shows Planning Status section header', () => {
      render(<WhatNextPanel />)
      expect(screen.getByText('Planning Status')).toBeInTheDocument()
    })
  })

  describe('loading state', () => {
    beforeEach(() => {
      vi.mocked(trpc.project.getCurrent.useQuery).mockReturnValue({
        data: undefined
      } as any)
    })

    it('shows skeleton loading state when project is not loaded', () => {
      render(<WhatNextPanel />)
      const section = screen.getByLabelText('What next recommendation loading')
      expect(section).toBeInTheDocument()
    })
  })
})

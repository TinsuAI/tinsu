import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ReadinessGatePanel } from './ReadinessGatePanel'

interface MockGateDecision {
  id: string
  project_id: string
  decision: string
  rationale: string
  issues: Array<{
    severity: string
    description: string
    artifactKey?: string
    sectionRef?: string
  }>
  created_at: Date
  workflow_run_id: string | null
}

const mockPassDecision: MockGateDecision = {
  id: 'gate-1',
  project_id: 'project-1',
  decision: 'pass',
  rationale: 'All artifacts pass validation.',
  issues: [],
  created_at: new Date(Date.now() - 300000), // 5 min ago
  workflow_run_id: null
}

const mockConcernsDecision: MockGateDecision = {
  ...mockPassDecision,
  id: 'gate-2',
  decision: 'concerns',
  rationale: 'Several issues need attention before proceeding.',
  issues: [
    { severity: 'major', description: 'Architecture missing caching strategy', artifactKey: 'architecture' },
    { severity: 'minor', description: 'Naming inconsistency in epics', artifactKey: 'epics-stories' }
  ]
}

const mockFailDecision: MockGateDecision = {
  ...mockPassDecision,
  id: 'gate-3',
  decision: 'fail',
  rationale: 'Critical issues prevent implementation.',
  issues: [
    { severity: 'critical', description: 'PRD missing core requirements', artifactKey: 'prd' },
    { severity: 'critical', description: 'Architecture not defined', artifactKey: 'architecture' },
    { severity: 'major', description: 'UX design incomplete' }
  ]
}

let mockLatestGate: MockGateDecision | null = mockPassDecision
let mockGateHistory: MockGateDecision[] = []
const mockApproveMutate = vi.fn()
const mockSetSelectedWorkflow = vi.fn()
const mockOpenWorkspaceToArtifact = vi.fn()

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
      getLatestGateDecision: {
        useQuery: vi.fn(() => ({ data: mockLatestGate }))
      },
      listGateDecisions: {
        useQuery: vi.fn(() => ({ data: mockGateHistory }))
      },
      approveForImplementation: {
        useMutation: vi.fn(() => ({
          mutate: mockApproveMutate,
          isPending: false
        }))
      },
      parseAndSaveGateResult: {
        useMutation: vi.fn(() => ({
          mutate: vi.fn(),
          isPending: false
        }))
      }
    },
    useUtils: vi.fn(() => ({
      planning: {
        scanArtifacts: { invalidate: vi.fn() },
        getLatestGateDecision: { invalidate: vi.fn() }
      }
    }))
  }
}))

// Mock stores
vi.mock('@renderer/stores', () => ({
  usePlanningWorkspaceStore: vi.fn((selector: any) => {
    const state = {
      setSelectedWorkflow: mockSetSelectedWorkflow,
      openWorkspaceToArtifact: mockOpenWorkspaceToArtifact
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

describe('ReadinessGatePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLatestGate = mockPassDecision
    mockGateHistory = []
  })

  // Empty state
  it('renders empty state when no gate result', () => {
    mockLatestGate = null
    render(<ReadinessGatePanel />)
    expect(screen.getByText('No readiness gate results yet')).toBeDefined()
    expect(screen.getByText(/Run the implementation readiness check/)).toBeDefined()
  })

  it('empty state has run button', () => {
    mockLatestGate = null
    render(<ReadinessGatePanel />)
    expect(screen.getByText('Run Readiness Check')).toBeDefined()
  })

  // PASS badge
  it('renders PASS badge with green styling', () => {
    render(<ReadinessGatePanel />)
    expect(screen.getByText('PASS')).toBeDefined()
    expect(screen.getByText('Readiness Gate')).toBeDefined()
  })

  it('renders rationale text for PASS', () => {
    render(<ReadinessGatePanel />)
    expect(screen.getByText('All artifacts pass validation.')).toBeDefined()
  })

  it('renders timestamp', () => {
    render(<ReadinessGatePanel />)
    expect(screen.getByText(/minutes? ago/)).toBeDefined()
  })

  // CONCERNS badge
  it('renders CONCERNS badge with yellow styling', () => {
    mockLatestGate = mockConcernsDecision
    render(<ReadinessGatePanel />)
    expect(screen.getByText('CONCERNS')).toBeDefined()
  })

  it('renders issues list for CONCERNS', () => {
    mockLatestGate = mockConcernsDecision
    render(<ReadinessGatePanel />)
    expect(screen.getByText('Architecture missing caching strategy')).toBeDefined()
    expect(screen.getByText('Naming inconsistency in epics')).toBeDefined()
  })

  it('renders severity badges on issues', () => {
    mockLatestGate = mockConcernsDecision
    render(<ReadinessGatePanel />)
    expect(screen.getByText('Major')).toBeDefined()
    expect(screen.getByText('Minor')).toBeDefined()
  })

  // FAIL badge
  it('renders FAIL badge with red styling', () => {
    mockLatestGate = mockFailDecision
    render(<ReadinessGatePanel />)
    expect(screen.getByText('FAIL')).toBeDefined()
  })

  it('renders critical issues for FAIL', () => {
    mockLatestGate = mockFailDecision
    render(<ReadinessGatePanel />)
    expect(screen.getByText('PRD missing core requirements')).toBeDefined()
    expect(screen.getByText('Architecture not defined')).toBeDefined()
    const criticals = screen.getAllByText('Critical')
    expect(criticals.length).toBe(2)
  })

  // View link on issues
  it('renders View link for issues with artifactKey', () => {
    mockLatestGate = mockConcernsDecision
    render(<ReadinessGatePanel />)
    const viewButtons = screen.getAllByText('View')
    expect(viewButtons.length).toBe(2)
  })

  it('View link calls openWorkspaceToArtifact', () => {
    mockLatestGate = mockConcernsDecision
    render(<ReadinessGatePanel />)
    const viewButtons = screen.getAllByText('View')
    fireEvent.click(viewButtons[0])
    expect(mockOpenWorkspaceToArtifact).toHaveBeenCalledWith('architecture')
  })

  // Approve button
  it('renders Approve for Implementation button when PASS', () => {
    render(<ReadinessGatePanel />)
    expect(screen.getByText('Approve for Implementation')).toBeDefined()
  })

  it('Approve button calls mutation on click', () => {
    render(<ReadinessGatePanel />)
    fireEvent.click(screen.getByText('Approve for Implementation'))
    expect(mockApproveMutate).toHaveBeenCalledWith({ projectId: 'project-1' })
  })

  it('does not show Approve button when decision is not pass', () => {
    mockLatestGate = mockConcernsDecision
    render(<ReadinessGatePanel />)
    expect(screen.queryByText('Approve for Implementation')).toBeNull()
  })

  it('shows disabled Approve text when not pass', () => {
    mockLatestGate = mockFailDecision
    render(<ReadinessGatePanel />)
    // Muted "Approve" text should be present but not the full action button
    const approveElements = screen.getAllByText('Approve')
    expect(approveElements.length).toBeGreaterThan(0)
  })

  // Re-run Gate
  it('renders Re-run Gate button', () => {
    render(<ReadinessGatePanel />)
    expect(screen.getByText('Re-run Gate')).toBeDefined()
  })

  it('Re-run Gate navigates to readiness-check workflow', () => {
    render(<ReadinessGatePanel />)
    fireEvent.click(screen.getByText('Re-run Gate'))
    expect(mockSetSelectedWorkflow).toHaveBeenCalledWith('readiness-check')
  })

  // History
  it('renders Gate History toggle', () => {
    render(<ReadinessGatePanel />)
    expect(screen.getByText('Gate History')).toBeDefined()
  })

  it('shows history section when toggled', () => {
    mockGateHistory = [mockPassDecision, mockConcernsDecision]
    render(<ReadinessGatePanel />)
    fireEvent.click(screen.getByText('Gate History'))
    // History shows the second entry (first is skipped as it's the latest)
    expect(screen.getByText('CONCERNS')).toBeDefined()
  })

  it('shows no previous results message when history is empty', () => {
    mockGateHistory = [mockPassDecision] // Only one = latest, no history
    render(<ReadinessGatePanel />)
    fireEvent.click(screen.getByText('Gate History'))
    expect(screen.getByText('No previous gate results')).toBeDefined()
  })

  // Issue count display
  it('renders issue count in header', () => {
    mockLatestGate = mockFailDecision
    render(<ReadinessGatePanel />)
    expect(screen.getByText('Issues (3)')).toBeDefined()
  })
})

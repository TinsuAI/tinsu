import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RecentRunsTable } from './RecentRunsTable'

const mockRuns = [
  {
    id: 'run-1',
    project_id: 'project-1',
    workflow_key: 'prd',
    phase: 'planning',
    status: 'succeeded',
    started_at: new Date(Date.now() - 3600000), // 1h ago
    finished_at: new Date(Date.now() - 3000000), // 50m ago
    input_artifacts: ['product-brief'],
    output_artifacts: ['prd.md'],
    agent_name: 'bmad:bmm:agents:pm',
    task_id: 'task-1'
  },
  {
    id: 'run-2',
    project_id: 'project-1',
    workflow_key: 'architecture',
    phase: 'solutioning',
    status: 'failed',
    started_at: new Date(Date.now() - 7200000), // 2h ago
    finished_at: new Date(Date.now() - 7100000),
    input_artifacts: ['prd'],
    output_artifacts: [],
    agent_name: 'bmad:bmm:agents:architect',
    task_id: 'task-2'
  }
]

let mockRunsResult: typeof mockRuns | undefined = mockRuns
let mockIsPending = false

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
      listWorkflowRuns: {
        useQuery: vi.fn(() => ({ data: mockRunsResult, isPending: mockIsPending }))
      }
    }
  }
}))

// Mock stores
const mockOpenWorkspaceToArtifact = vi.fn()

vi.mock('@renderer/stores', () => ({
  usePlanningWorkspaceStore: vi.fn((selector: any) => {
    const state = { openWorkspaceToArtifact: mockOpenWorkspaceToArtifact }
    return selector ? selector(state) : state
  })
}))

vi.mock('@renderer/stores/project.store', () => ({
  useProjectStore: vi.fn((selector: any) => {
    const state = { projectName: 'TestProject', projectPath: '/test' }
    return selector ? selector(state) : state
  })
}))

describe('RecentRunsTable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRunsResult = mockRuns
    mockIsPending = false
  })

  it('renders table with correct column headers', () => {
    render(<RecentRunsTable />)
    expect(screen.getByText('Workflow')).toBeDefined()
    expect(screen.getByText('Phase')).toBeDefined()
    expect(screen.getByText('Status')).toBeDefined()
    expect(screen.getByText('Started')).toBeDefined()
    expect(screen.getByText('Duration')).toBeDefined()
  })

  it('renders workflow names from BMAD_WORKFLOWS', () => {
    render(<RecentRunsTable />)
    expect(screen.getByText('Create PRD')).toBeDefined()
    expect(screen.getByText('Architecture')).toBeDefined()
  })

  it('renders status badges with correct labels', () => {
    render(<RecentRunsTable />)
    expect(screen.getByText('Succeeded')).toBeDefined()
    expect(screen.getByText('Failed')).toBeDefined()
  })

  it('renders empty state when no runs', () => {
    mockRunsResult = []
    render(<RecentRunsTable />)
    expect(screen.getByText(/no workflow runs yet/i)).toBeDefined()
  })

  it('renders loading state with skeletons', () => {
    mockIsPending = true
    mockRunsResult = undefined
    render(<RecentRunsTable />)
    // Loading state shows the heading
    expect(screen.getByText('Recent Runs')).toBeDefined()
  })

  it('expanding a row shows detail section with agent name', () => {
    render(<RecentRunsTable />)
    // Click the first row (Create PRD)
    fireEvent.click(screen.getByText('Create PRD'))
    expect(screen.getByText('bmad:bmm:agents:pm')).toBeDefined()
  })

  it('expanding a row shows input artifacts', () => {
    render(<RecentRunsTable />)
    fireEvent.click(screen.getByText('Create PRD'))
    expect(screen.getByText('product-brief')).toBeDefined()
  })

  it('expanding a row shows output artifact links', () => {
    render(<RecentRunsTable />)
    fireEvent.click(screen.getByText('Create PRD'))
    expect(screen.getByText('prd.md')).toBeDefined()
  })

  it('clicking output artifact link navigates to artifact viewer', () => {
    render(<RecentRunsTable />)
    fireEvent.click(screen.getByText('Create PRD'))
    fireEvent.click(screen.getByText('prd.md'))
    expect(mockOpenWorkspaceToArtifact).toHaveBeenCalledWith('prd')
  })

  it('collapsing an expanded row hides details', () => {
    render(<RecentRunsTable />)
    // Expand
    fireEvent.click(screen.getByText('Create PRD'))
    expect(screen.getByText('bmad:bmm:agents:pm')).toBeDefined()

    // Collapse
    fireEvent.click(screen.getByText('Create PRD'))
    expect(screen.queryByText('bmad:bmm:agents:pm')).toBeNull()
  })

  it('shows run count in header', () => {
    render(<RecentRunsTable />)
    expect(screen.getByText('2 runs')).toBeDefined()
  })

  it('renders phase badges', () => {
    render(<RecentRunsTable />)
    expect(screen.getByText('planning')).toBeDefined()
    expect(screen.getByText('solutioning')).toBeDefined()
  })
})

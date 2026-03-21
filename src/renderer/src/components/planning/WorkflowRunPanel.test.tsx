import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WorkflowRunPanel } from './WorkflowRunPanel'

interface MockRun {
  id: string
  project_id: string
  workflow_key: string
  phase: string
  status: string
  started_at: Date
  finished_at: Date | null
  input_artifacts: string[]
  output_artifacts: string[]
  agent_name: string | null
  task_id: string | null
}

const mockActiveRun: MockRun = {
  id: 'run-1',
  project_id: 'project-1',
  workflow_key: 'prd',
  phase: 'planning',
  status: 'running',
  started_at: new Date(Date.now() - 120000), // 2 min ago
  finished_at: null,
  input_artifacts: ['product-brief'],
  output_artifacts: [],
  agent_name: 'bmad:bmm:agents:pm',
  task_id: 'task-1'
}

const mockSucceededRun: MockRun = {
  ...mockActiveRun,
  status: 'succeeded',
  finished_at: new Date(),
  output_artifacts: ['prd.md']
}

let mockGetActiveResult: typeof mockActiveRun | null = mockActiveRun

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
      getActiveWorkflowRun: {
        useQuery: vi.fn(() => ({ data: mockGetActiveResult }))
      }
    }
  }
}))

// Mock stores
const mockCloseWorkspace = vi.fn()
const mockOpenWorkspaceToArtifact = vi.fn()
const mockOpenTaskWorkspace = vi.fn()

vi.mock('@renderer/stores', () => ({
  usePlanningWorkspaceStore: vi.fn((selector: any) => {
    const state = {
      closeWorkspace: mockCloseWorkspace,
      openWorkspaceToArtifact: mockOpenWorkspaceToArtifact
    }
    return selector ? selector(state) : state
  })
}))

vi.mock('@renderer/stores/task-workspace.store', () => ({
  useTaskWorkspaceStore: vi.fn((selector: any) => {
    const state = { openWorkspace: mockOpenTaskWorkspace }
    return selector ? selector(state) : state
  })
}))

vi.mock('@renderer/stores/project.store', () => ({
  useProjectStore: vi.fn((selector: any) => {
    const state = { projectName: 'TestProject', projectPath: '/test' }
    return selector ? selector(state) : state
  })
}))

describe('WorkflowRunPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetActiveResult = mockActiveRun
  })

  it('renders nothing when no active run', () => {
    mockGetActiveResult = null
    const { container } = render(<WorkflowRunPanel />)
    expect(container.innerHTML).toBe('')
  })

  it('renders workflow name and status for active run', () => {
    render(<WorkflowRunPanel />)
    expect(screen.getByText('Create PRD')).toBeDefined()
    expect(screen.getByText('Running')).toBeDefined()
  })

  it('renders phase badge', () => {
    render(<WorkflowRunPanel />)
    expect(screen.getByText('planning')).toBeDefined()
  })

  it('renders agent name', () => {
    render(<WorkflowRunPanel />)
    expect(screen.getByText('bmad:bmm:agents:pm')).toBeDefined()
  })

  it('renders input artifact tags', () => {
    render(<WorkflowRunPanel />)
    expect(screen.getByText('product-brief')).toBeDefined()
  })

  it('renders View Terminal button when task_id present', () => {
    render(<WorkflowRunPanel />)
    expect(screen.getByText('View Terminal')).toBeDefined()
  })

  it('View Terminal button navigates to task workspace', () => {
    render(<WorkflowRunPanel />)
    fireEvent.click(screen.getByText('View Terminal'))
    expect(mockCloseWorkspace).toHaveBeenCalled()
    expect(mockOpenTaskWorkspace).toHaveBeenCalledWith('task-1')
  })

  it('renders output artifact links when succeeded', () => {
    mockGetActiveResult = mockSucceededRun
    render(<WorkflowRunPanel />)
    expect(screen.getByText('prd.md')).toBeDefined()
    expect(screen.getByText('Succeeded')).toBeDefined()
  })

  it('clicking output artifact opens artifact viewer', () => {
    mockGetActiveResult = mockSucceededRun
    render(<WorkflowRunPanel />)
    fireEvent.click(screen.getByText('prd.md'))
    expect(mockOpenWorkspaceToArtifact).toHaveBeenCalledWith('prd')
  })

  it('renders needs-input status with correct label', () => {
    mockGetActiveResult = { ...mockActiveRun, status: 'needs-input' }
    render(<WorkflowRunPanel />)
    expect(screen.getByText('Needs Input')).toBeDefined()
  })

  it('renders failed status with correct label', () => {
    mockGetActiveResult = { ...mockActiveRun, status: 'failed' }
    render(<WorkflowRunPanel />)
    expect(screen.getByText('Failed')).toBeDefined()
  })

  it('renders cancelled status with correct label', () => {
    mockGetActiveResult = { ...mockActiveRun, status: 'cancelled' }
    render(<WorkflowRunPanel />)
    expect(screen.getByText('Cancelled')).toBeDefined()
  })
})

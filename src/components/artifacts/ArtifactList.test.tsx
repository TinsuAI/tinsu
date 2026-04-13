import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ArtifactList } from './ArtifactList'
import * as useTaskArtifactsModule from '@renderer/hooks/useTaskArtifacts'

// Mock the useTaskArtifacts hook
vi.mock('@renderer/hooks/useTaskArtifacts', () => ({
  useTaskArtifacts: vi.fn()
}))

const mockUseTaskArtifacts = vi.mocked(useTaskArtifactsModule.useTaskArtifacts)

const mockArtifacts: useTaskArtifactsModule.ArtifactWithStatus[] = [
  {
    id: 'artifact-1',
    task_id: 'task-1',
    artifact_type: 'prd',
    artifact_path: '/path/to/prd.md',
    section_ref: null,
    created_at: new Date(),
    exists: true,
    fileName: 'prd.md'
  },
  {
    id: 'artifact-2',
    task_id: 'task-1',
    artifact_type: 'architecture',
    artifact_path: '/path/to/architecture.md',
    section_ref: null,
    created_at: new Date(),
    exists: true,
    fileName: 'architecture.md'
  },
  {
    id: 'artifact-3',
    task_id: 'task-1',
    artifact_type: 'epics',
    artifact_path: '/path/to/epics.md',
    section_ref: 'Story-3.10',
    created_at: new Date(),
    exists: true,
    fileName: 'epics.md'
  },
  {
    id: 'artifact-4',
    task_id: 'task-1',
    artifact_type: 'ux_design',
    artifact_path: '/path/to/missing.md',
    section_ref: null,
    created_at: new Date(),
    exists: false,
    fileName: 'missing.md'
  }
]

const defaultHookReturn = {
  artifacts: mockArtifacts,
  isLoading: false,
  linkArtifact: vi.fn(),
  unlinkArtifact: vi.fn(),
  openInEditor: vi.fn(),
  isLinking: false,
  isUnlinking: false,
  isOpening: false,
  refreshArtifacts: vi.fn()
}

describe('ArtifactList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseTaskArtifacts.mockReturnValue(defaultHookReturn)
  })

  it('renders null when taskId is null', () => {
    const { container } = render(<ArtifactList taskId={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('shows loading state', () => {
    mockUseTaskArtifacts.mockReturnValue({
      ...defaultHookReturn,
      isLoading: true,
      artifacts: []
    })

    render(<ArtifactList taskId="task-1" />)
    // Should show loading spinner (svg with animate-spin class)
    expect(document.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('shows empty state when no artifacts', () => {
    mockUseTaskArtifacts.mockReturnValue({
      ...defaultHookReturn,
      artifacts: []
    })

    render(<ArtifactList taskId="task-1" />)
    expect(screen.getByText('No artifacts linked')).toBeInTheDocument()
  })

  it('renders all artifacts', () => {
    render(<ArtifactList taskId="task-1" />)

    expect(screen.getByText('prd.md')).toBeInTheDocument()
    expect(screen.getByText('architecture.md')).toBeInTheDocument()
    expect(screen.getByText('epics.md')).toBeInTheDocument()
    expect(screen.getByText('missing.md')).toBeInTheDocument()
  })

  it('shows artifact type badges', () => {
    render(<ArtifactList taskId="task-1" />)

    expect(screen.getByText('PRD')).toBeInTheDocument()
    expect(screen.getByText('Architecture')).toBeInTheDocument()
    expect(screen.getByText('Epics')).toBeInTheDocument()
    expect(screen.getByText('UX Design')).toBeInTheDocument()
  })

  it('shows section reference when present', () => {
    render(<ArtifactList taskId="task-1" />)

    expect(screen.getByText('#Story-3.10')).toBeInTheDocument()
  })

  it('shows missing indicator for non-existent files', () => {
    render(<ArtifactList taskId="task-1" />)

    expect(screen.getByText('Missing')).toBeInTheDocument()
  })

  it('calls openInEditor when clicking existing artifact', () => {
    const mockOpenInEditor = vi.fn()
    mockUseTaskArtifacts.mockReturnValue({
      ...defaultHookReturn,
      openInEditor: mockOpenInEditor
    })

    render(<ArtifactList taskId="task-1" />)

    // Click on the PRD artifact
    const prdItem = screen.getByText('prd.md').closest('[role="button"]')
    fireEvent.click(prdItem!)

    expect(mockOpenInEditor).toHaveBeenCalledWith('/path/to/prd.md')
  })

  it('does not call openInEditor when clicking missing artifact', () => {
    const mockOpenInEditor = vi.fn()
    mockUseTaskArtifacts.mockReturnValue({
      ...defaultHookReturn,
      openInEditor: mockOpenInEditor
    })

    render(<ArtifactList taskId="task-1" />)

    // Click on the missing artifact
    const missingItem = screen.getByText('missing.md').closest('[role="button"]')
    fireEvent.click(missingItem!)

    expect(mockOpenInEditor).not.toHaveBeenCalled()
  })

  it('shows full path in title attribute', () => {
    render(<ArtifactList taskId="task-1" />)

    const prdItem = screen.getByText('prd.md').closest('[role="button"]')
    expect(prdItem).toHaveAttribute('title', '/path/to/prd.md')
  })

  it('handles keyboard navigation with Enter key', () => {
    const mockOpenInEditor = vi.fn()
    mockUseTaskArtifacts.mockReturnValue({
      ...defaultHookReturn,
      openInEditor: mockOpenInEditor
    })

    render(<ArtifactList taskId="task-1" />)

    const prdItem = screen.getByText('prd.md').closest('[role="button"]')
    fireEvent.keyDown(prdItem!, { key: 'Enter' })

    expect(mockOpenInEditor).toHaveBeenCalledWith('/path/to/prd.md')
  })

  it('handles keyboard navigation with Space key', () => {
    const mockOpenInEditor = vi.fn()
    mockUseTaskArtifacts.mockReturnValue({
      ...defaultHookReturn,
      openInEditor: mockOpenInEditor
    })

    render(<ArtifactList taskId="task-1" />)

    const prdItem = screen.getByText('prd.md').closest('[role="button"]')
    fireEvent.keyDown(prdItem!, { key: ' ' })

    expect(mockOpenInEditor).toHaveBeenCalledWith('/path/to/prd.md')
  })

  it('applies custom className', () => {
    const { container } = render(<ArtifactList taskId="task-1" className="custom-class" />)

    expect(container.firstChild).toHaveClass('custom-class')
  })
})

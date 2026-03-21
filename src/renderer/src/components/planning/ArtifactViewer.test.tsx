import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ArtifactViewer } from './ArtifactViewer'
import { usePlanningWorkspaceStore } from '@renderer/stores/planning-workspace.store'

// Mock trpc
const mockGetArtifactContent = vi.fn()
const mockScanArtifacts = vi.fn()
const mockGetCurrent = vi.fn()
const mockUpdateArtifactStatus = vi.fn()
const mockInvalidate = vi.fn()

vi.mock('@renderer/lib/trpc', () => ({
  trpc: {
    project: {
      getCurrent: {
        useQuery: () => mockGetCurrent()
      }
    },
    planning: {
      getArtifactContent: {
        useQuery: (_input: unknown, _opts: unknown) => mockGetArtifactContent()
      },
      scanArtifacts: {
        useQuery: (_input: unknown, _opts: unknown) => mockScanArtifacts()
      },
      updateArtifactStatus: {
        useMutation: (opts: { onSuccess?: () => void }) => {
          mockUpdateArtifactStatus.mockImplementation(() => opts.onSuccess?.())
          return { mutate: mockUpdateArtifactStatus }
        }
      }
    },
    useUtils: () => ({
      planning: {
        scanArtifacts: {
          invalidate: mockInvalidate
        }
      }
    })
  }
}))

// Mock ReactMarkdown to avoid complex markdown rendering in tests
vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => (
    <div data-testid="react-markdown">{children}</div>
  )
}))

vi.mock('remark-gfm', () => ({
  default: () => {}
}))

// Mock MarkdownComponents
vi.mock('@renderer/components/task/MarkdownComponents', () => ({
  markdownComponents: {}
}))

describe('ArtifactViewer', () => {
  const mockArtifactContent = {
    content: '# Architecture\n\n## Overview\n\nThis is the architecture.\n\n### Details\n\nMore details here.',
    filePath: '_bmad-output/planning-artifacts/architecture.md',
    lastModified: 1711036500000, // Mar 21, 2026
    sizeBytes: 2048,
    wordCount: 42,
    workflowKey: 'architecture'
  }

  const mockArtifactsData = [
    {
      workflowKey: 'architecture',
      filename: 'architecture.md',
      exists: true,
      lastModified: 1711036500000,
      sizeBytes: 2048,
      status: 'draft'
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()

    // Reset store state
    usePlanningWorkspaceStore.setState({
      isOpen: true,
      activePhase: 'solutioning',
      selectedWorkflowKey: 'architecture'
    })

    // Default mocks - content loaded
    mockGetCurrent.mockReturnValue({ data: { id: 'project-1', name: 'Test' } })
    mockGetArtifactContent.mockReturnValue({ data: mockArtifactContent, isError: false })
    mockScanArtifacts.mockReturnValue({ data: mockArtifactsData })
  })

  describe('content rendering', () => {
    it('renders the artifact viewer with content', () => {
      render(<ArtifactViewer workflowKey="architecture" />)

      expect(screen.getByTestId('artifact-viewer')).toBeInTheDocument()
    })

    it('displays artifact name in header', () => {
      render(<ArtifactViewer workflowKey="architecture" />)

      // "Architecture" appears in header, outline, and markdown content — verify at least one
      expect(screen.getAllByText('Architecture').length).toBeGreaterThanOrEqual(1)
    })

    it('displays metadata bar with file path', () => {
      render(<ArtifactViewer workflowKey="architecture" />)

      expect(screen.getByText('_bmad-output/planning-artifacts/architecture.md')).toBeInTheDocument()
    })

    it('displays word count in metadata', () => {
      render(<ArtifactViewer workflowKey="architecture" />)

      expect(screen.getByText('42 words')).toBeInTheDocument()
    })

    it('renders markdown content area', () => {
      render(<ArtifactViewer workflowKey="architecture" />)

      expect(screen.getByTestId('markdown-content')).toBeInTheDocument()
    })
  })

  describe('section outline', () => {
    it('renders section outline panel', () => {
      render(<ArtifactViewer workflowKey="architecture" />)

      expect(screen.getByTestId('section-outline')).toBeInTheDocument()
      expect(screen.getByText('On this page')).toBeInTheDocument()
    })

    it('extracts headings from markdown content', () => {
      render(<ArtifactViewer workflowKey="architecture" />)

      const outline = screen.getByTestId('section-outline')
      // Headings should appear as buttons in the outline
      expect(outline.querySelectorAll('button').length).toBeGreaterThanOrEqual(3)
    })
  })

  describe('status badge', () => {
    it('displays draft status badge by default', () => {
      render(<ArtifactViewer workflowKey="architecture" />)

      expect(screen.getByTestId('status-badge')).toBeInTheDocument()
      expect(screen.getByTestId('status-badge')).toHaveTextContent('Draft')
    })

    it('displays approved status badge when artifact is approved', () => {
      mockScanArtifacts.mockReturnValue({
        data: [{ ...mockArtifactsData[0], status: 'approved' }]
      })

      render(<ArtifactViewer workflowKey="architecture" />)

      expect(screen.getByTestId('status-badge')).toHaveTextContent('Approved')
    })

    it('displays in-review status badge', () => {
      mockScanArtifacts.mockReturnValue({
        data: [{ ...mockArtifactsData[0], status: 'in-review' }]
      })

      render(<ArtifactViewer workflowKey="architecture" />)

      expect(screen.getByTestId('status-badge')).toHaveTextContent('In Review')
    })

    it('cycles status on click: draft → in-review', () => {
      render(<ArtifactViewer workflowKey="architecture" />)

      fireEvent.click(screen.getByTestId('status-badge'))

      expect(mockUpdateArtifactStatus).toHaveBeenCalledWith({
        projectId: 'project-1',
        artifactKey: 'architecture',
        status: 'in-review'
      })
    })
  })

  describe('Edit with Agent button', () => {
    it('renders Edit with Agent button', () => {
      render(<ArtifactViewer workflowKey="architecture" />)

      expect(screen.getByTestId('edit-with-agent')).toBeInTheDocument()
      expect(screen.getByText('Edit with Agent')).toBeInTheDocument()
    })

    it('closes workspace when Edit with Agent is clicked', () => {
      render(<ArtifactViewer workflowKey="architecture" />)

      fireEvent.click(screen.getByTestId('edit-with-agent'))

      expect(usePlanningWorkspaceStore.getState().isOpen).toBe(false)
    })
  })

  describe('loading state', () => {
    it('shows skeleton loading when content is not yet loaded', () => {
      mockGetArtifactContent.mockReturnValue({ data: undefined, isError: false })

      const { container } = render(<ArtifactViewer workflowKey="architecture" />)

      // Should show skeleton elements (animate-pulse classes)
      const skeletons = container.querySelectorAll('.animate-pulse')
      expect(skeletons.length).toBeGreaterThan(0)
    })
  })

  describe('error state', () => {
    it('shows error message when content fails to load', () => {
      mockGetArtifactContent.mockReturnValue({ data: undefined, isError: true, refetch: vi.fn() })

      render(<ArtifactViewer workflowKey="architecture" />)

      expect(screen.getByText('Could not load artifact content.')).toBeInTheDocument()
    })

    it('shows retry button on error', () => {
      const mockRefetch = vi.fn()
      mockGetArtifactContent.mockReturnValue({ data: undefined, isError: true, refetch: mockRefetch })

      render(<ArtifactViewer workflowKey="architecture" />)

      expect(screen.getByText('Retry')).toBeInTheDocument()
    })
  })
})

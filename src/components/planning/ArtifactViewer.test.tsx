import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ArtifactViewer } from './ArtifactViewer'
import { usePlanningWorkspaceStore } from '@renderer/stores/planning-workspace.store'

// Mock trpc
const mockGetArtifactContent = vi.fn()
const mockScanArtifacts = vi.fn()
const mockGetCurrent = vi.fn()
const mockUpdateArtifactStatus = vi.fn()
const mockInvalidate = vi.fn()
const mockGetVersionHistory = vi.fn()
const mockGetSessionForArtifact = vi.fn()

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
      },
      getArtifactVersionHistory: {
        useQuery: (_input: unknown, _opts: unknown) => mockGetVersionHistory()
      }
    },
    chatSession: {
      getSessionForArtifact: {
        useQuery: (_input: unknown, _opts: unknown) => mockGetSessionForArtifact()
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

// Mock planning workspace constants for AGENT_PERSONA_CONFIG (Story 10.7)
vi.mock('@renderer/constants/planning-workspace', async (importOriginal) => {
  const original = await importOriginal<typeof import('@renderer/constants/planning-workspace')>()
  return {
    ...original,
    AGENT_PERSONA_CONFIG: {
      'bmad:bmm:agents:pm': {
        displayName: 'PM',
        bg: 'bg-green-500/20',
        text: 'text-green-400',
        border: 'border-green-500/30',
        dot: 'bg-green-400'
      },
      'bmad:bmm:agents:architect': {
        displayName: 'Architect',
        bg: 'bg-orange-500/20',
        text: 'text-orange-400',
        border: 'border-orange-500/30',
        dot: 'bg-orange-400'
      }
    }
  }
})

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
    mockGetVersionHistory.mockReturnValue({ data: [] })
    mockGetSessionForArtifact.mockReturnValue({ data: null })
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

  // Story 9.7: Compare Versions integration
  describe('Compare Versions (Story 9.7)', () => {
    const mockVersions = [
      { commitSha: 'abc123', author: 'Alice', timestamp: Math.floor(Date.now() / 1000) - 3600, message: 'Updated architecture' },
      { commitSha: 'def456', author: 'Bob', timestamp: Math.floor(Date.now() / 1000) - 86400, message: 'Initial architecture' }
    ]

    it('renders Compare Versions button', () => {
      render(<ArtifactViewer workflowKey="architecture" />)
      expect(screen.getByTestId('compare-versions-btn')).toBeInTheDocument()
      expect(screen.getByText('Compare Versions')).toBeInTheDocument()
    })

    it('Compare Versions button enabled when 2+ versions exist', () => {
      mockGetVersionHistory.mockReturnValue({ data: mockVersions })
      render(<ArtifactViewer workflowKey="architecture" />)
      const btn = screen.getByTestId('compare-versions-btn')
      expect(btn).not.toBeDisabled()
    })

    it('Compare Versions button disabled when < 2 versions', () => {
      mockGetVersionHistory.mockReturnValue({ data: [mockVersions[0]] })
      render(<ArtifactViewer workflowKey="architecture" />)
      const btn = screen.getByTestId('compare-versions-btn')
      expect(btn).toBeDisabled()
    })

    it('Compare Versions button disabled when no versions', () => {
      mockGetVersionHistory.mockReturnValue({ data: [] })
      render(<ArtifactViewer workflowKey="architecture" />)
      const btn = screen.getByTestId('compare-versions-btn')
      expect(btn).toBeDisabled()
    })

    it('clicking Compare Versions hides section outline', () => {
      mockGetVersionHistory.mockReturnValue({ data: mockVersions })
      render(<ArtifactViewer workflowKey="architecture" />)

      // Section outline visible initially
      expect(screen.getByTestId('section-outline')).toBeInTheDocument()

      // Click Compare Versions
      fireEvent.click(screen.getByTestId('compare-versions-btn'))

      // Section outline should be hidden
      expect(screen.queryByTestId('section-outline')).not.toBeInTheDocument()
    })

    it('clicking Compare Versions hides markdown content', () => {
      mockGetVersionHistory.mockReturnValue({ data: mockVersions })
      render(<ArtifactViewer workflowKey="architecture" />)

      // Markdown content visible initially
      expect(screen.getByTestId('markdown-content')).toBeInTheDocument()

      // Click Compare Versions
      fireEvent.click(screen.getByTestId('compare-versions-btn'))

      // Markdown content should be hidden
      expect(screen.queryByTestId('markdown-content')).not.toBeInTheDocument()
    })

    it('Compare Versions has tooltip when disabled', () => {
      mockGetVersionHistory.mockReturnValue({ data: [] })
      render(<ArtifactViewer workflowKey="architecture" />)
      const btn = screen.getByTestId('compare-versions-btn')
      expect(btn.getAttribute('title')).toBe('Needs at least 2 committed versions')
    })
  })

  // Story 10.7: Artifact provenance badge tests (AC: 2)
  describe('Artifact provenance badge (Story 10.7, AC: 2)', () => {
    it('renders provenance badge when getSessionForArtifact returns session data', () => {
      mockGetSessionForArtifact.mockReturnValue({
        data: {
          sessionId: 'session-pm-1',
          sessionUuid: 'uuid-pm-1',
          agentPersona: 'bmad:bmm:agents:pm',
          createdAt: new Date('2026-03-22T10:00:00Z')
        }
      })

      render(<ArtifactViewer workflowKey="architecture" />)

      const badge = screen.getByTestId('artifact-provenance-badge')
      expect(badge).toBeInTheDocument()
      expect(badge).toHaveTextContent('PM')
    })

    it('does not render provenance badge when getSessionForArtifact returns null', () => {
      mockGetSessionForArtifact.mockReturnValue({ data: null })

      render(<ArtifactViewer workflowKey="architecture" />)

      expect(screen.queryByTestId('artifact-provenance-badge')).not.toBeInTheDocument()
    })

    it('"View Chat" link calls openChatToSession with correct session ID', () => {
      mockGetSessionForArtifact.mockReturnValue({
        data: {
          sessionId: 'session-arch-1',
          sessionUuid: 'uuid-arch-1',
          agentPersona: 'bmad:bmm:agents:architect',
          createdAt: new Date('2026-03-22T10:00:00Z')
        }
      })

      render(<ArtifactViewer workflowKey="architecture" />)

      const viewChatLink = screen.getByTestId('artifact-view-chat-link')
      expect(viewChatLink).toBeInTheDocument()
      expect(viewChatLink).toHaveTextContent('View Chat')

      fireEvent.click(viewChatLink)

      // openChatToSession should have been called on the store
      const state = usePlanningWorkspaceStore.getState()
      expect(state.targetChatSessionId).toBe('session-arch-1')
    })
  })
})

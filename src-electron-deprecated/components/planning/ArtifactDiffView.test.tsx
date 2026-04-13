/**
 * Tests for ArtifactDiffView component.
 * Story 9.7: Artifact Version Diff View (AC: 2, 3)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ArtifactDiffView } from './ArtifactDiffView'

const mockFromCommit = {
  commitSha: 'abc123def456',
  author: 'Alice',
  timestamp: Math.floor(Date.now() / 1000) - 86400,
  message: 'Initial PRD creation'
}

const mockToCommit = {
  commitSha: 'def789ghi012',
  author: 'Bob',
  timestamp: Math.floor(Date.now() / 1000) - 3600,
  message: 'Updated PRD requirements section'
}

const mockDiffData = {
  original: '# PRD\n\nInitial content',
  modified: '# PRD\n\nUpdated content with new requirements',
  language: 'markdown' as const
}

let mockData: typeof mockDiffData | undefined = mockDiffData
let mockIsLoading = false
let mockIsError = false
const mockRefetch = vi.fn()
const mockOnClose = vi.fn()
const mockToggleViewMode = vi.fn()
let mockViewMode: 'split' | 'unified' = 'split'

// Mock tRPC
vi.mock('@renderer/lib/trpc', () => ({
  trpc: {
    project: {
      getCurrent: {
        useQuery: vi.fn(() => ({
          data: { id: 'project-1' }
        }))
      }
    },
    planning: {
      getArtifactVersionDiff: {
        useQuery: vi.fn(() => ({
          data: mockData,
          isLoading: mockIsLoading,
          isError: mockIsError,
          refetch: mockRefetch
        }))
      }
    }
  }
}))

// Mock diff store
vi.mock('@renderer/stores/diff.store', () => ({
  useDiffStore: vi.fn((selector: any) => {
    const state = {
      viewMode: mockViewMode,
      toggleViewMode: mockToggleViewMode
    }
    return selector ? selector(state) : state
  })
}))

// Mock MonacoDiffEditor (to avoid Monaco loading in tests)
vi.mock('@renderer/components/diff/MonacoDiffEditor', () => ({
  MonacoDiffEditor: vi.fn(({ original, modified, language, viewMode: vm }: any) => (
    <div data-testid="monaco-diff-editor" data-original={original} data-modified={modified} data-language={language} data-viewmode={vm}>
      MonacoDiffEditor
    </div>
  ))
}))

// Mock constants
vi.mock('@renderer/constants/planning-workspace', () => ({
  BMAD_WORKFLOWS: [
    { key: 'prd', phase: 'planning', name: 'Create PRD', purpose: 'Requirements', outputFilename: 'prd.md' }
  ]
}))

describe('ArtifactDiffView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockData = mockDiffData
    mockIsLoading = false
    mockIsError = false
    mockViewMode = 'split'
  })

  it('renders MonacoDiffEditor with correct original/modified props', () => {
    render(
      <ArtifactDiffView
        workflowKey="prd"
        fromCommit={mockFromCommit}
        toCommit={mockToCommit}
        onClose={mockOnClose}
      />
    )
    const editor = screen.getByTestId('monaco-diff-editor')
    expect(editor.getAttribute('data-original')).toBe(mockDiffData.original)
    expect(editor.getAttribute('data-modified')).toBe(mockDiffData.modified)
    expect(editor.getAttribute('data-language')).toBe('markdown')
  })

  it('renders header with from/to commit info', () => {
    render(
      <ArtifactDiffView
        workflowKey="prd"
        fromCommit={mockFromCommit}
        toCommit={mockToCommit}
        onClose={mockOnClose}
      />
    )
    expect(screen.getByText('From:')).toBeDefined()
    expect(screen.getByText('To:')).toBeDefined()
    expect(screen.getByText('Initial PRD creation')).toBeDefined()
    expect(screen.getByText('Updated PRD requirements section')).toBeDefined()
  })

  it('shows "Initial (empty)" when fromCommit is null', () => {
    render(
      <ArtifactDiffView
        workflowKey="prd"
        fromCommit={null}
        toCommit={mockToCommit}
        onClose={mockOnClose}
      />
    )
    expect(screen.getByText('Initial (empty)')).toBeDefined()
  })

  it('view mode toggle button renders', () => {
    render(
      <ArtifactDiffView
        workflowKey="prd"
        fromCommit={mockFromCommit}
        toCommit={mockToCommit}
        onClose={mockOnClose}
      />
    )
    expect(screen.getByTestId('view-mode-toggle')).toBeDefined()
  })

  it('view mode toggle calls toggleViewMode', () => {
    render(
      <ArtifactDiffView
        workflowKey="prd"
        fromCommit={mockFromCommit}
        toCommit={mockToCommit}
        onClose={mockOnClose}
      />
    )
    fireEvent.click(screen.getByTestId('view-mode-toggle'))
    expect(mockToggleViewMode).toHaveBeenCalled()
  })

  it('close button calls onClose', () => {
    render(
      <ArtifactDiffView
        workflowKey="prd"
        fromCommit={mockFromCommit}
        toCommit={mockToCommit}
        onClose={mockOnClose}
      />
    )
    fireEvent.click(screen.getByTestId('diff-close-btn'))
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('back button calls onClose', () => {
    render(
      <ArtifactDiffView
        workflowKey="prd"
        fromCommit={mockFromCommit}
        toCommit={mockToCommit}
        onClose={mockOnClose}
      />
    )
    fireEvent.click(screen.getByTestId('diff-back-btn'))
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('renders loading skeleton', () => {
    mockIsLoading = true
    mockData = undefined
    render(
      <ArtifactDiffView
        workflowKey="prd"
        fromCommit={mockFromCommit}
        toCommit={mockToCommit}
        onClose={mockOnClose}
      />
    )
    expect(screen.getByTestId('diff-view-loading')).toBeDefined()
  })

  it('renders error state with retry', () => {
    mockIsError = true
    mockData = undefined
    render(
      <ArtifactDiffView
        workflowKey="prd"
        fromCommit={mockFromCommit}
        toCommit={mockToCommit}
        onClose={mockOnClose}
      />
    )
    expect(screen.getByTestId('diff-view-error')).toBeDefined()
    expect(screen.getByText('Could not load diff data.')).toBeDefined()
    fireEvent.click(screen.getByText('Retry'))
    expect(mockRefetch).toHaveBeenCalled()
  })

  it('shows Unified label when in split mode', () => {
    mockViewMode = 'split'
    render(
      <ArtifactDiffView
        workflowKey="prd"
        fromCommit={mockFromCommit}
        toCommit={mockToCommit}
        onClose={mockOnClose}
      />
    )
    expect(screen.getByText('Unified')).toBeDefined()
  })

  it('shows Split label when in unified mode', () => {
    mockViewMode = 'unified'
    render(
      <ArtifactDiffView
        workflowKey="prd"
        fromCommit={mockFromCommit}
        toCommit={mockToCommit}
        onClose={mockOnClose}
      />
    )
    expect(screen.getByText('Split')).toBeDefined()
  })

})

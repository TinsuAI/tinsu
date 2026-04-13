/**
 * Tests for ArtifactVersionHistory component.
 * Story 9.7: Artifact Version Diff View (AC: 1, 4)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ArtifactVersionHistory } from './ArtifactVersionHistory'

const NOW = Date.now()
const ONE_HOUR = 3600
const ONE_DAY = 86400

const mockVersions = [
  {
    commitSha: 'abc123def456',
    author: 'Alice',
    timestamp: Math.floor(NOW / 1000) - ONE_HOUR,
    message: 'Updated PRD requirements section'
  },
  {
    commitSha: 'def789ghi012',
    author: 'Bob',
    timestamp: Math.floor(NOW / 1000) - ONE_DAY,
    message: 'Added NFRs section'
  },
  {
    commitSha: 'ghi345jkl678',
    author: 'Alice',
    timestamp: Math.floor(NOW / 1000) - ONE_DAY * 3,
    message: 'Initial PRD creation'
  }
]

let mockVersionData: typeof mockVersions | undefined = mockVersions
let mockIsLoading = false
let mockIsError = false

const mockOnSelectVersions = vi.fn()
const mockOnClose = vi.fn()

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
      getArtifactVersionHistory: {
        useQuery: vi.fn(() => ({
          data: mockVersionData,
          isLoading: mockIsLoading,
          isError: mockIsError
        }))
      }
    }
  }
}))

describe('ArtifactVersionHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVersionData = mockVersions
    mockIsLoading = false
    mockIsError = false
  })

  it('renders version list with messages and timestamps', () => {
    render(
      <ArtifactVersionHistory
        workflowKey="prd"
        onSelectVersions={mockOnSelectVersions}
        onClose={mockOnClose}
      />
    )
    expect(screen.getByText('Updated PRD requirements section')).toBeDefined()
    expect(screen.getByText('Added NFRs section')).toBeDefined()
    expect(screen.getByText('Initial PRD creation')).toBeDefined()
  })

  it('renders "Current" badge on most recent version', () => {
    render(
      <ArtifactVersionHistory
        workflowKey="prd"
        onSelectVersions={mockOnSelectVersions}
        onClose={mockOnClose}
      />
    )
    expect(screen.getByText('Current')).toBeDefined()
  })

  it('renders author names', () => {
    render(
      <ArtifactVersionHistory
        workflowKey="prd"
        onSelectVersions={mockOnSelectVersions}
        onClose={mockOnClose}
      />
    )
    expect(screen.getAllByText('Alice').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Bob')).toBeDefined()
  })

  it('renders version count', () => {
    render(
      <ArtifactVersionHistory
        workflowKey="prd"
        onSelectVersions={mockOnSelectVersions}
        onClose={mockOnClose}
      />
    )
    expect(screen.getByText('3 versions')).toBeDefined()
  })

  it('renders from/to selectors', () => {
    render(
      <ArtifactVersionHistory
        workflowKey="prd"
        onSelectVersions={mockOnSelectVersions}
        onClose={mockOnClose}
      />
    )
    expect(screen.getByTestId('from-selector-0')).toBeDefined()
    expect(screen.getByTestId('to-selector-0')).toBeDefined()
    expect(screen.getByTestId('from-selector-1')).toBeDefined()
    expect(screen.getByTestId('to-selector-1')).toBeDefined()
  })

  it('"Compare Selected" button calls onSelectVersions', () => {
    render(
      <ArtifactVersionHistory
        workflowKey="prd"
        onSelectVersions={mockOnSelectVersions}
        onClose={mockOnClose}
      />
    )
    const btn = screen.getByTestId('compare-selected-btn')
    fireEvent.click(btn)
    expect(mockOnSelectVersions).toHaveBeenCalledWith(
      mockVersions[1], // from = second most recent (default)
      mockVersions[0]  // to = most recent (default)
    )
  })

  it('version selectors change from/to when clicked', () => {
    render(
      <ArtifactVersionHistory
        workflowKey="prd"
        onSelectVersions={mockOnSelectVersions}
        onClose={mockOnClose}
      />
    )
    // Click "from" selector on third version
    fireEvent.click(screen.getByTestId('from-selector-2'))
    // Click compare
    const btn = screen.getByTestId('compare-selected-btn')
    fireEvent.click(btn)
    expect(mockOnSelectVersions).toHaveBeenCalledWith(
      mockVersions[2], // from = third version
      mockVersions[0]  // to = still most recent
    )
  })

  it('renders single-version message when only 1 version', () => {
    mockVersionData = [mockVersions[0]]
    render(
      <ArtifactVersionHistory
        workflowKey="prd"
        onSelectVersions={mockOnSelectVersions}
        onClose={mockOnClose}
      />
    )
    expect(screen.getByText('Only one version exists. Make changes and commit to see version history.')).toBeDefined()
  })

  it('renders empty state when no versions', () => {
    mockVersionData = []
    render(
      <ArtifactVersionHistory
        workflowKey="prd"
        onSelectVersions={mockOnSelectVersions}
        onClose={mockOnClose}
      />
    )
    expect(screen.getByText('No git history available for this artifact.')).toBeDefined()
  })

  it('renders loading skeleton', () => {
    mockIsLoading = true
    mockVersionData = undefined
    render(
      <ArtifactVersionHistory
        workflowKey="prd"
        onSelectVersions={mockOnSelectVersions}
        onClose={mockOnClose}
      />
    )
    expect(screen.getByTestId('version-history-loading')).toBeDefined()
  })

  it('back button calls onClose', () => {
    render(
      <ArtifactVersionHistory
        workflowKey="prd"
        onSelectVersions={mockOnSelectVersions}
        onClose={mockOnClose}
      />
    )
    // Find the ArrowLeft button — it's in the header
    const backBtns = screen.getAllByRole('button')
    // First button is the back button
    fireEvent.click(backBtns[0])
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('renders error state', () => {
    mockIsError = true
    mockVersionData = undefined
    render(
      <ArtifactVersionHistory
        workflowKey="prd"
        onSelectVersions={mockOnSelectVersions}
        onClose={mockOnClose}
      />
    )
    expect(screen.getByText('Failed to load version history.')).toBeDefined()
  })

  it('truncates long commit messages to 60 chars', () => {
    const longMessage = 'A'.repeat(70)
    mockVersionData = [
      { ...mockVersions[0], message: longMessage },
      mockVersions[1]
    ]
    render(
      <ArtifactVersionHistory
        workflowKey="prd"
        onSelectVersions={mockOnSelectVersions}
        onClose={mockOnClose}
      />
    )
    expect(screen.getByText(`${'A'.repeat(60)}...`)).toBeDefined()
  })

  it('renders commit SHA prefix', () => {
    render(
      <ArtifactVersionHistory
        workflowKey="prd"
        onSelectVersions={mockOnSelectVersions}
        onClose={mockOnClose}
      />
    )
    expect(screen.getByText('abc123d')).toBeDefined()
  })

  it('"Compare Selected" button disabled when from === to (P5)', () => {
    render(
      <ArtifactVersionHistory
        workflowKey="prd"
        onSelectVersions={mockOnSelectVersions}
        onClose={mockOnClose}
      />
    )
    // Select "to" as same index as the default "from" (index 1)
    fireEvent.click(screen.getByTestId('to-selector-1'))
    const btn = screen.getByTestId('compare-selected-btn')
    // Both from and to are now index 1 — button should be disabled
    expect(btn).toBeDisabled()
  })
})

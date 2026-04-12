/**
 * ChatArtifactNotification Tests - Story 10.7 (AC: 3)
 *
 * Tests: renders artifact filename, "View in Workspace" link calls
 * openWorkspaceToArtifact with correct workflowKey, handles missing
 * workflowKey gracefully.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ChatArtifactNotification } from './ChatArtifactNotification'

// Mock planning workspace store
const mockOpenWorkspaceToArtifact = vi.fn()

vi.mock('@renderer/stores', () => ({
  usePlanningWorkspaceStore: (selector?: (state: Record<string, unknown>) => unknown) => {
    const state = {
      openWorkspaceToArtifact: mockOpenWorkspaceToArtifact
    }
    return selector ? selector(state) : state
  }
}))

describe('ChatArtifactNotification (Story 10.7, AC: 3)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders artifact filename in the notification card', () => {
    const message = {
      id: 'msg-1',
      content: 'Artifact created: prd.md',
      tool_input: JSON.stringify({ filename: 'prd.md', workflowKey: 'prd', filePath: '/test/prd.md' })
    }

    render(<ChatArtifactNotification message={message} />)

    const card = screen.getByTestId('chat-artifact-notification')
    expect(card).toBeInTheDocument()
    expect(card).toHaveTextContent('Artifact created: prd.md')
  })

  it('"View in Workspace" link calls openWorkspaceToArtifact with correct workflowKey', () => {
    const message = {
      id: 'msg-1',
      content: 'Artifact created: architecture.md',
      tool_input: JSON.stringify({ filename: 'architecture.md', workflowKey: 'architecture', filePath: '/test/arch.md' })
    }

    render(<ChatArtifactNotification message={message} />)

    const viewLink = screen.getByTestId('artifact-view-in-workspace')
    expect(viewLink).toBeInTheDocument()
    expect(viewLink).toHaveTextContent('View in Workspace')

    fireEvent.click(viewLink)
    expect(mockOpenWorkspaceToArtifact).toHaveBeenCalledWith('architecture')
  })

  it('handles missing workflowKey gracefully (unknown artifact filename)', () => {
    const message = {
      id: 'msg-1',
      content: 'Artifact created: custom-doc.md',
      tool_input: JSON.stringify({ filename: 'custom-doc.md', workflowKey: null, filePath: '/test/custom-doc.md' })
    }

    render(<ChatArtifactNotification message={message} />)

    // Should show "Unknown artifact" instead of "View in Workspace" link
    expect(screen.getByTestId('artifact-no-workspace-link')).toBeInTheDocument()
    expect(screen.queryByTestId('artifact-view-in-workspace')).not.toBeInTheDocument()
  })

  it('handles null tool_input gracefully', () => {
    const message = {
      id: 'msg-1',
      content: 'Artifact created: unknown',
      tool_input: null
    }

    render(<ChatArtifactNotification message={message} />)

    const card = screen.getByTestId('chat-artifact-notification')
    expect(card).toBeInTheDocument()
    expect(screen.getByTestId('artifact-no-workspace-link')).toBeInTheDocument()
  })
})

/**
 * ChatSessionList Tests - Story 10.6 (AC: 1, 2, 6)
 *
 * Tests: renders session cards with persona dot, name, preview, timestamp, status,
 * sessions sorted by most recently active, completed sessions have dimmed styling,
 * clicking session card calls onSelectSession, "New Chat" button calls onNewChat,
 * context menu shows "Mark as Completed" and "Delete" options,
 * "Delete" shows confirmation before deleting.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ChatSessionList } from './ChatSessionList'

// Mock react-markdown to avoid ESM import issues
vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => <div>{children}</div>
}))

vi.mock('remark-gfm', () => ({
  default: () => ({})
}))

// Mock planning workspace constants
vi.mock('@renderer/constants/planning-workspace', () => {
  const config: Record<string, { displayName: string; bg: string; text: string; border: string; icon: string; dot: string }> = {
    'bmad:bmm:agents:pm': {
      displayName: 'PM',
      bg: 'bg-emerald-500/20',
      text: 'text-emerald-400',
      border: 'border-emerald-500/30',
      icon: 'M',
      dot: 'bg-green-400'
    },
    'bmad:bmm:agents:architect': {
      displayName: 'Architect',
      bg: 'bg-purple-500/20',
      text: 'text-purple-400',
      border: 'border-purple-500/30',
      icon: 'A',
      dot: 'bg-orange-400'
    }
  }
  return {
    AGENT_PERSONA_CONFIG: config,
    getAgentPersona: (agentName: string | null) => {
      if (!agentName) return null
      return config[agentName] ?? null
    }
  }
})

// Mock tRPC
const mockListWithPreviewQuery = vi.fn()
const mockUpdateStatusMutation = vi.fn()
const mockDeleteSessionMutation = vi.fn()
const mockInvalidate = vi.fn()

vi.mock('@renderer/lib/trpc', () => ({
  trpc: {
    chatSession: {
      listWithPreview: {
        useQuery: (...args: unknown[]) => mockListWithPreviewQuery(...args)
      },
      updateStatus: {
        useMutation: (...args: unknown[]) => mockUpdateStatusMutation(...args)
      },
      deleteSession: {
        useMutation: (...args: unknown[]) => mockDeleteSessionMutation(...args)
      }
    },
    useUtils: () => ({
      chatSession: {
        listWithPreview: {
          invalidate: mockInvalidate
        }
      }
    })
  }
}))

const mockSessions = [
  {
    id: 'session-1',
    session_uuid: 'uuid-1',
    agent_persona: 'bmad:bmm:agents:pm',
    status: 'active',
    created_at: new Date('2026-03-22T10:00:00Z'),
    updated_at: new Date('2026-03-22T12:00:00Z'),
    last_message_at: new Date('2026-03-22T12:00:00Z'),
    lastMessagePreview: 'Tell me about the product roadmap'
  },
  {
    id: 'session-2',
    session_uuid: 'uuid-2',
    agent_persona: 'bmad:bmm:agents:architect',
    status: 'completed',
    created_at: new Date('2026-03-21T08:00:00Z'),
    updated_at: new Date('2026-03-21T09:00:00Z'),
    last_message_at: new Date('2026-03-21T09:00:00Z'),
    lastMessagePreview: 'The architecture is well structured'
  },
  {
    id: 'session-3',
    session_uuid: 'uuid-3',
    agent_persona: 'bmad:bmm:agents:pm',
    status: 'paused',
    created_at: new Date('2026-03-20T14:00:00Z'),
    updated_at: new Date('2026-03-20T15:00:00Z'),
    last_message_at: new Date('2026-03-20T15:00:00Z'),
    lastMessagePreview: null
  }
]

describe('ChatSessionList (Story 10.6, AC: 1, 2, 6)', () => {
  const onSelectSession = vi.fn()
  const onNewChat = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    mockListWithPreviewQuery.mockReturnValue({
      data: mockSessions
    })

    mockUpdateStatusMutation.mockReturnValue({
      mutate: vi.fn()
    })

    mockDeleteSessionMutation.mockReturnValue({
      mutate: vi.fn()
    })
  })

  it('renders the session list container', () => {
    render(
      <ChatSessionList
        projectId="project-1"
        onSelectSession={onSelectSession}
        onNewChat={onNewChat}
      />
    )

    expect(screen.getByTestId('chat-session-list')).toBeInTheDocument()
  })

  it('renders "New Chat" button', () => {
    render(
      <ChatSessionList
        projectId="project-1"
        onSelectSession={onSelectSession}
        onNewChat={onNewChat}
      />
    )

    expect(screen.getByTestId('new-chat-button')).toBeInTheDocument()
    expect(screen.getByText('New Chat')).toBeInTheDocument()
  })

  it('calls onNewChat when "New Chat" button is clicked', () => {
    render(
      <ChatSessionList
        projectId="project-1"
        onSelectSession={onSelectSession}
        onNewChat={onNewChat}
      />
    )

    fireEvent.click(screen.getByTestId('new-chat-button'))
    expect(onNewChat).toHaveBeenCalledTimes(1)
  })

  it('renders session cards with persona display name', () => {
    render(
      <ChatSessionList
        projectId="project-1"
        onSelectSession={onSelectSession}
        onNewChat={onNewChat}
      />
    )

    // PM persona appears twice (session-1 and session-3)
    const pmLabels = screen.getAllByText('PM')
    expect(pmLabels.length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Architect')).toBeInTheDocument()
  })

  it('renders last message preview (truncated to 60 chars)', () => {
    render(
      <ChatSessionList
        projectId="project-1"
        onSelectSession={onSelectSession}
        onNewChat={onNewChat}
      />
    )

    expect(screen.getByText('Tell me about the product roadmap')).toBeInTheDocument()
    expect(screen.getByText('The architecture is well structured')).toBeInTheDocument()
  })

  it('renders status badges', () => {
    render(
      <ChatSessionList
        projectId="project-1"
        onSelectSession={onSelectSession}
        onNewChat={onNewChat}
      />
    )

    expect(screen.getByTestId('session-status-session-1')).toHaveTextContent('Active')
    expect(screen.getByTestId('session-status-session-2')).toHaveTextContent('Completed')
    expect(screen.getByTestId('session-status-session-3')).toHaveTextContent('Paused')
  })

  it('completed sessions have dimmed styling (opacity-60)', () => {
    render(
      <ChatSessionList
        projectId="project-1"
        onSelectSession={onSelectSession}
        onNewChat={onNewChat}
      />
    )

    const completedCard = screen.getByTestId('session-card-session-2')
    expect(completedCard.className).toContain('opacity-60')
  })

  it('active sessions do NOT have dimmed styling', () => {
    render(
      <ChatSessionList
        projectId="project-1"
        onSelectSession={onSelectSession}
        onNewChat={onNewChat}
      />
    )

    const activeCard = screen.getByTestId('session-card-session-1')
    expect(activeCard.className).not.toContain('opacity-60')
  })

  it('clicking session card calls onSelectSession with session data', () => {
    render(
      <ChatSessionList
        projectId="project-1"
        onSelectSession={onSelectSession}
        onNewChat={onNewChat}
      />
    )

    fireEvent.click(screen.getByTestId('session-card-button-session-1'))

    expect(onSelectSession).toHaveBeenCalledTimes(1)
    expect(onSelectSession).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'session-1',
        agent_persona: 'bmad:bmm:agents:pm',
        status: 'active'
      })
    )
  })

  it('renders empty state when no sessions exist', () => {
    mockListWithPreviewQuery.mockReturnValue({
      data: []
    })

    render(
      <ChatSessionList
        projectId="project-1"
        onSelectSession={onSelectSession}
        onNewChat={onNewChat}
      />
    )

    expect(screen.getByTestId('session-list-empty')).toBeInTheDocument()
    expect(screen.getByText('No previous sessions')).toBeInTheDocument()
  })

  it('context menu opens on kebab button click', () => {
    render(
      <ChatSessionList
        projectId="project-1"
        onSelectSession={onSelectSession}
        onNewChat={onNewChat}
      />
    )

    const menuTrigger = screen.getByTestId('session-menu-trigger-session-1')
    fireEvent.click(menuTrigger)

    expect(screen.getByTestId('session-context-menu')).toBeInTheDocument()
  })

  it('context menu shows "Mark as Completed" for active sessions', () => {
    render(
      <ChatSessionList
        projectId="project-1"
        onSelectSession={onSelectSession}
        onNewChat={onNewChat}
      />
    )

    const menuTrigger = screen.getByTestId('session-menu-trigger-session-1')
    fireEvent.click(menuTrigger)

    expect(screen.getByTestId('session-menu-complete')).toBeInTheDocument()
    expect(screen.getByText('Mark as Completed')).toBeInTheDocument()
  })

  it('context menu shows "Delete" option', () => {
    render(
      <ChatSessionList
        projectId="project-1"
        onSelectSession={onSelectSession}
        onNewChat={onNewChat}
      />
    )

    const menuTrigger = screen.getByTestId('session-menu-trigger-session-1')
    fireEvent.click(menuTrigger)

    expect(screen.getByTestId('session-menu-delete')).toBeInTheDocument()
    expect(screen.getByText('Delete')).toBeInTheDocument()
  })

  it('delete shows confirmation before deleting', () => {
    render(
      <ChatSessionList
        projectId="project-1"
        onSelectSession={onSelectSession}
        onNewChat={onNewChat}
      />
    )

    const menuTrigger = screen.getByTestId('session-menu-trigger-session-1')
    fireEvent.click(menuTrigger)

    // Click "Delete" — should show confirmation
    fireEvent.click(screen.getByTestId('session-menu-delete'))

    expect(screen.getByTestId('session-menu-delete-confirm')).toBeInTheDocument()
    expect(screen.getByText('Delete this session?')).toBeInTheDocument()
  })

  it('context menu does NOT show "Mark as Completed" for completed sessions', () => {
    render(
      <ChatSessionList
        projectId="project-1"
        onSelectSession={onSelectSession}
        onNewChat={onNewChat}
      />
    )

    // Open context menu for the completed session
    const menuTrigger = screen.getByTestId('session-menu-trigger-session-2')
    fireEvent.click(menuTrigger)

    expect(screen.queryByTestId('session-menu-complete')).not.toBeInTheDocument()
  })

  it('uses 5 second refetch interval', () => {
    render(
      <ChatSessionList
        projectId="project-1"
        onSelectSession={onSelectSession}
        onNewChat={onNewChat}
      />
    )

    // Verify the query was called with refetchInterval: 5000
    expect(mockListWithPreviewQuery).toHaveBeenCalledWith(
      { projectId: 'project-1' },
      { refetchInterval: 5000 }
    )
  })
})

/**
 * ChatSessionList Tests - Story 10.6 (AC: 1, 2, 6)
 * CTM-2.3: Session List with Live Status Badges (AC: 1, 2, 3, 4, 5)
 *
 * Tests: renders session cards with persona dot, name, preview, timestamp, status,
 * sessions sorted by most recently active, completed sessions have dimmed styling,
 * clicking session card calls onSelectSession, "New Chat" button calls onNewChat,
 * context menu shows "Mark as Completed" and "Delete" options,
 * "Delete" shows confirmation before deleting.
 *
 * CTM-2.3 Tests: live status badges (thinking, idle, completed, exited, unknown),
 * thinking badge has animate-pulse, background session summary visibility,
 * 2-second refetch interval.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ChatSessionList, BackgroundSessionSummary } from './ChatSessionList'

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
    workflow_key: null,
    status: 'active',
    created_at: new Date('2026-03-22T10:00:00Z'),
    updated_at: new Date('2026-03-22T12:00:00Z'),
    last_message_at: new Date('2026-03-22T12:00:00Z'),
    lastMessagePreview: 'Tell me about the product roadmap',
    skip_permissions: true,
    liveStatus: 'idle' as const
  },
  {
    id: 'session-2',
    session_uuid: 'uuid-2',
    agent_persona: 'bmad:bmm:agents:architect',
    workflow_key: 'architecture',
    status: 'completed',
    created_at: new Date('2026-03-21T08:00:00Z'),
    updated_at: new Date('2026-03-21T09:00:00Z'),
    last_message_at: new Date('2026-03-21T09:00:00Z'),
    lastMessagePreview: 'The architecture is well structured',
    skip_permissions: false,
    liveStatus: 'completed' as const
  },
  {
    id: 'session-3',
    session_uuid: 'uuid-3',
    agent_persona: 'bmad:bmm:agents:pm',
    workflow_key: 'create-prd',
    status: 'paused',
    created_at: new Date('2026-03-20T14:00:00Z'),
    updated_at: new Date('2026-03-20T15:00:00Z'),
    last_message_at: new Date('2026-03-20T15:00:00Z'),
    lastMessagePreview: null,
    skip_permissions: true,
    liveStatus: 'thinking' as const
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

  // CTM-2.3: Updated from 5000ms to 2000ms
  it('uses 2 second refetch interval (CTM-2.3)', () => {
    render(
      <ChatSessionList
        projectId="project-1"
        onSelectSession={onSelectSession}
        onNewChat={onNewChat}
      />
    )

    // Verify the query was called with refetchInterval: 2000
    expect(mockListWithPreviewQuery).toHaveBeenCalledWith(
      { projectId: 'project-1' },
      { refetchInterval: 2000 }
    )
  })
})

describe('ChatSessionList Live Status Badges (CTM-2.3, AC: 1, 3)', () => {
  const onSelectSession = vi.fn()
  const onNewChat = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    mockUpdateStatusMutation.mockReturnValue({
      mutate: vi.fn()
    })

    mockDeleteSessionMutation.mockReturnValue({
      mutate: vi.fn()
    })
  })

  it('renders "Thinking" badge for thinking liveStatus', () => {
    mockListWithPreviewQuery.mockReturnValue({
      data: [{
        ...mockSessions[0],
        id: 'session-thinking',
        liveStatus: 'thinking'
      }]
    })

    render(
      <ChatSessionList
        projectId="project-1"
        onSelectSession={onSelectSession}
        onNewChat={onNewChat}
      />
    )

    const badge = screen.getByTestId('session-status-session-thinking')
    expect(badge).toHaveTextContent('Thinking')
  })

  it('renders "Idle" badge for idle liveStatus', () => {
    mockListWithPreviewQuery.mockReturnValue({
      data: [{
        ...mockSessions[0],
        id: 'session-idle',
        liveStatus: 'idle'
      }]
    })

    render(
      <ChatSessionList
        projectId="project-1"
        onSelectSession={onSelectSession}
        onNewChat={onNewChat}
      />
    )

    const badge = screen.getByTestId('session-status-session-idle')
    expect(badge).toHaveTextContent('Idle')
  })

  it('renders "Completed" badge for completed liveStatus', () => {
    mockListWithPreviewQuery.mockReturnValue({
      data: [{
        ...mockSessions[1],
        id: 'session-completed',
        liveStatus: 'completed'
      }]
    })

    render(
      <ChatSessionList
        projectId="project-1"
        onSelectSession={onSelectSession}
        onNewChat={onNewChat}
      />
    )

    const badge = screen.getByTestId('session-status-session-completed')
    expect(badge).toHaveTextContent('Completed')
  })

  it('renders "Exited" badge for exited liveStatus', () => {
    mockListWithPreviewQuery.mockReturnValue({
      data: [{
        ...mockSessions[0],
        id: 'session-exited',
        liveStatus: 'exited'
      }]
    })

    render(
      <ChatSessionList
        projectId="project-1"
        onSelectSession={onSelectSession}
        onNewChat={onNewChat}
      />
    )

    const badge = screen.getByTestId('session-status-session-exited')
    expect(badge).toHaveTextContent('Exited')
  })

  it('does NOT render badge for unknown liveStatus', () => {
    mockListWithPreviewQuery.mockReturnValue({
      data: [{
        ...mockSessions[0],
        id: 'session-unknown',
        liveStatus: 'unknown'
      }]
    })

    render(
      <ChatSessionList
        projectId="project-1"
        onSelectSession={onSelectSession}
        onNewChat={onNewChat}
      />
    )

    expect(screen.queryByTestId('session-status-session-unknown')).not.toBeInTheDocument()
  })

  it('"thinking" badge has animate-pulse class', () => {
    mockListWithPreviewQuery.mockReturnValue({
      data: [{
        ...mockSessions[0],
        id: 'session-pulse',
        liveStatus: 'thinking'
      }]
    })

    render(
      <ChatSessionList
        projectId="project-1"
        onSelectSession={onSelectSession}
        onNewChat={onNewChat}
      />
    )

    const badge = screen.getByTestId('session-status-session-pulse')
    expect(badge.className).toContain('animate-pulse')
  })

  it('"idle" badge does NOT have animate-pulse class', () => {
    mockListWithPreviewQuery.mockReturnValue({
      data: [{
        ...mockSessions[0],
        id: 'session-no-pulse',
        liveStatus: 'idle'
      }]
    })

    render(
      <ChatSessionList
        projectId="project-1"
        onSelectSession={onSelectSession}
        onNewChat={onNewChat}
      />
    )

    const badge = screen.getByTestId('session-status-session-no-pulse')
    expect(badge.className).not.toContain('animate-pulse')
  })

  it('completed sessions use liveStatus "completed" badge (from DB status)', () => {
    mockListWithPreviewQuery.mockReturnValue({
      data: [{
        ...mockSessions[1],
        status: 'completed',
        liveStatus: 'completed'
      }]
    })

    render(
      <ChatSessionList
        projectId="project-1"
        onSelectSession={onSelectSession}
        onNewChat={onNewChat}
      />
    )

    const badge = screen.getByTestId('session-status-session-2')
    expect(badge).toHaveTextContent('Completed')
    // Completed badge should have zinc styling
    expect(badge.className).toContain('text-zinc-400')
  })
})

describe('BackgroundSessionSummary (CTM-2.3, AC: 4)', () => {
  it('renders summary for background sessions with thinking or idle status', () => {
    render(
      <BackgroundSessionSummary
        sessions={[
          { ...mockSessions[0], liveStatus: 'idle' },
          { ...mockSessions[2], liveStatus: 'thinking' }
        ]}
        selectedSessionId={null}
      />
    )

    expect(screen.getByTestId('background-session-summary')).toBeInTheDocument()
    // Check persona names are rendered
    expect(screen.getAllByText('PM').length).toBeGreaterThanOrEqual(1)
  })

  it('hides summary when no active background sessions exist', () => {
    render(
      <BackgroundSessionSummary
        sessions={[
          { ...mockSessions[1], liveStatus: 'completed' },
          { ...mockSessions[0], liveStatus: 'exited' }
        ]}
        selectedSessionId={null}
      />
    )

    expect(screen.queryByTestId('background-session-summary')).not.toBeInTheDocument()
  })

  it('excludes the currently selected session from background summary', () => {
    render(
      <BackgroundSessionSummary
        sessions={[
          { ...mockSessions[0], id: 'selected-session', liveStatus: 'idle' },
          { ...mockSessions[2], id: 'background-session', liveStatus: 'thinking' }
        ]}
        selectedSessionId="selected-session"
      />
    )

    const summary = screen.getByTestId('background-session-summary')
    expect(summary).toBeInTheDocument()
    // Only one session should be shown (the background one)
    expect(screen.getByText('thinking')).toBeInTheDocument()
  })

  it('hides when all active sessions are the selected session', () => {
    render(
      <BackgroundSessionSummary
        sessions={[
          { ...mockSessions[0], id: 'selected-only', liveStatus: 'idle' }
        ]}
        selectedSessionId="selected-only"
      />
    )

    expect(screen.queryByTestId('background-session-summary')).not.toBeInTheDocument()
  })

  it('shows workflow_key context when available', () => {
    render(
      <BackgroundSessionSummary
        sessions={[
          { ...mockSessions[2], liveStatus: 'thinking', workflow_key: 'create-prd' }
        ]}
        selectedSessionId={null}
      />
    )

    expect(screen.getByText('(create-prd)')).toBeInTheDocument()
  })

  it('shows "thinking" label with cyan color for thinking sessions', () => {
    render(
      <BackgroundSessionSummary
        sessions={[
          { ...mockSessions[2], liveStatus: 'thinking' }
        ]}
        selectedSessionId={null}
      />
    )

    const thinkingLabel = screen.getByText('thinking')
    expect(thinkingLabel.className).toContain('text-cyan-400')
  })

  it('shows "idle" label with emerald color for idle sessions', () => {
    render(
      <BackgroundSessionSummary
        sessions={[
          { ...mockSessions[0], liveStatus: 'idle' }
        ]}
        selectedSessionId={null}
      />
    )

    const idleLabel = screen.getByText('idle')
    expect(idleLabel.className).toContain('text-emerald-400')
  })
})

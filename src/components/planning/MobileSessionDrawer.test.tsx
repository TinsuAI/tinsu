/**
 * MobileSessionDrawer.test.tsx
 *
 * Story t3-7: Mobile Chat with Planning Agents
 * Tests for MobileSessionDrawer component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MobileSessionDrawer } from './MobileSessionDrawer'
import type { ChatSessionListItem } from './ChatSessionContextMenu'

// Mock rspc commands
vi.mock('@renderer/lib/rspc', () => ({
  commands: {
    listChatSessionsWithPreview: vi.fn()
  }
}))

const mockSessions: ChatSessionListItem[] = [
  {
    id: 'session-1',
    persona_key: 'bmad-agent-pm',
    last_message: 'Here are the key findings from my analysis',
    last_message_at: new Date(),
    live_status: 'idle'
  },
  {
    id: 'session-2',
    persona_key: 'bmad-agent-architect',
    last_message: 'Let me design the system architecture for you',
    last_message_at: new Date(Date.now() - 5 * 60 * 1000),
    live_status: 'thinking'
  }
]

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  })

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = createQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  )
}

describe('MobileSessionDrawer', () => {
  const mockOnSelectSession = vi.fn()
  const mockOnNewChat = vi.fn()
  const projectId = 'test-project'

  beforeEach(() => {
    vi.clearAllMocks()
    const { commands } = require('@renderer/lib/rspc')
    commands.listChatSessionsWithPreview.mockResolvedValue({
      status: 'ok',
      data: mockSessions
    })
  })

  it('renders trigger button', () => {
    renderWithProviders(
      <MobileSessionDrawer
        projectId={projectId}
        onSelectSession={mockOnSelectSession}
        onNewChat={mockOnNewChat}
      />
    )

    const triggerButton = screen.getByLabelText('Open chat sessions')
    expect(triggerButton).toBeInTheDocument()
  })

  it('opens drawer when trigger is clicked', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <MobileSessionDrawer
        projectId={projectId}
        onSelectSession={mockOnSelectSession}
        onNewChat={mockOnNewChat}
      />
    )

    const triggerButton = screen.getByLabelText('Open chat sessions')
    await user.click(triggerButton)

    await waitFor(() => {
      expect(screen.getByText('Agent Sessions')).toBeInTheDocument()
    })
  })

  it('displays sessions after drawer opens', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <MobileSessionDrawer
        projectId={projectId}
        onSelectSession={mockOnSelectSession}
        onNewChat={mockOnNewChat}
      />
    )

    const triggerButton = screen.getByLabelText('Open chat sessions')
    await user.click(triggerButton)

    await waitFor(() => {
      expect(screen.getByText(/Here are the key findings/)).toBeInTheDocument()
      expect(screen.getByText(/Let me design the system/)).toBeInTheDocument()
    })
  })

  it('calls onSelectSession when session is clicked', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <MobileSessionDrawer
        projectId={projectId}
        onSelectSession={mockOnSelectSession}
        onNewChat={mockOnNewChat}
      />
    )

    const triggerButton = screen.getByLabelText('Open chat sessions')
    await user.click(triggerButton)

    await waitFor(() => {
      const sessionButtons = screen.getAllByRole('option')
      expect(sessionButtons.length).toBeGreaterThan(0)
    })

    const firstSession = screen.getAllByRole('option')[0]
    await user.click(firstSession)

    expect(mockOnSelectSession).toHaveBeenCalled()
  })

  it('calls onNewChat when new chat button is clicked', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <MobileSessionDrawer
        projectId={projectId}
        onSelectSession={mockOnSelectSession}
        onNewChat={mockOnNewChat}
      />
    )

    const triggerButton = screen.getByLabelText('Open chat sessions')
    await user.click(triggerButton)

    await waitFor(() => {
      expect(screen.getByText('Agent Sessions')).toBeInTheDocument()
    })

    const newChatButton = screen.getByText(/New/, { selector: 'button' })
    await user.click(newChatButton)

    expect(mockOnNewChat).toHaveBeenCalled()
  })

  it('shows correct status badges', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <MobileSessionDrawer
        projectId={projectId}
        onSelectSession={mockOnSelectSession}
        onNewChat={mockOnNewChat}
      />
    )

    const triggerButton = screen.getByLabelText('Open chat sessions')
    await user.click(triggerButton)

    await waitFor(() => {
      // Sessions should show their status indicators
      expect(screen.getByText(/Idle|Thinking/)).toBeInTheDocument()
    })
  })

  it('handles empty sessions state', async () => {
    const { commands } = require('@renderer/lib/rspc')
    commands.listChatSessionsWithPreview.mockResolvedValue({
      status: 'ok',
      data: []
    })

    const user = userEvent.setup()
    renderWithProviders(
      <MobileSessionDrawer
        projectId={projectId}
        onSelectSession={mockOnSelectSession}
        onNewChat={mockOnNewChat}
      />
    )

    const triggerButton = screen.getByLabelText('Open chat sessions')
    await user.click(triggerButton)

    await waitFor(() => {
      expect(screen.getByText(/No active sessions/)).toBeInTheDocument()
    })
  })

  it('supports controlled open state', async () => {
    const user = userEvent.setup()
    const { rerender } = renderWithProviders(
      <MobileSessionDrawer
        projectId={projectId}
        selectedSessionId={undefined}
        onSelectSession={mockOnSelectSession}
        onNewChat={mockOnNewChat}
        isOpen={false}
      />
    )

    // Controlled open state doesn't render content yet
    expect(screen.queryByText('Agent Sessions')).not.toBeInTheDocument()

    // Rerender with open = true
    rerender(
      <QueryClientProvider client={createQueryClient()}>
        <MobileSessionDrawer
          projectId={projectId}
          selectedSessionId={undefined}
          onSelectSession={mockOnSelectSession}
          onNewChat={mockOnNewChat}
          isOpen={true}
        />
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('Agent Sessions')).toBeInTheDocument()
    })
  })
})

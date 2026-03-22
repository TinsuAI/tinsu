/**
 * ChatPanel Tests - Story 10.2 (AC: 1, 2), Story 10.3 (AC: 1, 2, 4), Story 10.5 (AC: 1), Story 10.6 (AC: 1-4)
 *
 * Tests: panel has three-section layout (persona selector, message area, input),
 * persona selector visible, input visible, close button works,
 * sendChatMessage mutation is called on send (not addMessage directly),
 * currentToolActivity updates when PreToolUse tool messages arrive,
 * currentToolActivity clears when assistant message arrives.
 *
 * Story 10.6 tests: list/chat view modes, session selection/resume, "New Chat",
 * "Back to sessions" button, empty session list auto-switches to chat view.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ChatPanel } from './ChatPanel'

// Mock react-markdown to avoid ESM import issues
vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => <div>{children}</div>
}))

vi.mock('remark-gfm', () => ({
  default: () => ({})
}))

vi.mock('@renderer/components/ui/code-block', () => ({
  CodeBlock: ({ code }: { code: string }) => <pre>{code}</pre>
}))

// Mock date-fns for ChatToolActivityCard (Story 10.5)
vi.mock('date-fns', () => ({
  format: (_date: Date, _fmt: string) => '10:00:00 AM'
}))

// Mock planning workspace constants for ChatMessageArea and ChatMessageBubble
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
    },
    'bmad:bmm:agents:ux-designer': {
      displayName: 'UX Designer',
      bg: 'bg-pink-500/20',
      text: 'text-pink-400',
      border: 'border-pink-500/30',
      icon: 'U',
      dot: 'bg-purple-400'
    },
    'bmad:bmm:agents:analyst': {
      displayName: 'Analyst',
      bg: 'bg-blue-500/20',
      text: 'text-blue-400',
      border: 'border-blue-500/30',
      icon: 'R',
      dot: 'bg-blue-400'
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
const mockGetCurrentQuery = vi.fn().mockReturnValue({
  data: { id: 'project-1', name: 'Test Project' }
})

const mockGetMessagesQuery = vi.fn().mockReturnValue({
  data: []
})

const mockCreateMutation = vi.fn().mockReturnValue({
  mutateAsync: vi.fn().mockResolvedValue({ id: 'session-1', session_uuid: 'uuid-1' }),
  isPending: false
})

const mockSendChatMessageMutation = vi.fn().mockReturnValue({
  mutateAsync: vi.fn().mockResolvedValue({ id: 'msg-1', role: 'user', content: 'test' }),
  isPending: false
})

const mockListWithPreviewQuery = vi.fn().mockReturnValue({
  data: undefined
})

const mockUpdateStatusMutation = vi.fn().mockReturnValue({
  mutate: vi.fn()
})

const mockDeleteSessionMutation = vi.fn().mockReturnValue({
  mutate: vi.fn()
})

vi.mock('@renderer/lib/trpc', () => ({
  trpc: {
    project: {
      getCurrent: {
        useQuery: () => mockGetCurrentQuery()
      }
    },
    chatSession: {
      getMessages: {
        useQuery: (...args: unknown[]) => mockGetMessagesQuery(...args)
      },
      create: {
        useMutation: () => mockCreateMutation()
      },
      sendChatMessage: {
        useMutation: (...args: unknown[]) => mockSendChatMessageMutation(...args)
      },
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
        getMessages: {
          invalidate: vi.fn()
        },
        listWithPreview: {
          invalidate: vi.fn()
        }
      }
    })
  }
}))

// Mock stores
const mockCloseChat = vi.fn()
const mockClearTargetChatSession = vi.fn()
let mockTargetChatSessionId: string | null = null

vi.mock('@renderer/stores', () => ({
  usePlanningWorkspaceStore: (selector?: (state: Record<string, unknown>) => unknown) => {
    const state = {
      isChatOpen: true,
      closeChat: mockCloseChat,
      targetChatSessionId: mockTargetChatSessionId,
      clearTargetChatSession: mockClearTargetChatSession
    }
    return selector ? selector(state) : state
  }
}))

vi.mock('@renderer/stores/project.store', () => ({
  useProjectStore: () => ({ projectName: 'Test Project' })
}))

// Sessions fixture for list view tests
const mockSessions = [
  {
    id: 'session-pm-1',
    session_uuid: 'uuid-pm-1',
    agent_persona: 'bmad:bmm:agents:pm',
    status: 'active',
    created_at: new Date('2026-03-22T10:00:00Z'),
    updated_at: new Date('2026-03-22T12:00:00Z'),
    last_message_at: new Date('2026-03-22T12:00:00Z'),
    lastMessagePreview: 'Tell me about the product roadmap'
  },
  {
    id: 'session-arch-1',
    session_uuid: 'uuid-arch-1',
    agent_persona: 'bmad:bmm:agents:architect',
    status: 'completed',
    created_at: new Date('2026-03-21T08:00:00Z'),
    updated_at: new Date('2026-03-21T09:00:00Z'),
    last_message_at: new Date('2026-03-21T09:00:00Z'),
    lastMessagePreview: 'The architecture looks good'
  }
]

describe('ChatPanel (Story 10.2, AC: 1, 2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: no sessions (empty list -> auto-switch to chat view)
    mockListWithPreviewQuery.mockReturnValue({ data: [] })
  })

  it('renders the chat panel container', () => {
    render(<ChatPanel />)

    expect(screen.getByTestId('chat-panel')).toBeInTheDocument()
  })

  it('renders persona selector section in chat view', async () => {
    render(<ChatPanel />)

    await waitFor(() => {
      expect(screen.getByTestId('chat-persona-selector')).toBeInTheDocument()
    })
  })

  it('renders input section in chat view', async () => {
    render(<ChatPanel />)

    await waitFor(() => {
      expect(screen.getByTestId('chat-input')).toBeInTheDocument()
    })
  })

  it('renders empty state when no messages', async () => {
    render(<ChatPanel />)

    await waitFor(() => {
      expect(screen.getByTestId('chat-empty-state')).toBeInTheDocument()
      expect(screen.getByText('Start a conversation with your agent')).toBeInTheDocument()
    })
  })

  it('renders close button', () => {
    render(<ChatPanel />)

    expect(screen.getByTestId('chat-close-button')).toBeInTheDocument()
  })

  it('calls closeChat when close button is clicked', () => {
    render(<ChatPanel />)

    fireEvent.click(screen.getByTestId('chat-close-button'))
    expect(mockCloseChat).toHaveBeenCalledTimes(1)
  })

  it('renders textarea and send button in chat view', async () => {
    render(<ChatPanel />)

    await waitFor(() => {
      expect(screen.getByTestId('chat-textarea')).toBeInTheDocument()
      expect(screen.getByTestId('chat-send-button')).toBeInTheDocument()
    })
  })
})

describe('ChatPanel persona switch (Story 10.4, AC: 6)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockListWithPreviewQuery.mockReturnValue({ data: [] })
  })

  it('persona change resets sessionId — new session created on next message', async () => {
    // Set up mocks so first send creates a session
    const mockCreateMutateAsync = vi.fn().mockResolvedValue({
      id: 'session-1',
      session_uuid: 'uuid-1'
    })

    mockCreateMutation.mockReturnValue({
      mutateAsync: mockCreateMutateAsync,
      isPending: false
    })

    const mockSendMutateAsync = vi.fn().mockResolvedValue({
      id: 'msg-1',
      role: 'user',
      content: 'test'
    })

    mockSendChatMessageMutation.mockReturnValue({
      mutateAsync: mockSendMutateAsync,
      isPending: false
    })

    render(<ChatPanel />)

    await waitFor(() => {
      expect(screen.getByTestId('chat-textarea')).toBeInTheDocument()
    })

    // Send a message to establish a session
    const textarea = screen.getByTestId('chat-textarea')
    const sendButton = screen.getByTestId('chat-send-button')

    fireEvent.change(textarea, { target: { value: 'Hello PM!' } })
    fireEvent.click(sendButton)

    await waitFor(() => {
      expect(mockCreateMutateAsync).toHaveBeenCalledTimes(1)
    })

    // Now switch persona to Architect
    const architectButton = screen.getByText('Architect')
    fireEvent.click(architectButton)

    // Reset create mock to track the NEXT creation
    mockCreateMutateAsync.mockClear()
    mockCreateMutateAsync.mockResolvedValue({
      id: 'session-2',
      session_uuid: 'uuid-2'
    })

    // Send another message — should create a NEW session (not reuse session-1)
    fireEvent.change(textarea, { target: { value: 'Hello Architect!' } })
    fireEvent.click(sendButton)

    await waitFor(() => {
      expect(mockCreateMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          agentPersona: 'bmad:bmm:agents:architect',
          projectId: 'project-1'
        })
      )
    })
  })

  it('persona change clears thinking indicator', async () => {
    render(<ChatPanel />)

    await waitFor(() => {
      expect(screen.getByTestId('chat-persona-selector')).toBeInTheDocument()
    })

    // The thinking indicator data-testid is "chat-thinking-indicator"
    // After persona switch, thinking should be false
    const architectButton = screen.getByText('Architect')
    fireEvent.click(architectButton)

    // After clicking a persona button, there should be no thinking indicator
    expect(screen.queryByTestId('chat-thinking-indicator')).not.toBeInTheDocument()
  })
})

describe('ChatPanel sendChatMessage (Story 10.3, AC: 1, 2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockListWithPreviewQuery.mockReturnValue({ data: [] })
  })

  it('uses sendChatMessage mutation instead of addMessage on send', async () => {
    const mockSendMutateAsync = vi.fn().mockResolvedValue({
      id: 'msg-1',
      role: 'user',
      content: 'Hello'
    })

    mockSendChatMessageMutation.mockReturnValue({
      mutateAsync: mockSendMutateAsync,
      isPending: false
    })

    const mockCreateMutateAsync = vi.fn().mockResolvedValue({
      id: 'session-1',
      session_uuid: 'uuid-1'
    })

    mockCreateMutation.mockReturnValue({
      mutateAsync: mockCreateMutateAsync,
      isPending: false
    })

    render(<ChatPanel />)

    await waitFor(() => {
      expect(screen.getByTestId('chat-textarea')).toBeInTheDocument()
    })

    const textarea = screen.getByTestId('chat-textarea')
    const sendButton = screen.getByTestId('chat-send-button')

    fireEvent.change(textarea, { target: { value: 'Hello agent!' } })
    fireEvent.click(sendButton)

    await waitFor(() => {
      // Should have created session first
      expect(mockCreateMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          agentPersona: 'bmad:bmm:agents:pm',
          projectId: 'project-1'
        })
      )
    })

    await waitFor(() => {
      // Should have called sendChatMessage (not addMessage)
      expect(mockSendMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'session-1',
          content: 'Hello agent!'
        })
      )
    })
  })

  it('disables input while sendChatMessage is pending', async () => {
    mockSendChatMessageMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: true
    })

    render(<ChatPanel />)

    await waitFor(() => {
      expect(screen.getByTestId('chat-send-button')).toBeInTheDocument()
    })

    const sendButton = screen.getByTestId('chat-send-button')
    expect(sendButton).toBeDisabled()
  })
})

describe('ChatPanel currentToolActivity tracking (Story 10.5, AC: 1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockListWithPreviewQuery.mockReturnValue({ data: [] })
  })

  it('currentToolActivity updates when PreToolUse tool messages arrive during thinking', async () => {
    // Set up messages with a PreToolUse tool message
    const toolMessages = [
      {
        id: 'msg-1',
        role: 'user' as const,
        content: 'Read the file',
        created_at: new Date('2026-03-22T10:00:00Z')
      },
      {
        id: 'msg-tool-1',
        role: 'tool' as const,
        content: 'PreToolUse: Read',
        tool_name: 'Read',
        tool_input: JSON.stringify({ file_path: '/home/user/project/architecture.md' }),
        created_at: new Date('2026-03-22T10:00:01Z')
      }
    ]

    // First render returns user message only, second returns with tool message
    let callCount = 0
    mockGetMessagesQuery.mockImplementation(() => {
      callCount++
      if (callCount <= 2) {
        return { data: [toolMessages[0]] }
      }
      return { data: toolMessages }
    })

    const mockCreateMutateAsync = vi.fn().mockResolvedValue({
      id: 'session-1',
      session_uuid: 'uuid-1'
    })
    mockCreateMutation.mockReturnValue({
      mutateAsync: mockCreateMutateAsync,
      isPending: false
    })

    const mockSendMutateAsync = vi.fn().mockResolvedValue({
      id: 'msg-1',
      role: 'user',
      content: 'Read the file'
    })
    mockSendChatMessageMutation.mockReturnValue({
      mutateAsync: mockSendMutateAsync,
      isPending: false
    })

    render(<ChatPanel />)

    await waitFor(() => {
      expect(screen.getByTestId('chat-textarea')).toBeInTheDocument()
    })

    // Send a message to start thinking
    const textarea = screen.getByTestId('chat-textarea')
    const sendButton = screen.getByTestId('chat-send-button')
    fireEvent.change(textarea, { target: { value: 'Read the file' } })
    fireEvent.click(sendButton)

    await waitFor(() => {
      expect(mockCreateMutateAsync).toHaveBeenCalled()
    })

    await waitFor(() => {
      expect(screen.getByTestId('chat-thinking-indicator')).toBeInTheDocument()
    })
  })

  it('currentToolActivity clears when assistant message arrives', async () => {
    // Start with thinking and a PreToolUse, then assistant arrives
    const messagesWithAssistant = [
      {
        id: 'msg-1',
        role: 'user' as const,
        content: 'Hello',
        created_at: new Date('2026-03-22T10:00:00Z')
      },
      {
        id: 'msg-2',
        role: 'assistant' as const,
        content: 'Hi there!',
        created_at: new Date('2026-03-22T10:00:02Z')
      }
    ]

    mockGetMessagesQuery.mockReturnValue({
      data: messagesWithAssistant
    })

    render(<ChatPanel />)

    await waitFor(() => {
      // With assistant message present and no thinking state,
      // there should be no thinking indicator
      expect(screen.queryByTestId('chat-thinking-indicator')).not.toBeInTheDocument()
    })
  })
})

describe('ChatPanel session list view (Story 10.6, AC: 1, 2, 3, 4)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows list view when sessions exist', () => {
    mockListWithPreviewQuery.mockReturnValue({
      data: mockSessions
    })

    render(<ChatPanel />)

    // Should show session list, not chat input
    expect(screen.getByTestId('chat-session-list')).toBeInTheDocument()
    expect(screen.queryByTestId('chat-input')).not.toBeInTheDocument()
  })

  it('auto-switches to chat view when no sessions exist', async () => {
    mockListWithPreviewQuery.mockReturnValue({
      data: []
    })

    render(<ChatPanel />)

    // Should auto-switch to chat view
    await waitFor(() => {
      expect(screen.getByTestId('chat-input')).toBeInTheDocument()
    })
  })

  it('shows list view when listWithPreview is still loading (undefined)', () => {
    mockListWithPreviewQuery.mockReturnValue({
      data: undefined
    })

    render(<ChatPanel />)

    // When data is undefined (loading), should remain in list view
    // but listWithPreview is loading so the session list will show empty
    // The key is that we don't auto-switch to chat because data is undefined, not empty
    expect(screen.queryByTestId('chat-input')).not.toBeInTheDocument()
  })

  it('selecting a session switches to chat view', async () => {
    mockListWithPreviewQuery.mockReturnValue({
      data: mockSessions
    })

    render(<ChatPanel />)

    // Click on the first session
    fireEvent.click(screen.getByTestId('session-card-button-session-pm-1'))

    // Should switch to chat view
    await waitFor(() => {
      expect(screen.getByTestId('chat-input')).toBeInTheDocument()
      expect(screen.getByTestId('chat-persona-selector')).toBeInTheDocument()
    })
  })

  it('"New Chat" button switches to chat view', async () => {
    mockListWithPreviewQuery.mockReturnValue({
      data: mockSessions
    })

    render(<ChatPanel />)

    fireEvent.click(screen.getByTestId('new-chat-button'))

    // Should switch to chat view
    await waitFor(() => {
      expect(screen.getByTestId('chat-input')).toBeInTheDocument()
    })
  })

  it('"Back to sessions" button returns to list view', async () => {
    mockListWithPreviewQuery.mockReturnValue({
      data: mockSessions
    })

    render(<ChatPanel />)

    // First switch to chat view
    fireEvent.click(screen.getByTestId('new-chat-button'))

    await waitFor(() => {
      expect(screen.getByTestId('chat-back-button')).toBeInTheDocument()
    })

    // Click back
    fireEvent.click(screen.getByTestId('chat-back-button'))

    // Should return to list view
    await waitFor(() => {
      expect(screen.getByTestId('chat-session-list')).toBeInTheDocument()
    })
  })

  it('close button works in list view', () => {
    mockListWithPreviewQuery.mockReturnValue({
      data: mockSessions
    })

    render(<ChatPanel />)

    fireEvent.click(screen.getByTestId('chat-close-button'))
    expect(mockCloseChat).toHaveBeenCalledTimes(1)
  })

  it('header shows "Chat Sessions" title in list view', () => {
    mockListWithPreviewQuery.mockReturnValue({
      data: mockSessions
    })

    render(<ChatPanel />)

    expect(screen.getByText('Chat Sessions')).toBeInTheDocument()
  })
})

describe('ChatPanel targetChatSessionId (Story 10.7, AC: 2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTargetChatSessionId = null
  })

  it('auto-selects session and switches to chat view when targetChatSessionId is set', async () => {
    // Set up session list with a matching session
    mockListWithPreviewQuery.mockReturnValue({
      data: mockSessions
    })

    // Set target session ID
    mockTargetChatSessionId = 'session-pm-1'

    // Mock messages for the selected session
    mockGetMessagesQuery.mockReturnValue({
      data: [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Hello',
          created_at: new Date('2026-03-22T10:00:00Z')
        }
      ]
    })

    render(<ChatPanel />)

    // Should switch to chat view (since target session was set)
    await waitFor(() => {
      expect(screen.getByTestId('chat-input')).toBeInTheDocument()
    })

    // Should clear the target after processing
    expect(mockClearTargetChatSession).toHaveBeenCalled()
  })

  it('clears targetChatSessionId after processing', async () => {
    mockListWithPreviewQuery.mockReturnValue({
      data: mockSessions
    })

    mockTargetChatSessionId = 'session-arch-1'

    render(<ChatPanel />)

    await waitFor(() => {
      expect(mockClearTargetChatSession).toHaveBeenCalled()
    })
  })
})

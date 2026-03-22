/**
 * ChatPanel Tests - Story 10.2 (AC: 1, 2), Story 10.3 (AC: 1, 2, 4)
 *
 * Tests: panel has three-section layout (persona selector, message area, input),
 * persona selector visible, input visible, close button works,
 * sendChatMessage mutation is called on send (not addMessage directly).
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

// Mock planning workspace constants for ChatMessageArea and ChatMessageBubble
vi.mock('@renderer/constants/planning-workspace', () => {
  const config: Record<string, { displayName: string; bg: string; text: string; border: string; icon: string }> = {
    'bmad:bmm:agents:pm': {
      displayName: 'PM',
      bg: 'bg-emerald-500/20',
      text: 'text-emerald-400',
      border: 'border-emerald-500/30',
      icon: 'M'
    },
    'bmad:bmm:agents:architect': {
      displayName: 'Architect',
      bg: 'bg-purple-500/20',
      text: 'text-purple-400',
      border: 'border-purple-500/30',
      icon: 'A'
    },
    'bmad:bmm:agents:ux-designer': {
      displayName: 'UX Designer',
      bg: 'bg-pink-500/20',
      text: 'text-pink-400',
      border: 'border-pink-500/30',
      icon: 'U'
    },
    'bmad:bmm:agents:analyst': {
      displayName: 'Analyst',
      bg: 'bg-blue-500/20',
      text: 'text-blue-400',
      border: 'border-blue-500/30',
      icon: 'R'
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
      }
    },
    useUtils: () => ({
      chatSession: {
        getMessages: {
          invalidate: vi.fn()
        }
      }
    })
  }
}))

// Mock stores
const mockCloseChat = vi.fn()

vi.mock('@renderer/stores', () => ({
  usePlanningWorkspaceStore: (selector?: (state: Record<string, unknown>) => unknown) => {
    const state = {
      isChatOpen: true,
      closeChat: mockCloseChat
    }
    return selector ? selector(state) : state
  }
}))

vi.mock('@renderer/stores/project.store', () => ({
  useProjectStore: () => ({ projectName: 'Test Project' })
}))

describe('ChatPanel (Story 10.2, AC: 1, 2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the chat panel container', () => {
    render(<ChatPanel />)

    expect(screen.getByTestId('chat-panel')).toBeInTheDocument()
  })

  it('renders persona selector section', () => {
    render(<ChatPanel />)

    expect(screen.getByTestId('chat-persona-selector')).toBeInTheDocument()
  })

  it('renders input section', () => {
    render(<ChatPanel />)

    expect(screen.getByTestId('chat-input')).toBeInTheDocument()
  })

  it('renders empty state when no messages', () => {
    render(<ChatPanel />)

    expect(screen.getByTestId('chat-empty-state')).toBeInTheDocument()
    expect(screen.getByText('Start a conversation with your agent')).toBeInTheDocument()
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

  it('shows all four persona buttons', () => {
    render(<ChatPanel />)

    expect(screen.getByText('PM')).toBeInTheDocument()
    expect(screen.getByText('Architect')).toBeInTheDocument()
    expect(screen.getByText('UX Designer')).toBeInTheDocument()
    expect(screen.getByText('Analyst')).toBeInTheDocument()
  })

  it('renders textarea and send button', () => {
    render(<ChatPanel />)

    expect(screen.getByTestId('chat-textarea')).toBeInTheDocument()
    expect(screen.getByTestId('chat-send-button')).toBeInTheDocument()
  })
})

describe('ChatPanel sendChatMessage (Story 10.3, AC: 1, 2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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

  it('disables input while sendChatMessage is pending', () => {
    mockSendChatMessageMutation.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: true
    })

    render(<ChatPanel />)

    const sendButton = screen.getByTestId('chat-send-button')
    expect(sendButton).toBeDisabled()
  })
})

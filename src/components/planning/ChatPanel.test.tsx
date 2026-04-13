/**
 * ChatPanel Tests - T1.9: migrated from tRPC to Tauri commands.
 *
 * Tests: panel layout, persona selection, sending messages, session management,
 * currentToolActivity tracking, session list view modes, CTM-2.1 concurrent sessions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ChatPanel } from './ChatPanel'

// Mock @tauri-apps/api/event so listen() resolves cleanly in tests
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => {}),
}))

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

// ChatSessionUsage still uses tRPC (migrated in T1.10), stub it out
vi.mock('./ChatSessionUsage', () => ({
  ChatSessionUsage: () => <div data-testid="chat-session-usage-stub" />
}))

// Stub tRPC for sub-components that haven't been migrated yet (ChatInput → useAutocomplete)
vi.mock('@renderer/lib/trpc', () => ({
  trpc: {
    useUtils: () => ({
      planning: { getSkillManifest: { fetch: vi.fn().mockResolvedValue([]) } },
      project: {
        listFiles: { fetch: vi.fn().mockResolvedValue([]) },
        searchFiles: { fetch: vi.fn().mockResolvedValue([]) },
      }
    }),
    planning: {
      getSkillManifest: {
        useQuery: () => ({ data: [] })
      }
    }
  }
}))

// Mock date-fns for ChatToolActivityCard (Story 10.5)
vi.mock('date-fns', () => ({
  format: (_date: Date, _fmt: string) => '10:00:00 AM'
}))

// Mock planning workspace constants for ChatMessageArea and ChatMessageBubble
vi.mock('@renderer/constants/planning-workspace', () => {
  const config: Record<string, { displayName: string; bg: string; text: string; border: string; icon: string; dot: string }> = {
    'general': {
      displayName: 'General',
      bg: 'bg-zinc-500/20',
      text: 'text-zinc-400',
      border: 'border-zinc-500/30',
      icon: 'G',
      dot: 'bg-zinc-400'
    },
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
    },
    'bmad:ghk:agents:growth-guru': {
      displayName: 'Growth',
      bg: 'bg-orange-500/20',
      text: 'text-orange-400',
      border: 'border-orange-500/30',
      icon: 'G',
      dot: 'bg-orange-400'
    }
  }
  return {
    AGENT_PERSONA_CONFIG: config,
    BMAD_WORKFLOWS: [],
    getAgentPersona: (agentName: string | null) => {
      if (!agentName) return null
      return config[agentName] ?? null
    }
  }
})

// ─── Mock react-query ─────────────────────────────────────────────────────────
// We mock useQuery / useMutation to control return values without a real network.
const mockInvalidate = vi.fn()
type QueryOptions = { queryKey: unknown[] }

const mockListWithPreviewQuery = vi.fn().mockReturnValue({ data: undefined })
const mockGetMessagesQuery = vi.fn().mockReturnValue({ data: [] })
const mockGetByWorkflowKeyQuery = vi.fn().mockReturnValue({ data: null, isLoading: false })

// Mutation mocks — keyed by creation order in ChatPanel
const mockCreateMutation = vi.fn().mockReturnValue({
  mutateAsync: vi.fn().mockResolvedValue({ id: 'session-1', session_uuid: 'uuid-1' }),
  isPending: false
})
const mockSendChatMessageMutation = vi.fn().mockReturnValue({
  mutateAsync: vi.fn().mockResolvedValue({ id: 'msg-1', role: 'user', content: 'test' }),
  isPending: false
})
const mockStubMutation = vi.fn().mockReturnValue({ mutate: vi.fn(), mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false })

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>()
  return {
    ...actual,
    useQueryClient: () => ({ invalidateQueries: mockInvalidate }),
    useQuery: (options: QueryOptions) => {
      const key = options.queryKey[0] as string
      if (key === 'chat-sessions-preview') return mockListWithPreviewQuery(options)
      if (key === 'chat-messages') return mockGetMessagesQuery(options)
      if (key === 'chat-session-workflow') return mockGetByWorkflowKeyQuery(options)
      return { data: undefined, isLoading: false }
    },
    useMutation: (options: { mutationFn?: (...args: unknown[]) => unknown }) => {
      // Dispatch by mutationFn source to be stable across re-renders and child components
      const src = options?.mutationFn?.toString() ?? ''
      if (src.includes('createChatSession')) return mockCreateMutation()
      if (src.includes('sendChatMessage')) return mockSendChatMessageMutation()
      return mockStubMutation()
    },
  }
})

// ─── Mock stores ─────────────────────────────────────────────────────────────
const mockClearTargetChatSession = vi.fn()
const mockClearPendingChatPrefill = vi.fn()
let mockTargetChatSessionId: string | null = null
let mockSelectedWorkflowKey: string | null = null
let mockPendingChatPrefill: string | null = null

vi.mock('@renderer/stores', () => ({
  usePlanningWorkspaceStore: (selector?: (state: Record<string, unknown>) => unknown) => {
    const state = {
      targetChatSessionId: mockTargetChatSessionId,
      clearTargetChatSession: mockClearTargetChatSession,
      selectedWorkflowKey: mockSelectedWorkflowKey,
      pendingChatPrefill: mockPendingChatPrefill,
      pendingPersona: null,
      clearPendingChatPrefill: mockClearPendingChatPrefill,
      showTerminal: false,
      setShowTerminal: vi.fn(),
      setActiveChatSessionId: vi.fn(),
      setActivePhase: vi.fn(),
      setSelectedWorkflow: vi.fn(),
    }
    return selector ? selector(state) : state
  },
  useProjectStore: (selector?: (state: Record<string, unknown>) => unknown) => {
    const state = { activeProjectId: 'project-1', projectName: 'Test Project', projectPath: '/tmp/test' }
    return selector ? selector(state) : state
  },
}))

vi.mock('@renderer/stores/project.store', () => ({
  useProjectStore: (selector?: (state: Record<string, unknown>) => unknown) => {
    const state = { activeProjectId: 'project-1', projectName: 'Test Project', projectPath: '/tmp/test' }
    return selector ? selector(state) : state
  }
}))

// Sessions fixture for list view tests
const makeSession = (overrides: Record<string, unknown> = {}) => ({
  id: 'session-pm-1',
  session_uuid: 'uuid-pm-1',
  agent_persona: 'bmad:bmm:agents:pm',
  workflow_key: null,
  status: 'active',
  created_at: 1711101600,
  updated_at: 1711108800,
  last_message_at: 1711108800,
  last_message_preview: 'Tell me about the product roadmap',
  skip_permissions: 1,
  ...overrides
})

const mockSessions = [
  makeSession(),
  makeSession({
    id: 'session-arch-1',
    session_uuid: 'uuid-arch-1',
    agent_persona: 'bmad:bmm:agents:architect',
    status: 'completed',
    last_message_preview: 'The architecture looks good'
  })
]

describe('ChatPanel (Story 10.2, AC: 1, 2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: no sessions (empty list -> auto-switch to chat view)
    mockListWithPreviewQuery.mockReturnValue({ data: [] })
    mockGetMessagesQuery.mockReturnValue({ data: [] })
    mockGetByWorkflowKeyQuery.mockReturnValue({ data: null, isLoading: false })
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
    mockGetMessagesQuery.mockReturnValue({ data: [] })
    mockGetByWorkflowKeyQuery.mockReturnValue({ data: null, isLoading: false })
  })

  it('persona change resets sessionId — new session created on next message', async () => {
    const mockCreateMutateAsync = vi.fn().mockResolvedValue({ id: 'session-1', session_uuid: 'uuid-1' })
    mockCreateMutation.mockReturnValue({ mutateAsync: mockCreateMutateAsync, isPending: false })

    const mockSendMutateAsync = vi.fn().mockResolvedValue({ id: 'msg-1', role: 'user', content: 'test' })
    mockSendChatMessageMutation.mockReturnValue({ mutateAsync: mockSendMutateAsync, isPending: false })

    render(<ChatPanel />)

    await waitFor(() => {
      expect(screen.getByTestId('chat-textarea')).toBeInTheDocument()
    })

    const textarea = screen.getByTestId('chat-textarea')
    const sendButton = screen.getByTestId('chat-send-button')

    fireEvent.change(textarea, { target: { value: 'Hello PM!' } })
    fireEvent.click(sendButton)

    await waitFor(() => {
      expect(mockCreateMutateAsync).toHaveBeenCalledTimes(1)
    })

    // Switch to Architect persona
    const architectButton = screen.getByText('Architect')
    fireEvent.click(architectButton)

    // Reset create mock for the NEXT creation
    mockCreateMutateAsync.mockClear()
    mockCreateMutateAsync.mockResolvedValue({ id: 'session-2', session_uuid: 'uuid-2' })

    // Send another message — should create a NEW session
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
    const architectButton = screen.getByText('Architect')
    fireEvent.click(architectButton)
    expect(screen.queryByTestId('chat-thinking-indicator')).not.toBeInTheDocument()
  })
})

describe('ChatPanel sendChatMessage (Story 10.3, AC: 1, 2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockListWithPreviewQuery.mockReturnValue({ data: [] })
    mockGetMessagesQuery.mockReturnValue({ data: [] })
    mockGetByWorkflowKeyQuery.mockReturnValue({ data: null, isLoading: false })
  })

  it('uses sendChatMessage mutation instead of addMessage on send', async () => {
    const mockSendMutateAsync = vi.fn().mockResolvedValue({ id: 'msg-1', role: 'user', content: 'Hello' })
    mockSendChatMessageMutation.mockReturnValue({ mutateAsync: mockSendMutateAsync, isPending: false })

    const mockCreateMutateAsync = vi.fn().mockResolvedValue({ id: 'session-1', session_uuid: 'uuid-1' })
    mockCreateMutation.mockReturnValue({ mutateAsync: mockCreateMutateAsync, isPending: false })

    render(<ChatPanel />)

    await waitFor(() => {
      expect(screen.getByTestId('chat-textarea')).toBeInTheDocument()
    })

    const textarea = screen.getByTestId('chat-textarea')
    const sendButton = screen.getByTestId('chat-send-button')

    fireEvent.change(textarea, { target: { value: 'Hello agent!' } })
    fireEvent.click(sendButton)

    await waitFor(() => {
      expect(mockCreateMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ agentPersona: 'bmad:bmm:agents:pm', projectId: 'project-1' })
      )
    })

    await waitFor(() => {
      expect(mockSendMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: 'session-1', content: 'Hello agent!' })
      )
    })
  })

  it('disables input while sendChatMessage is pending', async () => {
    mockSendChatMessageMutation.mockReturnValue({ mutateAsync: vi.fn(), isPending: true })

    render(<ChatPanel />)

    await waitFor(() => {
      expect(screen.getByTestId('chat-send-button')).toBeInTheDocument()
    })

    expect(screen.getByTestId('chat-send-button')).toBeDisabled()
  })
})

describe('ChatPanel currentToolActivity tracking (Story 10.5, AC: 1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockListWithPreviewQuery.mockReturnValue({ data: [] })
    mockGetByWorkflowKeyQuery.mockReturnValue({ data: null, isLoading: false })
  })

  it('currentToolActivity updates when PreToolUse tool messages arrive during thinking', async () => {
    const toolMessages = [
      { id: 'msg-1', role: 'user' as const, content: 'Read the file', created_at: 1711101600 },
      { id: 'msg-tool-1', role: 'tool' as const, content: 'PreToolUse: Read', tool_name: 'Read',
        tool_input: JSON.stringify({ file_path: '/home/user/project/architecture.md' }), created_at: 1711101601 }
    ]

    let callCount = 0
    mockGetMessagesQuery.mockImplementation(() => {
      callCount++
      return callCount <= 2 ? { data: [toolMessages[0]] } : { data: toolMessages }
    })

    const mockCreateMutateAsync = vi.fn().mockResolvedValue({ id: 'session-1', session_uuid: 'uuid-1' })
    mockCreateMutation.mockReturnValue({ mutateAsync: mockCreateMutateAsync, isPending: false })
    mockSendChatMessageMutation.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue({ id: 'msg-1', role: 'user', content: 'Read the file' }), isPending: false })

    render(<ChatPanel />)

    await waitFor(() => {
      expect(screen.getByTestId('chat-textarea')).toBeInTheDocument()
    })

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
    const messagesWithAssistant = [
      { id: 'msg-1', role: 'user' as const, content: 'Hello', created_at: 1711101600 },
      { id: 'msg-2', role: 'assistant' as const, content: 'Hi there!', created_at: 1711101602 }
    ]

    mockGetMessagesQuery.mockReturnValue({ data: messagesWithAssistant })

    render(<ChatPanel />)

    await waitFor(() => {
      expect(screen.queryByTestId('chat-thinking-indicator')).not.toBeInTheDocument()
    })
  })
})

describe('ChatPanel session list view (Story 10.6, AC: 1, 2, 3, 4)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetMessagesQuery.mockReturnValue({ data: [] })
    mockGetByWorkflowKeyQuery.mockReturnValue({ data: null, isLoading: false })
  })

  it('shows list view when sessions exist', () => {
    mockListWithPreviewQuery.mockReturnValue({ data: mockSessions })
    render(<ChatPanel />)
    expect(screen.getByTestId('chat-session-list')).toBeInTheDocument()
    expect(screen.queryByTestId('chat-input')).not.toBeInTheDocument()
  })

  it('auto-switches to chat view when no sessions exist', async () => {
    mockListWithPreviewQuery.mockReturnValue({ data: [] })
    render(<ChatPanel />)
    await waitFor(() => {
      expect(screen.getByTestId('chat-input')).toBeInTheDocument()
    })
  })

  it('shows list view when listWithPreview is still loading (undefined)', () => {
    mockListWithPreviewQuery.mockReturnValue({ data: undefined })
    render(<ChatPanel />)
    expect(screen.queryByTestId('chat-input')).not.toBeInTheDocument()
  })

  it('selecting a session switches to chat view', async () => {
    mockListWithPreviewQuery.mockReturnValue({ data: mockSessions })
    render(<ChatPanel />)
    fireEvent.click(screen.getByTestId('session-card-button-session-pm-1'))
    await waitFor(() => {
      expect(screen.getByTestId('chat-input')).toBeInTheDocument()
      expect(screen.getByTestId('chat-persona-selector')).toBeInTheDocument()
    })
  })

  it('"New Chat" button switches to chat view', async () => {
    mockListWithPreviewQuery.mockReturnValue({ data: mockSessions })
    render(<ChatPanel />)
    fireEvent.click(screen.getByTestId('new-chat-button'))
    await waitFor(() => {
      expect(screen.getByTestId('chat-input')).toBeInTheDocument()
    })
  })

  it('"Back to sessions" button returns to list view', async () => {
    mockListWithPreviewQuery.mockReturnValue({ data: mockSessions })
    render(<ChatPanel />)
    fireEvent.click(screen.getByTestId('new-chat-button'))
    await waitFor(() => {
      expect(screen.getByTestId('chat-back-button')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByTestId('chat-back-button'))
    await waitFor(() => {
      expect(screen.getByTestId('chat-session-list')).toBeInTheDocument()
    })
  })

  it('header shows "Chat Sessions" title in list view', () => {
    mockListWithPreviewQuery.mockReturnValue({ data: mockSessions })
    render(<ChatPanel />)
    expect(screen.getByText('Chat Sessions')).toBeInTheDocument()
  })
})

describe('ChatPanel targetChatSessionId (Story 10.7, AC: 2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTargetChatSessionId = null
    mockGetMessagesQuery.mockReturnValue({ data: [] })
    mockGetByWorkflowKeyQuery.mockReturnValue({ data: null, isLoading: false })
  })

  it('auto-selects session and switches to chat view when targetChatSessionId is set', async () => {
    mockListWithPreviewQuery.mockReturnValue({ data: mockSessions })
    mockTargetChatSessionId = 'session-pm-1'
    mockGetMessagesQuery.mockReturnValue({ data: [{ id: 'msg-1', role: 'user', content: 'Hello', created_at: 1711101600 }] })

    render(<ChatPanel />)

    await waitFor(() => {
      expect(screen.getByTestId('chat-input')).toBeInTheDocument()
    })
    expect(mockClearTargetChatSession).toHaveBeenCalled()
  })

  it('clears targetChatSessionId after processing', async () => {
    mockListWithPreviewQuery.mockReturnValue({ data: mockSessions })
    mockTargetChatSessionId = 'session-arch-1'

    render(<ChatPanel />)

    await waitFor(() => {
      expect(mockClearTargetChatSession).toHaveBeenCalled()
    })
  })
})

describe('ChatPanel concurrent session background persistence (CTM-2.1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTargetChatSessionId = null
    mockSelectedWorkflowKey = null
    mockPendingChatPrefill = null
    mockGetMessagesQuery.mockReturnValue({ data: [] })
    mockGetByWorkflowKeyQuery.mockReturnValue({ data: null, isLoading: false })
  })

  it('persona switch to persona with existing session binds to that session (AC: 1, Task 7.2)', async () => {
    const sessionsWithBoth = [
      makeSession({ id: 'session-pm-active', session_uuid: 'uuid-pm-active', agent_persona: 'bmad:bmm:agents:pm', last_message_preview: 'PM session message' }),
      makeSession({ id: 'session-arch-active', session_uuid: 'uuid-arch-active', agent_persona: 'bmad:bmm:agents:architect', last_message_preview: 'Architect session message' })
    ]
    mockListWithPreviewQuery.mockReturnValue({ data: sessionsWithBoth })

    const mockCreateMutateAsync = vi.fn().mockResolvedValue({ id: 'session-new', session_uuid: 'uuid-new' })
    mockCreateMutation.mockReturnValue({ mutateAsync: mockCreateMutateAsync, isPending: false })
    const mockSendMutateAsync = vi.fn().mockResolvedValue({ id: 'msg-1', role: 'user', content: 'test' })
    mockSendChatMessageMutation.mockReturnValue({ mutateAsync: mockSendMutateAsync, isPending: false })

    render(<ChatPanel />)

    // Select Architect session (different from default PM persona)
    fireEvent.click(screen.getByTestId('session-card-button-session-arch-active'))

    await waitFor(() => {
      expect(screen.getByTestId('chat-input')).toBeInTheDocument()
    })

    // Switch to PM persona — should find and bind to session-pm-active
    const pmButton = screen.getByText('PM')
    fireEvent.click(pmButton)

    // Send message — should reuse session-pm-active, not create a new one
    const textarea = screen.getByTestId('chat-textarea')
    const sendButton = screen.getByTestId('chat-send-button')
    fireEvent.change(textarea, { target: { value: 'Hello PM!' } })
    fireEvent.click(sendButton)

    await waitFor(() => {
      expect(mockSendMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: 'session-pm-active', content: 'Hello PM!' })
      )
    })
    expect(mockCreateMutateAsync).not.toHaveBeenCalled()
  })

  it('persona switch to persona WITHOUT existing session sets sessionId(null) (AC: 1, Task 7.3)', async () => {
    const sessionsOnlyArch = [
      makeSession({ id: 'session-arch-only', session_uuid: 'uuid-arch-only', agent_persona: 'bmad:bmm:agents:architect', last_message_preview: 'Architect message' })
    ]
    mockListWithPreviewQuery.mockReturnValue({ data: sessionsOnlyArch })

    const mockCreateMutateAsync = vi.fn().mockResolvedValue({ id: 'session-new-ux', session_uuid: 'uuid-new-ux' })
    mockCreateMutation.mockReturnValue({ mutateAsync: mockCreateMutateAsync, isPending: false })
    const mockSendMutateAsync = vi.fn().mockResolvedValue({ id: 'msg-1', role: 'user', content: 'test' })
    mockSendChatMessageMutation.mockReturnValue({ mutateAsync: mockSendMutateAsync, isPending: false })

    render(<ChatPanel />)

    fireEvent.click(screen.getByTestId('session-card-button-session-arch-only'))

    await waitFor(() => {
      expect(screen.getByTestId('chat-input')).toBeInTheDocument()
    })

    // Switch to UX Designer (no existing session)
    const uxButton = screen.getByText('UX Designer')
    fireEvent.click(uxButton)

    const textarea = screen.getByTestId('chat-textarea')
    const sendButton = screen.getByTestId('chat-send-button')
    fireEvent.change(textarea, { target: { value: 'Hello UX Designer!' } })
    fireEvent.click(sendButton)

    await waitFor(() => {
      expect(mockCreateMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ agentPersona: 'bmad:bmm:agents:ux-designer', projectId: 'project-1' })
      )
    })
  })

  it('handleSelectSession correctly resumes a background session (Task 7.4)', async () => {
    mockListWithPreviewQuery.mockReturnValue({ data: mockSessions })
    mockGetMessagesQuery.mockReturnValue({ data: [{ id: 'msg-resumed', role: 'user', content: 'Resumed message', created_at: 1711101600 }] })

    render(<ChatPanel />)
    fireEvent.click(screen.getByTestId('session-card-button-session-pm-1'))

    await waitFor(() => {
      expect(screen.getByTestId('chat-input')).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(screen.getByText('Resumed message')).toBeInTheDocument()
    })
  })

  it('persona switch does NOT call killSession — old session persists in background (Task 7.1)', async () => {
    const sessionsWithActive = [
      makeSession({ id: 'session-pm-bg', session_uuid: 'uuid-pm-bg', last_message_preview: 'PM background session' })
    ]
    mockListWithPreviewQuery.mockReturnValue({ data: sessionsWithActive })

    render(<ChatPanel />)
    fireEvent.click(screen.getByTestId('session-card-button-session-pm-bg'))

    await waitFor(() => {
      expect(screen.getByTestId('chat-input')).toBeInTheDocument()
    })

    // Switch to Architect — PM session should persist
    const architectButton = screen.getByText('Architect')
    fireEvent.click(architectButton)
    expect(screen.getByTestId('chat-input')).toBeInTheDocument()

    // Go back to list — PM session still there
    const backButton = screen.getByTestId('chat-back-button')
    fireEvent.click(backButton)

    await waitFor(() => {
      expect(screen.getByTestId('chat-session-list')).toBeInTheDocument()
      expect(screen.getByTestId('session-card-button-session-pm-bg')).toBeInTheDocument()
    })
  })

  it('completed sessions are not resumed on persona switch (AC: 1)', async () => {
    const sessionsWithCompleted = [
      makeSession({ id: 'session-arch-completed', session_uuid: 'uuid-arch-completed', agent_persona: 'bmad:bmm:agents:architect', status: 'completed', last_message_preview: 'Completed session' })
    ]
    mockListWithPreviewQuery.mockReturnValue({ data: sessionsWithCompleted })

    const mockCreateMutateAsync = vi.fn().mockResolvedValue({ id: 'session-new-arch', session_uuid: 'uuid-new-arch' })
    mockCreateMutation.mockReturnValue({ mutateAsync: mockCreateMutateAsync, isPending: false })
    const mockSendMutateAsync = vi.fn().mockResolvedValue({ id: 'msg-1', role: 'user', content: 'test' })
    mockSendChatMessageMutation.mockReturnValue({ mutateAsync: mockSendMutateAsync, isPending: false })

    render(<ChatPanel />)
    fireEvent.click(screen.getByTestId('session-card-button-session-arch-completed'))

    await waitFor(() => {
      expect(screen.getByTestId('chat-input')).toBeInTheDocument()
    })

    // Switch to PM then back to Architect
    const pmButton = screen.getByText('PM')
    fireEvent.click(pmButton)
    const archButton = screen.getByText('Architect')
    fireEvent.click(archButton)

    // Send message — should create NEW session (completed session ignored)
    const textarea = screen.getByTestId('chat-textarea')
    const sendButton = screen.getByTestId('chat-send-button')
    fireEvent.change(textarea, { target: { value: 'Hello Architect!' } })
    fireEvent.click(sendButton)

    await waitFor(() => {
      expect(mockCreateMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ agentPersona: 'bmad:bmm:agents:architect', projectId: 'project-1' })
      )
    })
  })
})

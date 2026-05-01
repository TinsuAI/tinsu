import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MobileChatScreen } from './MobileChatScreen'

/* ── Module mocks ──────────────────────────────────────────────────── */

vi.mock('@renderer/lib/rspc', () => ({
  commands: {
    getChatMessages: vi.fn(),
    sendChatMessage: vi.fn(),
    listChatSessionsWithPreview: vi.fn(),
  },
}))

vi.mock('@renderer/stores/project.store', () => ({
  useProjectStore: (selector: (s: { projectId: string }) => unknown) =>
    selector({ projectId: 'proj-1' }),
}))

vi.mock('@renderer/constants/planning-workspace', () => ({
  AGENT_PERSONA_CONFIG: {
    general: {
      displayName: 'General',
      characterName: '',
      bg: '',
      text: '',
      border: '',
      dot: 'bg-slate-400',
    },
    'bmad:bmm:agents:pm': {
      displayName: 'PM',
      characterName: 'John',
      bg: '',
      text: '',
      border: '',
      dot: 'bg-green-400',
    },
  },
}))

const mockPopRoute = vi.fn()
vi.mock('../shell/mobile-nav.store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../shell/mobile-nav.store')>()
  return {
    ...actual,
    useMobileNavStore: Object.assign(
      vi.fn((selector?: (s: unknown) => unknown) => {
        const state = { popRoute: mockPopRoute }
        return selector ? selector(state) : state
      }),
      {
        getState: vi.fn(() => ({ popRoute: mockPopRoute })),
        setState: actual.useMobileNavStore.setState,
      },
    ),
  }
})

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async () => () => {}),
}))

vi.mock('@renderer/components/planning/ChatWorkingIndicator', () => ({
  ChatWorkingIndicator: () => <div data-testid="chat-working-indicator" />,
}))
vi.mock('@renderer/components/task/MarkdownComponents', () => ({
  markdownComponents: {},
}))
vi.mock('@renderer/components/ui/code-block', () => ({
  CodeBlock: ({ children }: { children: React.ReactNode }) => <pre>{children}</pre>,
}))
vi.mock('react-markdown', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="react-markdown">{children}</div>,
}))
vi.mock('remark-gfm', () => ({ default: vi.fn() }))

vi.mock('../primitives/MobileSheet', () => ({
  MobileSheet: ({
    open,
    children,
    title,
  }: {
    open: boolean
    children: React.ReactNode
    title?: string
  }) => {
    if (!open) return null
    return (
      <div data-testid="mobile-sheet-content">
        {title && <span data-testid="mobile-sheet-title">{title}</span>}
        {children}
      </div>
    )
  },
}))

vi.mock('../primitives/MobileLoadingSkeleton', () => ({
  MobileLoadingSkeleton: () => <div data-testid="mobile-loading-skeleton" />,
}))

vi.mock('../primitives/MobileEmptyState', () => ({
  MobileEmptyState: ({ title }: { title: string }) => (
    <div data-testid="mobile-empty-state"><h2>{title}</h2></div>
  ),
}))

import { commands } from '@renderer/lib/rspc'

/* ── Helpers ──────────────────────────────────────────────────────── */

function makeMessages() {
  return [
    { id: 'msg-1', role: 'user', content: 'Hello PM!', created_at: null },
    { id: 'msg-2', role: 'assistant', content: 'How can I help?', created_at: null },
  ]
}

function makeSessionList() {
  return [{ id: 'sess-1', agent_persona: 'bmad:bmm:agents:pm', live_status: 'idle', last_message_preview: null, last_message_at: null }]
}

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

function renderScreen(sessionId = 'sess-1') {
  return render(<MobileChatScreen sessionId={sessionId} />, { wrapper })
}

/* ── Tests ────────────────────────────────────────────────────────── */

describe('MobileChatScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPopRoute.mockReset()
    ;(commands.getChatMessages as Mock).mockResolvedValue({
      status: 'ok',
      data: makeMessages(),
    })
    ;(commands.listChatSessionsWithPreview as Mock).mockResolvedValue({
      status: 'ok',
      data: makeSessionList(),
    })
    ;(commands.sendChatMessage as Mock).mockResolvedValue({
      status: 'ok',
      data: {},
    })
  })

  it('renders the chat screen with data-testid', () => {
    renderScreen()
    expect(screen.getByTestId('mobile-chat-screen')).toBeInTheDocument()
  })

  it('renders back button in header', () => {
    renderScreen()
    const backBtn = screen.getByTestId('mobile-chat-back-button')
    expect(backBtn).toBeInTheDocument()
  })

  it('back button calls popRoute', () => {
    renderScreen()
    const backBtn = screen.getByTestId('mobile-chat-back-button')
    fireEvent.click(backBtn)
    expect(mockPopRoute).toHaveBeenCalledTimes(1)
  })

  it('renders persona pill', async () => {
    renderScreen()
    // Persona pill shows persona display name
    await waitFor(() => {
      expect(screen.getByText('PM')).toBeInTheDocument()
    })
  })

  it('tapping persona pill opens read-only info sheet', async () => {
    renderScreen()
    await waitFor(() => {
      expect(screen.getByText('PM')).toBeInTheDocument()
    })
    const pill = screen.getByLabelText(/Agent: PM/i)
    fireEvent.click(pill)
    expect(screen.getByTestId('mobile-sheet-content')).toBeInTheDocument()
    expect(screen.getByTestId('mobile-sheet-title')).toHaveTextContent('Agent persona')
  })

  it('persona info sheet has no switch persona button', async () => {
    renderScreen()
    await waitFor(() => {
      expect(screen.getByText('PM')).toBeInTheDocument()
    })
    const pill = screen.getByLabelText(/Agent: PM/i)
    fireEvent.click(pill)
    // Verify there's no "switch" or "change" button
    expect(screen.queryByRole('button', { name: /switch/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /change persona/i })).not.toBeInTheDocument()
  })

  it('composer Send button is disabled when empty', () => {
    renderScreen()
    const sendBtn = screen.getByRole('button', { name: /send message/i })
    expect(sendBtn).toBeDisabled()
  })

  it('tapping Send calls sendChatMessage and clears input', async () => {
    renderScreen()
    const textarea = screen.getByRole('textbox', { name: /type a message/i })
    fireEvent.change(textarea, { target: { value: 'Hello!' } })

    const sendBtn = screen.getByRole('button', { name: /send message/i })
    await act(async () => {
      fireEvent.click(sendBtn)
    })

    await waitFor(() => {
      expect(commands.sendChatMessage).toHaveBeenCalledWith('sess-1', 'Hello!')
    })
    expect((textarea as HTMLTextAreaElement).value).toBe('')
  })

  it('renders working indicator after send', async () => {
    // Make send slow so thinking shows up
    let resolveSend: () => void
    ;(commands.sendChatMessage as Mock).mockReturnValue(
      new Promise<{ status: 'ok'; data: object }>((resolve) => {
        resolveSend = () => resolve({ status: 'ok', data: {} })
      })
    )

    renderScreen()

    const textarea = screen.getByRole('textbox', { name: /type a message/i })
    fireEvent.change(textarea, { target: { value: 'Hello!' } })

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /send message/i }))
    })

    // Working indicator should appear
    await waitFor(() => {
      expect(screen.getByTestId('chat-working-indicator')).toBeInTheDocument()
    })

    resolveSend!()
  })

  it('working indicator disappears when assistant message arrives', async () => {
    // Start with only a user message; then inject assistant message
    ;(commands.getChatMessages as Mock)
      .mockResolvedValueOnce({ status: 'ok', data: [{ id: 'msg-1', role: 'user', content: 'Hello', created_at: null }] })
      .mockResolvedValue({ status: 'ok', data: makeMessages() }) // includes assistant

    ;(commands.sendChatMessage as Mock).mockResolvedValue({ status: 'ok', data: {} })

    renderScreen()

    const textarea = screen.getByRole('textbox', { name: /type a message/i })
    fireEvent.change(textarea, { target: { value: 'Hello!' } })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send message/i }))
    })

    // After refetch with assistant message, thinking should clear
    await waitFor(() => {
      expect(screen.queryByTestId('chat-working-indicator')).not.toBeInTheDocument()
    }, { timeout: 5000 })
  })

  it('message list renders', async () => {
    renderScreen()
    await waitFor(() => {
      expect(screen.getByTestId('mobile-chat-message-list')).toBeInTheDocument()
    })
  })
})

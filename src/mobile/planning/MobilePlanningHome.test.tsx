import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MobilePlanningHome } from './MobilePlanningHome'
import type { ChatSessionListItemPreview } from './MobileSessionRow'

/* ── Module mocks ──────────────────────────────────────────────────── */

vi.mock('@renderer/lib/rspc', () => ({
  commands: {
    listChatSessionsWithPreview: vi.fn(),
    createChatSession: vi.fn(),
  },
}))

vi.mock('@renderer/stores/project.store', () => ({
  useProjectStore: (selector: (s: { projectId: string | null }) => unknown) =>
    selector({ projectId: 'proj-1' }),
}))

vi.mock('@renderer/constants/planning-workspace', () => ({
  AGENT_PERSONA_CONFIG: {
    general: { displayName: 'General', characterName: '', bg: '', text: '', border: '', dot: 'bg-slate-400' },
    'bmad:bmm:agents:pm': { displayName: 'PM', characterName: 'John', bg: '', text: '', border: '', dot: 'bg-green-400' },
  },
}))

// Mock nav store
const mockPushRoute = vi.fn()
vi.mock('../shell/mobile-nav.store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../shell/mobile-nav.store')>()
  return {
    ...actual,
    useMobileNavStore: Object.assign(
      vi.fn((selector?: (s: unknown) => unknown) => {
        const state = { pushRoute: mockPushRoute }
        return selector ? selector(state) : state
      }),
      {
        getState: vi.fn(() => ({ pushRoute: mockPushRoute })),
        setState: actual.useMobileNavStore.setState,
      },
    ),
  }
})

// Mock primitives
vi.mock('../primitives/MobileTopAppBar', () => ({
  MobileTopAppBar: ({ title }: { title?: string }) => <header>{title}</header>,
}))

vi.mock('../primitives/MobileFab', () => ({
  MobileFab: ({ onPress, ariaLabel }: { onPress: () => void; ariaLabel: string }) => (
    <button type="button" onClick={onPress} aria-label={ariaLabel} data-testid="mobile-fab" />
  ),
}))

vi.mock('../primitives/MobileEmptyState', () => ({
  MobileEmptyState: ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <div data-testid="mobile-empty-state">
      <h2>{title}</h2>
      {subtitle && <p>{subtitle}</p>}
    </div>
  ),
}))

vi.mock('../primitives/MobileLoadingSkeleton', () => ({
  MobileLoadingSkeleton: ({ count }: { count?: number }) => (
    <div data-testid="mobile-loading-skeleton">{count} skeletons</div>
  ),
}))

vi.mock('./MobileSessionRow', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./MobileSessionRow')>()
  return {
    ...actual,
    MobileSessionRow: ({
      session,
      onTap,
    }: {
      session: ChatSessionListItemPreview
      onTap: () => void
    }) => (
      <button
        type="button"
        onClick={onTap}
        data-testid="mobile-session-row"
        data-session-id={session.id}
      >
        {session.agent_persona ?? 'general'}
      </button>
    ),
  }
})

vi.mock('./MobileNewSessionSheet', () => ({
  MobileNewSessionSheet: ({
    open,
    onSessionCreated,
  }: {
    open: boolean
    onOpenChange: (v: boolean) => void
    onSessionCreated: (id: string) => void
  }) =>
    open ? (
      <div data-testid="mobile-planning-new-session-sheet">
        <button
          type="button"
          onClick={() => onSessionCreated('new-sess-1')}
          data-testid="mock-create-session"
        >
          Create Session
        </button>
      </div>
    ) : null,
}))

import { commands } from '@renderer/lib/rspc'

/* ── Helpers ──────────────────────────────────────────────────────── */

function makeSessions(): ChatSessionListItemPreview[] {
  return [
    {
      id: 'sess-1',
      agent_persona: 'bmad:bmm:agents:pm',
      last_message_preview: 'Hello from PM',
      last_message_at: new Date(Date.now() - 10 * 60_000).toISOString(),
      live_status: 'idle',
    },
    {
      id: 'sess-2',
      agent_persona: 'general',
      last_message_preview: 'General thoughts',
      last_message_at: new Date(Date.now() - 60 * 60_000).toISOString(),
      live_status: 'thinking',
    },
  ]
}

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

function renderHome() {
  return render(<MobilePlanningHome />, { wrapper })
}

/* ── Tests ────────────────────────────────────────────────────────── */

describe('MobilePlanningHome', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPushRoute.mockReset()
  })

  it('renders the planning home wrapper', async () => {
    ;(commands.listChatSessionsWithPreview as Mock).mockResolvedValue({
      status: 'ok',
      data: [],
    })

    renderHome()
    // The container div is always rendered
    expect(document.querySelector('[data-testid="mobile-planning-home"]')).toBeInTheDocument()
  })

  it('shows empty state when no sessions', async () => {
    ;(commands.listChatSessionsWithPreview as Mock).mockResolvedValue({
      status: 'ok',
      data: [],
    })

    renderHome()

    await waitFor(() => {
      expect(screen.getByText('No chat sessions yet')).toBeInTheDocument()
    })
  })

  it('renders session rows for each session', async () => {
    ;(commands.listChatSessionsWithPreview as Mock).mockResolvedValue({
      status: 'ok',
      data: makeSessions(),
    })

    renderHome()

    await waitFor(() => {
      expect(screen.getAllByTestId('mobile-session-row')).toHaveLength(2)
    })
  })

  it('sorts "thinking" sessions first', async () => {
    ;(commands.listChatSessionsWithPreview as Mock).mockResolvedValue({
      status: 'ok',
      data: makeSessions(), // sess-2 is "thinking", sess-1 is "idle"
    })

    renderHome()

    await waitFor(() => {
      const rows = screen.getAllByTestId('mobile-session-row')
      // thinking session (sess-2/general) should be first
      expect(rows[0]).toHaveAttribute('data-session-id', 'sess-2')
      expect(rows[1]).toHaveAttribute('data-session-id', 'sess-1')
    })
  })

  it('tapping a session row pushes chat route', async () => {
    ;(commands.listChatSessionsWithPreview as Mock).mockResolvedValue({
      status: 'ok',
      data: makeSessions(),
    })

    renderHome()

    await waitFor(() => {
      expect(screen.getAllByTestId('mobile-session-row')).toHaveLength(2)
    })

    // Click first row (thinking = sess-2)
    fireEvent.click(screen.getAllByTestId('mobile-session-row')[0])
    expect(mockPushRoute).toHaveBeenCalledWith('planning', 'chat:sess-2')
  })

  it('FAB tap opens new session sheet', async () => {
    ;(commands.listChatSessionsWithPreview as Mock).mockResolvedValue({
      status: 'ok',
      data: [],
    })

    renderHome()

    await waitFor(() => {
      expect(screen.getByTestId('mobile-fab')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('mobile-fab'))

    expect(screen.getByTestId('mobile-planning-new-session-sheet')).toBeInTheDocument()
  })

  it('creating a session pushes chat route and closes sheet', async () => {
    ;(commands.listChatSessionsWithPreview as Mock).mockResolvedValue({
      status: 'ok',
      data: [],
    })

    renderHome()

    await waitFor(() => {
      expect(screen.getByTestId('mobile-fab')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('mobile-fab'))

    await act(async () => {
      fireEvent.click(screen.getByTestId('mock-create-session'))
    })

    expect(mockPushRoute).toHaveBeenCalledWith('planning', 'chat:new-sess-1')
  })

  it('shows error state when query fails', async () => {
    ;(commands.listChatSessionsWithPreview as Mock).mockResolvedValue({
      status: 'error',
      error: 'DB error',
    })

    renderHome()

    await waitFor(() => {
      expect(screen.getByText("Couldn't load sessions")).toBeInTheDocument()
    })
  })
})

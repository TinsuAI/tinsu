import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MobileNewSessionSheet } from './MobileNewSessionSheet'

// Mock commands
vi.mock('@renderer/lib/rspc', () => ({
  commands: {
    createChatSession: vi.fn(),
  },
}))

// Mock MobileSheet to render children directly (avoid Radix Portal in JSDOM)
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
        {title && <p>{title}</p>}
        {children}
      </div>
    )
  },
}))

// Mock MobileListItem — render as button with title, always with data-testid="mobile-list-item"
vi.mock('../primitives/MobileListItem', () => ({
  MobileListItem: ({
    title,
    onPress,
    disabled,
  }: {
    title: string
    onPress?: () => void
    disabled?: boolean
    [key: string]: unknown
  }) => (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled}
      data-testid="mobile-list-item"
    >
      {title}
    </button>
  ),
}))

import { commands } from '@renderer/lib/rspc'

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

function renderSheet(props: Partial<React.ComponentProps<typeof MobileNewSessionSheet>> = {}) {
  const defaults = {
    open: true,
    onOpenChange: vi.fn(),
    projectId: 'proj-1',
    onSessionCreated: vi.fn(),
  }
  return render(<MobileNewSessionSheet {...defaults} {...props} />, { wrapper })
}

describe('MobileNewSessionSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders 6 persona rows in canonical order', () => {
    renderSheet()
    const rows = screen.getAllByTestId('mobile-list-item')
    expect(rows).toHaveLength(6)
    expect(rows[0]).toHaveTextContent('General')
    expect(rows[1]).toHaveTextContent('PM')
    expect(rows[2]).toHaveTextContent('Architect')
    expect(rows[3]).toHaveTextContent('UX Designer')
    expect(rows[4]).toHaveTextContent('Analyst')
    expect(rows[5]).toHaveTextContent('Growth Guru')
  })

  it('calls commands.createChatSession then onSessionCreated when persona is selected', async () => {
    const onSessionCreated = vi.fn()
    ;(commands.createChatSession as Mock).mockResolvedValue({
      status: 'ok',
      data: { id: 'new-sess-1' },
    })

    renderSheet({ onSessionCreated })

    const pmRow = screen.getAllByTestId('mobile-list-item')[1] // PM
    await act(async () => {
      fireEvent.click(pmRow)
    })

    await waitFor(() => {
      expect(commands.createChatSession).toHaveBeenCalledWith(
        'proj-1',
        'bmad:bmm:agents:pm',
        null,
      )
      expect(onSessionCreated).toHaveBeenCalledWith('new-sess-1')
    })
  })

  it('disables rows while mutation is pending', async () => {
    // Make createChatSession hang
    let resolveFn: () => void
    ;(commands.createChatSession as Mock).mockReturnValue(
      new Promise<void>((resolve) => { resolveFn = resolve })
    )

    renderSheet()
    const rows = screen.getAllByTestId('mobile-list-item')

    fireEvent.click(rows[0]) // trigger mutation

    // While pending, all buttons should be disabled
    await waitFor(() => {
      const updatedRows = screen.getAllByTestId('mobile-list-item')
      updatedRows.forEach((row) => expect(row).toBeDisabled())
    })

    // Resolve to not leak the promise
    resolveFn!()
  })

  it('shows inline error message when mutation fails', async () => {
    ;(commands.createChatSession as Mock).mockResolvedValue({
      status: 'error',
      error: 'Something went wrong',
    })

    renderSheet()
    const firstRow = screen.getAllByTestId('mobile-list-item')[0]

    await act(async () => {
      fireEvent.click(firstRow)
    })

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
  })

  it('renders nothing when open=false', () => {
    renderSheet({ open: false })
    expect(screen.queryByTestId('mobile-sheet-content')).not.toBeInTheDocument()
  })
})

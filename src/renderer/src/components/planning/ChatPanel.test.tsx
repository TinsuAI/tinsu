/**
 * ChatPanel Tests - Story 10.2 (AC: 1, 2)
 *
 * Tests: panel has three-section layout (persona selector, message area, input),
 * persona selector visible, input visible, close button works.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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

// Mock tRPC
const mockGetCurrentQuery = vi.fn().mockReturnValue({
  data: { id: 'project-1', name: 'Test Project' }
})

const mockGetMessagesQuery = vi.fn().mockReturnValue({
  data: []
})

const mockCreateMutation = vi.fn().mockReturnValue({
  mutateAsync: vi.fn(),
  isPending: false
})

const mockAddMessageMutation = vi.fn().mockReturnValue({
  mutateAsync: vi.fn(),
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
      addMessage: {
        useMutation: (...args: unknown[]) => mockAddMessageMutation(...args)
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

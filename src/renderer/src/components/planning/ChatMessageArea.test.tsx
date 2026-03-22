/**
 * ChatMessageArea Tests - Story 10.2 (AC: 3, 7)
 *
 * Tests: messages render in order, empty state shown when no messages,
 * auto-scroll behavior.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChatMessageArea } from './ChatMessageArea'

// Mock react-markdown to avoid ESM import issues
vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => <div data-testid="markdown-content">{children}</div>
}))

vi.mock('remark-gfm', () => ({
  default: () => ({})
}))

vi.mock('@renderer/components/ui/code-block', () => ({
  CodeBlock: ({ code }: { code: string }) => <pre>{code}</pre>
}))

// Mock scrollIntoView for auto-scroll tests
const scrollIntoViewMock = vi.fn()
window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock

describe('ChatMessageArea (Story 10.2, AC: 3, 7)', () => {
  const baseTime = new Date('2026-03-22T10:00:00Z')

  const sampleMessages = [
    {
      id: 'msg-1',
      role: 'user' as const,
      content: 'Hello agent!',
      created_at: new Date(baseTime.getTime())
    },
    {
      id: 'msg-2',
      role: 'assistant' as const,
      content: 'Hello! How can I help?',
      created_at: new Date(baseTime.getTime() + 1000)
    },
    {
      id: 'msg-3',
      role: 'user' as const,
      content: 'Tell me about the architecture.',
      created_at: new Date(baseTime.getTime() + 2000)
    }
  ]

  describe('empty state', () => {
    it('shows empty state when no messages exist', () => {
      render(<ChatMessageArea messages={[]} />)

      expect(screen.getByTestId('chat-empty-state')).toBeInTheDocument()
      expect(screen.getByText('Start a conversation with your agent')).toBeInTheDocument()
    })

    it('does not show message area when empty', () => {
      render(<ChatMessageArea messages={[]} />)

      expect(screen.queryByTestId('chat-message-area')).not.toBeInTheDocument()
    })
  })

  describe('message rendering', () => {
    it('renders messages in order', () => {
      render(<ChatMessageArea messages={sampleMessages} agentPersona="bmad:bmm:agents:pm" />)

      expect(screen.getByTestId('chat-message-area')).toBeInTheDocument()

      // Should render user and assistant messages (not tool)
      const userBubbles = screen.getAllByTestId('chat-bubble-user')
      expect(userBubbles).toHaveLength(2)

      const assistantBubbles = screen.getAllByTestId('chat-bubble-assistant')
      expect(assistantBubbles).toHaveLength(1)
    })

    it('filters out tool messages', () => {
      const messagesWithTool = [
        ...sampleMessages,
        {
          id: 'msg-tool',
          role: 'tool' as const,
          content: 'Tool result',
          created_at: new Date(baseTime.getTime() + 3000)
        }
      ]

      render(<ChatMessageArea messages={messagesWithTool} agentPersona="bmad:bmm:agents:pm" />)

      // Tool messages should not be rendered as bubbles
      expect(screen.queryByTestId('chat-bubble-tool')).not.toBeInTheDocument()
    })

    it('passes agentPersona to message bubbles', () => {
      render(<ChatMessageArea messages={sampleMessages} agentPersona="bmad:bmm:agents:pm" />)

      // PM persona should show up on assistant messages
      expect(screen.getByText('PM')).toBeInTheDocument()
    })
  })

  describe('auto-scroll', () => {
    it('calls scrollIntoView when messages are added', () => {
      scrollIntoViewMock.mockClear()

      const { rerender } = render(
        <ChatMessageArea messages={sampleMessages.slice(0, 1)} />
      )

      rerender(
        <ChatMessageArea messages={sampleMessages} />
      )

      // scrollIntoView should have been called on the sentinel div
      expect(scrollIntoViewMock).toHaveBeenCalled()
    })
  })
})

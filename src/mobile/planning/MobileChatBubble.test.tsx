import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MobileChatBubble, type ChatMessage } from './MobileChatBubble'
import type { AgentPersonaConfig } from '@renderer/constants/planning-workspace'

// Mock cross-tree imports
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

const mockPersona: AgentPersonaConfig = {
  displayName: 'PM',
  characterName: 'John',
  bg: 'bg-green-500/20',
  text: 'text-green-400',
  border: 'border-green-500/30',
  dot: 'bg-green-400',
}

function makeMsg(overrides: Partial<ChatMessage>): ChatMessage {
  return {
    id: 'msg-1',
    role: 'user',
    content: 'Hello!',
    created_at: null,
    ...overrides,
  }
}

describe('MobileChatBubble', () => {
  describe('user messages', () => {
    it('renders user message content', () => {
      render(<MobileChatBubble message={makeMsg({ role: 'user', content: 'Hello agent!' })} persona={mockPersona} />)
      expect(screen.getByText('Hello agent!')).toBeInTheDocument()
    })

    it('user bubble has primary-tinted background class', () => {
      const { container } = render(<MobileChatBubble message={makeMsg({ role: 'user', content: 'Hi' })} persona={mockPersona} />)
      const bubble = container.querySelector('.bg-primary\\/15')
      expect(bubble).toBeInTheDocument()
    })

    it('user bubble is right-aligned (ml-auto)', () => {
      const { container } = render(<MobileChatBubble message={makeMsg({ role: 'user', content: 'Hi' })} persona={mockPersona} />)
      const wrapper = container.querySelector('.flex-col.items-end')
      expect(wrapper).toBeInTheDocument()
    })
  })

  describe('assistant messages', () => {
    it('renders assistant message via react-markdown', () => {
      render(<MobileChatBubble message={makeMsg({ role: 'assistant', content: '**Hello!**' })} persona={mockPersona} />)
      expect(screen.getByTestId('react-markdown')).toBeInTheDocument()
    })

    it('assistant bubble is left-aligned (mr-auto)', () => {
      const { container } = render(<MobileChatBubble message={makeMsg({ role: 'assistant', content: 'Hi' })} persona={mockPersona} />)
      const bubble = container.querySelector('.mr-auto')
      expect(bubble).toBeInTheDocument()
    })

    it('assistant bubble has card background class', () => {
      const { container } = render(<MobileChatBubble message={makeMsg({ role: 'assistant', content: 'Hi' })} persona={mockPersona} />)
      const bubble = container.querySelector('.bg-card')
      expect(bubble).toBeInTheDocument()
    })
  })

  describe('tool messages', () => {
    it('renders tool message collapsed by default', () => {
      render(
        <MobileChatBubble
          message={makeMsg({ role: 'tool', content: '', tool_name: 'search_docs', tool_input: '{"query":"test"}' })}
          persona={mockPersona}
        />
      )
      expect(screen.getByText('Tool: search_docs')).toBeInTheDocument()
    })

    it('expands tool message on click to show input', () => {
      render(
        <MobileChatBubble
          message={makeMsg({ role: 'tool', content: '', tool_name: 'search_docs', tool_input: '{"query":"test"}' })}
          persona={mockPersona}
        />
      )
      const btn = screen.getByRole('button', { name: /search_docs/i })
      fireEvent.click(btn)
      // After expand, tool_input JSON should be visible
      expect(screen.getByText(/"query":\s*"test"/)).toBeInTheDocument()
    })

    it('shows "unknown" when tool_name is null', () => {
      render(
        <MobileChatBubble
          message={makeMsg({ role: 'tool', content: '', tool_name: null })}
          persona={mockPersona}
        />
      )
      expect(screen.getByText('Tool: unknown')).toBeInTheDocument()
    })
  })
})

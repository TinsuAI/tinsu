/**
 * ChatMessageBubble Tests - Story 10.2 (AC: 3, 4)
 *
 * Tests: user messages right-aligned, agent messages left-aligned,
 * sender labels, timestamps, markdown rendering.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChatMessageBubble } from './ChatMessageBubble'

// Mock react-markdown to avoid ESM import issues in test
vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => <div data-testid="markdown-content">{children}</div>
}))

// Mock remark-gfm
vi.mock('remark-gfm', () => ({
  default: () => ({})
}))

// Mock CodeBlock
vi.mock('@renderer/components/ui/code-block', () => ({
  CodeBlock: ({ language, code }: { language: string; code: string }) => (
    <pre data-testid="code-block" data-language={language}>
      {code}
    </pre>
  )
}))

describe('ChatMessageBubble (Story 10.2, AC: 3, 4)', () => {
  const baseTimestamp = new Date('2026-03-22T14:30:00Z')

  describe('user messages', () => {
    it('renders user bubble with "You" label', () => {
      render(
        <ChatMessageBubble
          role="user"
          content="Hello agent!"
          createdAt={baseTimestamp}
        />
      )

      expect(screen.getByText('You')).toBeInTheDocument()
      expect(screen.getByText('Hello agent!')).toBeInTheDocument()
    })

    it('renders user messages right-aligned', () => {
      render(
        <ChatMessageBubble
          role="user"
          content="Test"
          createdAt={baseTimestamp}
        />
      )

      const bubble = screen.getByTestId('chat-bubble-user')
      expect(bubble.className).toContain('justify-end')
    })

    it('renders user bubble with cyan background', () => {
      render(
        <ChatMessageBubble
          role="user"
          content="Test"
          createdAt={baseTimestamp}
        />
      )

      const bubble = screen.getByTestId('chat-bubble-user')
      const innerBubble = bubble.firstElementChild as HTMLElement
      expect(innerBubble.className).toContain('bg-cyan-600/20')
    })

    it('displays a timestamp', () => {
      render(
        <ChatMessageBubble
          role="user"
          content="Test"
          createdAt={baseTimestamp}
        />
      )

      // The timestamp should be formatted with date-fns format
      // The exact text depends on timezone, but it should exist
      const bubble = screen.getByTestId('chat-bubble-user')
      const timeElements = bubble.querySelectorAll('span')
      // At least the "You" label and a timestamp should exist
      expect(timeElements.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('agent messages', () => {
    it('renders agent bubble with persona name', () => {
      render(
        <ChatMessageBubble
          role="assistant"
          content="Here is my analysis..."
          agentPersona="bmad-agent-pm"
          createdAt={baseTimestamp}
        />
      )

      expect(screen.getByText('PM')).toBeInTheDocument()
    })

    it('renders agent messages left-aligned', () => {
      render(
        <ChatMessageBubble
          role="assistant"
          content="Response"
          agentPersona="bmad-agent-architect"
          createdAt={baseTimestamp}
        />
      )

      const bubble = screen.getByTestId('chat-bubble-assistant')
      expect(bubble.className).toContain('justify-start')
    })

    it('renders agent bubble with muted background', () => {
      render(
        <ChatMessageBubble
          role="assistant"
          content="Response"
          agentPersona="bmad-agent-pm"
          createdAt={baseTimestamp}
        />
      )

      const bubble = screen.getByTestId('chat-bubble-assistant')
      const innerBubble = bubble.firstElementChild as HTMLElement
      expect(innerBubble.className).toContain('bg-muted/60')
    })

    it('renders persona colored dot for agent messages', () => {
      render(
        <ChatMessageBubble
          role="assistant"
          content="Response"
          agentPersona="bmad-agent-pm"
          createdAt={baseTimestamp}
        />
      )

      const bubble = screen.getByTestId('chat-bubble-assistant')
      const dot = bubble.querySelector('.bg-green-400')
      expect(dot).toBeInTheDocument()
    })

    it('falls back to "Agent" label when persona is unknown', () => {
      render(
        <ChatMessageBubble
          role="assistant"
          content="Response"
          agentPersona="unknown-agent"
          createdAt={baseTimestamp}
        />
      )

      expect(screen.getByText('Agent')).toBeInTheDocument()
    })

    it('renders markdown content for agent messages', () => {
      render(
        <ChatMessageBubble
          role="assistant"
          content="# Heading\n\nSome **bold** text"
          agentPersona="bmad-agent-pm"
          createdAt={baseTimestamp}
        />
      )

      // ReactMarkdown is mocked, so it renders the raw content as text
      expect(screen.getByTestId('markdown-content')).toBeInTheDocument()
    })
  })
})

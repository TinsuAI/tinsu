/**
 * ChatToolActivityGroup Tests - Story 10.5 (AC: 4)
 *
 * Tests: single tool message renders as individual card (no group header),
 * multiple tool messages show "Agent performed N actions" header,
 * expanding/collapsing group shows/hides individual cards.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ChatToolActivityGroup } from './ChatToolActivityGroup'

// Mock date-fns for ChatToolActivityCard
vi.mock('date-fns', () => ({
  format: (_date: Date, _fmt: string) => '10:00:00 AM'
}))

const baseTime = new Date('2026-03-22T10:00:00Z')

function makeToolMessage(id: string, toolName: string, toolInput: Record<string, unknown> = {}) {
  return {
    id,
    role: 'tool' as const,
    content: `PreToolUse: ${toolName}`,
    tool_name: toolName,
    tool_input: JSON.stringify(toolInput),
    created_at: new Date(baseTime.getTime() + parseInt(id.replace('msg-', '')) * 1000)
  }
}

describe('ChatToolActivityGroup (Story 10.5, AC: 4)', () => {
  describe('single tool message', () => {
    it('renders a single card without group header', () => {
      const messages = [makeToolMessage('msg-1', 'Read', { file_path: '/test/file.ts' })]

      render(<ChatToolActivityGroup toolMessages={messages} />)

      expect(screen.getByTestId('chat-tool-activity-group')).toBeInTheDocument()
      // Should show the individual card
      expect(screen.getByTestId('chat-tool-activity-card')).toBeInTheDocument()
      // Should NOT show group toggle (single message = no group header)
      expect(screen.queryByTestId('chat-tool-group-toggle')).not.toBeInTheDocument()
    })
  })

  describe('multiple tool messages', () => {
    const messages = [
      makeToolMessage('msg-1', 'Read', { file_path: '/test/file.ts' }),
      makeToolMessage('msg-2', 'Grep', { pattern: 'TODO' }),
      makeToolMessage('msg-3', 'Edit', { file_path: '/test/file.ts' })
    ]

    it('shows "Agent performed N actions" header', () => {
      render(<ChatToolActivityGroup toolMessages={messages} />)

      expect(screen.getByText('3')).toBeInTheDocument()
      expect(screen.getByText(/Agent performed/)).toBeInTheDocument()
      expect(screen.getByText(/actions/)).toBeInTheDocument()
    })

    it('is collapsed by default — does not show individual cards', () => {
      render(<ChatToolActivityGroup toolMessages={messages} />)

      expect(screen.queryByTestId('chat-tool-group-items')).not.toBeInTheDocument()
    })

    it('expanding group shows individual cards', () => {
      render(<ChatToolActivityGroup toolMessages={messages} />)

      fireEvent.click(screen.getByTestId('chat-tool-group-toggle'))

      expect(screen.getByTestId('chat-tool-group-items')).toBeInTheDocument()
      const cards = screen.getAllByTestId('chat-tool-activity-card')
      expect(cards).toHaveLength(3)
    })

    it('collapsing group hides individual cards', () => {
      render(<ChatToolActivityGroup toolMessages={messages} />)

      // Expand
      fireEvent.click(screen.getByTestId('chat-tool-group-toggle'))
      expect(screen.getByTestId('chat-tool-group-items')).toBeInTheDocument()

      // Collapse
      fireEvent.click(screen.getByTestId('chat-tool-group-toggle'))
      expect(screen.queryByTestId('chat-tool-group-items')).not.toBeInTheDocument()
    })

    it('supports defaultExpanded prop', () => {
      render(<ChatToolActivityGroup toolMessages={messages} defaultExpanded={true} />)

      expect(screen.getByTestId('chat-tool-group-items')).toBeInTheDocument()
      const cards = screen.getAllByTestId('chat-tool-activity-card')
      expect(cards).toHaveLength(3)
    })
  })
})

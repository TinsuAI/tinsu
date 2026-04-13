/**
 * ChatToolActivityCard Tests - Story 10.5 (AC: 2, 3)
 *
 * Tests: collapsed by default, click expands details, truncates long content,
 * maps tool names to correct icons and descriptions.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ChatToolActivityCard, getToolDescription } from './ChatToolActivityCard'

// Mock date-fns to avoid timezone issues in snapshot tests
vi.mock('date-fns', () => ({
  format: (_date: Date, _fmt: string) => '10:00:00 AM'
}))

describe('ChatToolActivityCard (Story 10.5, AC: 2, 3)', () => {
  const baseProps = {
    toolName: 'Read',
    toolInput: JSON.stringify({ file_path: '/home/user/project/src/architecture.md' }),
    content: 'Tool: Read',
    createdAt: new Date('2026-03-22T10:00:00Z')
  }

  describe('collapsed state (default)', () => {
    it('renders collapsed by default showing tool icon and description', () => {
      render(<ChatToolActivityCard {...baseProps} />)

      expect(screen.getByTestId('chat-tool-activity-card')).toBeInTheDocument()
      expect(screen.getByTestId('chat-tool-activity-toggle')).toBeInTheDocument()
      // Should show the contextual description
      expect(screen.getByText('Read architecture.md')).toBeInTheDocument()
      // Should NOT show expanded details
      expect(screen.queryByTestId('chat-tool-activity-details')).not.toBeInTheDocument()
    })

    it('shows timestamp in collapsed state', () => {
      render(<ChatToolActivityCard {...baseProps} />)

      expect(screen.getByText('10:00:00 AM')).toBeInTheDocument()
    })
  })

  describe('expand/collapse toggle', () => {
    it('click expands to show tool input details', () => {
      render(<ChatToolActivityCard {...baseProps} />)

      fireEvent.click(screen.getByTestId('chat-tool-activity-toggle'))

      expect(screen.getByTestId('chat-tool-activity-details')).toBeInTheDocument()
      // Input section should show the file path
      expect(screen.getByText('Input')).toBeInTheDocument()
    })

    it('second click collapses back', () => {
      render(<ChatToolActivityCard {...baseProps} />)

      // Expand
      fireEvent.click(screen.getByTestId('chat-tool-activity-toggle'))
      expect(screen.getByTestId('chat-tool-activity-details')).toBeInTheDocument()

      // Collapse
      fireEvent.click(screen.getByTestId('chat-tool-activity-toggle'))
      expect(screen.queryByTestId('chat-tool-activity-details')).not.toBeInTheDocument()
    })
  })

  describe('content truncation', () => {
    it('truncates long content to 500 chars', () => {
      const longContent = 'A'.repeat(600)

      render(
        <ChatToolActivityCard
          toolName="Read"
          toolInput={JSON.stringify({ file_path: '/test/file.ts' })}
          content={longContent}
          createdAt={new Date()}
        />
      )

      // Expand to see content
      fireEvent.click(screen.getByTestId('chat-tool-activity-toggle'))

      const details = screen.getByTestId('chat-tool-activity-details')
      // Content should be truncated (not the full 600 chars)
      const outputPre = details.querySelectorAll('pre')
      // The last pre should have the truncated content
      const outputPreContent = outputPre[outputPre.length - 1].textContent ?? ''
      expect(outputPreContent.length).toBeLessThan(600)
      expect(outputPreContent).toContain('...')
    })
  })

  describe('PreToolUse content handling', () => {
    it('does not show content preview for PreToolUse messages', () => {
      render(
        <ChatToolActivityCard
          toolName="Read"
          toolInput={JSON.stringify({ file_path: '/test/file.ts' })}
          content="PreToolUse: Read"
          createdAt={new Date()}
        />
      )

      // Expand
      fireEvent.click(screen.getByTestId('chat-tool-activity-toggle'))

      // Should show input but not a "PreToolUse: Read" output
      expect(screen.queryByText('PreToolUse: Read')).not.toBeInTheDocument()
    })
  })
})

describe('getToolDescription', () => {
  it('maps Read tool to "Read {basename}"', () => {
    const input = JSON.stringify({ file_path: '/home/user/project/src/index.ts' })
    expect(getToolDescription('Read', input)).toBe('Read index.ts')
  })

  it('maps Write tool to "Write {basename}"', () => {
    const input = JSON.stringify({ file_path: '/home/user/project/output.json' })
    expect(getToolDescription('Write', input)).toBe('Write output.json')
  })

  it('maps Edit tool to "Edit {basename}"', () => {
    const input = JSON.stringify({ file_path: '/home/user/project/config.yaml' })
    expect(getToolDescription('Edit', input)).toBe('Edit config.yaml')
  })

  it('maps Bash tool to "Ran command: {truncated}"', () => {
    const input = JSON.stringify({ command: 'npm run build && npm test' })
    expect(getToolDescription('Bash', input)).toBe('Ran command: npm run build && npm test')
  })

  it('truncates long Bash commands to 40 chars', () => {
    const longCmd = 'a'.repeat(60)
    const input = JSON.stringify({ command: longCmd })
    const desc = getToolDescription('Bash', input)
    expect(desc).toBe(`Ran command: ${'a'.repeat(40)}...`)
  })

  it('maps Grep tool to "Searched for {pattern}"', () => {
    const input = JSON.stringify({ pattern: 'TODO|FIXME' })
    expect(getToolDescription('Grep', input)).toBe('Searched for "TODO|FIXME"')
  })

  it('maps Glob tool to "Found files matching {pattern}"', () => {
    const input = JSON.stringify({ pattern: '**/*.tsx' })
    expect(getToolDescription('Glob', input)).toBe('Found files matching "**/*.tsx"')
  })

  it('returns tool name for unknown tools', () => {
    expect(getToolDescription('CustomTool', null)).toBe('CustomTool')
  })

  it('handles null tool_input gracefully', () => {
    expect(getToolDescription('Read', null)).toBe('Read file')
  })

  it('handles invalid JSON tool_input gracefully', () => {
    expect(getToolDescription('Read', '{invalid')).toBe('Read file')
  })
})

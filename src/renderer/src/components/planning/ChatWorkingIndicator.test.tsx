/**
 * ChatWorkingIndicator Tests - Story 10.5 (AC: 1)
 *
 * Tests: shows generic "thinking..." when no currentToolActivity,
 * shows contextual tool activity text for each tool type,
 * shows persona-colored pulse dot.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChatWorkingIndicator } from './ChatWorkingIndicator'

// Mock planning workspace constants for persona config
vi.mock('@renderer/constants/planning-workspace', () => {
  const config: Record<string, { displayName: string; bg: string; text: string; border: string; dot: string }> = {
    'bmad:bmm:agents:pm': {
      displayName: 'PM',
      bg: 'bg-green-500/20',
      text: 'text-green-400',
      border: 'border-green-500/30',
      dot: 'bg-green-400'
    },
    'bmad:bmm:agents:architect': {
      displayName: 'Architect',
      bg: 'bg-orange-500/20',
      text: 'text-orange-400',
      border: 'border-orange-500/30',
      dot: 'bg-orange-400'
    }
  }
  return {
    AGENT_PERSONA_CONFIG: config,
    getAgentPersona: (agentName: string | null) => {
      if (!agentName) return null
      return config[agentName] ?? null
    }
  }
})

describe('ChatWorkingIndicator (Story 10.5, AC: 1)', () => {
  describe('generic thinking indicator', () => {
    it('shows "is thinking..." when no currentToolActivity', () => {
      render(<ChatWorkingIndicator />)

      expect(screen.getByTestId('chat-thinking-indicator')).toBeInTheDocument()
      expect(screen.getByText('is thinking...')).toBeInTheDocument()
    })

    it('shows "is thinking..." when currentToolActivity is null', () => {
      render(<ChatWorkingIndicator currentToolActivity={null} />)

      expect(screen.getByText('is thinking...')).toBeInTheDocument()
    })

    it('shows persona label', () => {
      render(<ChatWorkingIndicator agentPersona="bmad:bmm:agents:pm" />)

      expect(screen.getByText('PM')).toBeInTheDocument()
    })

    it('shows fallback "Agent" label when persona is unknown', () => {
      render(<ChatWorkingIndicator agentPersona="unknown" />)

      expect(screen.getByText('Agent')).toBeInTheDocument()
    })
  })

  describe('contextual tool activity', () => {
    it('shows "Reading {file}..." for Read tool', () => {
      render(
        <ChatWorkingIndicator
          agentPersona="bmad:bmm:agents:pm"
          currentToolActivity={{
            toolName: 'Read',
            toolInput: { file_path: '/home/user/project/architecture.md' }
          }}
        />
      )

      expect(screen.getByTestId('working-indicator-tool-text')).toHaveTextContent(
        'Reading architecture.md...'
      )
    })

    it('shows "Writing {file}..." for Write tool', () => {
      render(
        <ChatWorkingIndicator
          currentToolActivity={{
            toolName: 'Write',
            toolInput: { file_path: '/home/user/project/output.ts' }
          }}
        />
      )

      expect(screen.getByTestId('working-indicator-tool-text')).toHaveTextContent(
        'Writing output.ts...'
      )
    })

    it('shows "Editing {file}..." for Edit tool', () => {
      render(
        <ChatWorkingIndicator
          currentToolActivity={{
            toolName: 'Edit',
            toolInput: { file_path: '/home/user/project/config.yaml' }
          }}
        />
      )

      expect(screen.getByTestId('working-indicator-tool-text')).toHaveTextContent(
        'Editing config.yaml...'
      )
    })

    it('shows "Running command..." for Bash tool', () => {
      render(
        <ChatWorkingIndicator
          currentToolActivity={{
            toolName: 'Bash',
            toolInput: { command: 'npm test' }
          }}
        />
      )

      expect(screen.getByTestId('working-indicator-tool-text')).toHaveTextContent(
        'Running command...'
      )
    })

    it('shows "Searching for {pattern}..." for Grep tool', () => {
      render(
        <ChatWorkingIndicator
          currentToolActivity={{
            toolName: 'Grep',
            toolInput: { pattern: 'TODO|FIXME' }
          }}
        />
      )

      expect(screen.getByTestId('working-indicator-tool-text')).toHaveTextContent(
        'Searching for "TODO|FIXME"...'
      )
    })

    it('shows "Finding files..." for Glob tool', () => {
      render(
        <ChatWorkingIndicator
          currentToolActivity={{
            toolName: 'Glob',
            toolInput: { pattern: '**/*.tsx' }
          }}
        />
      )

      expect(screen.getByTestId('working-indicator-tool-text')).toHaveTextContent(
        'Finding files...'
      )
    })

    it('shows "Using {toolName}..." for unknown tools', () => {
      render(
        <ChatWorkingIndicator
          currentToolActivity={{
            toolName: 'CustomTool',
            toolInput: {}
          }}
        />
      )

      expect(screen.getByTestId('working-indicator-tool-text')).toHaveTextContent(
        'Using CustomTool...'
      )
    })
  })

  describe('persona-colored pulse dot', () => {
    it('shows pulse dot with persona color', () => {
      render(
        <ChatWorkingIndicator agentPersona="bmad:bmm:agents:pm" />
      )

      const dot = screen.getByTestId('working-indicator-dot')
      expect(dot).toBeInTheDocument()
      expect(dot.className).toContain('animate-pulse')
      expect(dot.className).toContain('bg-green-400')
    })

    it('shows pulse dot with fallback color when persona unknown', () => {
      render(
        <ChatWorkingIndicator agentPersona="unknown" />
      )

      const dot = screen.getByTestId('working-indicator-dot')
      expect(dot).toBeInTheDocument()
      expect(dot.className).toContain('animate-pulse')
      expect(dot.className).toContain('bg-muted-foreground/40')
    })
  })
})

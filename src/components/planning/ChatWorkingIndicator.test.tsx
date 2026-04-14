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
    it('shows Gen Z phrases when active', () => {
      render(<ChatWorkingIndicator />)

      expect(screen.getByTestId('chat-thinking-indicator')).toBeInTheDocument()
      // Phrases are randomized, so we check for common elements or the phrase container
      expect(screen.getByTestId('working-indicator-phrase')).toBeInTheDocument()
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
    it('shows tool detail for Read tool', () => {
      render(
        <ChatWorkingIndicator
          agentPersona="bmad:bmm:agents:pm"
          currentToolActivity={{
            toolName: 'Read',
            toolInput: { file_path: '/home/user/project/architecture.md' }
          }}
        />
      )

      expect(screen.getByText(/↳ architecture.md/i)).toBeInTheDocument()
    })

    it('shows tool detail for Write tool', () => {
      render(
        <ChatWorkingIndicator
          currentToolActivity={{
            toolName: 'Write',
            toolInput: { file_path: '/home/user/project/output.ts' }
          }}
        />
      )

      expect(screen.getByText(/↳ output.ts/i)).toBeInTheDocument()
    })

    it('shows tool detail for Edit tool', () => {
      render(
        <ChatWorkingIndicator
          currentToolActivity={{
            toolName: 'Edit',
            toolInput: { file_path: '/home/user/project/config.yaml' }
          }}
        />
      )

      expect(screen.getByText(/↳ config.yaml/i)).toBeInTheDocument()
    })

    it('shows tool detail for Grep tool', () => {
      render(
        <ChatWorkingIndicator
          currentToolActivity={{
            toolName: 'Grep',
            toolInput: { pattern: 'TODO|FIXME' }
          }}
        />
      )

      expect(screen.getByText(/↳ "TODO|FIXME"/i)).toBeInTheDocument()
    })
  })

  describe('persona-colored pulse dot', () => {
    it('shows pulse dot with persona color', () => {
      render(
        <ChatWorkingIndicator agentPersona="bmad:bmm:agents:pm" />
      )

      const dot = screen.getByTestId('working-indicator-dot')
      expect(dot).toBeInTheDocument()
      expect(dot.style.animation).toContain('cooking-pulse')
      expect(dot.className).toContain('bg-green-400')
    })

    it('shows pulse dot with fallback color when persona unknown', () => {
      render(
        <ChatWorkingIndicator agentPersona="unknown" />
      )

      const dot = screen.getByTestId('working-indicator-dot')
      expect(dot).toBeInTheDocument()
      expect(dot.style.animation).toContain('cooking-pulse')
      expect(dot.className).toContain('bg-muted-foreground/40')
    })
  })
})

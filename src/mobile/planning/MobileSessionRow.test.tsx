import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MobileSessionRow, type ChatSessionListItemPreview } from './MobileSessionRow'

function makeSession(overrides: Partial<ChatSessionListItemPreview> = {}): ChatSessionListItemPreview {
  return {
    id: 'sess-1',
    agent_persona: 'bmad:bmm:agents:pm',
    last_message_preview: 'Let me help you with that.',
    last_message_at: new Date(Date.now() - 5 * 60_000).toISOString(), // 5 min ago
    live_status: 'idle',
    ...overrides,
  }
}

describe('MobileSessionRow', () => {
  it('renders persona display name', () => {
    render(<MobileSessionRow session={makeSession()} onTap={vi.fn()} />)
    expect(screen.getByText('PM')).toBeInTheDocument()
  })

  it('renders last message preview truncated in subtitle', () => {
    render(<MobileSessionRow session={makeSession()} onTap={vi.fn()} />)
    expect(screen.getByText('Let me help you with that.')).toBeInTheDocument()
  })

  it('renders em-dash placeholder when preview is null', () => {
    render(<MobileSessionRow session={makeSession({ last_message_preview: null })} onTap={vi.fn()} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('renders live status badge', () => {
    render(<MobileSessionRow session={makeSession({ live_status: 'thinking' })} onTap={vi.fn()} />)
    expect(screen.getByText('Thinking')).toBeInTheDocument()
  })

  it('renders relative timestamp', () => {
    render(<MobileSessionRow session={makeSession()} onTap={vi.fn()} />)
    // 5 minutes ago → "5m ago"
    expect(screen.getByText('5m ago')).toBeInTheDocument()
  })

  it('calls onTap when row is pressed', () => {
    const onTap = vi.fn()
    render(<MobileSessionRow session={makeSession()} onTap={onTap} />)
    fireEvent.click(screen.getByTestId('mobile-list-item'))
    expect(onTap).toHaveBeenCalledTimes(1)
  })

  it('falls back to general persona on unknown persona', () => {
    render(<MobileSessionRow session={makeSession({ agent_persona: 'totally-unknown-persona' })} onTap={vi.fn()} />)
    // Should not crash and falls back to General
    expect(screen.getByText('General')).toBeInTheDocument()
  })

  it('falls back to general persona when agent_persona is null', () => {
    render(<MobileSessionRow session={makeSession({ agent_persona: null })} onTap={vi.fn()} />)
    expect(screen.getByText('General')).toBeInTheDocument()
  })
})

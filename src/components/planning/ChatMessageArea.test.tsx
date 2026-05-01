/**
 * ChatMessageArea Tests - Story 10.2 (AC: 3, 7), Story 10.3 (AC: 4), Story 10.5 (AC: 1-5)
 *
 * Tests: messages render in order, empty state shown when no messages,
 * auto-scroll behavior, typing indicator appears/hides correctly,
 * tool messages render as ChatToolActivityGroup (not filtered out),
 * working indicator replaces thinking indicator,
 * notification messages render as system messages with amber accent.
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

// Mock date-fns for tool activity cards
vi.mock('date-fns', () => ({
  format: (_date: Date, _fmt: string) => '10:00:00 AM'
}))

// Mock planning workspace constants for persona label resolution
vi.mock('@renderer/constants/planning-workspace', () => {
  const config: Record<string, { displayName: string; bg: string; text: string; border: string; icon: string; dot: string }> = {
    'bmad-agent-pm': {
      displayName: 'PM',
      bg: 'bg-emerald-500/20',
      text: 'text-emerald-400',
      border: 'border-emerald-500/30',
      icon: 'M',
      dot: 'bg-green-400'
    },
    'bmad-agent-architect': {
      displayName: 'Architect',
      bg: 'bg-purple-500/20',
      text: 'text-purple-400',
      border: 'border-purple-500/30',
      icon: 'A',
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

// Mock planning workspace store for ChatArtifactNotification
const mockOpenWorkspaceToArtifact = vi.fn()

vi.mock('@renderer/stores', () => ({
  usePlanningWorkspaceStore: (selector?: (state: Record<string, unknown>) => unknown) => {
    const state = {
      openWorkspaceToArtifact: mockOpenWorkspaceToArtifact
    }
    return selector ? selector(state) : state
  }
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
      render(<ChatMessageArea messages={sampleMessages} agentPersona="bmad-agent-pm" />)

      expect(screen.getByTestId('chat-message-area')).toBeInTheDocument()

      // Should render user and assistant messages
      const userBubbles = screen.getAllByTestId('chat-bubble-user')
      expect(userBubbles).toHaveLength(2)

      const assistantBubbles = screen.getAllByTestId('chat-bubble-assistant')
      expect(assistantBubbles).toHaveLength(1)
    })

    it('passes agentPersona to message bubbles', () => {
      render(<ChatMessageArea messages={sampleMessages} agentPersona="bmad-agent-pm" />)

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

describe('ChatMessageArea typing indicator (Story 10.3, AC: 4)', () => {
  const baseTime = new Date('2026-03-22T10:00:00Z')

  const sampleMessages = [
    {
      id: 'msg-1',
      role: 'user' as const,
      content: 'Hello agent!',
      created_at: new Date(baseTime.getTime())
    }
  ]

  it('shows typing indicator when isAgentThinking is true', () => {
    render(
      <ChatMessageArea
        messages={sampleMessages}
        agentPersona="bmad-agent-pm"
        isAgentThinking={true}
      />
    )

    expect(screen.getByTestId('chat-thinking-indicator')).toBeInTheDocument()
    expect(screen.getByText('is thinking...')).toBeInTheDocument()
  })

  it('hides typing indicator when isAgentThinking is false', () => {
    render(
      <ChatMessageArea
        messages={sampleMessages}
        agentPersona="bmad-agent-pm"
        isAgentThinking={false}
      />
    )

    expect(screen.queryByTestId('chat-thinking-indicator')).not.toBeInTheDocument()
  })

  it('does not show typing indicator by default (prop not provided)', () => {
    render(
      <ChatMessageArea
        messages={sampleMessages}
        agentPersona="bmad-agent-pm"
      />
    )

    expect(screen.queryByTestId('chat-thinking-indicator')).not.toBeInTheDocument()
  })

  it('shows persona label in typing indicator', () => {
    render(
      <ChatMessageArea
        messages={sampleMessages}
        agentPersona="bmad-agent-pm"
        isAgentThinking={true}
      />
    )

    // PM label in the thinking indicator
    const indicator = screen.getByTestId('chat-thinking-indicator')
    expect(indicator).toHaveTextContent('PM')
  })

  it('shows fallback label when persona not recognized', () => {
    render(
      <ChatMessageArea
        messages={sampleMessages}
        agentPersona="unknown-persona"
        isAgentThinking={true}
      />
    )

    const indicator = screen.getByTestId('chat-thinking-indicator')
    expect(indicator).toHaveTextContent('Agent')
  })
})

describe('ChatMessageArea tool activity display (Story 10.5, AC: 2, 3, 4)', () => {
  const baseTime = new Date('2026-03-22T10:00:00Z')

  it('renders tool messages as ChatToolActivityGroup (not filtered out)', () => {
    const messages = [
      {
        id: 'msg-1',
        role: 'user' as const,
        content: 'Read the file',
        created_at: new Date(baseTime.getTime())
      },
      {
        id: 'msg-tool-1',
        role: 'tool' as const,
        content: 'Tool: Read',
        tool_name: 'Read',
        tool_input: JSON.stringify({ file_path: '/test/file.ts' }),
        created_at: new Date(baseTime.getTime() + 1000)
      },
      {
        id: 'msg-2',
        role: 'assistant' as const,
        content: 'I read the file.',
        created_at: new Date(baseTime.getTime() + 2000)
      }
    ]

    render(<ChatMessageArea messages={messages} agentPersona="bmad-agent-pm" />)

    // Tool activity group should be visible
    expect(screen.getByTestId('chat-tool-activity-group')).toBeInTheDocument()
    // Individual card visible (single tool = no group header)
    expect(screen.getByTestId('chat-tool-activity-card')).toBeInTheDocument()
  })

  it('groups consecutive tool messages together', () => {
    const messages = [
      {
        id: 'msg-1',
        role: 'user' as const,
        content: 'Analyze the code',
        created_at: new Date(baseTime.getTime())
      },
      {
        id: 'msg-tool-1',
        role: 'tool' as const,
        content: 'Tool: Read',
        tool_name: 'Read',
        tool_input: JSON.stringify({ file_path: '/test/a.ts' }),
        created_at: new Date(baseTime.getTime() + 1000)
      },
      {
        id: 'msg-tool-2',
        role: 'tool' as const,
        content: 'Tool: Grep',
        tool_name: 'Grep',
        tool_input: JSON.stringify({ pattern: 'TODO' }),
        created_at: new Date(baseTime.getTime() + 2000)
      },
      {
        id: 'msg-2',
        role: 'assistant' as const,
        content: 'Found issues.',
        created_at: new Date(baseTime.getTime() + 3000)
      }
    ]

    render(<ChatMessageArea messages={messages} agentPersona="bmad-agent-pm" />)

    // Should have a group toggle for the 2 consecutive tool messages
    expect(screen.getByTestId('chat-tool-group-toggle')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('working indicator shows contextual tool activity when currentToolActivity is set', () => {
    const messages = [
      {
        id: 'msg-1',
        role: 'user' as const,
        content: 'Read the architecture file',
        created_at: new Date(baseTime.getTime())
      }
    ]

    render(
      <ChatMessageArea
        messages={messages}
        agentPersona="bmad-agent-pm"
        isAgentThinking={true}
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
})

describe('ChatMessageArea notification display (Story 10.5, AC: 5)', () => {
  const baseTime = new Date('2026-03-22T10:00:00Z')

  it('renders notification messages as system messages with amber accent', () => {
    const messages = [
      {
        id: 'msg-1',
        role: 'user' as const,
        content: 'Do something risky',
        created_at: new Date(baseTime.getTime())
      },
      {
        id: 'msg-notif',
        role: 'tool' as const,
        content: 'Notification: permission_prompt: Allow file write?',
        tool_name: '__notification__',
        tool_input: JSON.stringify({ type: 'permission_prompt', message: 'Allow file write?' }),
        created_at: new Date(baseTime.getTime() + 1000)
      }
    ]

    render(<ChatMessageArea messages={messages} agentPersona="bmad-agent-pm" />)

    const notification = screen.getByTestId('chat-notification-message')
    expect(notification).toBeInTheDocument()
    expect(notification).toHaveTextContent('Agent needs permission to proceed')
    expect(notification).toHaveTextContent('Allow file write?')
  })

  it('notification messages are NOT grouped with tool activity', () => {
    const messages = [
      {
        id: 'msg-1',
        role: 'user' as const,
        content: 'Do something',
        created_at: new Date(baseTime.getTime())
      },
      {
        id: 'msg-tool-1',
        role: 'tool' as const,
        content: 'Tool: Read',
        tool_name: 'Read',
        tool_input: JSON.stringify({ file_path: '/test/file.ts' }),
        created_at: new Date(baseTime.getTime() + 1000)
      },
      {
        id: 'msg-notif',
        role: 'tool' as const,
        content: 'Notification: permission_prompt: Allow?',
        tool_name: '__notification__',
        tool_input: JSON.stringify({ type: 'permission_prompt', message: 'Allow?' }),
        created_at: new Date(baseTime.getTime() + 2000)
      },
      {
        id: 'msg-2',
        role: 'assistant' as const,
        content: 'Done.',
        created_at: new Date(baseTime.getTime() + 3000)
      }
    ]

    render(<ChatMessageArea messages={messages} agentPersona="bmad-agent-pm" />)

    // Tool card and notification should both be visible, separately
    expect(screen.getByTestId('chat-tool-activity-card')).toBeInTheDocument()
    expect(screen.getByTestId('chat-notification-message')).toBeInTheDocument()
    // Notification should NOT be inside a tool activity group
    expect(screen.queryByTestId('chat-tool-group-toggle')).not.toBeInTheDocument()
  })
})

describe('ChatMessageArea artifact notification (Story 10.7, AC: 3)', () => {
  const baseTime = new Date('2026-03-22T10:00:00Z')

  it('renders __artifact_created__ tool messages as artifact notification cards, not tool activity groups', () => {
    const messages = [
      {
        id: 'msg-1',
        role: 'user' as const,
        content: 'Create the PRD',
        created_at: new Date(baseTime.getTime())
      },
      {
        id: 'msg-artifact',
        role: 'tool' as const,
        content: 'Artifact created: prd.md',
        tool_name: '__artifact_created__',
        tool_input: JSON.stringify({ filename: 'prd.md', workflowKey: 'prd', filePath: '/test/prd.md' }),
        created_at: new Date(baseTime.getTime() + 1000)
      },
      {
        id: 'msg-2',
        role: 'assistant' as const,
        content: 'I have created the PRD.',
        created_at: new Date(baseTime.getTime() + 2000)
      }
    ]

    render(<ChatMessageArea messages={messages} agentPersona="bmad-agent-pm" />)

    // Should render as artifact notification, not as tool activity group
    expect(screen.getByTestId('chat-artifact-notification')).toBeInTheDocument()
    expect(screen.queryByTestId('chat-tool-activity-group')).not.toBeInTheDocument()
    expect(screen.queryByTestId('chat-tool-activity-card')).not.toBeInTheDocument()
  })

  it('artifact notification is separate from regular tool groups', () => {
    const messages = [
      {
        id: 'msg-1',
        role: 'user' as const,
        content: 'Read the file and create PRD',
        created_at: new Date(baseTime.getTime())
      },
      {
        id: 'msg-tool-1',
        role: 'tool' as const,
        content: 'Tool: Read',
        tool_name: 'Read',
        tool_input: JSON.stringify({ file_path: '/test/file.ts' }),
        created_at: new Date(baseTime.getTime() + 1000)
      },
      {
        id: 'msg-artifact',
        role: 'tool' as const,
        content: 'Artifact created: prd.md',
        tool_name: '__artifact_created__',
        tool_input: JSON.stringify({ filename: 'prd.md', workflowKey: 'prd', filePath: '/test/prd.md' }),
        created_at: new Date(baseTime.getTime() + 2000)
      }
    ]

    render(<ChatMessageArea messages={messages} agentPersona="bmad-agent-pm" />)

    // Both should be present and separate
    expect(screen.getByTestId('chat-tool-activity-card')).toBeInTheDocument()
    expect(screen.getByTestId('chat-artifact-notification')).toBeInTheDocument()
  })
})

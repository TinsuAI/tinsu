/**
 * ChatInput Tests - Story 10.2 (AC: 6)
 *
 * Tests: submit on Enter, Shift+Enter newline, clear after submit,
 * disabled when empty.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChatInput } from './ChatInput'

// Mock useAutocomplete to avoid tRPC context requirement
vi.mock('@renderer/hooks/useAutocomplete', () => ({
  useAutocomplete: () => ({
    state: { isOpen: false, trigger: null, query: '', triggerIndex: -1, items: [], selectedIndex: 0, isLoading: false },
    handleInputChange: vi.fn(),
    handleKeyDown: () => false,
    selectItem: vi.fn(),
    dismiss: vi.fn()
  })
}))

const defaultProps = {
  onSend: vi.fn(),
  onAttachmentsAdded: vi.fn(),
  onAttachClick: vi.fn(),
  pendingAttachments: [],
  onRemoveAttachment: vi.fn()
}

describe('ChatInput (Story 10.2, AC: 6)', () => {
  it('renders textarea and send button', () => {
    render(<ChatInput {...defaultProps} />)

    expect(screen.getByTestId('chat-textarea')).toBeInTheDocument()
    expect(screen.getByTestId('chat-send-button')).toBeInTheDocument()
  })

  it('renders placeholder text', () => {
    render(<ChatInput {...defaultProps} />)

    expect(screen.getByPlaceholderText('Message your agent...')).toBeInTheDocument()
  })

  it('disables send button when textarea is empty', () => {
    render(<ChatInput {...defaultProps} />)

    const sendButton = screen.getByTestId('chat-send-button')
    expect(sendButton).toBeDisabled()
  })

  it('disables send button when textarea has only whitespace', async () => {
    const user = userEvent.setup()
    render(<ChatInput {...defaultProps} />)

    const textarea = screen.getByTestId('chat-textarea')
    await user.type(textarea, '   ')

    const sendButton = screen.getByTestId('chat-send-button')
    expect(sendButton).toBeDisabled()
  })

  it('enables send button when textarea has content', async () => {
    const user = userEvent.setup()
    render(<ChatInput {...defaultProps} />)

    const textarea = screen.getByTestId('chat-textarea')
    await user.type(textarea, 'Hello')

    const sendButton = screen.getByTestId('chat-send-button')
    expect(sendButton).not.toBeDisabled()
  })

  it('calls onSend with trimmed content and empty attachments on Enter key', async () => {
    const onSend = vi.fn()
    const user = userEvent.setup()
    render(<ChatInput {...defaultProps} onSend={onSend} />)

    const textarea = screen.getByTestId('chat-textarea')
    await user.type(textarea, 'Hello agent!')
    await user.keyboard('{Enter}')

    expect(onSend).toHaveBeenCalledWith('Hello agent!', [])
  })

  it('does not submit on Shift+Enter (inserts newline instead)', async () => {
    const onSend = vi.fn()
    const user = userEvent.setup()
    render(<ChatInput {...defaultProps} onSend={onSend} />)

    const textarea = screen.getByTestId('chat-textarea')
    await user.type(textarea, 'Line 1')
    await user.keyboard('{Shift>}{Enter}{/Shift}')

    expect(onSend).not.toHaveBeenCalled()
  })

  it('clears textarea after submit', async () => {
    const onSend = vi.fn()
    const user = userEvent.setup()
    render(<ChatInput {...defaultProps} onSend={onSend} />)

    const textarea = screen.getByTestId('chat-textarea') as HTMLTextAreaElement
    await user.type(textarea, 'Hello')
    await user.keyboard('{Enter}')

    expect(textarea.value).toBe('')
  })

  it('calls onSend when send button is clicked', async () => {
    const onSend = vi.fn()
    const user = userEvent.setup()
    render(<ChatInput {...defaultProps} onSend={onSend} />)

    const textarea = screen.getByTestId('chat-textarea')
    await user.type(textarea, 'Hello via button')

    const sendButton = screen.getByTestId('chat-send-button')
    await user.click(sendButton)

    expect(onSend).toHaveBeenCalledWith('Hello via button', [])
  })

  it('does not submit when disabled', async () => {
    const onSend = vi.fn()
    render(<ChatInput {...defaultProps} onSend={onSend} disabled />)

    const textarea = screen.getByTestId('chat-textarea')
    expect(textarea).toBeDisabled()
  })

  it('auto-focuses textarea when autoFocus is true', () => {
    render(<ChatInput {...defaultProps} autoFocus />)

    const textarea = screen.getByTestId('chat-textarea')
    expect(document.activeElement).toBe(textarea)
  })

  it('sets textarea value from initialValue prop', () => {
    const onConsumed = vi.fn()
    render(
      <ChatInput
        {...defaultProps}
        initialValue="/bmad-brainstorming"
        onInitialValueConsumed={onConsumed}
      />
    )

    const textarea = screen.getByTestId('chat-textarea') as HTMLTextAreaElement
    expect(textarea.value).toBe('/bmad-brainstorming')
    expect(onConsumed).toHaveBeenCalled()
  })

  it('does not re-set textarea when initialValue is the same', () => {
    const onConsumed = vi.fn()
    const { rerender } = render(
      <ChatInput
        {...defaultProps}
        initialValue="/bmad-brainstorming"
        onInitialValueConsumed={onConsumed}
      />
    )

    // First render consumes once
    expect(onConsumed).toHaveBeenCalledTimes(1)

    // Re-render with same initialValue — should not consume again
    rerender(
      <ChatInput
        {...defaultProps}
        initialValue="/bmad-brainstorming"
        onInitialValueConsumed={onConsumed}
      />
    )

    expect(onConsumed).toHaveBeenCalledTimes(1)
  })

  it('renders attach button', () => {
    render(<ChatInput {...defaultProps} />)

    expect(screen.getByTestId('chat-attach-button')).toBeInTheDocument()
  })

  it('renders attachment preview strip when pendingAttachments has items', () => {
    const att = {
      file: new File(['test'], 'image.png', { type: 'image/png' }),
      previewUrl: 'blob:test',
      isImage: true
    }
    render(<ChatInput {...defaultProps} pendingAttachments={[att]} />)

    expect(screen.getByTestId('chat-attachment-preview-strip')).toBeInTheDocument()
    expect(screen.getByTestId('attachment-preview-0')).toBeInTheDocument()
  })

  it('calls onRemoveAttachment when remove button is clicked', async () => {
    const onRemove = vi.fn()
    const user = userEvent.setup()
    const att = {
      file: new File(['test'], 'image.png', { type: 'image/png' }),
      previewUrl: 'blob:test',
      isImage: true
    }
    render(<ChatInput {...defaultProps} pendingAttachments={[att]} onRemoveAttachment={onRemove} />)

    const removeBtn = screen.getByTestId('remove-attachment-0')
    await user.click(removeBtn)

    expect(onRemove).toHaveBeenCalledWith(0)
  })
})

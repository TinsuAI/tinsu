import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MobileChatComposer } from './MobileChatComposer'

// Stub matchMedia — default: hover device (non-touch)
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn((query: string) => ({
      matches: query === '(hover: none)' ? false : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
})

describe('MobileChatComposer', () => {
  it('Send button is disabled when input is empty', () => {
    render(<MobileChatComposer onSend={vi.fn()} disabled={false} />)
    const sendBtn = screen.getByRole('button', { name: /send message/i })
    expect(sendBtn).toBeDisabled()
  })

  it('Send button is disabled when input is whitespace only', () => {
    render(<MobileChatComposer onSend={vi.fn()} disabled={false} />)
    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: '   ' } })
    const sendBtn = screen.getByRole('button', { name: /send message/i })
    expect(sendBtn).toBeDisabled()
  })

  it('Send button is enabled when input has non-whitespace text', () => {
    render(<MobileChatComposer onSend={vi.fn()} disabled={false} />)
    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'Hello!' } })
    const sendBtn = screen.getByRole('button', { name: /send message/i })
    expect(sendBtn).not.toBeDisabled()
  })

  it('clicking Send calls onSend with the text and clears input', async () => {
    const onSend = vi.fn().mockResolvedValue(undefined)
    render(<MobileChatComposer onSend={onSend} disabled={false} />)
    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'Hello!' } })

    const sendBtn = screen.getByRole('button', { name: /send message/i })
    await act(async () => {
      fireEvent.click(sendBtn)
    })

    expect(onSend).toHaveBeenCalledWith('Hello!')
    expect((textarea as HTMLTextAreaElement).value).toBe('')
  })

  it('Enter key sends on hover device (non-touch)', async () => {
    const onSend = vi.fn().mockResolvedValue(undefined)
    render(<MobileChatComposer onSend={onSend} disabled={false} />)
    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'Hello' } })

    await act(async () => {
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    })

    expect(onSend).toHaveBeenCalledWith('Hello')
  })

  it('Shift+Enter does NOT send on hover device', async () => {
    const onSend = vi.fn()
    render(<MobileChatComposer onSend={onSend} disabled={false} />)
    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'Hello' } })

    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true })
    expect(onSend).not.toHaveBeenCalled()
  })

  it('Enter inserts newline on mobile (touch-only)', async () => {
    // Override matchMedia to return touch device
    window.matchMedia = vi.fn((query: string) => ({
      matches: query === '(hover: none)' ? true : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia

    const onSend = vi.fn()
    render(<MobileChatComposer onSend={onSend} disabled={false} />)
    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'Hello' } })

    // On mobile Enter does NOT send
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(onSend).not.toHaveBeenCalled()
  })

  it('is fully disabled when disabled prop is true', () => {
    render(<MobileChatComposer onSend={vi.fn()} disabled={true} />)
    const textarea = screen.getByRole('textbox')
    expect(textarea).toBeDisabled()
    const sendBtn = screen.getByRole('button', { name: /send message/i })
    expect(sendBtn).toBeDisabled()
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TaskTerminal, type TaskTerminalRef } from './TaskTerminal'
import { createRef } from 'react'

// Mock useTaskTerminal hook
const mockUseTaskTerminal = vi.fn()

vi.mock('@renderer/hooks/useTaskTerminal', () => ({
  useTaskTerminal: (...args: unknown[]) => mockUseTaskTerminal(...args)
}))

// Mock XTerminal component
vi.mock('@renderer/components/terminal/XTerminal', () => ({
  XTerminal: vi.fn(({ onData, onResize }) => (
    <div data-testid="xterminal" data-ondata={!!onData} data-onresize={!!onResize}>
      Mock XTerminal
    </div>
  ))
}))

// Mock TerminalInput component
vi.mock('./TerminalInput', () => ({
  TerminalInput: vi.fn(({ taskId }) => (
    <div data-testid="terminal-input" data-taskid={taskId}>
      Mock TerminalInput
    </div>
  ))
}))

describe('TaskTerminal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('loading state', () => {
    it('shows loading message when isLoading is true', () => {
      mockUseTaskTerminal.mockReturnValue({
        isAttached: false,
        isLoading: true,
        error: null,
        write: vi.fn(),
        resize: vi.fn()
      })

      render(<TaskTerminal taskId="task-123" />)

      expect(screen.getByText('Connecting to terminal...')).toBeInTheDocument()
      expect(screen.queryByTestId('xterminal')).not.toBeInTheDocument()
    })
  })

  describe('error state', () => {
    it('shows error message when error is present', () => {
      mockUseTaskTerminal.mockReturnValue({
        isAttached: false,
        isLoading: false,
        error: 'Connection failed',
        write: vi.fn(),
        resize: vi.fn()
      })

      render(<TaskTerminal taskId="task-123" />)

      expect(screen.getByText(/Failed to connect: Connection failed/)).toBeInTheDocument()
      expect(screen.queryByTestId('xterminal')).not.toBeInTheDocument()
    })
  })

  describe('no session state', () => {
    it('shows "No active session" when not attached and no error (AC: #3)', () => {
      mockUseTaskTerminal.mockReturnValue({
        isAttached: false,
        isLoading: false,
        error: null,
        write: vi.fn(),
        resize: vi.fn()
      })

      render(<TaskTerminal taskId="task-123" />)

      expect(screen.getByText('No active session')).toBeInTheDocument()
      expect(screen.queryByTestId('xterminal')).not.toBeInTheDocument()
    })
  })

  describe('attached state', () => {
    it('shows XTerminal when attached', () => {
      mockUseTaskTerminal.mockReturnValue({
        isAttached: true,
        isLoading: false,
        error: null,
        write: vi.fn(),
        resize: vi.fn()
      })

      render(<TaskTerminal taskId="task-123" />)

      expect(screen.getByTestId('xterminal')).toBeInTheDocument()
      expect(screen.queryByText('Connecting to terminal...')).not.toBeInTheDocument()
      expect(screen.queryByText('No active session')).not.toBeInTheDocument()
    })

    it('passes write and resize callbacks to XTerminal', () => {
      const mockWrite = vi.fn()
      const mockResize = vi.fn()

      mockUseTaskTerminal.mockReturnValue({
        isAttached: true,
        isLoading: false,
        error: null,
        write: mockWrite,
        resize: mockResize
      })

      render(<TaskTerminal taskId="task-123" />)

      const terminal = screen.getByTestId('xterminal')
      expect(terminal.getAttribute('data-ondata')).toBe('true')
      expect(terminal.getAttribute('data-onresize')).toBe('true')
    })
  })

  describe('hook integration', () => {
    it('passes taskId to useTaskTerminal hook', () => {
      mockUseTaskTerminal.mockReturnValue({
        isAttached: false,
        isLoading: true,
        error: null,
        write: vi.fn(),
        resize: vi.fn()
      })

      render(<TaskTerminal taskId="task-abc-123" />)

      expect(mockUseTaskTerminal).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: 'task-abc-123'
        })
      )
    })
  })

  // ===== TES-1.5: User Command Input Integration =====

  describe('TerminalInput integration (TES-1.5)', () => {
    it('renders TerminalInput when attached', () => {
      mockUseTaskTerminal.mockReturnValue({
        isAttached: true,
        isLoading: false,
        error: null,
        write: vi.fn(),
        resize: vi.fn()
      })

      render(<TaskTerminal taskId="task-123" />)

      expect(screen.getByTestId('terminal-input')).toBeInTheDocument()
    })

    it('passes taskId to TerminalInput', () => {
      mockUseTaskTerminal.mockReturnValue({
        isAttached: true,
        isLoading: false,
        error: null,
        write: vi.fn(),
        resize: vi.fn()
      })

      render(<TaskTerminal taskId="task-xyz-789" />)

      const terminalInput = screen.getByTestId('terminal-input')
      expect(terminalInput.getAttribute('data-taskid')).toBe('task-xyz-789')
    })

    it('does not render TerminalInput when loading', () => {
      mockUseTaskTerminal.mockReturnValue({
        isAttached: false,
        isLoading: true,
        error: null,
        write: vi.fn(),
        resize: vi.fn()
      })

      render(<TaskTerminal taskId="task-123" />)

      expect(screen.queryByTestId('terminal-input')).not.toBeInTheDocument()
    })

    it('does not render TerminalInput when not attached', () => {
      mockUseTaskTerminal.mockReturnValue({
        isAttached: false,
        isLoading: false,
        error: null,
        write: vi.fn(),
        resize: vi.fn()
      })

      render(<TaskTerminal taskId="task-123" />)

      expect(screen.queryByTestId('terminal-input')).not.toBeInTheDocument()
    })

    it('does not render TerminalInput on error', () => {
      mockUseTaskTerminal.mockReturnValue({
        isAttached: false,
        isLoading: false,
        error: 'Connection failed',
        write: vi.fn(),
        resize: vi.fn()
      })

      render(<TaskTerminal taskId="task-123" />)

      expect(screen.queryByTestId('terminal-input')).not.toBeInTheDocument()
    })
  })

  describe('ref forwarding (TES-1.5 - AC: #3)', () => {
    it('exposes focusInput method via ref', () => {
      mockUseTaskTerminal.mockReturnValue({
        isAttached: true,
        isLoading: false,
        error: null,
        write: vi.fn(),
        resize: vi.fn()
      })

      const ref = createRef<TaskTerminalRef>()
      render(<TaskTerminal taskId="task-123" ref={ref} />)

      expect(ref.current).not.toBeNull()
      expect(typeof ref.current?.focusInput).toBe('function')
    })
  })
})

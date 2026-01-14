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
        sessionState: 'none',
        lastBackupTime: null,
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
        sessionState: 'none',
        lastBackupTime: null,
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
        sessionState: 'none',
        lastBackupTime: null,
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
        sessionState: 'live',
        lastBackupTime: null,
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
        sessionState: 'live',
        lastBackupTime: null,
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
        sessionState: 'none',
        lastBackupTime: null,
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
        sessionState: 'live',
        lastBackupTime: null,
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
        sessionState: 'live',
        lastBackupTime: null,
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
        sessionState: 'none',
        lastBackupTime: null,
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
        sessionState: 'none',
        lastBackupTime: null,
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
        sessionState: 'none',
        lastBackupTime: null,
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
        sessionState: 'live',
        lastBackupTime: null,
        write: vi.fn(),
        resize: vi.fn()
      })

      const ref = createRef<TaskTerminalRef>()
      render(<TaskTerminal taskId="task-123" ref={ref} />)

      expect(ref.current).not.toBeNull()
      expect(typeof ref.current?.focusInput).toBe('function')
    })
  })

  // ===== TES-1.11: Session End & Unresponsive Detection UI =====

  describe('session state badges (TES-1.11)', () => {
    it('shows "Live" badge when sessionState is live (AC: #1)', () => {
      mockUseTaskTerminal.mockReturnValue({
        isAttached: true,
        isLoading: false,
        error: null,
        sessionState: 'live',
        lastBackupTime: null,
        write: vi.fn(),
        resize: vi.fn()
      })

      render(<TaskTerminal taskId="task-live" />)

      expect(screen.getByText('Live')).toBeInTheDocument()
      expect(screen.getByTestId('xterminal')).toBeInTheDocument()
      expect(screen.getByTestId('terminal-input')).toBeInTheDocument()
    })

    it('shows "Stalled" badge with warning when sessionState is stalled (AC: #3)', () => {
      mockUseTaskTerminal.mockReturnValue({
        isAttached: true,
        isLoading: false,
        error: null,
        sessionState: 'stalled',
        lastBackupTime: null,
        write: vi.fn(),
        resize: vi.fn()
      })

      render(<TaskTerminal taskId="task-stalled" />)

      expect(screen.getByText('Stalled')).toBeInTheDocument()
      expect(screen.getByText('(No output for 5 min)')).toBeInTheDocument()
      expect(screen.getByTestId('xterminal')).toBeInTheDocument()
      // Stalled sessions should still show TerminalInput (user can try input)
      expect(screen.getByTestId('terminal-input')).toBeInTheDocument()
    })

    it('shows "Session ended" badge when sessionState is ended (AC: #1)', () => {
      mockUseTaskTerminal.mockReturnValue({
        isAttached: false,
        isLoading: false,
        error: null,
        sessionState: 'ended',
        lastBackupTime: null,
        write: vi.fn(),
        resize: vi.fn()
      })

      render(<TaskTerminal taskId="task-ended" />)

      expect(screen.getByText('Session ended')).toBeInTheDocument()
      expect(screen.getByTestId('xterminal')).toBeInTheDocument()
      // Ended sessions should NOT show TerminalInput
      expect(screen.queryByTestId('terminal-input')).not.toBeInTheDocument()
    })

    it('shows guidance message for ended sessions (AC: #1)', () => {
      mockUseTaskTerminal.mockReturnValue({
        isAttached: false,
        isLoading: false,
        error: null,
        sessionState: 'ended',
        lastBackupTime: null,
        write: vi.fn(),
        resize: vi.fn()
      })

      render(<TaskTerminal taskId="task-ended" />)

      expect(
        screen.getByText('Session ended — Move task to In Progress to start a new session')
      ).toBeInTheDocument()
    })

    it('shows "History restored" badge when sessionState is restored (TES-1.10)', () => {
      mockUseTaskTerminal.mockReturnValue({
        isAttached: false,
        isLoading: false,
        error: null,
        sessionState: 'restored',
        lastBackupTime: Date.now() - 3600000, // 1 hour ago
        write: vi.fn(),
        resize: vi.fn()
      })

      render(<TaskTerminal taskId="task-restored" />)

      expect(screen.getByText('History restored')).toBeInTheDocument()
      // Should show time since backup
      expect(screen.getByText(/ago/)).toBeInTheDocument()
    })

    it('disables onData for non-live sessions', () => {
      mockUseTaskTerminal.mockReturnValue({
        isAttached: false,
        isLoading: false,
        error: null,
        sessionState: 'ended',
        lastBackupTime: null,
        write: vi.fn(),
        resize: vi.fn()
      })

      render(<TaskTerminal taskId="task-ended" />)

      const terminal = screen.getByTestId('xterminal')
      // onData should be undefined for non-live sessions (data-ondata="false")
      expect(terminal.getAttribute('data-ondata')).toBe('false')
    })

    it('enables onData for live sessions', () => {
      mockUseTaskTerminal.mockReturnValue({
        isAttached: true,
        isLoading: false,
        error: null,
        sessionState: 'live',
        lastBackupTime: null,
        write: vi.fn(),
        resize: vi.fn()
      })

      render(<TaskTerminal taskId="task-live" />)

      const terminal = screen.getByTestId('xterminal')
      expect(terminal.getAttribute('data-ondata')).toBe('true')
    })
  })
})

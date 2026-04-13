import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTerminal } from './useTerminal'
import { useTerminalStore } from '@renderer/stores/terminal.store'

// ─── Mock tauri-specta commands ───────────────────────────────────────────
// vi.mock is hoisted, so we define fns inside the factory.

vi.mock('@renderer/lib/rspc', () => {
  const spawnPty = vi.fn(async () => ({ status: 'ok' as const, data: 'test-process-id' }))
  const writePty = vi.fn(async () => ({ status: 'ok' as const, data: null }))
  const killPty = vi.fn(async () => ({ status: 'ok' as const, data: null }))
  const resizePty = vi.fn(async () => ({ status: 'ok' as const, data: null }))
  return {
    commands: { spawnPty, writePty, killPty, resizePty },
  }
})

// ─── Mock Tauri Channel ───────────────────────────────────────────────────

vi.mock('@tauri-apps/api/core', () => {
  function Channel(this: { onmessage: null | ((data: unknown) => void) }) {
    this.onmessage = null
  }
  return { Channel: vi.fn().mockImplementation(Channel) }
})

// ─── Mock Tauri listen ────────────────────────────────────────────────────

const eventListeners: Record<string, Array<(event: { payload: unknown }) => void>> = {}

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async (eventName: string, handler: (event: { payload: unknown }) => void) => {
    if (!eventListeners[eventName]) {
      eventListeners[eventName] = []
    }
    eventListeners[eventName].push(handler)
    return () => {
      const idx = eventListeners[eventName]?.indexOf(handler)
      if (idx != null && idx >= 0) {
        eventListeners[eventName].splice(idx, 1)
      }
    }
  }),
}))

describe('useTerminal', () => {
  let commands: {
    spawnPty: ReturnType<typeof vi.fn>
    writePty: ReturnType<typeof vi.fn>
    killPty: ReturnType<typeof vi.fn>
    resizePty: ReturnType<typeof vi.fn>
  }

  const mockTerminalRef = {
    current: {
      write: vi.fn(),
      clear: vi.fn(),
      focus: vi.fn(),
      getDimensions: vi.fn(() => ({ cols: 80, rows: 24 })),
      fit: vi.fn(),
      serialize: vi.fn(() => ''),
      getScrollPosition: vi.fn(() => 0),
      scrollToLine: vi.fn(),
    },
  }

  beforeEach(async () => {
    vi.clearAllMocks()
    Object.keys(eventListeners).forEach((k) => {
      eventListeners[k] = []
    })
    useTerminalStore.setState({
      isExpanded: true,
      height: 300,
      activeProcessId: null,
    })

    const mod = await import('@renderer/lib/rspc')
    commands = mod.commands as typeof commands

    commands.spawnPty.mockResolvedValue({ status: 'ok', data: 'test-process-id' })
    commands.killPty.mockResolvedValue({ status: 'ok', data: null })
    commands.writePty.mockResolvedValue({ status: 'ok', data: null })
    commands.resizePty.mockResolvedValue({ status: 'ok', data: null })
  })

  it('should return isRunning as false when no active process', () => {
    const { result } = renderHook(() =>
      useTerminal({ terminalRef: mockTerminalRef, onExit: vi.fn() })
    )

    expect(result.current.isRunning).toBe(false)
    expect(result.current.processId).toBeNull()
  })

  it('should return isRunning as true when process is active', () => {
    useTerminalStore.setState({ activeProcessId: 'test-process-123' })

    const { result } = renderHook(() =>
      useTerminal({ terminalRef: mockTerminalRef, onExit: vi.fn() })
    )

    expect(result.current.isRunning).toBe(true)
    expect(result.current.processId).toBe('test-process-123')
  })

  describe('spawn', () => {
    it('should call spawnPty and set active process', async () => {
      const { result } = renderHook(() =>
        useTerminal({ terminalRef: mockTerminalRef, onExit: vi.fn() })
      )

      await act(async () => {
        await result.current.spawn()
      })

      expect(commands.spawnPty).toHaveBeenCalledWith(
        null,           // command
        [],             // args
        null,           // cwd
        80,             // cols
        24,             // rows
        expect.anything() // Channel
      )
    })

    it('should spawn with custom command and args', async () => {
      const { result } = renderHook(() =>
        useTerminal({ terminalRef: mockTerminalRef, onExit: vi.fn() })
      )

      await act(async () => {
        await result.current.spawn({
          command: 'node',
          args: ['--version'],
          cwd: '/tmp',
        })
      })

      expect(commands.spawnPty).toHaveBeenCalledWith(
        'node',
        ['--version'],
        '/tmp',
        80,
        24,
        expect.anything()
      )
    })

    it('should kill existing process before spawning new one', async () => {
      useTerminalStore.setState({ activeProcessId: 'old-process-id' })

      const { result } = renderHook(() =>
        useTerminal({ terminalRef: mockTerminalRef, onExit: vi.fn() })
      )

      await act(async () => {
        await result.current.spawn()
      })

      expect(commands.killPty).toHaveBeenCalledWith('old-process-id')
    })

    it('should set activeProcess after spawn', async () => {
      const { result } = renderHook(() =>
        useTerminal({ terminalRef: mockTerminalRef, onExit: vi.fn() })
      )

      await act(async () => {
        await result.current.spawn()
      })

      expect(result.current.isRunning).toBe(true)
      expect(result.current.processId).toBe('test-process-id')
    })
  })

  describe('write', () => {
    it('should call writePty when process is active', () => {
      useTerminalStore.setState({ activeProcessId: 'test-process-id' })

      const { result } = renderHook(() =>
        useTerminal({ terminalRef: mockTerminalRef, onExit: vi.fn() })
      )

      act(() => {
        result.current.write('test input')
      })

      expect(commands.writePty).toHaveBeenCalledWith('test-process-id', 'test input')
    })

    it('should not call writePty when no process is active', () => {
      const { result } = renderHook(() =>
        useTerminal({ terminalRef: mockTerminalRef, onExit: vi.fn() })
      )

      act(() => {
        result.current.write('test input')
      })

      expect(commands.writePty).not.toHaveBeenCalled()
    })
  })

  describe('kill', () => {
    it('should call killPty when process is active', () => {
      useTerminalStore.setState({ activeProcessId: 'test-process-id' })

      const { result } = renderHook(() =>
        useTerminal({ terminalRef: mockTerminalRef, onExit: vi.fn() })
      )

      act(() => {
        result.current.kill()
      })

      expect(commands.killPty).toHaveBeenCalledWith('test-process-id')
    })

    it('should not call killPty when no process is active', () => {
      const { result } = renderHook(() =>
        useTerminal({ terminalRef: mockTerminalRef, onExit: vi.fn() })
      )

      act(() => {
        result.current.kill()
      })

      expect(commands.killPty).not.toHaveBeenCalled()
    })
  })

  describe('resize', () => {
    it('should call resizePty when process is active', () => {
      useTerminalStore.setState({ activeProcessId: 'test-process-id' })

      const { result } = renderHook(() =>
        useTerminal({ terminalRef: mockTerminalRef, onExit: vi.fn() })
      )

      act(() => {
        result.current.resize(120, 40)
      })

      expect(commands.resizePty).toHaveBeenCalledWith('test-process-id', 120, 40)
    })

    it('should not call resizePty when no process is active', () => {
      const { result } = renderHook(() =>
        useTerminal({ terminalRef: mockTerminalRef, onExit: vi.fn() })
      )

      act(() => {
        result.current.resize(120, 40)
      })

      expect(commands.resizePty).not.toHaveBeenCalled()
    })

    it('should debounce redundant resize calls', () => {
      useTerminalStore.setState({ activeProcessId: 'test-process-id' })

      const { result } = renderHook(() =>
        useTerminal({ terminalRef: mockTerminalRef, onExit: vi.fn() })
      )

      act(() => {
        result.current.resize(120, 40)
        result.current.resize(120, 40) // Same dimensions
        result.current.resize(120, 40) // Same dimensions
      })

      expect(commands.resizePty).toHaveBeenCalledTimes(1)
    })

    it('should call resize for different dimensions', () => {
      useTerminalStore.setState({ activeProcessId: 'test-process-id' })

      const { result } = renderHook(() =>
        useTerminal({ terminalRef: mockTerminalRef, onExit: vi.fn() })
      )

      act(() => {
        result.current.resize(120, 40)
        result.current.resize(100, 30) // Different dimensions
      })

      expect(commands.resizePty).toHaveBeenCalledTimes(2)
    })
  })

  describe('cleanup on unmount', () => {
    it('should kill active process on unmount', () => {
      useTerminalStore.setState({ activeProcessId: 'test-process-id' })

      const { unmount } = renderHook(() =>
        useTerminal({ terminalRef: mockTerminalRef, onExit: vi.fn() })
      )

      unmount()

      expect(commands.killPty).toHaveBeenCalledWith('test-process-id')
    })

    it('should not call killPty on unmount if no active process', () => {
      const { unmount } = renderHook(() =>
        useTerminal({ terminalRef: mockTerminalRef, onExit: vi.fn() })
      )

      unmount()

      expect(commands.killPty).not.toHaveBeenCalled()
    })
  })

  describe('PTY exit via Tauri Event', () => {
    it('clears active process when pty:exit fires for active process', async () => {
      useTerminalStore.setState({ activeProcessId: 'test-process-id' })
      const onExit = vi.fn()

      const { result } = renderHook(() =>
        useTerminal({ terminalRef: mockTerminalRef, onExit })
      )

      expect(result.current.isRunning).toBe(true)

      act(() => {
        eventListeners['pty:exit']?.forEach((h) =>
          h({ payload: { process_id: 'test-process-id', exit_code: 0 } })
        )
      })

      expect(result.current.isRunning).toBe(false)
      expect(onExit).toHaveBeenCalledWith(0)
    })

    it('ignores pty:exit events for other processes', () => {
      useTerminalStore.setState({ activeProcessId: 'test-process-id' })
      const onExit = vi.fn()

      const { result } = renderHook(() =>
        useTerminal({ terminalRef: mockTerminalRef, onExit })
      )

      act(() => {
        eventListeners['pty:exit']?.forEach((h) =>
          h({ payload: { process_id: 'other-process-id', exit_code: 0 } })
        )
      })

      expect(result.current.isRunning).toBe(true)
      expect(onExit).not.toHaveBeenCalled()
    })
  })
})

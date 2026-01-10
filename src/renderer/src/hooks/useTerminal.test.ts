import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTerminal } from './useTerminal'
import { useTerminalStore } from '@renderer/stores/terminal.store'

// Mock tRPC
const mockSpawnMutate = vi.fn()
const mockSpawnMutateAsync = vi.fn()
const mockWriteMutate = vi.fn()
const mockKillMutate = vi.fn()
const mockResizeMutate = vi.fn()

vi.mock('@renderer/lib/trpc', () => ({
  trpc: {
    pty: {
      spawn: {
        useMutation: (options?: { onError?: (error: Error) => void }) => ({
          mutate: mockSpawnMutate,
          mutateAsync: mockSpawnMutateAsync,
          onError: options?.onError
        })
      },
      write: {
        useMutation: (options?: { onError?: (error: Error) => void }) => ({
          mutate: mockWriteMutate,
          onError: options?.onError
        })
      },
      kill: {
        useMutation: (options?: { onError?: (error: Error) => void }) => ({
          mutate: mockKillMutate,
          onError: options?.onError
        })
      },
      resize: {
        useMutation: (options?: { onError?: (error: Error) => void }) => ({
          mutate: mockResizeMutate,
          onError: options?.onError
        })
      },
      onOutput: {
        useSubscription: vi.fn()
      },
      onExit: {
        useSubscription: vi.fn()
      }
    }
  }
}))

describe('useTerminal', () => {
  const mockTerminalRef = {
    current: {
      write: vi.fn(),
      clear: vi.fn(),
      focus: vi.fn(),
      getDimensions: vi.fn(() => ({ cols: 80, rows: 24 })),
      fit: vi.fn()
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    useTerminalStore.setState({
      isExpanded: true,
      height: 300,
      activeProcessId: null
    })
    mockSpawnMutateAsync.mockResolvedValue('test-process-id')
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
    it('should call spawn mutation and set active process', async () => {
      const { result } = renderHook(() =>
        useTerminal({ terminalRef: mockTerminalRef, onExit: vi.fn() })
      )

      await act(async () => {
        await result.current.spawn()
      })

      expect(mockSpawnMutateAsync).toHaveBeenCalledWith({
        command: undefined, // Server decides default shell based on platform
        args: [],
        cwd: undefined,
        cols: 80,
        rows: 24
      })
    })

    it('should spawn with custom command and args', async () => {
      const { result } = renderHook(() =>
        useTerminal({ terminalRef: mockTerminalRef, onExit: vi.fn() })
      )

      await act(async () => {
        await result.current.spawn({
          command: 'node',
          args: ['--version'],
          cwd: '/tmp'
        })
      })

      expect(mockSpawnMutateAsync).toHaveBeenCalledWith({
        command: 'node',
        args: ['--version'],
        cwd: '/tmp',
        cols: 80,
        rows: 24
      })
    })

    it('should kill existing process before spawning new one', async () => {
      useTerminalStore.setState({ activeProcessId: 'old-process-id' })

      const { result } = renderHook(() =>
        useTerminal({ terminalRef: mockTerminalRef, onExit: vi.fn() })
      )

      await act(async () => {
        await result.current.spawn()
      })

      expect(mockKillMutate).toHaveBeenCalledWith({ processId: 'old-process-id' })
    })
  })

  describe('write', () => {
    it('should call write mutation when process is active', () => {
      useTerminalStore.setState({ activeProcessId: 'test-process-id' })

      const { result } = renderHook(() =>
        useTerminal({ terminalRef: mockTerminalRef, onExit: vi.fn() })
      )

      act(() => {
        result.current.write('test input')
      })

      expect(mockWriteMutate).toHaveBeenCalledWith({
        processId: 'test-process-id',
        data: 'test input'
      })
    })

    it('should not call write mutation when no process is active', () => {
      const { result } = renderHook(() =>
        useTerminal({ terminalRef: mockTerminalRef, onExit: vi.fn() })
      )

      act(() => {
        result.current.write('test input')
      })

      expect(mockWriteMutate).not.toHaveBeenCalled()
    })
  })

  describe('kill', () => {
    it('should call kill mutation when process is active', () => {
      useTerminalStore.setState({ activeProcessId: 'test-process-id' })

      const { result } = renderHook(() =>
        useTerminal({ terminalRef: mockTerminalRef, onExit: vi.fn() })
      )

      act(() => {
        result.current.kill()
      })

      expect(mockKillMutate).toHaveBeenCalledWith({ processId: 'test-process-id' })
    })

    it('should not call kill mutation when no process is active', () => {
      const { result } = renderHook(() =>
        useTerminal({ terminalRef: mockTerminalRef, onExit: vi.fn() })
      )

      act(() => {
        result.current.kill()
      })

      expect(mockKillMutate).not.toHaveBeenCalled()
    })
  })

  describe('resize', () => {
    it('should call resize mutation when process is active', () => {
      useTerminalStore.setState({ activeProcessId: 'test-process-id' })

      const { result } = renderHook(() =>
        useTerminal({ terminalRef: mockTerminalRef, onExit: vi.fn() })
      )

      act(() => {
        result.current.resize(120, 40)
      })

      expect(mockResizeMutate).toHaveBeenCalledWith({
        processId: 'test-process-id',
        cols: 120,
        rows: 40
      })
    })

    it('should not call resize mutation when no process is active', () => {
      const { result } = renderHook(() =>
        useTerminal({ terminalRef: mockTerminalRef, onExit: vi.fn() })
      )

      act(() => {
        result.current.resize(120, 40)
      })

      expect(mockResizeMutate).not.toHaveBeenCalled()
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

      // Should only be called once due to debounce
      expect(mockResizeMutate).toHaveBeenCalledTimes(1)
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

      expect(mockResizeMutate).toHaveBeenCalledTimes(2)
    })
  })

  describe('cleanup on unmount', () => {
    it('should kill active process on unmount', () => {
      useTerminalStore.setState({ activeProcessId: 'test-process-id' })

      const { unmount } = renderHook(() =>
        useTerminal({ terminalRef: mockTerminalRef, onExit: vi.fn() })
      )

      unmount()

      expect(mockKillMutate).toHaveBeenCalledWith({ processId: 'test-process-id' })
    })

    it('should not call kill on unmount if no active process', () => {
      const { unmount } = renderHook(() =>
        useTerminal({ terminalRef: mockTerminalRef, onExit: vi.fn() })
      )

      unmount()

      expect(mockKillMutate).not.toHaveBeenCalled()
    })
  })
})

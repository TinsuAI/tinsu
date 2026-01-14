import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useTaskTerminal } from './useTaskTerminal'
import type { XTerminalRef } from '@renderer/components/terminal/XTerminal'

// Mock tRPC
const mockMutateAsync = vi.fn()
const mockMutate = vi.fn()

vi.mock('@renderer/lib/trpc', () => ({
  trpc: {
    agent: {
      attachTaskTerminal: {
        useMutation: vi.fn(() => ({
          mutateAsync: mockMutateAsync
        }))
      },
      detachTaskTerminal: {
        useMutation: vi.fn(() => ({
          mutate: mockMutate
        }))
      }
    },
    pty: {
      write: {
        useMutation: vi.fn(() => ({
          mutate: mockMutate
        }))
      },
      resize: {
        useMutation: vi.fn(() => ({
          mutate: mockMutate
        }))
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

describe('useTaskTerminal', () => {
  const mockTerminalRef = {
    current: {
      write: vi.fn(),
      clear: vi.fn(),
      focus: vi.fn(),
      getDimensions: vi.fn(() => ({ cols: 80, rows: 24 })),
      fit: vi.fn()
    } as unknown as XTerminalRef
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('initial state', () => {
    it('starts in loading state', () => {
      mockMutateAsync.mockImplementation(() => new Promise(() => {})) // Never resolves

      const { result } = renderHook(() =>
        useTaskTerminal({
          taskId: 'task-123',
          terminalRef: mockTerminalRef
        })
      )

      expect(result.current.isLoading).toBe(true)
      expect(result.current.isAttached).toBe(false)
      expect(result.current.error).toBeNull()
    })
  })

  describe('successful attachment', () => {
    it('sets isAttached to true when attachment succeeds', async () => {
      mockMutateAsync.mockResolvedValue({
        attached: true,
        processId: 'pty-123'
      })

      const { result } = renderHook(() =>
        useTaskTerminal({
          taskId: 'task-123',
          terminalRef: mockTerminalRef
        })
      )

      await waitFor(() => {
        expect(result.current.isAttached).toBe(true)
        expect(result.current.isLoading).toBe(false)
        expect(result.current.error).toBeNull()
      })
    })

    it('passes terminal dimensions to attach mutation', async () => {
      mockMutateAsync.mockResolvedValue({ attached: true, processId: 'pty-123' })

      renderHook(() =>
        useTaskTerminal({
          taskId: 'task-123',
          terminalRef: mockTerminalRef
        })
      )

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledWith({
          taskId: 'task-123',
          cols: 80,
          rows: 24
        })
      })
    })
  })

  describe('no session available', () => {
    it('sets isAttached to false when no session exists', async () => {
      mockMutateAsync.mockResolvedValue({
        attached: false,
        processId: null
      })

      const { result } = renderHook(() =>
        useTaskTerminal({
          taskId: 'task-456',
          terminalRef: mockTerminalRef
        })
      )

      await waitFor(() => {
        expect(result.current.isAttached).toBe(false)
        expect(result.current.isLoading).toBe(false)
        expect(result.current.error).toBeNull()
      })
    })
  })

  describe('error handling', () => {
    it('sets error when attachment fails', async () => {
      mockMutateAsync.mockRejectedValue(new Error('Connection failed'))

      const { result } = renderHook(() =>
        useTaskTerminal({
          taskId: 'task-789',
          terminalRef: mockTerminalRef
        })
      )

      await waitFor(() => {
        expect(result.current.error).toBe('Connection failed')
        expect(result.current.isAttached).toBe(false)
        expect(result.current.isLoading).toBe(false)
      })
    })

    it('handles non-Error rejection', async () => {
      mockMutateAsync.mockRejectedValue('Unknown error')

      const { result } = renderHook(() =>
        useTaskTerminal({
          taskId: 'task-abc',
          terminalRef: mockTerminalRef
        })
      )

      await waitFor(() => {
        expect(result.current.error).toBe('Failed to attach terminal')
        expect(result.current.isAttached).toBe(false)
      })
    })
  })

  describe('write function', () => {
    it('does nothing when not attached', async () => {
      mockMutateAsync.mockResolvedValue({ attached: false, processId: null })

      const { result } = renderHook(() =>
        useTaskTerminal({
          taskId: 'task-123',
          terminalRef: mockTerminalRef
        })
      )

      await waitFor(() => !result.current.isLoading)

      act(() => {
        result.current.write('test input')
      })

      // write mutation should not be called
      expect(mockMutate).not.toHaveBeenCalled()
    })
  })

  describe('resize function', () => {
    it('does nothing when not attached', async () => {
      mockMutateAsync.mockResolvedValue({ attached: false, processId: null })

      const { result } = renderHook(() =>
        useTaskTerminal({
          taskId: 'task-123',
          terminalRef: mockTerminalRef
        })
      )

      await waitFor(() => !result.current.isLoading)

      act(() => {
        result.current.resize(100, 30)
      })

      // resize mutation should not be called
      expect(mockMutate).not.toHaveBeenCalled()
    })
  })

  describe('cleanup on unmount', () => {
    it('calls detachMutation when unmounting with active attachment', async () => {
      mockMutateAsync.mockResolvedValue({
        attached: true,
        processId: 'pty-cleanup-123'
      })

      const { unmount } = renderHook(() =>
        useTaskTerminal({
          taskId: 'task-cleanup',
          terminalRef: mockTerminalRef
        })
      )

      // Wait for attachment to complete
      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalled()
      })

      // Clear mock to isolate unmount behavior
      mockMutate.mockClear()

      // Unmount the hook
      unmount()

      // Verify detach was called with the correct processId
      expect(mockMutate).toHaveBeenCalledWith({ processId: 'pty-cleanup-123' })
    })

    it('does not call detachMutation when unmounting without attachment', async () => {
      mockMutateAsync.mockResolvedValue({
        attached: false,
        processId: null
      })

      const { unmount } = renderHook(() =>
        useTaskTerminal({
          taskId: 'task-no-session',
          terminalRef: mockTerminalRef
        })
      )

      // Wait for loading to complete
      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalled()
      })

      // Clear mock to isolate unmount behavior
      mockMutate.mockClear()

      // Unmount the hook
      unmount()

      // Verify detach was NOT called since there was no processId
      expect(mockMutate).not.toHaveBeenCalled()
    })

    it('cleans up if component unmounts during attachment', async () => {
      // Make attach take a while
      let resolveAttach: (value: { attached: boolean; processId: string }) => void
      mockMutateAsync.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveAttach = resolve
          })
      )

      const { unmount } = renderHook(() =>
        useTaskTerminal({
          taskId: 'task-race',
          terminalRef: mockTerminalRef
        })
      )

      // Unmount before attachment completes
      unmount()

      // Now resolve the attachment
      act(() => {
        resolveAttach!({ attached: true, processId: 'pty-race-123' })
      })

      // Verify detach was called to clean up the orphaned PTY
      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalledWith({ processId: 'pty-race-123' })
      })
    })
  })
})

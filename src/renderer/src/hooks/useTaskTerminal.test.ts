import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useTaskTerminal } from './useTaskTerminal'
import type { XTerminalRef } from '@renderer/components/terminal/XTerminal'
import { useTerminalStore } from '@renderer/stores/terminal.store'

// Mock tRPC
const mockMutateAsync = vi.fn()
const mockMutate = vi.fn()
const mockSerialize = vi.fn(() => 'serialized-buffer-content')
const mockGetScrollPosition = vi.fn(() => 42)
const mockScrollToLine = vi.fn()

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
      fit: vi.fn(),
      serialize: mockSerialize,
      getScrollPosition: mockGetScrollPosition,
      scrollToLine: mockScrollToLine
    } as unknown as XTerminalRef
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset terminal store
    useTerminalStore.setState({ terminalBuffers: {} })
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
    /**
     * TES-1.6 Task 1.3: Verify tmux session survives component unmount
     * The detachTaskTerminal procedure only kills the PTY process,
     * NOT the underlying tmux session. This test verifies that
     * cleanup calls detach (not kill-session).
     */
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

    /**
     * TES-1.6 Task 2: Buffer save on unmount
     * Verify that the terminal buffer is saved to the store when unmounting.
     */
    it('saves terminal buffer to store on unmount', async () => {
      mockMutateAsync.mockResolvedValue({
        attached: true,
        processId: 'pty-buffer-test'
      })

      const { unmount } = renderHook(() =>
        useTaskTerminal({
          taskId: 'task-buffer-save',
          terminalRef: mockTerminalRef
        })
      )

      // Wait for attachment to complete
      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalled()
      })

      // Unmount the hook
      unmount()

      // Verify buffer was saved to store
      const savedBuffer = useTerminalStore.getState().getBuffer('task-buffer-save')
      expect(savedBuffer).toBeDefined()
      expect(savedBuffer?.serializedBuffer).toBe('serialized-buffer-content')
      expect(savedBuffer?.scrollPosition).toBe(42)
    })

    it('handles serialize errors gracefully on unmount', async () => {
      mockMutateAsync.mockResolvedValue({
        attached: true,
        processId: 'pty-error-test'
      })

      // Make serialize throw
      mockSerialize.mockImplementationOnce(() => {
        throw new Error('Serialize failed')
      })

      const { unmount } = renderHook(() =>
        useTaskTerminal({
          taskId: 'task-error-test',
          terminalRef: mockTerminalRef
        })
      )

      // Wait for attachment
      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalled()
      })

      // Unmount should not throw
      expect(() => unmount()).not.toThrow()

      // Buffer should not be saved due to error
      const savedBuffer = useTerminalStore.getState().getBuffer('task-error-test')
      expect(savedBuffer).toBeUndefined()
    })
  })

  /**
   * TES-1.6 Task 3: Terminal state restoration on reattach
   */
  describe('buffer restoration on mount (TES-1.6)', () => {
    it('restores cached buffer when mounting', async () => {
      // Pre-populate the store with a cached buffer
      useTerminalStore.getState().saveBuffer('task-restore', 'previous-output', 10)

      mockMutateAsync.mockResolvedValue({
        attached: true,
        processId: 'pty-restore-123'
      })

      renderHook(() =>
        useTaskTerminal({
          taskId: 'task-restore',
          terminalRef: mockTerminalRef
        })
      )

      // Wait for attachment
      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalled()
      })

      // Verify write was called with cached buffer content
      expect(mockTerminalRef.current?.write).toHaveBeenCalledWith('previous-output')
    })

    it('restores scroll position after buffer restoration', async () => {
      // Pre-populate the store with a cached buffer including scroll position
      useTerminalStore.getState().saveBuffer('task-scroll', 'buffer-content', 150)

      mockMutateAsync.mockResolvedValue({
        attached: true,
        processId: 'pty-scroll-123'
      })

      renderHook(() =>
        useTaskTerminal({
          taskId: 'task-scroll',
          terminalRef: mockTerminalRef
        })
      )

      // Wait for attachment
      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalled()
      })

      // Verify buffer was written first
      expect(mockTerminalRef.current?.write).toHaveBeenCalledWith('buffer-content')
      // Verify scroll position was restored
      expect(mockScrollToLine).toHaveBeenCalledWith(150)
    })

    it('does not scroll if scroll position is zero', async () => {
      // Pre-populate with scroll position of 0
      useTerminalStore.getState().saveBuffer('task-no-scroll', 'buffer-content', 0)

      mockMutateAsync.mockResolvedValue({
        attached: true,
        processId: 'pty-no-scroll-123'
      })

      renderHook(() =>
        useTaskTerminal({
          taskId: 'task-no-scroll',
          terminalRef: mockTerminalRef
        })
      )

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalled()
      })

      // Verify scroll was NOT called (position was 0)
      expect(mockScrollToLine).not.toHaveBeenCalled()
    })

    it('does not write if no cached buffer exists', async () => {
      mockMutateAsync.mockResolvedValue({
        attached: true,
        processId: 'pty-no-cache'
      })

      renderHook(() =>
        useTaskTerminal({
          taskId: 'task-no-cache',
          terminalRef: mockTerminalRef
        })
      )

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalled()
      })

      // Write should not have been called (no cached buffer)
      expect(mockTerminalRef.current?.write).not.toHaveBeenCalled()
    })

    it('handles buffer restoration errors gracefully', async () => {
      // Pre-populate the store with a cached buffer
      useTerminalStore.getState().saveBuffer('task-error-restore', 'cached-content', 5)

      // Make write throw
      const mockWrite = mockTerminalRef.current?.write as ReturnType<typeof vi.fn>
      mockWrite.mockImplementationOnce(() => {
        throw new Error('Write failed')
      })

      mockMutateAsync.mockResolvedValue({
        attached: true,
        processId: 'pty-error-restore'
      })

      // Should not throw
      expect(() =>
        renderHook(() =>
          useTaskTerminal({
            taskId: 'task-error-restore',
            terminalRef: mockTerminalRef
          })
        )
      ).not.toThrow()

      // Attachment should still proceed
      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalled()
      })
    })
  })
})

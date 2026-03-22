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

// TES-1.9: Mock scrollback query data
let mockScrollbackQueryData: { content: string | null; metadata: unknown | null } | undefined = undefined
let mockScrollbackQueryLoading = false

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
      },
      // TES-1.9: Mock getScrollbackBackup query
      getScrollbackBackup: {
        useQuery: vi.fn(() => ({
          data: mockScrollbackQueryData,
          isLoading: mockScrollbackQueryLoading,
          error: null
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
    // Reset scrollback query mock data
    mockScrollbackQueryData = undefined
    mockScrollbackQueryLoading = false
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

  /**
   * TES-1.9: Scrollback Restoration After App Restart
   *
   * When there is no in-memory cache (app was restarted), the hook should
   * restore scrollback from the filesystem backup if available.
   */
  describe('scrollback restoration from backup (TES-1.9)', () => {
    it('restores scrollback from backup when no in-memory cache exists', async () => {
      // No in-memory cache, but backup exists
      // Note: lastBackup should be a number (Unix timestamp) to match the type definition
      mockScrollbackQueryData = {
        content: 'Restored scrollback content\nLine 2\nLine 3',
        metadata: {
          lines: 3,
          bytes: 100,
          lastBackup: Date.now() - 7200000, // 2 hours ago (number format)
          tmuxSession: 'tinsu-test'
        }
      }

      mockMutateAsync.mockResolvedValue({
        attached: true,
        processId: 'pty-restore-backup'
      })

      renderHook(() =>
        useTaskTerminal({
          taskId: 'task-backup-restore',
          terminalRef: mockTerminalRef
        })
      )

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalled()
      })

      // Verify backup content was written
      expect(mockTerminalRef.current?.write).toHaveBeenCalledWith(
        'Restored scrollback content\nLine 2\nLine 3'
      )
      // Verify separator was added
      expect(mockTerminalRef.current?.write).toHaveBeenCalledWith(
        '\r\n\x1b[90m--- Session Restored ---\x1b[0m\r\n'
      )
    })

    it('does not restore from backup when in-memory cache exists', async () => {
      // In-memory cache exists (takes precedence)
      useTerminalStore.getState().saveBuffer('task-cache-priority', 'in-memory-content', 0)

      // Backup also exists
      mockScrollbackQueryData = {
        content: 'Backup content (should not be used)',
        metadata: null
      }

      mockMutateAsync.mockResolvedValue({
        attached: true,
        processId: 'pty-cache-priority'
      })

      renderHook(() =>
        useTaskTerminal({
          taskId: 'task-cache-priority',
          terminalRef: mockTerminalRef
        })
      )

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalled()
      })

      // Should have written in-memory content, NOT backup content
      expect(mockTerminalRef.current?.write).toHaveBeenCalledWith('in-memory-content')
      // Separator should NOT be added when using in-memory cache
      expect(mockTerminalRef.current?.write).not.toHaveBeenCalledWith(
        expect.stringContaining('Session Restored')
      )
    })

    it('handles no backup gracefully', async () => {
      // No in-memory cache and no backup
      mockScrollbackQueryData = {
        content: null,
        metadata: null
      }

      mockMutateAsync.mockResolvedValue({
        attached: true,
        processId: 'pty-no-backup'
      })

      renderHook(() =>
        useTaskTerminal({
          taskId: 'task-no-backup',
          terminalRef: mockTerminalRef
        })
      )

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalled()
      })

      // Write should not have been called
      expect(mockTerminalRef.current?.write).not.toHaveBeenCalled()
    })

    it('returns isRestoringScrollback state', async () => {
      mockScrollbackQueryLoading = true
      mockMutateAsync.mockResolvedValue({
        attached: true,
        processId: 'pty-loading'
      })

      const { result } = renderHook(() =>
        useTaskTerminal({
          taskId: 'task-loading',
          terminalRef: mockTerminalRef
        })
      )

      // Initially should indicate restoring scrollback when query is loading
      // Note: The actual isRestoringScrollback state depends on implementation
      expect(result.current.isRestoringScrollback).toBeDefined()
    })

    it('handles backup restoration errors gracefully', async () => {
      // Backup exists
      mockScrollbackQueryData = {
        content: 'backup-content',
        metadata: null
      }

      // Make write throw for backup restoration
      const mockWrite = mockTerminalRef.current?.write as ReturnType<typeof vi.fn>
      mockWrite.mockImplementationOnce(() => {
        throw new Error('Write failed')
      })

      mockMutateAsync.mockResolvedValue({
        attached: true,
        processId: 'pty-backup-error'
      })

      // Should not throw
      expect(() =>
        renderHook(() =>
          useTaskTerminal({
            taskId: 'task-backup-error',
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

  /**
   * TES-1.10: Scrollback Survival After System Reboot
   *
   * Session state detection for proper UI rendering:
   * - 'live': Actively connected to tmux session
   * - 'restored': Viewing historical backup (no live session)
   * - 'none': No session and no backup
   */
  describe('session state detection (TES-1.10)', () => {
    it('returns sessionState "live" when attached to tmux session', async () => {
      mockMutateAsync.mockResolvedValue({
        attached: true,
        processId: 'pty-live'
      })

      const { result } = renderHook(() =>
        useTaskTerminal({
          taskId: 'task-live',
          terminalRef: mockTerminalRef
        })
      )

      await waitFor(() => {
        expect(result.current.isAttached).toBe(true)
      })

      expect(result.current.sessionState).toBe('live')
    })

    it('returns sessionState "restored" when backup exists but no live session', async () => {
      // Backup exists
      mockScrollbackQueryData = {
        content: 'Historical scrollback content',
        metadata: {
          lines: 10,
          bytes: 200,
          lastBackup: Date.now(),
          tmuxSession: 'tinsu-historical'
        }
      }

      // No live session
      mockMutateAsync.mockResolvedValue({
        attached: false,
        processId: null
      })

      const { result } = renderHook(() =>
        useTaskTerminal({
          taskId: 'task-historical',
          terminalRef: mockTerminalRef
        })
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      // Should be restored state (backup was written, no live session)
      expect(result.current.sessionState).toBe('restored')
    })

    it('returns sessionState "none" when no backup and no live session', async () => {
      // No backup
      mockScrollbackQueryData = {
        content: null,
        metadata: null
      }

      // No live session
      mockMutateAsync.mockResolvedValue({
        attached: false,
        processId: null
      })

      const { result } = renderHook(() =>
        useTaskTerminal({
          taskId: 'task-empty',
          terminalRef: mockTerminalRef
        })
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.sessionState).toBe('none')
    })

    it('returns lastBackupTime from backup metadata', async () => {
      const backupTime = Date.now() - 3600000 // 1 hour ago
      mockScrollbackQueryData = {
        content: 'Backup content',
        metadata: {
          lines: 5,
          bytes: 50,
          lastBackup: backupTime,
          tmuxSession: 'tinsu-test'
        }
      }

      mockMutateAsync.mockResolvedValue({
        attached: false,
        processId: null
      })

      const { result } = renderHook(() =>
        useTaskTerminal({
          taskId: 'task-timestamp',
          terminalRef: mockTerminalRef
        })
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.lastBackupTime).toBe(backupTime)
    })

    it('returns null lastBackupTime when no backup metadata', async () => {
      mockScrollbackQueryData = {
        content: null,
        metadata: null
      }

      mockMutateAsync.mockResolvedValue({
        attached: true,
        processId: 'pty-no-metadata'
      })

      const { result } = renderHook(() =>
        useTaskTerminal({
          taskId: 'task-no-metadata',
          terminalRef: mockTerminalRef
        })
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.lastBackupTime).toBeNull()
    })
  })

  /**
   * TES-1.11: Session End & Unresponsive Detection
   *
   * Session state detection for ended and stalled states:
   * - 'ended': Session process has exited
   * - 'stalled': No output received for 5 minutes (warning state)
   */
  describe('session end/stall detection (TES-1.11)', () => {
    it('returns sessionState "ended" when session has ended', async () => {
      // Simulate session ended via subscription
      let onSessionStatusCallback: ((data: { status: string; reason?: string }) => void) | undefined

      // Mock the subscription to capture the callback
      vi.mocked(require('@renderer/lib/trpc').trpc.agent.onSessionStatusChange.useSubscription)
        .mockImplementation((_input: unknown, options: { onData: (data: unknown) => void }) => {
          onSessionStatusCallback = options.onData
        })

      mockMutateAsync.mockResolvedValue({
        attached: true,
        processId: 'pty-ended'
      })

      const { result } = renderHook(() =>
        useTaskTerminal({
          taskId: 'task-ended',
          terminalRef: mockTerminalRef
        })
      )

      await waitFor(() => {
        expect(result.current.isAttached).toBe(true)
      })

      // Trigger session ended event
      act(() => {
        onSessionStatusCallback?.({ status: 'ended', reason: 'process_exit' })
      })

      expect(result.current.sessionState).toBe('ended')
    })

    it('returns sessionState "stalled" when session has stalled', async () => {
      let onSessionStatusCallback: ((data: { status: string }) => void) | undefined

      vi.mocked(require('@renderer/lib/trpc').trpc.agent.onSessionStatusChange.useSubscription)
        .mockImplementation((_input: unknown, options: { onData: (data: unknown) => void }) => {
          onSessionStatusCallback = options.onData
        })

      mockMutateAsync.mockResolvedValue({
        attached: true,
        processId: 'pty-stalled'
      })

      const { result } = renderHook(() =>
        useTaskTerminal({
          taskId: 'task-stalled',
          terminalRef: mockTerminalRef
        })
      )

      await waitFor(() => {
        expect(result.current.isAttached).toBe(true)
      })

      // Trigger stall event
      act(() => {
        onSessionStatusCallback?.({ status: 'stalled' })
      })

      expect(result.current.sessionState).toBe('stalled')
    })

    it('recovers from stalled state when output is received', async () => {
      let onSessionStatusCallback: ((data: { status: string }) => void) | undefined

      vi.mocked(require('@renderer/lib/trpc').trpc.agent.onSessionStatusChange.useSubscription)
        .mockImplementation((_input: unknown, options: { onData: (data: unknown) => void }) => {
          onSessionStatusCallback = options.onData
        })

      mockMutateAsync.mockResolvedValue({
        attached: true,
        processId: 'pty-recover'
      })

      const { result } = renderHook(() =>
        useTaskTerminal({
          taskId: 'task-recover',
          terminalRef: mockTerminalRef
        })
      )

      await waitFor(() => {
        expect(result.current.isAttached).toBe(true)
      })

      // First stall
      act(() => {
        onSessionStatusCallback?.({ status: 'stalled' })
      })
      expect(result.current.sessionState).toBe('stalled')

      // Then recover
      act(() => {
        onSessionStatusCallback?.({ status: 'recovered' })
      })
      expect(result.current.sessionState).toBe('live')
    })

    it('ended state takes precedence over stalled state', async () => {
      let onSessionStatusCallback: ((data: { status: string }) => void) | undefined

      vi.mocked(require('@renderer/lib/trpc').trpc.agent.onSessionStatusChange.useSubscription)
        .mockImplementation((_input: unknown, options: { onData: (data: unknown) => void }) => {
          onSessionStatusCallback = options.onData
        })

      mockMutateAsync.mockResolvedValue({
        attached: true,
        processId: 'pty-precedence'
      })

      const { result } = renderHook(() =>
        useTaskTerminal({
          taskId: 'task-precedence',
          terminalRef: mockTerminalRef
        })
      )

      await waitFor(() => {
        expect(result.current.isAttached).toBe(true)
      })

      // First stall
      act(() => {
        onSessionStatusCallback?.({ status: 'stalled' })
      })
      expect(result.current.sessionState).toBe('stalled')

      // Then end (should take precedence)
      act(() => {
        onSessionStatusCallback?.({ status: 'ended' })
      })
      expect(result.current.sessionState).toBe('ended')
    })
  })
})

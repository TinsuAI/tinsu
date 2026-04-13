import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useTaskTerminal } from './useTaskTerminal'
import type { XTerminalRef } from '@renderer/components/terminal/XTerminal'
import { useTerminalStore } from '@renderer/stores/terminal.store'

// ─── Mock tauri-specta commands ───────────────────────────────────────────
// vi.mock is hoisted, so factories cannot reference outer variables.
// We export the fns from the factory and access them via the module.

vi.mock('@renderer/lib/rspc', () => {
  const attachTaskTerminal = vi.fn(async () => ({
    status: 'ok' as const,
    data: { process_id: 'pty-123', attached: true },
  }))
  const detachTaskTerminal = vi.fn(async () => ({ status: 'ok' as const, data: null }))
  const writePty = vi.fn(async () => ({ status: 'ok' as const, data: null }))
  const resizePty = vi.fn(async () => ({ status: 'ok' as const, data: null }))
  const startSessionMonitor = vi.fn(async () => ({ status: 'ok' as const, data: null }))
  const getScrollbackBackup = vi.fn(async () => ({
    status: 'ok' as const,
    data: { content: null, metadata: null },
  }))
  return {
    commands: {
      attachTaskTerminal,
      detachTaskTerminal,
      writePty,
      resizePty,
      startSessionMonitor,
      getScrollbackBackup,
    },
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

function emitEvent(eventName: string, payload: unknown) {
  eventListeners[eventName]?.forEach((h) => h({ payload }))
}

// ─── Mock @tanstack/react-query ───────────────────────────────────────────

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(({ queryFn }: { queryFn: () => Promise<unknown> }) => {
    return { data: undefined, isLoading: false, error: null }
  }),
}))

const mockSerialize = vi.fn(() => 'serialized-buffer-content')
const mockGetScrollPosition = vi.fn(() => 42)
const mockScrollToLine = vi.fn()

describe('useTaskTerminal', () => {
  // Access mocked commands from the module
  let commands: {
    attachTaskTerminal: ReturnType<typeof vi.fn>
    detachTaskTerminal: ReturnType<typeof vi.fn>
    writePty: ReturnType<typeof vi.fn>
    resizePty: ReturnType<typeof vi.fn>
    startSessionMonitor: ReturnType<typeof vi.fn>
    getScrollbackBackup: ReturnType<typeof vi.fn>
  }

  const mockTerminalRef = {
    current: {
      write: vi.fn(),
      clear: vi.fn(),
      focus: vi.fn(),
      getDimensions: vi.fn(() => ({ cols: 80, rows: 24 })),
      fit: vi.fn(),
      serialize: mockSerialize,
      getScrollPosition: mockGetScrollPosition,
      scrollToLine: mockScrollToLine,
    } as unknown as XTerminalRef,
  }

  beforeEach(async () => {
    vi.clearAllMocks()
    Object.keys(eventListeners).forEach((k) => {
      eventListeners[k] = []
    })
    useTerminalStore.setState({ terminalBuffers: {} })

    // Get reference to the mocked module's commands
    const mod = await import('@renderer/lib/rspc')
    commands = mod.commands as typeof commands

    // Reset default implementations
    commands.attachTaskTerminal.mockResolvedValue({
      status: 'ok',
      data: { process_id: 'pty-123', attached: true },
    })
    commands.detachTaskTerminal.mockResolvedValue({ status: 'ok', data: null })
    commands.startSessionMonitor.mockResolvedValue({ status: 'ok', data: null })
    commands.getScrollbackBackup.mockResolvedValue({
      status: 'ok',
      data: { content: null, metadata: null },
    })
    commands.writePty.mockResolvedValue({ status: 'ok', data: null })
    commands.resizePty.mockResolvedValue({ status: 'ok', data: null })

    // Also reset react-query mock to return no data by default
    const { useQuery } = await import('@tanstack/react-query')
    vi.mocked(useQuery).mockImplementation(() => ({
      data: undefined,
      isLoading: false,
      error: null,
    }) as ReturnType<typeof useQuery>)
  })

  describe('initial state', () => {
    it('starts in loading state', () => {
      commands.attachTaskTerminal.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      )

      const { result } = renderHook(() =>
        useTaskTerminal({
          taskId: 'task-123',
          terminalRef: mockTerminalRef,
        })
      )

      expect(result.current.isLoading).toBe(true)
      expect(result.current.isAttached).toBe(false)
      expect(result.current.error).toBeNull()
    })
  })

  describe('successful attachment', () => {
    it('sets isAttached to true when attachment succeeds', async () => {
      const { result } = renderHook(() =>
        useTaskTerminal({
          taskId: 'task-123',
          terminalRef: mockTerminalRef,
        })
      )

      await waitFor(() => {
        expect(result.current.isAttached).toBe(true)
        expect(result.current.isLoading).toBe(false)
        expect(result.current.error).toBeNull()
      })
    })

    it('calls commands.attachTaskTerminal with task dimensions', async () => {
      renderHook(() =>
        useTaskTerminal({
          taskId: 'task-123',
          terminalRef: mockTerminalRef,
        })
      )

      await waitFor(() => {
        expect(commands.attachTaskTerminal).toHaveBeenCalledWith(
          'task-123',
          80,
          24,
          expect.anything() // Channel
        )
      })
    })
  })

  describe('no session available', () => {
    it('sets isAttached to false when no session exists', async () => {
      commands.attachTaskTerminal.mockResolvedValue({
        status: 'ok',
        data: { process_id: '', attached: false },
      })

      const { result } = renderHook(() =>
        useTaskTerminal({
          taskId: 'task-456',
          terminalRef: mockTerminalRef,
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
    it('sets error when attachment command throws', async () => {
      commands.attachTaskTerminal.mockRejectedValue(new Error('Connection failed'))

      const { result } = renderHook(() =>
        useTaskTerminal({
          taskId: 'task-789',
          terminalRef: mockTerminalRef,
        })
      )

      await waitFor(() => {
        expect(result.current.error).toBe('Connection failed')
        expect(result.current.isAttached).toBe(false)
        expect(result.current.isLoading).toBe(false)
      })
    })

    it('handles non-Error rejection', async () => {
      commands.attachTaskTerminal.mockRejectedValue('Unknown error')

      const { result } = renderHook(() =>
        useTaskTerminal({
          taskId: 'task-abc',
          terminalRef: mockTerminalRef,
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
      commands.attachTaskTerminal.mockResolvedValue({
        status: 'ok',
        data: { process_id: '', attached: false },
      })

      const { result } = renderHook(() =>
        useTaskTerminal({
          taskId: 'task-123',
          terminalRef: mockTerminalRef,
        })
      )

      await waitFor(() => !result.current.isLoading)

      act(() => {
        result.current.write('test input')
      })

      expect(commands.writePty).not.toHaveBeenCalled()
    })

    it('calls writePty when attached', async () => {
      const { result } = renderHook(() =>
        useTaskTerminal({
          taskId: 'task-write',
          terminalRef: mockTerminalRef,
        })
      )

      // Wait until sessionState === 'live' which requires both isAttached AND processId set
      await waitFor(() => result.current.sessionState === 'live')

      act(() => {
        result.current.write('hello')
      })

      expect(commands.writePty).toHaveBeenCalledWith('pty-123', 'hello')
    })
  })

  describe('resize function', () => {
    it('does nothing when not attached', async () => {
      commands.attachTaskTerminal.mockResolvedValue({
        status: 'ok',
        data: { process_id: '', attached: false },
      })

      const { result } = renderHook(() =>
        useTaskTerminal({
          taskId: 'task-123',
          terminalRef: mockTerminalRef,
        })
      )

      await waitFor(() => !result.current.isLoading)

      act(() => {
        result.current.resize(100, 30)
      })

      expect(commands.resizePty).not.toHaveBeenCalled()
    })
  })

  describe('cleanup on unmount', () => {
    it('calls detachTaskTerminal when unmounting with active attachment', async () => {
      const { unmount } = renderHook(() =>
        useTaskTerminal({
          taskId: 'task-cleanup',
          terminalRef: mockTerminalRef,
        })
      )

      await waitFor(() => {
        expect(commands.attachTaskTerminal).toHaveBeenCalled()
      })

      unmount()

      await waitFor(() => {
        expect(commands.detachTaskTerminal).toHaveBeenCalledWith('pty-123')
      })
    })

    it('does not call detachTaskTerminal when unmounting without attachment', async () => {
      commands.attachTaskTerminal.mockResolvedValue({
        status: 'ok',
        data: { process_id: '', attached: false },
      })

      const { unmount } = renderHook(() =>
        useTaskTerminal({
          taskId: 'task-no-session',
          terminalRef: mockTerminalRef,
        })
      )

      await waitFor(() => {
        expect(commands.attachTaskTerminal).toHaveBeenCalled()
      })

      unmount()

      expect(commands.detachTaskTerminal).not.toHaveBeenCalled()
    })

    it('saves terminal buffer to store on unmount', async () => {
      const { unmount } = renderHook(() =>
        useTaskTerminal({
          taskId: 'task-buffer-save',
          terminalRef: mockTerminalRef,
        })
      )

      await waitFor(() => {
        expect(commands.attachTaskTerminal).toHaveBeenCalled()
      })

      unmount()

      const savedBuffer = useTerminalStore.getState().getBuffer('task-buffer-save')
      expect(savedBuffer).toBeDefined()
      expect(savedBuffer?.serializedBuffer).toBe('serialized-buffer-content')
      expect(savedBuffer?.scrollPosition).toBe(42)
    })
  })

  describe('buffer restoration on mount (TES-1.6)', () => {
    it('restores cached buffer when mounting', async () => {
      useTerminalStore.getState().saveBuffer('task-restore', 'previous-output', 10)

      renderHook(() =>
        useTaskTerminal({
          taskId: 'task-restore',
          terminalRef: mockTerminalRef,
        })
      )

      await waitFor(() => {
        expect(commands.attachTaskTerminal).toHaveBeenCalled()
      })

      expect(mockTerminalRef.current?.write).toHaveBeenCalledWith('previous-output')
    })

    it('restores scroll position after buffer restoration', async () => {
      useTerminalStore.getState().saveBuffer('task-scroll', 'buffer-content', 150)

      renderHook(() =>
        useTaskTerminal({
          taskId: 'task-scroll',
          terminalRef: mockTerminalRef,
        })
      )

      await waitFor(() => {
        expect(commands.attachTaskTerminal).toHaveBeenCalled()
      })

      expect(mockTerminalRef.current?.write).toHaveBeenCalledWith('buffer-content')
      expect(mockScrollToLine).toHaveBeenCalledWith(150)
    })
  })

  describe('scrollback restoration from backup (TES-1.9)', () => {
    it('restores scrollback from backup when no in-memory cache exists', async () => {
      const { useQuery } = await import('@tanstack/react-query')
      vi.mocked(useQuery).mockReturnValue({
        data: {
          content: 'Restored scrollback content\nLine 2\nLine 3',
          metadata: { last_backup: Date.now() - 7200000, size: 100 },
        },
        isLoading: false,
        error: null,
      } as ReturnType<typeof useQuery>)

      renderHook(() =>
        useTaskTerminal({
          taskId: 'task-backup-restore',
          terminalRef: mockTerminalRef,
        })
      )

      await waitFor(() => {
        expect(commands.attachTaskTerminal).toHaveBeenCalled()
      })

      expect(mockTerminalRef.current?.write).toHaveBeenCalledWith(
        'Restored scrollback content\nLine 2\nLine 3'
      )
      expect(mockTerminalRef.current?.write).toHaveBeenCalledWith(
        '\r\n\x1b[90m--- Session Restored ---\x1b[0m\r\n'
      )
    })

    it('does not restore from backup when in-memory cache exists', async () => {
      useTerminalStore.getState().saveBuffer('task-cache-priority', 'in-memory-content', 0)

      const { useQuery } = await import('@tanstack/react-query')
      vi.mocked(useQuery).mockReturnValue({
        data: {
          content: 'Backup content (should not be used)',
          metadata: null,
        },
        isLoading: false,
        error: null,
      } as ReturnType<typeof useQuery>)

      renderHook(() =>
        useTaskTerminal({
          taskId: 'task-cache-priority',
          terminalRef: mockTerminalRef,
        })
      )

      await waitFor(() => {
        expect(commands.attachTaskTerminal).toHaveBeenCalled()
      })

      expect(mockTerminalRef.current?.write).toHaveBeenCalledWith('in-memory-content')
      expect(mockTerminalRef.current?.write).not.toHaveBeenCalledWith(
        expect.stringContaining('Session Restored')
      )
    })

    it('handles no backup gracefully', async () => {
      renderHook(() =>
        useTaskTerminal({
          taskId: 'task-no-backup',
          terminalRef: mockTerminalRef,
        })
      )

      await waitFor(() => {
        expect(commands.attachTaskTerminal).toHaveBeenCalled()
      })

      expect(mockTerminalRef.current?.write).not.toHaveBeenCalled()
    })

    it('returns isRestoringScrollback state', () => {
      const { result } = renderHook(() =>
        useTaskTerminal({
          taskId: 'task-loading',
          terminalRef: mockTerminalRef,
        })
      )

      expect(result.current.isRestoringScrollback).toBeDefined()
    })
  })

  describe('session state detection (TES-1.10)', () => {
    it('returns sessionState "live" when attached to tmux session', async () => {
      const { result } = renderHook(() =>
        useTaskTerminal({
          taskId: 'task-live',
          terminalRef: mockTerminalRef,
        })
      )

      await waitFor(() => {
        expect(result.current.isAttached).toBe(true)
      })

      expect(result.current.sessionState).toBe('live')
    })

    it('returns sessionState "restored" when backup exists but no live session', async () => {
      const { useQuery } = await import('@tanstack/react-query')
      vi.mocked(useQuery).mockReturnValue({
        data: {
          content: 'Historical scrollback content',
          metadata: { last_backup: Date.now(), size: 200 },
        },
        isLoading: false,
        error: null,
      } as ReturnType<typeof useQuery>)

      commands.attachTaskTerminal.mockResolvedValue({
        status: 'ok',
        data: { process_id: '', attached: false },
      })

      const { result } = renderHook(() =>
        useTaskTerminal({
          taskId: 'task-historical',
          terminalRef: mockTerminalRef,
        })
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.sessionState).toBe('restored')
    })

    it('returns sessionState "none" when no backup and no live session', async () => {
      commands.attachTaskTerminal.mockResolvedValue({
        status: 'ok',
        data: { process_id: '', attached: false },
      })

      const { result } = renderHook(() =>
        useTaskTerminal({
          taskId: 'task-empty',
          terminalRef: mockTerminalRef,
        })
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.sessionState).toBe('none')
    })

    it('returns null lastBackupTime when no backup metadata', async () => {
      const { result } = renderHook(() =>
        useTaskTerminal({
          taskId: 'task-no-metadata',
          terminalRef: mockTerminalRef,
        })
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.lastBackupTime).toBeNull()
    })
  })

  describe('session end/stall detection via Tauri Events (TES-1.11)', () => {
    it('returns sessionState "ended" when pty:session-status ended event fires', async () => {
      const { result } = renderHook(() =>
        useTaskTerminal({
          taskId: 'task-ended',
          terminalRef: mockTerminalRef,
        })
      )

      await waitFor(() => expect(result.current.isAttached).toBe(true))

      act(() => {
        emitEvent('pty:session-status', { task_id: 'task-ended', status: 'ended' })
      })

      expect(result.current.sessionState).toBe('ended')
    })

    it('returns sessionState "stalled" when pty:session-status stalled event fires', async () => {
      const { result } = renderHook(() =>
        useTaskTerminal({
          taskId: 'task-stalled',
          terminalRef: mockTerminalRef,
        })
      )

      await waitFor(() => expect(result.current.isAttached).toBe(true))

      act(() => {
        emitEvent('pty:session-status', { task_id: 'task-stalled', status: 'stalled' })
      })

      expect(result.current.sessionState).toBe('stalled')
    })

    it('recovers from stalled state when recovered event fires', async () => {
      const { result } = renderHook(() =>
        useTaskTerminal({
          taskId: 'task-recover',
          terminalRef: mockTerminalRef,
        })
      )

      await waitFor(() => expect(result.current.isAttached).toBe(true))

      act(() => {
        emitEvent('pty:session-status', { task_id: 'task-recover', status: 'stalled' })
      })
      expect(result.current.sessionState).toBe('stalled')

      act(() => {
        emitEvent('pty:session-status', { task_id: 'task-recover', status: 'recovered' })
      })
      expect(result.current.sessionState).toBe('live')
    })

    it('ended state takes precedence over stalled state', async () => {
      const { result } = renderHook(() =>
        useTaskTerminal({
          taskId: 'task-precedence',
          terminalRef: mockTerminalRef,
        })
      )

      await waitFor(() => expect(result.current.isAttached).toBe(true))

      act(() => {
        emitEvent('pty:session-status', { task_id: 'task-precedence', status: 'stalled' })
      })
      expect(result.current.sessionState).toBe('stalled')

      act(() => {
        emitEvent('pty:session-status', { task_id: 'task-precedence', status: 'ended' })
      })
      expect(result.current.sessionState).toBe('ended')
    })

    it('ignores pty:session-status events for other task IDs', async () => {
      const { result } = renderHook(() =>
        useTaskTerminal({
          taskId: 'task-mine',
          terminalRef: mockTerminalRef,
        })
      )

      await waitFor(() => expect(result.current.isAttached).toBe(true))

      act(() => {
        emitEvent('pty:session-status', { task_id: 'task-other', status: 'ended' })
      })

      expect(result.current.sessionState).toBe('live')
    })

    it('detaches from pty when pty:exit event fires for active process', async () => {
      const { result } = renderHook(() =>
        useTaskTerminal({
          taskId: 'task-exit',
          terminalRef: mockTerminalRef,
        })
      )

      await waitFor(() => expect(result.current.isAttached).toBe(true))

      act(() => {
        emitEvent('pty:exit', { process_id: 'pty-123', exit_code: 0 })
      })

      await waitFor(() => {
        expect(result.current.isAttached).toBe(false)
      })
    })
  })
})

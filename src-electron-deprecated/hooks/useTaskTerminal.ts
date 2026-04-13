import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { commands } from '@renderer/lib/rspc'
import { Channel } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { useQuery } from '@tanstack/react-query'
import type { XTerminalRef } from '@renderer/components/terminal/XTerminal'
import { useTerminalStore } from '@renderer/stores/terminal.store'

interface UseTaskTerminalOptions {
  /** Task ID to attach terminal for */
  taskId: string
  /** Ref to the XTerminal component for writing output */
  terminalRef: React.RefObject<XTerminalRef | null>
}

/**
 * Session state for terminal display.
 *
 * TES-1.11: Added 'ended' and 'stalled' states for session lifecycle tracking.
 *
 * - 'live': Actively connected to tmux session
 * - 'restored': Viewing historical backup (no live session)
 * - 'ended': Session process has exited
 * - 'stalled': No output received for 5 minutes (warning state)
 * - 'none': No session and no backup
 */
export type SessionState = 'live' | 'restored' | 'ended' | 'stalled' | 'none'

interface UseTaskTerminalReturn {
  /** Whether terminal is successfully attached to tmux session */
  isAttached: boolean
  /** Whether attachment is in progress */
  isLoading: boolean
  /** Error message if attachment failed */
  error: string | null
  /** Whether scrollback is being restored from backup */
  isRestoringScrollback: boolean
  /**
   * Session state for UI rendering (TES-1.10)
   * - 'live': Actively connected to tmux session
   * - 'restored': Viewing historical backup (no live session)
   * - 'none': No session and no backup
   */
  sessionState: SessionState
  /**
   * Last backup timestamp for UI display (TES-1.10)
   * Shows "Last active: X hours ago" in restored state
   */
  lastBackupTime: number | null
  /** Write data to terminal (user input) */
  write: (data: string) => void
  /** Resize terminal dimensions */
  resize: (cols: number, rows: number) => void
}

/**
 * Hook to connect XTerminal to a task's tmux session via tauri-specta commands.
 *
 * Handles:
 * - Restoring scrollback from filesystem backup after app restart (TES-1.9)
 * - Restoring in-memory buffer for navigation within session (TES-1.6)
 * - Spawning PTY process that attaches to tmux session
 * - Writing user input to PTY
 * - Subscribing to PTY output via Tauri Channel and writing to xterm
 * - Subscribing to PTY exit and session status events via Tauri Events
 * - Resizing PTY on terminal resize
 * - Cleanup on unmount (detaches from tmux but leaves session running)
 *
 * @see TES-1.4: xterm.js Terminal Attachment
 * @see TES-1.6: Terminal Persistence Across Navigation
 * @see TES-1.9: Scrollback Restoration After App Restart
 */
export function useTaskTerminal({
  taskId,
  terminalRef
}: UseTaskTerminalOptions): UseTaskTerminalReturn {
  const [isAttached, setIsAttached] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isRestoringScrollback, setIsRestoringScrollback] = useState(false)
  // Use state for processId so event listeners re-register when it changes
  const [processId, setProcessId] = useState<string | null>(null)
  const lastDimensionsRef = useRef<{ cols: number; rows: number } | null>(null)
  // Track if backup scrollback was restored to avoid duplicate restoration
  const backupRestoredRef = useRef(false)

  // TES-1.9: Query for scrollback backup restoration
  const scrollbackQuery = useQuery({
    queryKey: ['scrollback', taskId],
    queryFn: async () => {
      const result = await commands.getScrollbackBackup(taskId)
      if (result.status === 'error') throw new Error(JSON.stringify(result.error))
      return result.data
    },
    enabled: !!taskId,
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
  })

  // Track if backup was successfully restored (TES-1.10)
  const [hasRestoredBackup, setHasRestoredBackup] = useState(false)

  // TES-1.11: Track session end/stall status
  const [sessionEnded, setSessionEnded] = useState(false)
  const [sessionStalled, setSessionStalled] = useState(false)

  // Track processId for cleanup — need ref to avoid stale closure in cleanup
  const processIdForCleanupRef = useRef<string | null>(null)

  // Keep cleanup ref in sync with state
  useEffect(() => {
    processIdForCleanupRef.current = processId
  }, [processId])

  // Listen to pty:exit Tauri Event
  useEffect(() => {
    if (!processId) return
    let unlisten: (() => void) | undefined

    listen<{ process_id: string; task_id?: string; exit_code: number }>('pty:exit', (event) => {
      if (event.payload.process_id !== processId) return
      terminalRef.current?.write(
        `\r\n\x1b[90m[Terminal detached with code ${event.payload.exit_code}]\x1b[0m\r\n`
      )
      setIsAttached(false)
      setProcessId(null)
    }).then((fn) => {
      unlisten = fn
    })

    return () => {
      unlisten?.()
    }
  }, [processId, terminalRef])

  // TES-1.11: Listen to pty:session-status Tauri Event
  useEffect(() => {
    if (!taskId) return
    let unlisten: (() => void) | undefined

    listen<{ task_id: string; status: string }>('pty:session-status', (event) => {
      if (event.payload.task_id !== taskId) return
      if (event.payload.status === 'ended') {
        setSessionEnded(true)
        setSessionStalled(false)
        setIsAttached(false)
        terminalRef.current?.write('\r\n\x1b[90m[Session ended]\x1b[0m\r\n')
      } else if (event.payload.status === 'stalled') {
        setSessionStalled(true)
      } else if (event.payload.status === 'recovered') {
        setSessionStalled(false)
      }
    }).then((fn) => {
      unlisten = fn
    })

    return () => {
      unlisten?.()
    }
  }, [taskId, terminalRef])

  // Attach to tmux session on mount
  useEffect(() => {
    let cancelled = false

    async function attach(): Promise<void> {
      try {
        setIsLoading(true)
        setError(null)

        // Check for cached buffer first (TES-1.6: in-memory cache for navigation)
        const cachedBuffer = useTerminalStore.getState().getBuffer(taskId)
        const hasInMemoryCache = !!cachedBuffer

        // TES-1.9: Restore from filesystem backup if no in-memory cache
        if (!hasInMemoryCache && !backupRestoredRef.current && terminalRef.current) {
          if (!scrollbackQuery.isLoading) {
            const backupContent = scrollbackQuery.data?.content
            if (backupContent) {
              setIsRestoringScrollback(true)
              try {
                terminalRef.current.write(backupContent)
                terminalRef.current.write('\r\n\x1b[90m--- Session Restored ---\x1b[0m\r\n')
                backupRestoredRef.current = true
                setHasRestoredBackup(true)
              } catch {
                console.warn('[useTaskTerminal] Failed to write restored scrollback')
              }
              setIsRestoringScrollback(false)
            }
          }
        }

        // TES-1.6: Restore cached buffer if available
        if (hasInMemoryCache && terminalRef.current) {
          try {
            terminalRef.current.write(cachedBuffer.serializedBuffer)
            if (cachedBuffer.scrollPosition > 0) {
              terminalRef.current.scrollToLine(cachedBuffer.scrollPosition)
            }
          } catch {
            // Ignore restoration errors
          }
        }

        // Get terminal dimensions
        const dimensions = terminalRef.current?.getDimensions()

        // Create Tauri Channel for PTY output streaming
        const decoder = new TextDecoder()
        const channel = new Channel<number[]>()
        channel.onmessage = (data) => {
          terminalRef.current?.write(decoder.decode(new Uint8Array(data)))
        }

        const result = await commands.attachTaskTerminal(
          taskId,
          dimensions?.cols ?? null,
          dimensions?.rows ?? null,
          channel
        )

        if (result.status === 'error') {
          throw new Error(JSON.stringify(result.error))
        }

        if (cancelled) {
          // Component unmounted during attach, clean up
          if (result.data.process_id) {
            commands.detachTaskTerminal(result.data.process_id).catch(() => {})
          }
          return
        }

        if (!result.data.attached || !result.data.process_id) {
          setIsAttached(false)
          setIsLoading(false)
          return
        }

        setProcessId(result.data.process_id)
        setIsAttached(true)
        setIsLoading(false)

        // TES-1.11: Start session monitor (fire and forget)
        commands.startSessionMonitor(taskId).catch((e) =>
          console.warn('[useTaskTerminal] startSessionMonitor error:', e)
        )
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to attach terminal')
          setIsLoading(false)
        }
      }
    }

    attach()

    // Cleanup: save buffer and detach from tmux on unmount
    return () => {
      cancelled = true

      // TES-1.6: Save terminal buffer before detaching
      if (terminalRef.current) {
        try {
          const serialized = terminalRef.current.serialize()
          const scrollPos = terminalRef.current.getScrollPosition()
          if (serialized) {
            useTerminalStore.getState().saveBuffer(taskId, serialized, scrollPos)
          }
        } catch {
          // Ignore serialization errors during cleanup
        }
      }

      if (processIdForCleanupRef.current) {
        commands.detachTaskTerminal(processIdForCleanupRef.current).catch(() => {})
        processIdForCleanupRef.current = null
        setProcessId(null)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId])

  // Write data to PTY
  const write = useCallback(
    (data: string) => {
      if (!processId) return
      commands.writePty(processId, data).catch((e) =>
        console.warn('[useTaskTerminal] Write error:', e)
      )
    },
    [processId]
  )

  // Resize PTY
  const resize = useCallback(
    (cols: number, rows: number) => {
      if (!processId) return

      const last = lastDimensionsRef.current
      if (last && last.cols === cols && last.rows === rows) return

      lastDimensionsRef.current = { cols, rows }
      commands.resizePty(processId, cols, rows).catch((e) =>
        console.warn('[useTaskTerminal] Resize error:', e)
      )
    },
    [processId]
  )

  // TES-1.10 + TES-1.11: Compute session state for UI rendering
  const sessionState: SessionState = useMemo(() => {
    if (sessionEnded) return 'ended'
    if (sessionStalled && isAttached && processId) return 'stalled'
    if (isAttached && processId) return 'live'
    if (hasRestoredBackup) return 'restored'
    return 'none'
  }, [isAttached, processId, hasRestoredBackup, sessionEnded, sessionStalled])

  // TES-1.10: Get last backup timestamp for UI display
  const lastBackupTime = useMemo((): number | null => {
    const raw = scrollbackQuery.data?.metadata?.last_backup
    if (raw == null) return null
    return typeof raw === 'number' ? raw : Number(raw)
  }, [scrollbackQuery.data?.metadata?.last_backup])

  return {
    isAttached,
    isLoading,
    error,
    isRestoringScrollback,
    sessionState,
    lastBackupTime,
    write,
    resize
  }
}

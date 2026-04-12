import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { trpc } from '@renderer/lib/trpc'
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
 * Hook to connect XTerminal to a task's tmux session via tRPC.
 *
 * Handles:
 * - Restoring scrollback from filesystem backup after app restart (TES-1.9)
 * - Restoring in-memory buffer for navigation within session (TES-1.6)
 * - Spawning PTY process that attaches to tmux session
 * - Writing user input to PTY
 * - Subscribing to PTY output and writing to xterm
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
  // Use state for processId so subscriptions re-subscribe when it changes
  const [processId, setProcessId] = useState<string | null>(null)
  const lastDimensionsRef = useRef<{ cols: number; rows: number } | null>(null)
  // Track if backup scrollback was restored to avoid duplicate restoration
  const backupRestoredRef = useRef(false)

  // tRPC mutations for terminal attachment
  const attachMutation = trpc.agent.attachTaskTerminal.useMutation()
  const detachMutation = trpc.agent.detachTaskTerminal.useMutation()

  // TES-1.9: Query for scrollback backup restoration
  // Note: This query is integrated here rather than using a separate useScrollbackRestore hook
  // because we need to coordinate with the in-memory cache check (TES-1.6) and attachment flow.
  const scrollbackQuery = trpc.agent.getScrollbackBackup.useQuery(
    { taskId },
    {
      enabled: !!taskId,
      staleTime: Infinity, // Backup is static - no refetch
      retry: false,
      refetchOnWindowFocus: false
    }
  )

  // tRPC mutations for PTY interaction (reuse existing pty router)
  const writeMutation = trpc.pty.write.useMutation({
    onError: (err) => {
      console.warn('[useTaskTerminal] Write error:', err.message)
    }
  })
  const resizeMutation = trpc.pty.resize.useMutation({
    onError: (err) => {
      console.warn('[useTaskTerminal] Resize error:', err.message)
    }
  })

  // Subscribe to PTY output when attached
  // Using processId state ensures subscription re-subscribes when processId changes
  trpc.pty.onOutput.useSubscription(
    { processId: processId ?? '' },
    {
      enabled: isAttached && !!processId,
      onData: (event) => {
        terminalRef.current?.write(event.data)
      }
    }
  )

  // Subscribe to PTY exit events
  trpc.pty.onExit.useSubscription(
    { processId: processId ?? '' },
    {
      enabled: isAttached && !!processId,
      onData: (event) => {
        // Display exit message in terminal
        terminalRef.current?.write(
          `\r\n\x1b[90m[Terminal detached with code ${event.exitCode}${event.signal ? `, signal ${event.signal}` : ''}]\x1b[0m\r\n`
        )
        setIsAttached(false)
        setProcessId(null)
      }
    }
  )

  // Track if backup was successfully restored (TES-1.10)
  const [hasRestoredBackup, setHasRestoredBackup] = useState(false)

  // TES-1.11: Track session end/stall status
  const [sessionEnded, setSessionEnded] = useState(false)
  const [sessionStalled, setSessionStalled] = useState(false)

  // Track processId for cleanup - need ref to avoid stale closure in cleanup
  const processIdForCleanupRef = useRef<string | null>(null)

  // Keep cleanup ref in sync with state
  useEffect(() => {
    processIdForCleanupRef.current = processId
  }, [processId])

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

        // TES-1.9: Restore from filesystem backup if:
        // 1. No in-memory cache exists (app was restarted)
        // 2. Backup content exists
        // Only restore once per mount to avoid duplicates
        //
        // Gap Detection (AC #2): When a tmux session survives app restart, we need to
        // prepend the backup scrollback. This is implicitly handled here - if there's
        // no in-memory cache (app restarted) but backup exists, we restore it before
        // attaching to the live session. The "gap" is the period between our last
        // backup and the current session state.
        if (!hasInMemoryCache && !backupRestoredRef.current && terminalRef.current) {
          // Only proceed with restoration if query has completed loading
          if (!scrollbackQuery.isLoading) {
            const backupContent = scrollbackQuery.data?.content
            if (backupContent) {
              setIsRestoringScrollback(true)
              try {
                // Write restored scrollback to terminal
                terminalRef.current.write(backupContent)
                // Add separator to indicate restored content
                terminalRef.current.write('\r\n\x1b[90m--- Session Restored ---\x1b[0m\r\n')
                backupRestoredRef.current = true
                setHasRestoredBackup(true) // TES-1.10: Track successful restoration
              } catch {
                console.warn('[useTaskTerminal] Failed to write restored scrollback')
              }
              setIsRestoringScrollback(false)
            }
          }
        }

        // TES-1.6: Restore cached buffer if available (takes precedence over backup
        // since it's more recent - from within the current session)
        if (hasInMemoryCache && terminalRef.current) {
          try {
            terminalRef.current.write(cachedBuffer.serializedBuffer)
            // Restore scroll position after buffer is written
            if (cachedBuffer.scrollPosition > 0) {
              terminalRef.current.scrollToLine(cachedBuffer.scrollPosition)
            }
          } catch {
            // Ignore restoration errors
          }
        }

        // Get terminal dimensions
        const dimensions = terminalRef.current?.getDimensions()

        const result = await attachMutation.mutateAsync({
          taskId,
          cols: dimensions?.cols,
          rows: dimensions?.rows
        })

        if (cancelled) {
          // Component unmounted during attach, clean up
          if (result.processId) {
            detachMutation.mutate({ processId: result.processId })
          }
          return
        }

        if (!result.attached || !result.processId) {
          // No active session for this task
          setIsAttached(false)
          setIsLoading(false)
          return
        }

        setProcessId(result.processId)
        setIsAttached(true)
        setIsLoading(false)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to attach terminal')
          setIsLoading(false)
        }
      }
    }

    attach()

    // Cleanup: save buffer and detach from tmux on unmount (but don't kill the tmux session)
    return () => {
      cancelled = true

      // TES-1.6: Save terminal buffer before detaching for seamless navigation
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
        detachMutation.mutate({ processId: processIdForCleanupRef.current })
        processIdForCleanupRef.current = null
        setProcessId(null)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId])

  // TES-1.11: Subscribe to session status changes
  trpc.agent.onSessionStatusChange.useSubscription(
    { taskId },
    {
      enabled: !!taskId,
      onData: (event) => {
        if (event.status === 'ended') {
          setSessionEnded(true)
          setSessionStalled(false)
          setIsAttached(false)
          // Write session ended message to terminal
          terminalRef.current?.write(
            '\r\n\x1b[90m[Session ended]\x1b[0m\r\n'
          )
        } else if (event.status === 'stalled') {
          setSessionStalled(true)
        } else if (event.status === 'recovered') {
          setSessionStalled(false)
        }
      }
    }
  )

  // TES-1.11: Start session monitor when attached
  const startMonitorMutation = trpc.agent.startSessionMonitor.useMutation()

  useEffect(() => {
    if (isAttached && taskId) {
      startMonitorMutation.mutate({ taskId })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAttached, taskId])

  // Write data to PTY
  const write = useCallback((data: string) => {
    if (!processId) return
    writeMutation.mutate({ processId, data })
  }, [processId, writeMutation])

  // Resize PTY
  const resize = useCallback(
    (cols: number, rows: number) => {
      if (!processId) return

      // Avoid redundant resize calls
      const last = lastDimensionsRef.current
      if (last && last.cols === cols && last.rows === rows) return

      lastDimensionsRef.current = { cols, rows }
      resizeMutation.mutate({ processId, cols, rows })
    },
    [processId, resizeMutation]
  )

  // TES-1.10 + TES-1.11: Compute session state for UI rendering
  const sessionState: SessionState = useMemo(() => {
    // TES-1.11: Session ended takes precedence
    if (sessionEnded) return 'ended'
    // TES-1.11: Stalled is a warning state for live sessions
    if (sessionStalled && isAttached && processId) return 'stalled'
    // Live session
    if (isAttached && processId) return 'live'
    // Restored from backup
    if (hasRestoredBackup) return 'restored'
    return 'none'
  }, [isAttached, processId, hasRestoredBackup, sessionEnded, sessionStalled])

  // TES-1.10: Get last backup timestamp for UI display
  const lastBackupTime = useMemo((): number | null => {
    const raw = scrollbackQuery.data?.metadata?.lastBackup
    if (raw == null) return null
    return typeof raw === 'number' ? raw : Number(raw)
  }, [scrollbackQuery.data?.metadata?.lastBackup])

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

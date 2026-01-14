import { useEffect, useRef, useState, useCallback } from 'react'
import { trpc } from '@renderer/lib/trpc'
import type { XTerminalRef } from '@renderer/components/terminal/XTerminal'
import { useTerminalStore } from '@renderer/stores/terminal.store'

interface UseTaskTerminalOptions {
  /** Task ID to attach terminal for */
  taskId: string
  /** Ref to the XTerminal component for writing output */
  terminalRef: React.RefObject<XTerminalRef | null>
}

interface UseTaskTerminalReturn {
  /** Whether terminal is successfully attached to tmux session */
  isAttached: boolean
  /** Whether attachment is in progress */
  isLoading: boolean
  /** Error message if attachment failed */
  error: string | null
  /** Write data to terminal (user input) */
  write: (data: string) => void
  /** Resize terminal dimensions */
  resize: (cols: number, rows: number) => void
}

/**
 * Hook to connect XTerminal to a task's tmux session via tRPC.
 *
 * Handles:
 * - Spawning PTY process that attaches to tmux session
 * - Writing user input to PTY
 * - Subscribing to PTY output and writing to xterm
 * - Resizing PTY on terminal resize
 * - Cleanup on unmount (detaches from tmux but leaves session running)
 *
 * @see TES-1.4: xterm.js Terminal Attachment
 */
export function useTaskTerminal({
  taskId,
  terminalRef
}: UseTaskTerminalOptions): UseTaskTerminalReturn {
  const [isAttached, setIsAttached] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Use state for processId so subscriptions re-subscribe when it changes
  const [processId, setProcessId] = useState<string | null>(null)
  const lastDimensionsRef = useRef<{ cols: number; rows: number } | null>(null)

  // tRPC mutations for terminal attachment
  const attachMutation = trpc.agent.attachTaskTerminal.useMutation()
  const detachMutation = trpc.agent.detachTaskTerminal.useMutation()

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

        // TES-1.6: Restore cached buffer before attaching
        // This shows previous output immediately for seamless navigation
        const cachedBuffer = useTerminalStore.getState().getBuffer(taskId)
        if (cachedBuffer && terminalRef.current) {
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

  return {
    isAttached,
    isLoading,
    error,
    write,
    resize
  }
}

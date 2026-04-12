import { useCallback, useEffect, useRef } from 'react'
import { trpc } from '@renderer/lib/trpc'
import { useTerminalStore } from '@renderer/stores'
import type { XTerminalRef } from '@renderer/components/terminal/XTerminal'

interface UseTerminalOptions {
  /** Ref to the XTerminal component */
  terminalRef: React.RefObject<XTerminalRef | null>
  /** Optional callback when process exits */
  onExit?: (exitCode: number, signal?: number) => void
}

interface UseTerminalReturn {
  /** Spawn a new terminal process */
  spawn: (options?: { command?: string; args?: string[]; cwd?: string }) => Promise<string>
  /** Write data to the terminal */
  write: (data: string) => void
  /** Kill the current process */
  kill: () => void
  /** Resize the terminal */
  resize: (cols: number, rows: number) => void
  /** Whether a process is currently running */
  isRunning: boolean
  /** Current process ID */
  processId: string | null
}

/**
 * Hook to connect XTerminal to the PTY service via tRPC.
 *
 * Handles:
 * - Spawning PTY processes
 * - Writing user input to PTY
 * - Subscribing to PTY output and writing to xterm
 * - Subscribing to PTY exit events
 * - Resizing PTY on terminal resize
 * - Cleanup on unmount
 */
export function useTerminal({ terminalRef, onExit }: UseTerminalOptions): UseTerminalReturn {
  const { activeProcessId, setActiveProcess } = useTerminalStore()
  const lastDimensionsRef = useRef<{ cols: number; rows: number } | null>(null)
  // Track processId in ref for cleanup to avoid stale closure
  const activeProcessIdRef = useRef<string | null>(null)
  activeProcessIdRef.current = activeProcessId

  // Helper to write error message to terminal
  const writeError = useCallback(
    (message: string) => {
      terminalRef.current?.write(`\r\n\x1b[31m[Error] ${message}\x1b[0m\r\n`)
    },
    [terminalRef]
  )

  // tRPC mutations with error handling
  const spawnMutation = trpc.pty.spawn.useMutation({
    onError: (error) => {
      writeError(`Failed to spawn process: ${error.message}`)
    }
  })
  const writeMutation = trpc.pty.write.useMutation({
    onError: (error) => {
      writeError(`Failed to write to process: ${error.message}`)
    }
  })
  const killMutation = trpc.pty.kill.useMutation({
    onError: (error) => {
      writeError(`Failed to kill process: ${error.message}`)
    }
  })
  const resizeMutation = trpc.pty.resize.useMutation({
    onError: (error) => {
      // Resize errors are less critical, log but don't show to user
      console.warn('[Terminal] Resize error:', error.message)
    }
  })

  // Subscribe to output when we have an active process
  trpc.pty.onOutput.useSubscription(
    { processId: activeProcessId ?? '' },
    {
      enabled: !!activeProcessId,
      onData: (event) => {
        terminalRef.current?.write(event.data)
      }
    }
  )

  // Subscribe to exit events
  trpc.pty.onExit.useSubscription(
    { processId: activeProcessId ?? '' },
    {
      enabled: !!activeProcessId,
      onData: (event) => {
        // Display exit message in terminal
        terminalRef.current?.write(
          `\r\n\x1b[90m[Process exited with code ${event.exitCode}${event.signal ? `, signal ${event.signal}` : ''}]\x1b[0m\r\n`
        )
        setActiveProcess(null)
        onExit?.(event.exitCode, event.signal)
      }
    }
  )

  // Spawn a new terminal process
  const spawn = useCallback(
    async (options?: { command?: string; args?: string[]; cwd?: string }): Promise<string> => {
      // Kill existing process if any
      if (activeProcessId) {
        killMutation.mutate({ processId: activeProcessId })
        setActiveProcess(null)
      }

      // Get current terminal dimensions
      const dimensions = terminalRef.current?.getDimensions()

      const processId = await spawnMutation.mutateAsync({
        command: options?.command,
        args: options?.args ?? [],
        cwd: options?.cwd,
        cols: dimensions?.cols,
        rows: dimensions?.rows
      })

      setActiveProcess(processId)
      return processId
    },
    [activeProcessId, spawnMutation, killMutation, setActiveProcess, terminalRef]
  )

  // Write data to the terminal
  const write = useCallback(
    (data: string) => {
      if (!activeProcessId) return
      writeMutation.mutate({ processId: activeProcessId, data })
    },
    [activeProcessId, writeMutation]
  )

  // Kill the current process
  const kill = useCallback(() => {
    if (!activeProcessId) return
    killMutation.mutate({ processId: activeProcessId })
    setActiveProcess(null)
  }, [activeProcessId, killMutation, setActiveProcess])

  // Resize the terminal
  const resize = useCallback(
    (cols: number, rows: number) => {
      if (!activeProcessId) return

      // Avoid sending redundant resize calls
      const last = lastDimensionsRef.current
      if (last && last.cols === cols && last.rows === rows) return

      lastDimensionsRef.current = { cols, rows }
      resizeMutation.mutate({ processId: activeProcessId, cols, rows })
    },
    [activeProcessId, resizeMutation]
  )

  // Cleanup on unmount - kill process using ref to get current value
  useEffect(() => {
    return () => {
      const currentProcessId = activeProcessIdRef.current
      if (currentProcessId) {
        killMutation.mutate({ processId: currentProcessId })
      }
    }
    // Only run on unmount - using ref avoids stale closure issue
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    spawn,
    write,
    kill,
    resize,
    isRunning: !!activeProcessId,
    processId: activeProcessId
  }
}

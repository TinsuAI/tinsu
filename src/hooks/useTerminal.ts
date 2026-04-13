import { useCallback, useEffect, useRef } from 'react'
import { commands } from '@renderer/lib/rspc'
import { Channel } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { useTerminalStore } from '@renderer/stores'
import type { XTerminalRef } from '@renderer/components/terminal/XTerminal'

interface UseTerminalOptions {
  /** Ref to the XTerminal component */
  terminalRef: React.RefObject<XTerminalRef | null>
  /** Optional callback when process exits */
  onExit?: (exitCode: number) => void
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
 * Hook to connect XTerminal to the PTY service via tauri-specta commands.
 *
 * Handles:
 * - Spawning PTY processes via Tauri Channel for output streaming
 * - Writing user input to PTY
 * - Listening to PTY exit events via Tauri Event
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

  // Listen to PTY exit events for the active process
  useEffect(() => {
    if (!activeProcessId) return
    let unlisten: (() => void) | undefined

    listen<{ process_id: string; task_id?: string; exit_code: number }>('pty:exit', (event) => {
      if (event.payload.process_id !== activeProcessId) return
      terminalRef.current?.write(
        `\r\n\x1b[90m[Process exited with code ${event.payload.exit_code}]\x1b[0m\r\n`
      )
      setActiveProcess(null)
      onExit?.(event.payload.exit_code)
    }).then((fn) => {
      unlisten = fn
    })

    return () => {
      unlisten?.()
    }
  }, [activeProcessId, terminalRef, setActiveProcess, onExit])

  // Spawn a new terminal process
  const spawn = useCallback(
    async (options?: { command?: string; args?: string[]; cwd?: string }): Promise<string> => {
      // Kill existing process if any
      if (activeProcessId) {
        commands.killPty(activeProcessId).catch((e) =>
          console.warn('[useTerminal] Kill existing process error:', e)
        )
        setActiveProcess(null)
      }

      // Get current terminal dimensions
      const dimensions = terminalRef.current?.getDimensions()

      // Create Tauri Channel for PTY output streaming
      const decoder = new TextDecoder()
      const channel = new Channel<number[]>()
      channel.onmessage = (data) => {
        terminalRef.current?.write(decoder.decode(new Uint8Array(data)))
      }

      const result = await commands.spawnPty(
        options?.command ?? null,
        options?.args ?? [],
        options?.cwd ?? null,
        dimensions?.cols ?? null,
        dimensions?.rows ?? null,
        channel
      )

      if (result.status === 'error') {
        const errMsg = JSON.stringify(result.error)
        writeError(`Failed to spawn process: ${errMsg}`)
        throw new Error(errMsg)
      }

      const processId = result.data
      setActiveProcess(processId)
      return processId
    },
    [activeProcessId, setActiveProcess, terminalRef, writeError]
  )

  // Write data to the terminal
  const write = useCallback(
    (data: string) => {
      if (!activeProcessId) return
      commands.writePty(activeProcessId, data).catch((e) =>
        writeError(`Failed to write to process: ${e}`)
      )
    },
    [activeProcessId, writeError]
  )

  // Kill the current process
  const kill = useCallback(() => {
    if (!activeProcessId) return
    commands.killPty(activeProcessId).catch((e) =>
      writeError(`Failed to kill process: ${e}`)
    )
    setActiveProcess(null)
  }, [activeProcessId, setActiveProcess, writeError])

  // Resize the terminal
  const resize = useCallback(
    (cols: number, rows: number) => {
      if (!activeProcessId) return

      const last = lastDimensionsRef.current
      if (last && last.cols === cols && last.rows === rows) return

      lastDimensionsRef.current = { cols, rows }
      commands.resizePty(activeProcessId, cols, rows).catch((e) =>
        console.warn('[Terminal] Resize error:', e)
      )
    },
    [activeProcessId]
  )

  // Cleanup on unmount — kill process using ref to get current value
  useEffect(() => {
    return () => {
      const currentProcessId = activeProcessIdRef.current
      if (currentProcessId) {
        commands.killPty(currentProcessId).catch(() => {})
      }
    }
    // Only run on unmount — using ref avoids stale closure issue
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

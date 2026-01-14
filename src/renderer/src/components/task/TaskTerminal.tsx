import { useRef } from 'react'
import { useTaskTerminal } from '@renderer/hooks/useTaskTerminal'
import { XTerminal, type XTerminalRef } from '@renderer/components/terminal/XTerminal'

interface TaskTerminalProps {
  /** Task ID to show terminal for */
  taskId: string
}

/**
 * TaskTerminal component - displays a task's tmux session in xterm.js.
 *
 * Automatically attaches to the task's tmux session when mounted and
 * detaches when unmounted. Shows appropriate states for:
 * - Loading: "Connecting to terminal..."
 * - No session: "No active session"
 * - Error: Error message
 * - Attached: Live terminal output
 *
 * User input is forwarded to the tmux session, and resize events
 * are synchronized with the PTY.
 *
 * @see TES-1.4: xterm.js Terminal Attachment
 */
export function TaskTerminal({ taskId }: TaskTerminalProps) {
  const terminalRef = useRef<XTerminalRef>(null)

  const { isAttached, isLoading, error, write, resize } = useTaskTerminal({
    taskId,
    terminalRef
  })

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-500">
        Connecting to terminal...
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-red-500">
        Failed to connect: {error}
      </div>
    )
  }

  // No active session state (AC: #3)
  if (!isAttached) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-500">
        No active session
      </div>
    )
  }

  // Attached state - show live terminal
  return (
    <div className="w-full h-full">
      <XTerminal ref={terminalRef} onData={write} onResize={resize} />
    </div>
  )
}

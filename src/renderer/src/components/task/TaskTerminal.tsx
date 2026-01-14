import { forwardRef, useRef, useImperativeHandle } from 'react'
import { useTaskTerminal } from '@renderer/hooks/useTaskTerminal'
import { XTerminal, type XTerminalRef } from '@renderer/components/terminal/XTerminal'
import { TerminalInput } from './TerminalInput'

interface TaskTerminalProps {
  /** Task ID to show terminal for */
  taskId: string
}

/**
 * Ref type for TaskTerminal - exposes input focus control
 * for keyboard shortcuts (e.g., "/" to focus input)
 */
export interface TaskTerminalRef {
  /** Focus the command input field */
  focusInput: () => void
}

/**
 * TaskTerminal component - displays a task's tmux session in xterm.js
 * with a command input field.
 *
 * Automatically attaches to the task's tmux session when mounted and
 * detaches when unmounted. Shows appropriate states for:
 * - Loading: "Connecting to terminal..."
 * - Restoring: "Restoring terminal history..." (TES-1.9)
 * - No session: "No active session"
 * - Error: Error message
 * - Attached: Live terminal output + command input
 *
 * User input is forwarded to the tmux session via the TerminalInput component,
 * and resize events are synchronized with the PTY.
 *
 * @see TES-1.4: xterm.js Terminal Attachment
 * @see TES-1.5: User Command Input
 * @see TES-1.9: Scrollback Restoration After App Restart
 */
export const TaskTerminal = forwardRef<TaskTerminalRef, TaskTerminalProps>(function TaskTerminal(
  { taskId },
  ref
) {
  const terminalRef = useRef<XTerminalRef>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Expose focusInput for keyboard shortcut (AC: #3)
  useImperativeHandle(
    ref,
    () => ({
      focusInput: () => inputRef.current?.focus()
    }),
    []
  )

  const { isAttached, isLoading, isRestoringScrollback, error, write, resize } = useTaskTerminal({
    taskId,
    terminalRef
  })

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-500">
        {isRestoringScrollback ? 'Restoring terminal history...' : 'Connecting to terminal...'}
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

  // No active session state (AC: #3 from TES-1.4)
  if (!isAttached) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-500">No active session</div>
    )
  }

  // Attached state - show live terminal with input field
  return (
    <div className="flex flex-col w-full h-full">
      <div className="flex-1 min-h-0">
        <XTerminal ref={terminalRef} onData={write} onResize={resize} />
      </div>
      <TerminalInput ref={inputRef} taskId={taskId} />
    </div>
  )
})

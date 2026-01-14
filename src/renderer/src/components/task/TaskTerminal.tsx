import { forwardRef, useRef, useImperativeHandle } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { useTaskTerminal, type SessionState } from '@renderer/hooks/useTaskTerminal'
import { XTerminal, type XTerminalRef } from '@renderer/components/terminal/XTerminal'
import { TerminalInput } from './TerminalInput'
import { Badge } from '@renderer/components/ui/badge'

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

  const { isAttached, isLoading, isRestoringScrollback, error, sessionState, lastBackupTime, write, resize } = useTaskTerminal({
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

  // No active session AND no restored content AND not ended (AC: #3 from TES-1.4)
  // TES-1.11: Show terminal for ended sessions to display historical content
  if (!isAttached && sessionState === 'none') {
    return (
      <div className="flex items-center justify-center h-full text-zinc-500">No active session</div>
    )
  }

  // TES-1.10: Determine if terminal should be interactive
  const isInteractive = sessionState === 'live'

  // TES-1.10 + TES-1.11: Render session state badge
  const renderSessionBadge = () => {
    if (sessionState === 'live') {
      return (
        <Badge variant="default" className="bg-green-600 hover:bg-green-700">
          Live
        </Badge>
      )
    }
    if (sessionState === 'stalled') {
      return (
        <Badge variant="secondary" className="bg-amber-600/20 text-amber-500 border-amber-600/30">
          Stalled
          <span className="ml-1 text-amber-400/70">(No output for 5 min)</span>
        </Badge>
      )
    }
    if (sessionState === 'ended') {
      return (
        <Badge variant="secondary" className="bg-zinc-600/20 text-zinc-400 border-zinc-600/30">
          Session ended
        </Badge>
      )
    }
    if (sessionState === 'restored') {
      return (
        <Badge variant="secondary" className="bg-amber-600/20 text-amber-500 border-amber-600/30">
          History restored
          {lastBackupTime && (
            <span className="ml-1 text-amber-400/70">
              ({formatDistanceToNow(new Date(lastBackupTime))} ago)
            </span>
          )}
        </Badge>
      )
    }
    return null
  }

  // Attached state OR restored state - show terminal with appropriate header
  return (
    <div className="flex flex-col w-full h-full">
      {/* TES-1.10: Terminal header with session state indicator */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-800 bg-zinc-900/50">
        <span className="text-xs text-zinc-500">Terminal</span>
        {renderSessionBadge()}
      </div>
      <div className="flex-1 min-h-0">
        <XTerminal ref={terminalRef} onData={isInteractive ? write : undefined} onResize={resize} />
      </div>
      {/* TES-1.10 + TES-1.11: Show appropriate footer based on session state */}
      {isInteractive || sessionState === 'stalled' ? (
        <TerminalInput ref={inputRef} taskId={taskId} />
      ) : sessionState === 'ended' ? (
        <div className="px-3 py-2 border-t border-zinc-800 bg-zinc-900/50 text-xs text-zinc-500">
          Session ended — Move task to In Progress to start a new session
        </div>
      ) : (
        <div className="px-3 py-2 border-t border-zinc-800 bg-zinc-900/50 text-xs text-zinc-500">
          Session inactive — Move task to In Progress to start a new session
        </div>
      )}
    </div>
  )
})

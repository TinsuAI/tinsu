import { forwardRef, useRef, useImperativeHandle } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { useTaskTerminal } from '@renderer/hooks/useTaskTerminal'
import { XTerminal, type XTerminalRef } from '@renderer/components/terminal/XTerminal'
import { MobileTerminal, type MobileTerminalRef } from '@renderer/components/terminal/MobileTerminal'
import { TerminalInput } from './TerminalInput'
import { Badge } from '@renderer/components/ui/badge'
import { useIsMobile } from '@renderer/hooks/useIsMobile'

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
 * @see t3-5: Mobile Terminal View
 */
export const TaskTerminal = forwardRef<TaskTerminalRef, TaskTerminalProps>(function TaskTerminal(
  { taskId },
  ref
) {
  const terminalRef = useRef<XTerminalRef>(null)
  const mobileTerminalRef = useRef<MobileTerminalRef>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const isMobile = useIsMobile()

  // Expose focusInput for keyboard shortcut (AC: #3)
  useImperativeHandle(
    ref,
    () => ({
      focusInput: () => {
        if (isMobile) {
          mobileTerminalRef.current?.focus()
        } else {
          inputRef.current?.focus()
        }
      }
    }),
    [isMobile]
  )

  // Use either mobile terminal ref or regular terminal ref for the hook
  const effectiveRef = isMobile ? (mobileTerminalRef as unknown as React.RefObject<XTerminalRef>) : terminalRef

  const { isAttached, isLoading, isRestoringScrollback, error, sessionState, lastBackupTime, write, resize } = useTaskTerminal({
    taskId,
    terminalRef: effectiveRef
  })

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
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
      <div className="flex items-center justify-center h-full text-muted-foreground">No active session</div>
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
        <Badge variant="secondary" className="bg-muted text-muted-foreground border-border">
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
      {/* t3-5: Show status badge on all screen sizes (was hidden on mobile) */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted/30">
        <span className="text-xs text-muted-foreground">Terminal</span>
        {renderSessionBadge()}
      </div>
      
      <div className="flex-1 min-h-0">
        {isMobile ? (
          <MobileTerminal
            ref={mobileTerminalRef}
            onData={isInteractive ? write : undefined}
            onResize={resize}
            sessionStatus={sessionState}
            onPause={() => {
              // t3-5: TODO - integrate with backend pause API
              // This will be implemented when agent pause/resume API is available
              console.log('Pause requested for task:', taskId)
            }}
            onResume={() => {
              // t3-5: TODO - integrate with backend resume API
              // This will be implemented when agent pause/resume API is available
              console.log('Resume requested for task:', taskId)
            }}
          />
        ) : (
          <XTerminal ref={terminalRef} onData={isInteractive ? write : undefined} onResize={resize} />
        )}
      </div>

      {/* TES-1.10 + TES-1.11: Show appropriate footer based on session state */}
      {!isMobile && (
        <>
          {isInteractive || sessionState === 'stalled' ? (
            <TerminalInput ref={inputRef} taskId={taskId} />
          ) : sessionState === 'ended' ? (
            <div className="px-3 py-2 border-t border-border bg-muted/30 text-xs text-muted-foreground">
              Session ended — Move task to In Progress to start a new session
            </div>
          ) : (
            <div className="px-3 py-2 border-t border-border bg-muted/30 text-xs text-muted-foreground">
              Session inactive — Move task to In Progress to start a new session
            </div>
          )}
        </>
      )}
    </div>
  )
})

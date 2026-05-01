/**
 * MobileTerminalTab — Terminal sub-tab for the mobile task workspace.
 *
 * Embeds the existing TaskTerminal (desktop cross-tree allowed, AC 16) inside a
 * flex column that fills the slide. Renders TerminalAccessoryBar below the
 * terminal as a sticky bottom strip.
 *
 * Key press handling (AC 7):
 *   - 'Ctrl' / 'Alt' keys → no-op (chord handling deferred; keys rendered disabled in v1).
 *   - '\t', '\x1b', arrow escape codes → call focusInput() to bring up soft keyboard.
 *     Full escape-sequence writing is deferred to a follow-up (TaskTerminalRef only
 *     exposes focusInput; TerminalInput's write path is internal).
 *
 * forwardRef: exposes focusInput() upward so screen action bar can call it.
 *
 * Token contract: bg-background fill wrapper only. Terminal interior uses its own
 * dark theme (xterm.js). No inline color classes on wrapper (AC 20).
 *
 * @see Story T3.5-4, AC 7
 */

import { forwardRef, useRef, useImperativeHandle } from 'react'
import { TaskTerminal, type TaskTerminalRef } from '@renderer/components/task/TaskTerminal'
import { TerminalAccessoryBar } from '@renderer/components/terminal/TerminalAccessoryBar'

export interface MobileTerminalTabRef {
  focusInput: () => void
}

interface MobileTerminalTabProps {
  taskId: string
}

export const MobileTerminalTab = forwardRef<MobileTerminalTabRef, MobileTerminalTabProps>(
  function MobileTerminalTab({ taskId }, ref) {
    const terminalRef = useRef<TaskTerminalRef>(null)

    // Expose focusInput upward (AC 6.4)
    useImperativeHandle(
      ref,
      () => ({
        focusInput: () => {
          terminalRef.current?.focusInput?.()
        },
      }),
      [],
    )

    /**
     * Handle key press from TerminalAccessoryBar (AC 7).
     *
     * v1 limitation:
     *   - Ctrl/Alt chord rows → no-op (deferred to follow-up).
     *   - All other keys (Tab, Esc, arrow codes) → focus the terminal input,
     *     bringing up the soft keyboard. Full escape-sequence injection into
     *     the xterm writeable stream is deferred (TaskTerminalRef only
     *     exposes focusInput, not write).
     */
    const handleKeyPress = (key: string) => {
      // Chord keys — no-op (v1 limitation, TODO: implement in follow-up)
      if (key === 'Ctrl' || key === 'Alt') return

      // For all other keys (Tab, Esc, arrows), focus the terminal input.
      // This brings up the soft keyboard so the user can type the next sequence.
      terminalRef.current?.focusInput?.()
    }

    return (
      <div
        className="flex flex-col h-full bg-background"
        data-testid="mobile-terminal-tab"
      >
        {/* Terminal — fills available space */}
        <div className="flex-1 min-h-0">
          <TaskTerminal ref={terminalRef} taskId={taskId} />
        </div>

        {/* Accessory bar — sticky above the screen-level action bar */}
        <TerminalAccessoryBar onKeyPress={handleKeyPress} />
      </div>
    )
  },
)

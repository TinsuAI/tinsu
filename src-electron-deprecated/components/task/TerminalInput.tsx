import { forwardRef, useImperativeHandle, useRef, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { trpc } from '@renderer/lib/trpc'
import { Button } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'

interface TerminalInputProps {
  /** Task ID to send commands to */
  taskId: string
  /** Whether the input is disabled (e.g., no active session) */
  disabled?: boolean
  /** Callback when command is successfully sent */
  onSubmit?: (command: string) => void
}

/**
 * TerminalInput component - command input field for task terminals.
 *
 * Provides a dedicated input field for sending commands to a task's
 * tmux session. Commands are sent via tRPC to the main process which
 * executes `tmux send-keys`.
 *
 * Features:
 * - Dark theme styling to match terminal aesthetic
 * - Loading state while command is being sent
 * - Clears input on successful send
 * - Error toast on failure
 * - Ref forwarding for focus control (used by "/" keyboard shortcut)
 *
 * @see TES-1.5: User Command Input
 */
export const TerminalInput = forwardRef<HTMLInputElement, TerminalInputProps>(
  ({ taskId, disabled, onSubmit }, ref) => {
    const [command, setCommand] = useState('')
    const inputRef = useRef<HTMLInputElement>(null)

    // Expose ref for focus control (keyboard shortcut)
    useImperativeHandle(ref, () => inputRef.current!, [])

    const sendCommand = trpc.agent.sendTerminalCommand.useMutation()

    const handleSubmit = async (e: FormEvent): Promise<void> => {
      e.preventDefault()

      const trimmedCommand = command.trim()

      // AC #2: Don't send empty commands
      if (!trimmedCommand || disabled) return

      try {
        await sendCommand.mutateAsync({
          taskId,
          command: trimmedCommand
        })

        // AC #1: Clear input after successful send
        setCommand('')
        onSubmit?.(trimmedCommand)
      } catch (error) {
        // Show specific error message if available from tRPC
        const message = error instanceof Error ? error.message : 'Failed to send command'
        toast.error(message)
      }
    }

    const isSubmitDisabled = disabled || !command.trim() || sendCommand.isPending

    return (
      <form onSubmit={handleSubmit} className="flex gap-2 p-2 border-t border-border">
        <input
          ref={inputRef}
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          placeholder="Type a command..."
          disabled={disabled || sendCommand.isPending}
          className={cn(
            'flex-1 bg-input text-foreground font-mono text-sm',
            'px-3 py-2 rounded border border-border',
            'focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'placeholder:text-muted-foreground'
          )}
          aria-label="Terminal command input"
        />
        <Button type="submit" size="sm" variant="secondary" disabled={isSubmitDisabled}>
          {sendCommand.isPending ? 'Sending...' : 'Send'}
        </Button>
      </form>
    )
  }
)

TerminalInput.displayName = 'TerminalInput'

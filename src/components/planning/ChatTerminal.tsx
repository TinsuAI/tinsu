/**
 * ChatTerminal - Full-height terminal panel for a chat session's tmux session.
 *
 * Spawns a separate PTY to `tmux attach` the chat session's tmux,
 * giving the user full read/write terminal access. Auto-detaches on close/unmount.
 * Designed to fill its parent container (used as a dedicated panel column).
 */

import { useRef, useEffect, useCallback, useState } from 'react'
import { X } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { trpc } from '@renderer/lib/trpc'
import { XTerminal, type XTerminalRef } from '../terminal/XTerminal'

interface ChatTerminalProps {
  sessionId: string
  onClose: () => void
}

export function ChatTerminal({ sessionId, onClose }: ChatTerminalProps) {
  const termRef = useRef<XTerminalRef>(null)
  const [processId, setProcessId] = useState<string | null>(null)
  const [isAttached, setIsAttached] = useState(false)
  const processIdRef = useRef<string | null>(null)

  const attachMutation = trpc.chatSession.attachTerminal.useMutation()
  const detachMutation = trpc.chatSession.detachTerminal.useMutation()
  const writeMutation = trpc.pty.write.useMutation()
  const resizeMutation = trpc.pty.resize.useMutation()

  // Attach on mount
  useEffect(() => {
    const dims = termRef.current?.getDimensions()
    attachMutation.mutate(
      { sessionId, cols: dims?.cols, rows: dims?.rows },
      {
        onSuccess: (result) => {
          if (result.attached && result.processId) {
            setProcessId(result.processId)
            processIdRef.current = result.processId
            setIsAttached(true)
          }
        }
      }
    )

    return () => {
      if (processIdRef.current) {
        detachMutation.mutate({ processId: processIdRef.current })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  // Subscribe to PTY output
  trpc.pty.onOutput.useSubscription(
    { processId: processId ?? '' },
    {
      enabled: !!processId,
      onData: (event) => {
        termRef.current?.write(event.data)
      }
    }
  )

  // Subscribe to PTY exit
  trpc.pty.onExit.useSubscription(
    { processId: processId ?? '' },
    {
      enabled: !!processId,
      onData: () => {
        setIsAttached(false)
        termRef.current?.write('\r\n\x1b[90m[Session ended]\x1b[0m\r\n')
      }
    }
  )

  const handleData = useCallback(
    (data: string) => {
      if (processIdRef.current) {
        writeMutation.mutate({ processId: processIdRef.current, data })
      }
    },
    [writeMutation]
  )

  const handleResize = useCallback(
    (cols: number, rows: number) => {
      if (processIdRef.current) {
        resizeMutation.mutate({ processId: processIdRef.current, cols, rows })
      }
    },
    [resizeMutation]
  )

  return (
    <div className="flex h-full flex-col" data-testid="chat-terminal">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border/20 px-2 py-1">
        <div className="flex items-center gap-1.5">
          <div className={cn(
            'h-1.5 w-1.5 rounded-full transition-colors',
            isAttached ? 'bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.4)]' : 'bg-muted-foreground/20'
          )} />
          <span className="font-mono text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/30">
            Terminal
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground/25 hover:text-red-400/60 transition-colors"
          aria-label="Close terminal"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {/* Terminal — fills remaining height */}
      <div className="min-h-0 flex-1">
        <XTerminal ref={termRef} onData={handleData} onResize={handleResize} />
      </div>
    </div>
  )
}

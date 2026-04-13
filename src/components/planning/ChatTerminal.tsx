/**
 * ChatTerminal - Full-height terminal panel for a chat session's tmux session.
 *
 * T1.9: Migrated from tRPC subscriptions to Tauri Channel + listen events.
 *
 * Spawns a separate PTY to `tmux attach` the chat session's tmux,
 * giving the user full read/write terminal access. Auto-detaches on close/unmount.
 * Designed to fill its parent container (used as a dedicated panel column).
 */

import { useRef, useEffect, useCallback, useState } from 'react'
import { X } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { commands } from '@renderer/lib/rspc'
import { Channel } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
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

  // Keep cleanup ref in sync with state
  useEffect(() => {
    processIdRef.current = processId
  }, [processId])

  // Attach on mount — uses Tauri Channel for PTY output streaming
  useEffect(() => {
    let cancelled = false

    async function attach() {
      try {
        const dims = termRef.current?.getDimensions()

        const decoder = new TextDecoder()
        const channel = new Channel<number[]>()
        channel.onmessage = (data) => {
          if (!cancelled) {
            termRef.current?.write(decoder.decode(new Uint8Array(data)))
          }
        }

        const result = await commands.attachChatTerminal(
          sessionId,
          dims?.cols ?? null,
          dims?.rows ?? null,
          channel
        )

        if (result.status === 'error') {
          console.warn('[ChatTerminal] attach error:', result.error)
          return
        }

        if (cancelled) {
          if (result.data.process_id) {
            commands.detachChatTerminal(result.data.process_id).catch(() => {})
          }
          return
        }

        if (result.data.attached && result.data.process_id) {
          setProcessId(result.data.process_id)
          processIdRef.current = result.data.process_id
          setIsAttached(true)
        }
      } catch (err) {
        console.warn('[ChatTerminal] attach exception:', err)
      }
    }

    attach()

    return () => {
      cancelled = true
      if (processIdRef.current) {
        commands.detachChatTerminal(processIdRef.current).catch(() => {})
        processIdRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  // Listen to pty:exit Tauri Event
  useEffect(() => {
    if (!processId) return
    let unlisten: (() => void) | undefined
    let isMounted = true

    listen<{ process_id: string; exit_code: number }>('pty:exit', (event) => {
      if (event.payload.process_id !== processId) return
      setIsAttached(false)
      termRef.current?.write('\r\n\x1b[90m[Session ended]\x1b[0m\r\n')
    }).then((fn) => {
      if (isMounted) {
        unlisten = fn
      } else {
        fn()
      }
    })

    return () => {
      isMounted = false
      unlisten?.()
    }
  }, [processId])

  const handleData = useCallback(
    (data: string) => {
      if (processIdRef.current) {
        commands.writePty(processIdRef.current, data).catch((e) =>
          console.warn('[ChatTerminal] write error:', e)
        )
      }
    },
    []
  )

  const handleResize = useCallback(
    (cols: number, rows: number) => {
      if (processIdRef.current) {
        commands.resizePty(processIdRef.current, cols, rows).catch((e) =>
          console.warn('[ChatTerminal] resize error:', e)
        )
      }
    },
    []
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

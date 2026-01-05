import { useCallback, useRef, useEffect } from 'react'
import { ChevronDown, ChevronUp, Play, X } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { useTerminalStore } from '@renderer/stores'
import { XTerminal, type XTerminalRef } from './XTerminal'
import { useTerminal } from '@renderer/hooks/useTerminal'

const MIN_HEIGHT = 80
const MAX_HEIGHT_VH = 60
const DEFAULT_HEIGHT_VH = 35

/**
 * TerminalDock component - Bottom dock with embedded terminal.
 *
 * Features:
 * - Fixed positioning at bottom of viewport
 * - Collapsible to 80px header-only state
 * - Resizable via drag handle (80px - 60vh)
 * - Height persisted to localStorage
 * - Connected to PTY for shell execution
 */
export function TerminalDock(): React.JSX.Element {
  const { isExpanded, height, setExpanded, setHeight } = useTerminalStore()
  const terminalRef = useRef<XTerminalRef>(null)
  const isDraggingRef = useRef(false)

  // Initialize default height on first render (if not yet set from storage)
  useEffect(() => {
    if (height === 0 || isNaN(height)) {
      setHeight(window.innerHeight * (DEFAULT_HEIGHT_VH / 100))
    }
  }, [height, setHeight])

  // Connect terminal to PTY
  const { spawn, write, kill, resize, isRunning } = useTerminal({
    terminalRef,
    onExit: (exitCode) => {
      console.log(`[Terminal] Process exited with code ${exitCode}`)
    }
  })

  // Handle user input from terminal
  const handleTerminalData = useCallback(
    (data: string) => {
      write(data)
    },
    [write]
  )

  // Handle terminal resize
  const handleTerminalResize = useCallback(
    (cols: number, rows: number) => {
      resize(cols, rows)
    },
    [resize]
  )

  // Start a new shell session
  const handleStartShell = useCallback(() => {
    spawn()
  }, [spawn])

  // Kill the current shell session
  const handleKillShell = useCallback(() => {
    kill()
  }, [kill])

  // Handle drag resize
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      isDraggingRef.current = true

      const startY = e.clientY
      const startHeight = height

      const handleMouseMove = (e: MouseEvent): void => {
        if (!isDraggingRef.current) return

        const delta = startY - e.clientY
        const maxHeight = window.innerHeight * (MAX_HEIGHT_VH / 100)
        const newHeight = Math.max(MIN_HEIGHT, Math.min(maxHeight, startHeight + delta))
        setHeight(newHeight)
      }

      const handleMouseUp = (): void => {
        isDraggingRef.current = false
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        // Fit terminal after resize completes
        terminalRef.current?.fit()
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    },
    [height, setHeight]
  )

  // Toggle expand/collapse
  const handleToggleExpand = useCallback(() => {
    setExpanded(!isExpanded)
    // Fit terminal after expand animation
    if (!isExpanded) {
      setTimeout(() => {
        terminalRef.current?.fit()
      }, 250) // Match transition duration
    }
  }, [isExpanded, setExpanded])

  const effectiveHeight = isExpanded ? height : MIN_HEIGHT

  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-800',
        'flex flex-col transition-[height] duration-200 ease-out z-50'
      )}
      style={{ height: effectiveHeight }}
      data-testid="terminal-dock"
    >
      {/* Resize handle - only visible when expanded */}
      {isExpanded && (
        <div
          className="absolute top-0 left-0 right-0 h-1 cursor-ns-resize hover:bg-zinc-600 transition-colors"
          onMouseDown={handleMouseDown}
          role="separator"
          aria-label="Resize terminal"
          aria-orientation="horizontal"
          data-testid="terminal-resize-handle"
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-4 h-10 min-h-[40px] border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="text-sm text-zinc-400 font-medium">Terminal</span>
          {isRunning && <span className="w-2 h-2 rounded-full bg-green-500" aria-label="Running" />}
        </div>
        <div className="flex items-center gap-1">
          {/* Start/Stop shell button */}
          {isExpanded && (
            <>
              {!isRunning ? (
                <button
                  onClick={handleStartShell}
                  className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
                  aria-label="Start shell"
                  title="Start shell"
                >
                  <Play size={14} />
                </button>
              ) : (
                <button
                  onClick={handleKillShell}
                  className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-red-400 transition-colors"
                  aria-label="Kill shell"
                  title="Kill shell"
                >
                  <X size={14} />
                </button>
              )}
            </>
          )}
          {/* Collapse/Expand button */}
          <button
            onClick={handleToggleExpand}
            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
            aria-label={isExpanded ? 'Collapse terminal' : 'Expand terminal'}
            aria-expanded={isExpanded}
            data-testid="terminal-toggle"
          >
            {isExpanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
        </div>
      </div>

      {/* Terminal content - only rendered when expanded */}
      {isExpanded && (
        <div className="flex-1 p-2 overflow-hidden min-h-0">
          <XTerminal
            ref={terminalRef}
            onData={handleTerminalData}
            onResize={handleTerminalResize}
          />
        </div>
      )}
    </div>
  )
}

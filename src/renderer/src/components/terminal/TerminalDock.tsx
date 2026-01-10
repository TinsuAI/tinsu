import { useCallback, useRef, useEffect, useMemo } from 'react'
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Play, X } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { useTerminalStore, type DockPosition } from '@renderer/stores'
import { XTerminal, type XTerminalRef } from './XTerminal'
import { useTerminal } from '@renderer/hooks/useTerminal'
import { DockPositionSelector } from './DockPositionSelector'

const MIN_SIZE = 80
const MAX_SIZE_PERCENT = 60
const DEFAULT_SIZE_PERCENT = 35

/** Check if dock position is horizontal (top/bottom) */
const isHorizontal = (pos: DockPosition): boolean => pos === 'top' || pos === 'bottom'

/**
 * TerminalDock component - Dockable terminal panel.
 *
 * Features:
 * - Dock to any edge: top, bottom, left, right
 * - Collapsible to header-only state
 * - Resizable via drag handle
 * - Size persisted to localStorage
 * - Connected to PTY for shell execution
 */
export function TerminalDock(): React.JSX.Element {
  const { isExpanded, height, width, dockPosition, setExpanded, setHeight, setWidth } =
    useTerminalStore()
  const terminalRef = useRef<XTerminalRef>(null)
  const isDraggingRef = useRef(false)

  const horizontal = isHorizontal(dockPosition)

  // Initialize default size on first render (if not yet set from storage)
  useEffect(() => {
    if (horizontal && (height === 0 || isNaN(height))) {
      setHeight(window.innerHeight * (DEFAULT_SIZE_PERCENT / 100))
    }
    if (!horizontal && (width === 0 || isNaN(width))) {
      setWidth(window.innerWidth * (DEFAULT_SIZE_PERCENT / 100))
    }
  }, [height, width, horizontal, setHeight, setWidth])

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

  // Handle drag resize for all positions
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      isDraggingRef.current = true

      const startX = e.clientX
      const startY = e.clientY
      const startHeight = height
      const startWidth = width

      const handleMouseMove = (e: MouseEvent): void => {
        if (!isDraggingRef.current) return

        if (horizontal) {
          // Vertical resize for top/bottom
          const delta = dockPosition === 'bottom' ? startY - e.clientY : e.clientY - startY
          const maxSize = window.innerHeight * (MAX_SIZE_PERCENT / 100)
          const newHeight = Math.max(MIN_SIZE, Math.min(maxSize, startHeight + delta))
          setHeight(newHeight)
        } else {
          // Horizontal resize for left/right
          const delta = dockPosition === 'right' ? startX - e.clientX : e.clientX - startX
          const maxSize = window.innerWidth * (MAX_SIZE_PERCENT / 100)
          const newWidth = Math.max(MIN_SIZE, Math.min(maxSize, startWidth + delta))
          setWidth(newWidth)
        }
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
    [height, width, horizontal, dockPosition, setHeight, setWidth]
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

  // Calculate effective size based on position and expanded state
  const effectiveSize = useMemo(() => {
    if (!isExpanded) return MIN_SIZE
    return horizontal ? height : width
  }, [isExpanded, horizontal, height, width])

  // Get the appropriate chevron icon based on position and expanded state
  const ToggleIcon = useMemo(() => {
    if (isExpanded) {
      switch (dockPosition) {
        case 'bottom':
          return ChevronDown
        case 'top':
          return ChevronUp
        case 'left':
          return ChevronLeft
        case 'right':
          return ChevronRight
      }
    } else {
      switch (dockPosition) {
        case 'bottom':
          return ChevronUp
        case 'top':
          return ChevronDown
        case 'left':
          return ChevronRight
        case 'right':
          return ChevronLeft
      }
    }
  }, [isExpanded, dockPosition])

  // Container classes based on dock position
  const containerClasses = useMemo(() => {
    const base = 'fixed bg-zinc-900 z-50 transition-all duration-200 ease-out'
    switch (dockPosition) {
      case 'bottom':
        return cn(base, 'bottom-0 left-0 right-0 border-t border-zinc-800 flex flex-col')
      case 'top':
        return cn(base, 'top-0 left-0 right-0 border-b border-zinc-800 flex flex-col')
      case 'left':
        return cn(base, 'top-0 left-0 bottom-0 border-r border-zinc-800 flex flex-row')
      case 'right':
        return cn(base, 'top-0 right-0 bottom-0 border-l border-zinc-800 flex flex-row-reverse')
    }
  }, [dockPosition])

  // Container style based on position
  const containerStyle = useMemo(() => {
    if (horizontal) {
      return { height: effectiveSize }
    }
    return { width: effectiveSize }
  }, [horizontal, effectiveSize])

  // Resize handle classes based on position
  const resizeHandleClasses = useMemo(() => {
    const base = 'absolute hover:bg-zinc-600 transition-colors'
    switch (dockPosition) {
      case 'bottom':
        return cn(base, 'top-0 left-0 right-0 h-1 cursor-ns-resize')
      case 'top':
        return cn(base, 'bottom-0 left-0 right-0 h-1 cursor-ns-resize')
      case 'left':
        return cn(base, 'top-0 right-0 bottom-0 w-1 cursor-ew-resize')
      case 'right':
        return cn(base, 'top-0 left-0 bottom-0 w-1 cursor-ew-resize')
    }
  }, [dockPosition])

  // Header classes based on position
  const headerClasses = useMemo(() => {
    if (horizontal) {
      return 'flex items-center justify-between px-4 h-10 min-h-[40px] border-b border-zinc-800'
    }
    return cn(
      'flex flex-col items-center justify-between py-3 w-10 min-w-[40px]',
      dockPosition === 'left' ? 'border-r border-zinc-800' : 'border-l border-zinc-800'
    )
  }, [horizontal, dockPosition])

  return (
    <div
      className={containerClasses}
      style={containerStyle}
      data-testid="terminal-dock"
      data-dock-position={dockPosition}
    >
      {/* Resize handle - only visible when expanded */}
      {isExpanded && (
        <div
          className={resizeHandleClasses}
          onMouseDown={handleMouseDown}
          role="separator"
          aria-label="Resize terminal"
          aria-orientation={horizontal ? 'horizontal' : 'vertical'}
          data-testid="terminal-resize-handle"
        />
      )}

      {/* Header */}
      <div className={headerClasses}>
        <div className={cn('flex items-center gap-2', !horizontal && 'flex-col')}>
          <span
            className={cn(
              'text-sm text-zinc-400 font-medium',
              !horizontal && 'writing-mode-vertical text-xs'
            )}
            style={!horizontal ? { writingMode: 'vertical-rl', textOrientation: 'mixed' } : undefined}
          >
            Terminal
          </span>
          {isRunning && <span className="w-2 h-2 rounded-full bg-green-500" aria-label="Running" />}
        </div>
        <div className={cn('flex items-center gap-1', !horizontal && 'flex-col')}>
          {/* Dock position selector - always visible when expanded */}
          {isExpanded && <DockPositionSelector vertical={!horizontal} />}

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
            <ToggleIcon size={16} />
          </button>
        </div>
      </div>

      {/* Terminal content - only rendered when expanded */}
      {isExpanded && (
        <div className="flex-1 p-2 overflow-hidden min-h-0 min-w-0">
          <XTerminal ref={terminalRef} onData={handleTerminalData} onResize={handleTerminalResize} />
        </div>
      )}
    </div>
  )
}

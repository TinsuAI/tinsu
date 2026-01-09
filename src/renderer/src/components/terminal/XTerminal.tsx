import { useEffect, useRef, useCallback, useImperativeHandle, forwardRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'

interface ContextMenuState {
  visible: boolean
  x: number
  y: number
}

export interface XTerminalProps {
  /** Callback when user types in the terminal */
  onData?: (data: string) => void
  /** Callback when terminal is resized with new dimensions */
  onResize?: (cols: number, rows: number) => void
}

export interface XTerminalRef {
  /** Write data to the terminal */
  write: (data: string) => void
  /** Clear the terminal */
  clear: () => void
  /** Focus the terminal */
  focus: () => void
  /** Get terminal dimensions */
  getDimensions: () => { cols: number; rows: number } | null
  /** Fit terminal to container */
  fit: () => void
}

/**
 * XTerminal component - xterm.js wrapper for terminal rendering.
 *
 * Uses dark theme matching the app design:
 * - Background: #0a0a0b
 * - Foreground: #fafafa
 * - Selection: #3f3f46
 *
 * Features:
 * - Auto-resize with FitAddon
 * - 10,000 line scrollback buffer
 * - Text selection and copy support
 * - ARIA accessible with role="log"
 * - Keyboard focusable with tabIndex
 */
export const XTerminal = forwardRef<XTerminalRef, XTerminalProps>(function XTerminal(
  { onData, onResize },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0 })

  // Handle right-click to show context menu
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY })
  }, [])

  // Handle copy action from context menu
  const handleCopy = useCallback(async () => {
    const terminal = terminalRef.current
    if (terminal) {
      const selection = terminal.getSelection()
      if (selection) {
        await navigator.clipboard.writeText(selection)
      }
    }
    setContextMenu({ visible: false, x: 0, y: 0 })
  }, [])

  // Close context menu on click outside or escape
  useEffect(() => {
    const handleClickOutside = (): void => {
      setContextMenu((prev) => (prev.visible ? { visible: false, x: 0, y: 0 } : prev))
    }
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setContextMenu({ visible: false, x: 0, y: 0 })
      }
    }

    if (contextMenu.visible) {
      document.addEventListener('click', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
      return () => {
        document.removeEventListener('click', handleClickOutside)
        document.removeEventListener('keydown', handleKeyDown)
      }
    }
  }, [contextMenu.visible])

  // Expose methods via ref
  useImperativeHandle(
    ref,
    () => ({
      write: (data: string) => {
        terminalRef.current?.write(data)
      },
      clear: () => {
        terminalRef.current?.clear()
      },
      focus: () => {
        terminalRef.current?.focus()
      },
      getDimensions: () => {
        const terminal = terminalRef.current
        if (!terminal) return null
        return { cols: terminal.cols, rows: terminal.rows }
      },
      fit: () => {
        fitAddonRef.current?.fit()
      }
    }),
    []
  )

  // Use refs to store callbacks so they don't trigger terminal recreation
  const onDataRef = useRef(onData)
  const onResizeRef = useRef(onResize)

  // Keep refs updated when props change
  useEffect(() => {
    onDataRef.current = onData
  }, [onData])

  useEffect(() => {
    onResizeRef.current = onResize
  }, [onResize])

  useEffect(() => {
    if (!containerRef.current) return

    // Create terminal instance with dark theme
    const terminal = new Terminal({
      theme: {
        background: '#0a0a0b',
        foreground: '#fafafa',
        cursor: '#fafafa',
        cursorAccent: '#0a0a0b',
        selectionBackground: '#3f3f46',
        selectionForeground: '#fafafa'
      },
      fontFamily: 'Menlo, Monaco, Consolas, monospace',
      fontSize: 14,
      lineHeight: 1.2,
      scrollback: 10000,
      cursorBlink: true,
      allowProposedApi: true
    })

    // Create and attach FitAddon for auto-resize
    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)

    // Open terminal in container
    terminal.open(containerRef.current)

    // Initial fit
    fitAddon.fit()

    // Handle user input - use ref to avoid recreation on callback change
    const dataDisposer = terminal.onData((data) => {
      onDataRef.current?.(data)
    })

    // Handle resize - use ref to avoid recreation on callback change
    const resizeDisposer = terminal.onResize(({ cols, rows }) => {
      onResizeRef.current?.(cols, rows)
    })

    // Store refs
    terminalRef.current = terminal
    fitAddonRef.current = fitAddon

    // Observe container resize and refit terminal
    const resizeObserver = new ResizeObserver(() => {
      // Debounce the fit call slightly to avoid excessive calls
      requestAnimationFrame(() => {
        fitAddon.fit()
      })
    })
    resizeObserver.observe(containerRef.current)

    // Cleanup
    return () => {
      resizeObserver.disconnect()
      dataDisposer.dispose()
      resizeDisposer.dispose()
      terminal.dispose()
      terminalRef.current = null
      fitAddonRef.current = null
    }
  }, []) // Empty deps - terminal created once, callbacks accessed via refs

  return (
    <div className="relative w-full h-full">
      <div
        ref={containerRef}
        className="w-full h-full"
        role="log"
        aria-label="Terminal output"
        tabIndex={0}
        data-testid="xterminal"
        onContextMenu={handleContextMenu}
      />
      {/* Context menu for copy */}
      {contextMenu.visible && (
        <div
          className="fixed z-50 bg-zinc-800 border border-zinc-700 rounded shadow-lg py-1 min-w-[120px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          data-testid="terminal-context-menu"
        >
          <button
            onClick={handleCopy}
            className="w-full px-3 py-1.5 text-sm text-left text-zinc-200 hover:bg-zinc-700 transition-colors"
            data-testid="context-menu-copy"
          >
            Copy
          </button>
        </div>
      )}
    </div>
  )
})

import { useEffect, useRef, useCallback, useImperativeHandle, forwardRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { SerializeAddon } from '@xterm/addon-serialize'
import { TerminalAccessoryBar } from './TerminalAccessoryBar'
import { cn } from '@renderer/lib/utils'

export interface MobileTerminalProps {
  /** Callback when user types in the terminal */
  onData?: (data: string) => void
  /** Callback when terminal is resized with new dimensions */
  onResize?: (cols: number, rows: number) => void
  /** Whether the terminal should be full-screen */
  isFullScreen?: boolean
}

export interface MobileTerminalRef {
  write: (data: string) => void
  clear: () => void
  focus: () => void
  getDimensions: () => { cols: number; rows: number } | null
  fit: () => void
  /**
   * TES-1.6: Serialize terminal buffer for persistence.
   */
  serialize: () => string
  /**
   * TES-1.6: Get current scroll position.
   */
  getScrollPosition: () => number
  /**
   * TES-1.6: Scroll to a specific line.
   */
  scrollToLine: (line: number) => void
}

/**
 * MobileTerminal component - Touch-optimized variant of XTerminal.
 * 
 * Features:
 * - Responsive height calculation
 * - Accessory bar for CLI navigation
 * - Gesture support (Double-tap for full-screen)
 * - Viewport management for on-screen keyboard
 */
export const MobileTerminal = forwardRef<MobileTerminalRef, MobileTerminalProps>(function MobileTerminal(
  { onData, onResize, isFullScreen: initialFullScreen = false },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const serializeAddonRef = useRef<SerializeAddon | null>(null)
  const [isFullScreen, setIsFullScreen] = useState(initialFullScreen)
  const [isFocused, setIsFocused] = useState(false)
  
  // Ctrl and Alt states for modifier keys
  const [ctrlActive, setCtrlActive] = useState(false)
  const [altActive, setAltActive] = useState(false)

  // Double-tap detection
  const lastTapRef = useRef<number>(0)
  const handleTouchEnd = useCallback(() => {
    const now = Date.now()
    const DOUBLE_TAP_DELAY = 300
    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      setIsFullScreen(prev => !prev)
    }
    lastTapRef.current = now
  }, [])

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
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
    },
    serialize: () => {
      if (!serializeAddonRef.current) return ''
      try {
        return serializeAddonRef.current.serialize()
      } catch {
        return ''
      }
    },
    getScrollPosition: () => {
      const terminal = terminalRef.current
      if (!terminal || !terminal.buffer?.active) return 0
      return terminal.buffer.active.viewportY
    },
    scrollToLine: (line: number) => {
      const terminal = terminalRef.current
      if (!terminal) return
      try {
        terminal.scrollToLine(line)
      } catch {
        // Ignore scroll errors
      }
    }
  }), [])

  const onDataRef = useRef(onData)
  const onResizeRef = useRef(onResize)

  useEffect(() => {
    onDataRef.current = onData
  }, [onData])

  useEffect(() => {
    onResizeRef.current = onResize
  }, [onResize])

  useEffect(() => {
    if (!containerRef.current) return

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
      fontSize: 12, // Slightly smaller for mobile
      lineHeight: 1.2,
      scrollback: 5000,
      cursorBlink: true,
      allowProposedApi: true
    })

    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)

    const serializeAddon = new SerializeAddon()
    terminal.loadAddon(serializeAddon)

    terminal.open(containerRef.current)
    fitAddon.fit()

    terminal.onData((data) => {
      // Handle Ctrl/Alt combinations from physical keyboard if any
      // but primarily we handle them via state for the accessory bar
      let finalData = data
      
      if (ctrlActive) {
        // Simple Ctrl combination for A-Z
        if (data.length === 1) {
          const code = data.toUpperCase().charCodeAt(0)
          if (code >= 64 && code <= 95) {
            finalData = String.fromCharCode(code - 64)
          }
        }
        setCtrlActive(false)
      } else if (altActive) {
        finalData = '\x1b' + data
        setAltActive(false)
      }
      
      onDataRef.current?.(finalData)
    })

    terminal.onResize(({ cols, rows }) => {
      onResizeRef.current?.(cols, rows)
    })

    // Listen to focus events
    terminal.onFocus(() => setIsFocused(true))
    terminal.onBlur(() => setIsFocused(false))

    terminalRef.current = terminal
    fitAddonRef.current = fitAddon
    serializeAddonRef.current = serializeAddon

    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        fitAddon.fit()
      })
    })
    resizeObserver.observe(containerRef.current)

    // Keyboard and Viewport Management
    const handleViewportChange = () => {
      if (window.visualViewport) {
        // Adjust container height based on viewport height to handle keyboard
        // This is handled by CSS in our layout mostly, but we trigger fit here
        fitAddon.fit()
        terminal.scrollToBottom()
      }
    }

    window.visualViewport?.addEventListener('resize', handleViewportChange)
    window.visualViewport?.addEventListener('scroll', handleViewportChange)

    return () => {
      window.visualViewport?.removeEventListener('resize', handleViewportChange)
      window.visualViewport?.removeEventListener('scroll', handleViewportChange)
      resizeObserver.disconnect()
      terminal.dispose()
      terminalRef.current = null
      fitAddonRef.current = null
      serializeAddonRef.current = null
    }
  }, [ctrlActive, altActive]) // Re-bind onData to capture latest modifier state


  const handleAccessoryKeyPress = useCallback((key: string) => {
    if (key === 'Ctrl') {
      setCtrlActive(prev => !prev)
      return
    }
    if (key === 'Alt') {
      setAltActive(prev => !prev)
      return
    }
    
    let data = key
    if (ctrlActive) {
      // If we have specific mappings for Ctrl + key, we could put them here
      // For now, assume common keys like C, D, Z
      if (key === 'c' || key === 'C') data = '\x03'
      else if (key === 'd' || key === 'D') data = '\x04'
      else if (key === 'z' || key === 'Z') data = '\x1a'
      setCtrlActive(false)
    } else if (altActive) {
      data = '\x1b' + key
      setAltActive(false)
    }
    
    terminalRef.current?.focus()
    onDataRef.current?.(data)
  }, [ctrlActive, altActive])

  return (
    <div 
      className={cn(
        "flex flex-col w-full bg-[#0a0a0b] overflow-hidden transition-all duration-300",
        isFullScreen ? "fixed inset-0 z-50" : "relative h-full"
      )}
      onTouchEnd={handleTouchEnd}
    >
      <div 
        ref={containerRef} 
        className="flex-1 w-full" 
        role="log"
        aria-label="Mobile terminal output"
      />
      
      {/* Accessory Bar - show when focused or permanently on mobile */}
      <TerminalAccessoryBar 
        onKeyPress={handleAccessoryKeyPress}
        className={cn(
          "transition-opacity duration-200",
          isFocused ? "opacity-100" : "opacity-80"
        )}
      />
      
      {/* Modifier Indicators */}
      {(ctrlActive || altActive) && (
        <div className="absolute top-2 right-2 flex gap-2 pointer-events-none">
          {ctrlActive && <span className="px-1.5 py-0.5 rounded bg-blue-600 text-[10px] font-bold text-white">CTRL</span>}
          {altActive && <span className="px-1.5 py-0.5 rounded bg-amber-600 text-[10px] font-bold text-white">ALT</span>}
        </div>
      )}
    </div>
  )
})

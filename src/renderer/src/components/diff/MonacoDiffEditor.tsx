/**
 * MonacoDiffEditor - Syntax-highlighted diff viewer using Monaco Editor
 *
 * Displays side-by-side code diffs with:
 * - Syntax highlighting based on file extension
 * - Custom TinSu dark theme with green/red diff colors
 * - Synchronized scrolling between original and modified panes
 * - Collapsible unchanged regions for large files
 *
 * Story TES-4.4: Monaco Diff Viewer Integration
 */

import { useCallback, useState, useRef, useEffect } from 'react'
import { DiffEditor, type Monaco, loader } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import type { DiffViewMode } from '@renderer/stores/diff.store'
import { cn } from '@renderer/lib/utils'
import { Skeleton } from '@renderer/components/ui/skeleton'
import { Button } from '@renderer/components/ui/button'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { registerTinsuTheme, TINSU_DARK_THEME } from './theme'

// Configure Monaco to load from local public directory
// This prevents CSP violations in Electron
loader.config({
  paths: {
    vs: '/monaco/vs'
  }
})

/**
 * Props for the MonacoDiffEditor component.
 */
export interface MonacoDiffEditorProps {
  /** Original file content (before changes) */
  original: string
  /** Modified file content (after changes) */
  modified: string
  /** Programming language for syntax highlighting */
  language: string
  /** File path for display/reference */
  filePath: string
  /** Optional additional CSS classes */
  className?: string
  /** Optional height (default: 300px) */
  height?: string | number
  /**
   * View mode for the diff display (TES-4.5)
   * - 'split': Side-by-side view with original on left, modified on right (default)
   * - 'unified': Interleaved view with changes shown in single column
   */
  viewMode?: DiffViewMode
}

/**
 * MonacoDiffEditor component for displaying syntax-highlighted code diffs.
 *
 * Features:
 * - AC #1: Syntax highlighting matching file type
 * - AC #2: Green background for added lines
 * - AC #3: Red background for removed lines
 * - AC #4: Synchronized scrolling, visible line numbers
 * - AC #5: Collapsible unchanged sections
 *
 * @example
 * <MonacoDiffEditor
 *   original={originalContent}
 *   modified={modifiedContent}
 *   language="typescript"
 *   filePath="src/App.tsx"
 *   height={400}
 * />
 */
export function MonacoDiffEditor({
  original,
  modified,
  language,
  filePath,
  className,
  height = 300,
  viewMode = 'split'
}: MonacoDiffEditorProps): React.JSX.Element {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Dynamic height calculated from Monaco's getContentHeight() (TES-4.6)
  const [calculatedHeight, setCalculatedHeight] = useState<number>(
    typeof height === 'number' ? height : 300
  )

  // Thread-safe theme registration tracking (per component instance)
  const themeRegisteredRef = useRef(false)

  // Ref to the Monaco diff editor instance for dynamic option updates (TES-4.5)
  const editorRef = useRef<editor.IStandaloneDiffEditor | null>(null)

  /**
   * Handler called before Monaco mounts.
   * Registers the custom TinSu theme with error handling.
   */
  const handleBeforeMount = useCallback((monaco: Monaco) => {
    if (!themeRegisteredRef.current) {
      try {
        registerTinsuTheme(monaco)
        themeRegisteredRef.current = true
      } catch (err) {
        console.error('Failed to register Monaco theme:', err)
        setError('Failed to initialize theme. Using default theme.')
      }
    }
  }, [])

  /**
   * Handler called when the editor has mounted.
   * Sets up auto-height calculation using Monaco's getContentHeight() (TES-4.6)
   */
  const handleMount = useCallback((editor: editor.IStandaloneDiffEditor) => {
    // Store editor reference for dynamic option updates (TES-4.5)
    editorRef.current = editor
    setIsLoading(false)
    setError(null) // Clear errors on successful mount

    // Get the modified editor to access content height (TES-4.6)
    const modifiedEditor = editor.getModifiedEditor()

    // Calculate initial height using Monaco's built-in method
    const updateHeight = () => {
      try {
        const contentHeight = modifiedEditor.getContentHeight()
        // Add buffer to prevent scrollbar (20px for borders, padding, rounding errors)
        const finalHeight = contentHeight + 20
        setCalculatedHeight(finalHeight)

        // Force Monaco to layout with new height to prevent scrollbar
        // Use setTimeout to ensure state update has completed
        setTimeout(() => {
          if (editorRef.current) {
            editorRef.current.layout()
          }
        }, 0)
      } catch (err) {
        console.warn('Failed to get content height:', err)
      }
    }

    // Set initial height
    updateHeight()

    // Listen for content size changes and update height dynamically
    const disposable = modifiedEditor.onDidContentSizeChange(() => {
      updateHeight()
    })

    // Cleanup listener on unmount
    return () => disposable.dispose()
  }, [])

  /**
   * Retry loading the editor after an error.
   */
  const handleRetry = useCallback(() => {
    setError(null)
    setIsLoading(true)
  }, [])

  /**
   * Catch mount errors and display them
   */
  const handleMountError = useCallback(() => {
    setError('Monaco editor failed to render')
    setIsLoading(false)
  }, [])

  /**
   * Timeout to detect Monaco loading failures
   * If still loading after 10 seconds, assume it failed
   */
  useEffect(() => {
    if (!isLoading) return

    const timeout = setTimeout(() => {
      if (isLoading) {
        handleMountError()
      }
    }, 10000)

    return () => clearTimeout(timeout)
  }, [isLoading, handleMountError])

  /**
   * Dynamically update editor view mode without remounting (TES-4.5)
   * Uses Monaco's updateOptions() for smooth transitions
   */
  useEffect(() => {
    if (editorRef.current) {
      const renderSideBySide = viewMode === 'split'

      // Capture scroll position before view switch
      const modifiedEditor = editorRef.current.getModifiedEditor()
      const visibleRanges = modifiedEditor.getVisibleRanges()
      const firstVisibleLine = visibleRanges[0]?.startLineNumber ?? 1

      // Update the view mode
      editorRef.current.updateOptions({
        renderSideBySide
      })

      // Restore scroll position after layout update
      requestAnimationFrame(() => {
        modifiedEditor.revealLineInCenter(firstVisibleLine)
      })
    }
  }, [viewMode])

  return (
    <div
      className={cn(
        'relative monaco-diff-wrapper',
        'rounded-md border border-border/20',
        'bg-[#0d1117]',
        'shadow-sm',
        className
      )}
      style={{
        height: `${calculatedHeight}px`,
        // Clip vertical scrollbar but allow horizontal
        overflowY: 'hidden',
        overflowX: 'visible'
      }}
      data-testid="monaco-diff-editor"
      aria-label={`Diff viewer for ${filePath}`}
    >
      {/* GitHub-style loading skeleton */}
      {isLoading && !error && (
        <div
          className="absolute inset-0 z-10 flex flex-col gap-1.5 bg-[#0d1117] p-4"
          data-testid="monaco-loading"
        >
          <Skeleton className="h-4 w-full bg-muted/10" />
          <Skeleton className="h-4 w-[90%] bg-muted/10" />
          <Skeleton className="h-4 w-[95%] bg-muted/10" />
          <Skeleton className="h-4 w-[85%] bg-muted/10" />
          <Skeleton className="h-4 w-[92%] bg-muted/10" />
        </div>
      )}

      {/* GitHub-style error state */}
      {error && (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-[#0d1117] p-4"
          data-testid="monaco-error"
        >
          <div className="rounded-lg bg-[#f85149]/10 p-4">
            <AlertCircle className="h-7 w-7 text-[#f85149]" />
          </div>
          <div className="text-center">
            <p className="mb-1.5 text-sm font-semibold text-foreground">Failed to load diff viewer</p>
            <p className="text-xs text-muted-foreground/70">{error}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRetry}
            className="gap-2 rounded-md border-border/40 hover:bg-muted/40"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </Button>
        </div>
      )}

      <DiffEditor
        key={error ? 'retry' : 'initial'} // Force remount on retry
        original={original}
        modified={modified}
        language={language}
        theme={TINSU_DARK_THEME}
        height={calculatedHeight}
        beforeMount={handleBeforeMount}
        onMount={handleMount}
        options={{
          // Read-only mode
          readOnly: true,
          originalEditable: false,

          // View mode: split (side-by-side) or unified (interleaved) (TES-4.5)
          renderSideBySide: viewMode === 'split',
          enableSplitViewResizing: true,

          // Line numbers visible (AC #4)
          lineNumbers: 'on',
          lineNumbersMinChars: 4, // Balanced line number column width

          // UI options
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          wordWrap: 'off',
          renderIndicators: true,
          glyphMargin: false, // Disable glyph margin for more compact layout
          overviewRulerLanes: 0,
          automaticLayout: true,
          fixedOverflowWidgets: true,
          // Disable vertical scrolling completely - height fits all content (TES-4.6)
          scrollbar: {
            verticalScrollbarSize: 0,
            horizontalScrollbarSize: 10,
            vertical: 'hidden',
            horizontal: 'auto',
            useShadows: false,
            verticalHasArrows: false,
            horizontalHasArrows: false,
            // Don't capture mouse wheel events - let parent handle scrolling
            handleMouseWheel: false,
            alwaysConsumeMouseWheel: false
          },

          // Collapse unchanged regions (AC #5)
          // Disabled to prevent blank diff view - Monaco was collapsing too aggressively
          hideUnchangedRegions: {
            enabled: false
          },

          // Performance
          renderValidationDecorations: 'off',
          folding: true,
          foldingStrategy: 'auto'
        }}
      />
    </div>
  )
}

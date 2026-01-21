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

import { useCallback, useState, useRef } from 'react'
import { DiffEditor, type Monaco, type OnMount, loader } from '@monaco-editor/react'
import { cn } from '@renderer/lib/utils'
import { Skeleton } from '@renderer/components/ui/skeleton'
import { Button } from '@renderer/components/ui/button'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { registerTinsuTheme, TINSU_DARK_THEME } from './theme'

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
  height = 300
}: MonacoDiffEditorProps): React.JSX.Element {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Thread-safe theme registration tracking (per component instance)
  const themeRegisteredRef = useRef(false)

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
   * Marks loading as complete and clears any errors.
   */
  const handleMount: OnMount = useCallback(() => {
    setIsLoading(false)
    setError(null) // Clear errors on successful mount
  }, [])

  /**
   * Retry loading the editor after an error.
   */
  const handleRetry = useCallback(() => {
    setError(null)
    setIsLoading(true)
  }, [])

  return (
    <div
      className={cn('relative overflow-hidden rounded border border-border/20', className)}
      data-testid="monaco-diff-editor"
      aria-label={`Diff viewer for ${filePath}`}
    >
      {/* Loading skeleton overlay */}
      {isLoading && !error && (
        <div
          className="absolute inset-0 z-10 flex flex-col gap-1 bg-[#1a1a1a] p-2"
          data-testid="monaco-loading"
        >
          <Skeleton className="h-4 w-full bg-muted/20" />
          <Skeleton className="h-4 w-3/4 bg-muted/20" />
          <Skeleton className="h-4 w-5/6 bg-muted/20" />
          <Skeleton className="h-4 w-2/3 bg-muted/20" />
          <Skeleton className="h-4 w-4/5 bg-muted/20" />
        </div>
      )}

      {/* Error state overlay */}
      {error && (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[#1a1a1a] p-4"
          data-testid="monaco-error"
        >
          <div className="rounded-lg bg-destructive/10 p-3">
            <AlertCircle className="h-6 w-6 text-destructive" />
          </div>
          <div className="text-center">
            <p className="mb-1 text-sm font-medium text-destructive">Failed to load diff viewer</p>
            <p className="text-xs text-muted-foreground">{error}</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleRetry} className="gap-2">
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
        height={height}
        beforeMount={handleBeforeMount}
        onMount={handleMount}
        options={{
          // Read-only mode
          readOnly: true,
          originalEditable: false,

          // Split view with synchronized scrolling (AC #4)
          renderSideBySide: true,
          enableSplitViewResizing: true,

          // Line numbers visible (AC #4)
          lineNumbers: 'on',

          // UI options
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          wordWrap: 'off',
          renderIndicators: true,
          glyphMargin: true,

          // Collapse unchanged regions (AC #5)
          hideUnchangedRegions: {
            enabled: true,
            minimumLineCount: 3,
            contextLineCount: 3
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

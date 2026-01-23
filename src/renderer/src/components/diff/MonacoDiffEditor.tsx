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
import type { InlineComment } from '@shared/types/task.types'
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
 * Side of the diff editor where a gutter click occurred.
 * - 'original': Left side showing the old content
 * - 'modified': Right side showing the new content (typically where comments are added)
 */
export type DiffEditorSide = 'original' | 'modified'

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
  /**
   * Callback when user clicks on the gutter (line numbers or glyph margin) (Story 7.5)
   * Only fires for the modified editor side where inline comments are added.
   * @param lineNumber - The 1-indexed line number that was clicked
   * @param side - Which editor side was clicked ('original' or 'modified')
   */
  onGutterClick?: (lineNumber: number, side: DiffEditorSide) => void
  /**
   * Whether gutter click for comments is enabled (Story 7.5)
   * When true, enables the glyph margin and shows hover indicator
   */
  enableCommentGutter?: boolean
  /**
   * Inline comments to display as gutter decorations (Story 7.5 Task 8)
   * Comments are displayed as amber glyph margin indicators
   */
  comments?: InlineComment[]
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
  viewMode = 'split',
  onGutterClick,
  enableCommentGutter = false,
  comments = []
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

  // Ref to Monaco instance for decoration updates (Story 7.5 Task 8)
  const monacoRef = useRef<Monaco | null>(null)

  // Ref for decorations collection (Story 7.5 Task 8)
  const decorationsRef = useRef<editor.IEditorDecorationsCollection | null>(null)

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
   * Sets up gutter click handlers for inline comments (Story 7.5)
   */
  const handleMount = useCallback(
    (editor: editor.IStandaloneDiffEditor, monaco: Monaco) => {
      // Store editor reference for dynamic option updates (TES-4.5)
      editorRef.current = editor
      // Store Monaco instance for decoration updates (Story 7.5 Task 8)
      monacoRef.current = monaco
      setIsLoading(false)
      setError(null) // Clear errors on successful mount

      // Get the modified editor to access content height (TES-4.6)
      const modifiedEditor = editor.getModifiedEditor()
      const originalEditor = editor.getOriginalEditor()

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

      // Disposables to clean up on unmount
      const disposables: { dispose(): void }[] = []

      // Listen for content size changes and update height dynamically
      disposables.push(
        modifiedEditor.onDidContentSizeChange(() => {
          updateHeight()
        })
      )

      // Story 7.5: Set up gutter click handlers for inline comments
      if (onGutterClick && enableCommentGutter) {
        // Handler for modified editor (right side) - where comments are typically added
        disposables.push(
          modifiedEditor.onMouseDown((e: editor.IEditorMouseEvent) => {
            // Check if click was on gutter (line numbers or glyph margin)
            const targetType = e.target.type
            if (
              targetType === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN ||
              targetType === monaco.editor.MouseTargetType.GUTTER_LINE_NUMBERS ||
              targetType === monaco.editor.MouseTargetType.GUTTER_LINE_DECORATIONS
            ) {
              const lineNumber = e.target.position?.lineNumber
              if (lineNumber !== undefined && lineNumber > 0) {
                onGutterClick(lineNumber, 'modified')
              }
            }
          })
        )

        // Handler for original editor (left side) - optional, for viewing context
        disposables.push(
          originalEditor.onMouseDown((e: editor.IEditorMouseEvent) => {
            const targetType = e.target.type
            if (
              targetType === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN ||
              targetType === monaco.editor.MouseTargetType.GUTTER_LINE_NUMBERS ||
              targetType === monaco.editor.MouseTargetType.GUTTER_LINE_DECORATIONS
            ) {
              const lineNumber = e.target.position?.lineNumber
              if (lineNumber !== undefined && lineNumber > 0) {
                onGutterClick(lineNumber, 'original')
              }
            }
          })
        )
      }

      // Cleanup all listeners on unmount
      return () => {
        disposables.forEach((d) => d.dispose())
      }
    },
    [onGutterClick, enableCommentGutter]
  )

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

  /**
   * Story 7.5 Task 8: Update gutter decorations when comments change
   * Uses Monaco's IEditorDecorationsCollection for efficient updates
   */
  useEffect(() => {
    const editor = editorRef.current
    const monaco = monacoRef.current

    if (!editor || !monaco || !enableCommentGutter) return

    const modifiedEditor = editor.getModifiedEditor()
    const model = modifiedEditor.getModel()

    // Story 7.5 Fix Issue #6: Validate comments belong to current file and are within bounds
    // Filter comments for this exact file path (strict equality)
    const fileComments = comments.filter((c) => {
      // Ensure comment has valid structure
      if (!c.filePath || !c.lineNumber || !c.content) {
        return false
      }
      // Ensure file path matches exactly
      if (c.filePath !== filePath) {
        return false
      }
      // Ensure line number is within file bounds
      if (model && (c.lineNumber < 1 || c.lineNumber > model.getLineCount())) {
        console.warn(
          `Skipping comment for ${c.filePath}:${c.lineNumber} - line out of bounds (max: ${model.getLineCount()})`
        )
        return false
      }
      return true
    })

    // Group comments by line number
    const commentsByLine = new Map<number, InlineComment[]>()
    for (const comment of fileComments) {
      const existing = commentsByLine.get(comment.lineNumber) || []
      existing.push(comment)
      commentsByLine.set(comment.lineNumber, existing)
    }

    // Create decorations for each line with comments
    const decorations: editor.IModelDeltaDecoration[] = []
    for (const [lineNumber, lineComments] of commentsByLine) {
      const firstComment = lineComments[0]
      const previewText =
        firstComment.content.length > 50
          ? `${firstComment.content.slice(0, 50)}...`
          : firstComment.content
      const countText =
        lineComments.length > 1 ? ` (+${lineComments.length - 1} more)` : ''

      decorations.push({
        range: new monaco.Range(lineNumber, 1, lineNumber, 1),
        options: {
          isWholeLine: true,
          glyphMarginClassName: 'inline-comment-glyph',
          glyphMarginHoverMessage: {
            value: `**${lineComments.length} comment${lineComments.length > 1 ? 's' : ''}**\n\n"${previewText}"${countText}`
          }
        }
      })
    }

    // Clean up previous decorations
    if (decorationsRef.current) {
      decorationsRef.current.clear()
    }

    // Create new decorations collection
    if (decorations.length > 0) {
      decorationsRef.current = modifiedEditor.createDecorationsCollection(decorations)
    }

    // Cleanup on unmount (Story 7.5 Task 8.5)
    return () => {
      if (decorationsRef.current) {
        decorationsRef.current.clear()
        decorationsRef.current = null
      }
    }
  }, [comments, filePath, enableCommentGutter])

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
          // Story 7.5: Enable glyph margin when comment gutter is active for inline comments
          glyphMargin: enableCommentGutter,
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

/**
 * ConflictFileEditor - Monaco-based conflict editor with inline resolution buttons
 *
 * Displays git conflict markers with syntax highlighting and provides
 * inline "Accept Current" / "Accept Incoming" / "Accept Both" buttons.
 *
 * Story 8.8: Conflict Resolution UI - Task 2
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Editor, { type Monaco, loader } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import { cn } from '@renderer/lib/utils'
import { Skeleton } from '@renderer/components/ui/skeleton'
import { Button } from '@renderer/components/ui/button'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { registerTinsuThemes, TINSU_DARK_THEME, TINSU_LIGHT_THEME } from '../diff/theme'
import { useThemeStore } from '@renderer/stores'
import {
  parseConflictRegions,
  getConflictLineRanges,
  resolveConflict,
  hasUnresolvedConflicts,
  getLanguageFromPath,
  type ConflictRegion
} from './utils'

// Configure Monaco to load from local public directory (CSP-safe for Electron)
loader.config({
  paths: {
    vs: '/monaco/vs'
  }
})

/**
 * Props for ConflictFileEditor component.
 */
export interface ConflictFileEditorProps {
  /** File path for language detection and display */
  filePath: string
  /** Initial file content with conflict markers */
  content: string
  /** Callback when content changes */
  onChange: (content: string) => void
  /** Callback when file becomes fully resolved (no more conflicts) */
  onResolved?: () => void
  /** Additional CSS classes */
  className?: string
}

/**
 * ConflictFileEditor component.
 *
 * Features:
 * - Editable Monaco Editor (not DiffEditor)
 * - Conflict marker highlighting with decorations
 * - Inline resolution buttons via ViewZones
 * - Tracks resolved state
 */
export function ConflictFileEditor({
  filePath,
  content,
  onChange,
  onResolved,
  className
}: ConflictFileEditorProps): React.JSX.Element {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [localContent, setLocalContent] = useState(content)

  // Get current theme from store
  const theme = useThemeStore((state) => state.theme)
  const monacoTheme = theme === 'dark' ? TINSU_DARK_THEME : TINSU_LIGHT_THEME

  // Refs for Monaco instances
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<Monaco | null>(null)
  const themeRegisteredRef = useRef(false)
  const decorationsRef = useRef<string[]>([])
  const viewZoneIdsRef = useRef<string[]>([])

  // Ref to hold the addViewZones function to break circular dependency
  const addViewZonesRef = useRef<(() => void) | null>(null)

  // Sync content from props
  useEffect(() => {
    setLocalContent(content)
  }, [content])

  // Language detection
  const language = getLanguageFromPath(filePath)

  /**
   * Apply decorations to highlight conflict regions.
   */
  const applyDecorations = useCallback(() => {
    const editor = editorRef.current
    const monaco = monacoRef.current
    if (!editor || !monaco) return

    const model = editor.getModel()
    if (!model) return

    const currentContent = model.getValue()
    const { regions } = parseConflictRegions(currentContent)

    // Clear existing decorations
    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, [])

    // Build new decorations
    const newDecorations: editor.IModelDeltaDecoration[] = []

    for (const region of regions) {
      const ranges = getConflictLineRanges(currentContent, region)

      // Conflict marker start (<<<<<<)
      newDecorations.push({
        range: new monaco.Range(ranges.markerStart, 1, ranges.markerStart, 1),
        options: {
          isWholeLine: true,
          className: 'conflict-marker-line',
          marginClassName: 'conflict-margin-marker',
          glyphMarginClassName: 'conflict-glyph-marker'
        }
      })

      // Current content (green background)
      if (ranges.currentEnd >= ranges.currentStart) {
        newDecorations.push({
          range: new monaco.Range(ranges.currentStart, 1, ranges.currentEnd, 1),
          options: {
            isWholeLine: true,
            className: 'conflict-current-region',
            marginClassName: 'conflict-margin-current'
          }
        })
      }

      // Base content if diff3 (gray background)
      if (ranges.baseStart !== undefined && ranges.baseEnd !== undefined) {
        newDecorations.push({
          range: new monaco.Range(ranges.baseStart, 1, ranges.baseEnd, 1),
          options: {
            isWholeLine: true,
            className: 'conflict-base-region',
            marginClassName: 'conflict-margin-base'
          }
        })
      }

      // Separator (=======)
      newDecorations.push({
        range: new monaco.Range(ranges.separatorLine, 1, ranges.separatorLine, 1),
        options: {
          isWholeLine: true,
          className: 'conflict-separator-line',
          marginClassName: 'conflict-margin-separator'
        }
      })

      // Incoming content (blue background)
      if (ranges.incomingEnd >= ranges.incomingStart) {
        newDecorations.push({
          range: new monaco.Range(ranges.incomingStart, 1, ranges.incomingEnd, 1),
          options: {
            isWholeLine: true,
            className: 'conflict-incoming-region',
            marginClassName: 'conflict-margin-incoming'
          }
        })
      }

      // Conflict marker end (>>>>>>>)
      newDecorations.push({
        range: new monaco.Range(ranges.markerEnd, 1, ranges.markerEnd, 1),
        options: {
          isWholeLine: true,
          className: 'conflict-marker-line',
          marginClassName: 'conflict-margin-marker'
        }
      })
    }

    // Apply decorations
    decorationsRef.current = editor.deltaDecorations([], newDecorations)
  }, [])

  /**
   * Handle resolution choice for a specific conflict.
   */
  const handleResolveConflict = useCallback(
    (region: ConflictRegion, choice: 'current' | 'incoming' | 'both') => {
      const editor = editorRef.current
      if (!editor) return

      const model = editor.getModel()
      if (!model) return

      const currentContent = model.getValue()
      const newContent = resolveConflict(currentContent, region, choice)

      // Update editor content
      model.setValue(newContent)
      setLocalContent(newContent)
      onChange(newContent)

      // Re-apply decorations after content change
      setTimeout(() => {
        applyDecorations()
        // Use ref to call addViewZones to break circular dependency
        addViewZonesRef.current?.()

        // Check if fully resolved
        if (!hasUnresolvedConflicts(newContent)) {
          onResolved?.()
        }
      }, 0)
    },
    [onChange, onResolved, applyDecorations]
  )

  /**
   * Add ViewZones with resolution buttons above each conflict.
   */
  const addViewZones = useCallback(() => {
    const editor = editorRef.current
    if (!editor) return

    const model = editor.getModel()
    if (!model) return

    const currentContent = model.getValue()
    const { regions } = parseConflictRegions(currentContent)

    // Clear existing view zones
    editor.changeViewZones((accessor) => {
      for (const id of viewZoneIdsRef.current) {
        accessor.removeZone(id)
      }
      viewZoneIdsRef.current = []

      // Add view zone for each conflict
      for (const region of regions) {
        const domNode = document.createElement('div')
        domNode.className = 'conflict-resolution-buttons'

        // Create buttons container
        const buttonsHtml = `
          <div class="flex items-center gap-2 px-3 py-1.5 bg-[#1a1a1f] border-b border-amber-500/30">
            <span class="text-xs font-medium text-amber-400 mr-2">Resolve:</span>
            <button data-action="current" class="conflict-btn conflict-btn-current">
              Accept Current
            </button>
            <button data-action="incoming" class="conflict-btn conflict-btn-incoming">
              Accept Incoming
            </button>
            <button data-action="both" class="conflict-btn conflict-btn-both">
              Accept Both
            </button>
          </div>
        `
        domNode.innerHTML = buttonsHtml

        // Attach event listeners
        const buttons = domNode.querySelectorAll('button')
        buttons.forEach((btn) => {
          btn.addEventListener('click', (e) => {
            const action = (e.target as HTMLButtonElement).dataset.action as
              | 'current'
              | 'incoming'
              | 'both'
            if (action) {
              handleResolveConflict(region, action)
            }
          })
        })

        const zoneId = accessor.addZone({
          afterLineNumber: region.startLine - 1,
          heightInLines: 1,
          domNode
        })
        viewZoneIdsRef.current.push(zoneId)
      }
    })
  }, [handleResolveConflict])

  // Store addViewZones in ref after it's created
  useEffect(() => {
    addViewZonesRef.current = addViewZones
  }, [addViewZones])

  /**
   * Handler called before Monaco mounts.
   */
  const handleBeforeMount = useCallback((monaco: Monaco) => {
    monacoRef.current = monaco
    if (!themeRegisteredRef.current) {
      try {
        registerTinsuThemes(monaco)
        themeRegisteredRef.current = true
      } catch (err) {
        console.error('Failed to register Monaco themes:', err)
        setError('Failed to initialize theme.')
      }
    }
  }, [])

  /**
   * Handler called when the editor has mounted.
   */
  const handleMount = useCallback(
    (editor: editor.IStandaloneCodeEditor) => {
      editorRef.current = editor
      setIsLoading(false)
      setError(null)

      // Apply decorations and view zones
      applyDecorations()
      addViewZones()

      // Re-apply when content changes
      editor.onDidChangeModelContent(() => {
        applyDecorations()
      })
    },
    [applyDecorations, addViewZones]
  )

  /**
   * Handle content changes from the editor.
   */
  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      const newValue = value ?? ''
      setLocalContent(newValue)
      onChange(newValue)

      // Check if fully resolved after manual edit
      if (!hasUnresolvedConflicts(newValue)) {
        onResolved?.()
      }
    },
    [onChange, onResolved]
  )

  /**
   * Retry loading the editor after an error.
   */
  const handleRetry = useCallback(() => {
    setError(null)
    setIsLoading(true)
  }, [])

  /**
   * Timeout to detect Monaco loading failures.
   */
  useEffect(() => {
    if (!isLoading) return

    const timeout = setTimeout(() => {
      if (isLoading) {
        setError('Monaco editor failed to load')
        setIsLoading(false)
      }
    }, 10000)

    return () => clearTimeout(timeout)
  }, [isLoading])

  return (
    <div
      className={cn(
        'relative flex-1 overflow-hidden rounded-md border border-border/30 bg-[#0d1117]',
        className
      )}
      data-testid="conflict-file-editor"
    >
      {/* Loading state */}
      {isLoading && !error && (
        <div
          className="absolute inset-0 z-10 flex flex-col gap-1.5 bg-[#0d1117] p-4"
          data-testid="editor-loading"
        >
          <Skeleton className="h-4 w-full bg-muted/10" />
          <Skeleton className="h-4 w-[90%] bg-muted/10" />
          <Skeleton className="h-4 w-[95%] bg-muted/10" />
          <Skeleton className="h-4 w-[85%] bg-muted/10" />
        </div>
      )}

      {/* Error state */}
      {error && (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-[#0d1117] p-4"
          data-testid="editor-error"
        >
          <div className="rounded-lg bg-destructive/10 p-4">
            <AlertCircle className="h-7 w-7 text-destructive" />
          </div>
          <div className="text-center">
            <p className="mb-1.5 text-sm font-semibold text-foreground">Failed to load editor</p>
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

      <Editor
        key={error ? 'retry' : 'initial'}
        value={localContent}
        onChange={handleEditorChange}
        language={language}
        theme={monacoTheme}
        height="100%"
        beforeMount={handleBeforeMount}
        onMount={handleMount}
        options={{
          readOnly: false,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          lineNumbers: 'on',
          lineNumbersMinChars: 4,
          glyphMargin: true,
          folding: true,
          automaticLayout: true,
          renderLineHighlight: 'line',
          scrollbar: {
            verticalScrollbarSize: 10,
            horizontalScrollbarSize: 10,
            vertical: 'auto',
            horizontal: 'auto',
            useShadows: false
          },
          padding: {
            top: 8,
            bottom: 8
          }
        }}
      />
    </div>
  )
}

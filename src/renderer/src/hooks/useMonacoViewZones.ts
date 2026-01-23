import { useRef, useCallback, useLayoutEffect } from 'react'
import type { editor, IDisposable } from 'monaco-editor'

/**
 * Configuration for a ViewZone to be created in Monaco Editor.
 */
export interface ViewZoneConfig {
  /** Line number after which to insert the zone (1-indexed) */
  afterLineNumber: number
  /** Height of the zone in pixels */
  heightInPx: number
  /** DOM node to render in the zone */
  domNode: HTMLElement
  /** Optional margin DOM node */
  marginDomNode?: HTMLElement
}

/**
 * Hook result with methods to manage ViewZones.
 */
export interface UseMonacoViewZonesResult {
  /** Add a ViewZone and return its ID */
  addZone: (config: ViewZoneConfig) => string | null
  /** Remove a ViewZone by its ID */
  removeZone: (zoneId: string) => void
  /** Remove all ViewZones */
  clearZones: () => void
  /** Get all current zone IDs */
  getZoneIds: () => string[]
}

/**
 * Hook to manage Monaco Editor ViewZones.
 *
 * ViewZones allow injecting DOM content into the editor at specific line positions.
 * This is used for inline comment inputs and comment threads (Story 7.5).
 *
 * @param editor - Monaco editor instance (from getModifiedEditor() or getOriginalEditor())
 * @returns Methods to add, remove, and manage ViewZones
 *
 * @example
 * ```tsx
 * const { addZone, removeZone, clearZones } = useMonacoViewZones(editorRef.current)
 *
 * const handleAddComment = (lineNumber: number) => {
 *   const domNode = document.createElement('div')
 *   const zoneId = addZone({ afterLineNumber: lineNumber, heightInPx: 80, domNode })
 *   // Render React component into domNode
 * }
 * ```
 */
export function useMonacoViewZones(
  editor: editor.IStandaloneCodeEditor | null
): UseMonacoViewZonesResult {
  // Track all created zone IDs for cleanup
  const zoneIdsRef = useRef<Set<string>>(new Set())
  const disposablesRef = useRef<IDisposable[]>([])

  /**
   * Add a ViewZone to the editor.
   */
  const addZone = useCallback(
    (config: ViewZoneConfig): string | null => {
      if (!editor) return null

      let zoneId: string | null = null

      editor.changeViewZones((accessor) => {
        const id = accessor.addZone({
          afterLineNumber: config.afterLineNumber,
          heightInPx: config.heightInPx,
          domNode: config.domNode,
          marginDomNode: config.marginDomNode
        })
        zoneId = id
        zoneIdsRef.current.add(id)
      })

      return zoneId
    },
    [editor]
  )

  /**
   * Remove a specific ViewZone by ID.
   */
  const removeZone = useCallback(
    (zoneId: string): void => {
      if (!editor) return

      editor.changeViewZones((accessor) => {
        accessor.removeZone(zoneId)
        zoneIdsRef.current.delete(zoneId)
      })
    },
    [editor]
  )

  /**
   * Remove all ViewZones managed by this hook.
   */
  const clearZones = useCallback((): void => {
    if (!editor) return

    editor.changeViewZones((accessor) => {
      for (const zoneId of zoneIdsRef.current) {
        accessor.removeZone(zoneId)
      }
      zoneIdsRef.current.clear()
    })
  }, [editor])

  /**
   * Get all current zone IDs.
   */
  const getZoneIds = useCallback((): string[] => {
    return Array.from(zoneIdsRef.current)
  }, [])

  // Cleanup on unmount - use useLayoutEffect to ensure cleanup happens synchronously
  // Story 7.5 Fix Issue #4: Prevent ViewZone cleanup race conditions
  useLayoutEffect(() => {
    return () => {
      // Clear all zones when component unmounts or editor changes
      if (editor) {
        try {
          editor.changeViewZones((accessor) => {
            // Create array to avoid iterator invalidation during deletion
            const zoneIds = Array.from(zoneIdsRef.current)
            for (const zoneId of zoneIds) {
              accessor.removeZone(zoneId)
            }
            zoneIdsRef.current.clear()
          })
        } catch (error) {
          // Editor might already be disposed, ignore
          console.warn('Failed to cleanup ViewZones:', error)
        }
      }
      // Dispose any event listeners
      disposablesRef.current.forEach((d) => d.dispose())
      disposablesRef.current = []
    }
  }, [editor])

  return {
    addZone,
    removeZone,
    clearZones,
    getZoneIds
  }
}

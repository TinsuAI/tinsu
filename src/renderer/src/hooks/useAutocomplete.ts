/**
 * useAutocomplete - Autocomplete state machine for chat input.
 *
 * Supports two trigger modes:
 * - `/` for slash command completion (client-side filtering)
 * - `@` for file/folder path completion (debounced backend fetch)
 *
 * Returns event handlers that integrate with ChatInput's existing
 * handleChange and handleKeyDown callbacks.
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { trpc } from '@renderer/lib/trpc'
import { getFilteredCommands, type SlashCommandDefinition } from '@renderer/constants/slash-commands'

type AutocompleteTrigger = '/' | '@'

export interface AutocompleteItem {
  id: string
  label: string
  description?: string
  icon: 'command' | 'workflow' | 'file' | 'folder'
  insertText: string
  category: string
}

export interface AutocompleteState {
  isOpen: boolean
  trigger: AutocompleteTrigger | null
  query: string
  triggerIndex: number
  items: AutocompleteItem[]
  selectedIndex: number
  isLoading: boolean
}

const INITIAL_STATE: AutocompleteState = {
  isOpen: false,
  trigger: null,
  query: '',
  triggerIndex: -1,
  items: [],
  selectedIndex: 0,
  isLoading: false
}

function commandToItem(cmd: SlashCommandDefinition): AutocompleteItem {
  return {
    id: cmd.command,
    label: cmd.command,
    description: cmd.description,
    icon: cmd.category === 'workflow' ? 'workflow' : 'command',
    insertText: cmd.command,
    category: cmd.category === 'workflow' ? 'Workflows' : 'Commands'
  }
}

/**
 * Find the active trigger character scanning backwards from the cursor.
 * Returns null if no valid trigger is found.
 */
function findTrigger(
  value: string,
  cursorPos: number
): { trigger: AutocompleteTrigger; triggerIndex: number; query: string } | null {
  // Scan backwards from cursor
  for (let i = cursorPos - 1; i >= 0; i--) {
    const ch = value[i]

    // For slash commands: trigger must be at start or after whitespace
    if (ch === '/') {
      if (i === 0 || /\s/.test(value[i - 1])) {
        const query = value.slice(i + 1, cursorPos)
        // Slash commands don't contain spaces
        if (!query.includes(' ')) {
          return { trigger: '/', triggerIndex: i, query }
        }
      }
      return null
    }

    // For file paths: trigger must be at start or after whitespace
    if (ch === '@') {
      if (i === 0 || /\s/.test(value[i - 1])) {
        const query = value.slice(i + 1, cursorPos)
        // File paths don't contain spaces
        if (!query.includes(' ')) {
          return { trigger: '@', triggerIndex: i, query }
        }
      }
      return null
    }

    // Stop scanning at whitespace (no trigger in sight)
    if (/\s/.test(ch)) return null
  }

  return null
}

interface UseAutocompleteOptions {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  value: string
  setValue: (value: string) => void
}

export interface UseAutocompleteReturn {
  state: AutocompleteState
  handleInputChange: (value: string, cursorPos: number) => void
  handleKeyDown: (e: React.KeyboardEvent) => boolean
  selectItem: (index: number) => void
  dismiss: () => void
}

export function useAutocomplete({
  textareaRef,
  value,
  setValue
}: UseAutocompleteOptions): UseAutocompleteReturn {
  const [state, setState] = useState<AutocompleteState>(INITIAL_STATE)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const utils = trpc.useUtils()

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const fetchFiles = useCallback(
    async (query: string) => {
      setState((s) => ({ ...s, isLoading: true }))
      try {
        // If query contains '/', use directory-based prefix listing
        // If query is empty, show root directory listing
        // Otherwise, use fuzzy search across all project files
        const useFuzzy = query !== '' && !query.includes('/')
        const results = useFuzzy
          ? await utils.project.searchFiles.fetch({ query })
          : await utils.project.listFiles.fetch({ prefix: query })

        setState((s) => {
          // Only update if we're still in file mode
          if (s.trigger !== '@') return s
          const items: AutocompleteItem[] = results.map((r) => ({
            id: r.relativePath,
            label: r.name,
            description: r.relativePath,
            icon: r.isDirectory ? ('folder' as const) : ('file' as const),
            insertText: r.relativePath + (r.isDirectory ? '/' : ' '),
            category: 'Files'
          }))
          return {
            ...s,
            items,
            selectedIndex: 0,
            isLoading: false,
            isOpen: items.length > 0
          }
        })
      } catch {
        setState((s) => ({ ...s, items: [], isLoading: false, isOpen: false }))
      }
    },
    [utils.project.listFiles, utils.project.searchFiles]
  )

  const handleInputChange = useCallback(
    (newValue: string, cursorPos: number) => {
      const found = findTrigger(newValue, cursorPos)

      if (!found) {
        if (state.isOpen) setState(INITIAL_STATE)
        if (debounceRef.current) clearTimeout(debounceRef.current)
        return
      }

      if (found.trigger === '/') {
        // Slash commands: client-side filter
        const commands = getFilteredCommands('/' + found.query)
        const items = commands.map(commandToItem)
        setState({
          isOpen: items.length > 0,
          trigger: '/',
          query: found.query,
          triggerIndex: found.triggerIndex,
          items,
          selectedIndex: 0,
          isLoading: false
        })
      } else if (found.trigger === '@') {
        // File paths: debounced backend fetch
        setState((s) => ({
          ...s,
          trigger: '@',
          query: found.query,
          triggerIndex: found.triggerIndex,
          isOpen: true
        }))

        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => {
          fetchFiles(found.query)
        }, 200)
      }
    },
    [state.isOpen, fetchFiles]
  )

  const insertSelection = useCallback(
    (item: AutocompleteItem) => {
      const { triggerIndex } = state
      const textarea = textareaRef.current
      if (!textarea) return

      const cursorPos = textarea.selectionStart
      const before = value.slice(0, triggerIndex)
      const after = value.slice(cursorPos)
      const newValue = before + item.insertText + after
      const newCursorPos = before.length + item.insertText.length

      setValue(newValue)
      setState(INITIAL_STATE)

      // Restore cursor position after React re-render
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.setSelectionRange(newCursorPos, newCursorPos)
          textareaRef.current.focus()
        }
      })
    },
    [state, value, setValue, textareaRef]
  )

  const selectItem = useCallback(
    (index: number) => {
      const item = state.items[index]
      if (item) insertSelection(item)
    },
    [state.items, insertSelection]
  )

  const dismiss = useCallback(() => {
    setState(INITIAL_STATE)
    if (debounceRef.current) clearTimeout(debounceRef.current)
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent): boolean => {
      if (!state.isOpen || state.items.length === 0) return false
      if (e.nativeEvent.isComposing) return false

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setState((s) => ({
            ...s,
            selectedIndex: (s.selectedIndex + 1) % s.items.length
          }))
          return true

        case 'ArrowUp':
          e.preventDefault()
          setState((s) => ({
            ...s,
            selectedIndex: (s.selectedIndex - 1 + s.items.length) % s.items.length
          }))
          return true

        case 'Tab':
        case 'Enter':
          e.preventDefault()
          selectItem(state.selectedIndex)
          return true

        case 'Escape':
          e.preventDefault()
          dismiss()
          return true

        default:
          return false
      }
    },
    [state.isOpen, state.items.length, state.selectedIndex, selectItem, dismiss]
  )

  return { state, handleInputChange, handleKeyDown, selectItem, dismiss }
}

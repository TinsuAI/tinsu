/**
 * AutocompleteDropdown - Floating suggestion list for chat input autocomplete.
 *
 * Renders above the textarea with grouped items (Commands, Workflows, Files).
 * Supports keyboard navigation highlighting and click selection.
 */

import { useEffect, useRef } from 'react'
import { Terminal, Workflow, File, Folder, Loader2 } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import type { AutocompleteState, AutocompleteItem } from '@renderer/hooks/useAutocomplete'

interface AutocompleteDropdownProps {
  state: AutocompleteState
  onSelect: (index: number) => void
}

function ItemIcon({ icon }: { icon: AutocompleteItem['icon'] }) {
  const cls = 'h-3.5 w-3.5 shrink-0'
  switch (icon) {
    case 'command':
      return <Terminal className={cn(cls, 'text-muted-foreground/60')} />
    case 'workflow':
      return <Workflow className={cn(cls, 'text-cyan-400/60')} />
    case 'folder':
      return <Folder className={cn(cls, 'text-amber-400/60')} />
    case 'file':
      return <File className={cn(cls, 'text-muted-foreground/50')} />
  }
}

export function AutocompleteDropdown({ state, onSelect }: AutocompleteDropdownProps) {
  const listRef = useRef<HTMLDivElement>(null)
  const selectedRef = useRef<HTMLDivElement>(null)

  // Scroll selected item into view
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest' })
  }, [state.selectedIndex])

  if (!state.isOpen) return null

  // Group items by category
  const groups: { label: string; items: { item: AutocompleteItem; globalIndex: number }[] }[] = []
  const groupMap = new Map<string, { item: AutocompleteItem; globalIndex: number }[]>()

  state.items.forEach((item, i) => {
    const key = item.category
    if (!groupMap.has(key)) {
      const arr: { item: AutocompleteItem; globalIndex: number }[] = []
      groupMap.set(key, arr)
      groups.push({ label: key, items: arr })
    }
    groupMap.get(key)!.push({ item, globalIndex: i })
  })

  return (
    <div
      ref={listRef}
      className="absolute bottom-full left-0 z-50 mb-1 max-h-64 w-80 overflow-y-auto rounded-lg border border-border/50 bg-popover shadow-lg"
      data-testid="autocomplete-dropdown"
    >
      {groups.map((group) => (
        <div key={group.label}>
          <div className="sticky top-0 bg-popover/95 px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/40">
            {group.label}
          </div>
          {group.items.map(({ item, globalIndex }) => {
            const isSelected = globalIndex === state.selectedIndex
            return (
              <div
                key={item.id}
                ref={isSelected ? selectedRef : undefined}
                className={cn(
                  'flex cursor-pointer items-center gap-2 px-3 py-1.5',
                  isSelected
                    ? 'bg-cyan-500/10 text-cyan-400'
                    : 'text-foreground/80 hover:bg-accent/30'
                )}
                onMouseDown={(e) => {
                  e.preventDefault() // keep textarea focus
                  onSelect(globalIndex)
                }}
                data-testid={`autocomplete-item-${globalIndex}`}
              >
                <ItemIcon icon={item.icon} />
                <span className="truncate text-sm">{item.label}</span>
                {item.description && (
                  <span className="ml-auto truncate text-[11px] text-muted-foreground/40">
                    {item.description}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      ))}

      {state.isLoading && (
        <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground/40">
          <Loader2 className="h-3 w-3 animate-spin" />
          Searching...
        </div>
      )}

      {!state.isLoading && state.items.length === 0 && state.isOpen && (
        <div className="px-3 py-2 text-xs text-muted-foreground/30">No matches</div>
      )}
    </div>
  )
}

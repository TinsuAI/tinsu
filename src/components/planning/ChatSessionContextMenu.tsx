/**
 * ChatSessionContextMenu - Minimal dropdown for session actions.
 *
 * Story 10.6: Session Persistence & Resume (AC: 6)
 *
 * Custom dropdown (no shadcn/ui DropdownMenu available) triggered by kebab button.
 * Renders "Mark as Completed" and "Delete" actions with inline confirmation.
 * Click-outside and Escape key close the menu.
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { CheckCircle, Trash2 } from 'lucide-react'
import { cn } from '@renderer/lib/utils'

export interface ChatSessionListItem {
  id: string
  session_uuid: string
  agent_persona: string
  workflow_key: string | null
  status: string
  created_at: Date | string | number
  updated_at: Date | string | number
  last_message_at: Date | string | number | null
  lastMessagePreview: string | null
  skip_permissions: boolean | number | null
  /** CTM-2.3: Live tmux/PTY session status for real-time badges */
  liveStatus?: 'thinking' | 'idle' | 'completed' | 'exited' | 'unknown'
}

interface ChatSessionContextMenuProps {
  session: ChatSessionListItem
  onComplete: () => void
  onDelete: () => void
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function ChatSessionContextMenu({
  session,
  onComplete,
  onDelete,
  isOpen,
  onOpenChange
}: ChatSessionContextMenuProps) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const canComplete = session.status === 'active' || session.status === 'paused'

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return

    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onOpenChange(false)
        setConfirmDelete(false)
      }
    }

    // Use setTimeout to avoid the click that opened the menu from immediately closing it
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 0)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onOpenChange])

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onOpenChange(false)
        setConfirmDelete(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onOpenChange])

  // Reset confirm state when menu closes
  useEffect(() => {
    if (!isOpen) setConfirmDelete(false)
  }, [isOpen])

  const handleComplete = useCallback(() => {
    onComplete()
    onOpenChange(false)
  }, [onComplete, onOpenChange])

  const handleDeleteConfirm = useCallback(() => {
    onDelete()
    onOpenChange(false)
    setConfirmDelete(false)
  }, [onDelete, onOpenChange])

  if (!isOpen) return null

  return (
    <div
      ref={menuRef}
      className={cn(
        'absolute right-0 top-full z-50 mt-1 min-w-[180px]',
        'rounded-md border border-border bg-popover py-1 shadow-lg shadow-black/30',
        'animate-in fade-in-0 zoom-in-95 duration-100'
      )}
      role="menu"
      data-testid="session-context-menu"
    >
      {canComplete && (
        <button
          type="button"
          role="menuitem"
          onClick={handleComplete}
          className={cn(
            'flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-xs',
            'text-popover-foreground/80 transition-colors hover:bg-accent/30 hover:text-popover-foreground'
          )}
          data-testid="session-menu-complete"
        >
          <CheckCircle className="h-3.5 w-3.5 text-muted-foreground" />
          <span>Mark as Completed</span>
        </button>
      )}

      {!confirmDelete ? (
        <button
          type="button"
          role="menuitem"
          onClick={() => setConfirmDelete(true)}
          className={cn(
            'flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-xs',
            'text-red-400/80 transition-colors hover:bg-red-500/10 hover:text-red-400'
          )}
          data-testid="session-menu-delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span>Delete</span>
        </button>
      ) : (
        <div className="px-3 py-1.5" data-testid="session-menu-delete-confirm">
          <p className="mb-1.5 text-xs text-red-400/90">Delete this session?</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDeleteConfirm}
              className="rounded bg-red-500/20 px-2 py-0.5 text-[11px] font-medium text-red-400 transition-colors hover:bg-red-500/30"
              data-testid="session-menu-delete-yes"
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="rounded px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
              data-testid="session-menu-delete-cancel"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

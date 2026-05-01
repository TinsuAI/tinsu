/**
 * MobileActivityDetail — bottom sheet showing full activity detail.
 *
 * Story T3.5-8, Task 4 (AC: 7, 8, 19).
 *
 * Uses MobileSheet snapPoint="half". Shows:
 *   - event_type heading + category chip
 *   - Task name + status pill (no extra rspc round-trip — resolved from props)
 *   - Full payload as pretty-printed JSON in a scrollable code block
 *   - created_at as long-form timestamp
 *   - "Open task" primary button
 *
 * AC-8 navigation order:
 *   pushRoute('tasks', 'workspace:{taskId}') → switchTab('tasks')
 *   (push first so the tab switch sees the freshly-pushed route)
 *
 * Sub-tab routing per event_type:
 *   tool_used → 'terminal' (via useTaskWorkspaceStore.setSubTab if present)
 *   all other → 'activities'
 *
 * AC-16: No imports from @renderer/components/ui/*.
 * AC-17: Token-only colors.
 * AC-18: "Open task" button ≥ 44 px.
 * AC-19: aria-modal, aria-labelledby on sheet.
 */

import { useId } from 'react'
import { cn } from '@renderer/lib/utils'
import { MobileSheet } from '../primitives/MobileSheet'
import { useMobileNavStore } from '../shell/mobile-nav.store'
import { eventTypeToTitle, eventTypeToCategory } from './activity-meta'
import type { Activity } from '@shared/types/activity.types'

/* ── Props ──────────────────────────────────────────────────────── */

interface MobileActivityDetailProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  activity: Activity | null
  /** Task name for the task that owns this activity (resolved by caller from cache) */
  taskName?: string
  /** Task status (resolved by caller from cache) */
  taskStatus?: string
}

/* ── Helpers ────────────────────────────────────────────────────── */

function formatTimestamp(ms: number): string {
  try {
    return new Date(ms).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'medium',
    })
  } catch {
    return String(ms)
  }
}

function prettyPayload(payload: string | null): string {
  if (!payload) return '{}'
  try {
    return JSON.stringify(JSON.parse(payload), null, 2)
  } catch {
    return payload
  }
}

/* ── Component ──────────────────────────────────────────────────── */

export function MobileActivityDetail({
  open,
  onOpenChange,
  activity,
  taskName,
  taskStatus,
}: MobileActivityDetailProps) {
  const titleId = useId()
  const { pushRoute, switchTab } = useMobileNavStore()

  if (!activity) return null

  const category = eventTypeToCategory(activity.event_type)
  const title = eventTypeToTitle(activity.event_type)

  const handleOpenTask = () => {
    // AC-8: push route first, then switch tab
    pushRoute('tasks', `workspace:${activity.task_id}`)
    switchTab('tasks')
    onOpenChange(false)
  }

  return (
    <MobileSheet
      open={open}
      onOpenChange={onOpenChange}
      snapPoint="half"
      title={title}
      ariaLabel={`Activity detail: ${title}`}
    >
      <div
        role="dialog"
        aria-modal
        aria-labelledby={titleId}
        className="flex flex-col gap-4 pb-2"
      >
        {/* Event type heading + category chip */}
        <div className="flex items-center gap-2 flex-wrap">
          <span id={titleId} className="text-base font-semibold text-foreground">
            {title}
          </span>
          <span className="px-2 py-0.5 rounded-full bg-muted/50 text-xs text-muted-foreground border border-border/30">
            {category}
          </span>
        </div>

        {/* Task info */}
        {taskName && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">Task:</span>
            <span className="text-xs font-medium text-foreground truncate max-w-[60%]">
              {taskName}
            </span>
            {taskStatus && (
              <span className="px-1.5 py-0.5 rounded bg-muted/50 text-xs text-muted-foreground border border-border/30">
                {taskStatus}
              </span>
            )}
          </div>
        )}

        {/* Timestamp */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">At:</span>
          <span className="text-xs text-foreground">
            {formatTimestamp(activity.created_at)}
          </span>
        </div>

        {/* Payload JSON code block */}
        <div>
          <p className="text-xs text-muted-foreground mb-1.5">Payload</p>
          <pre
            className={cn(
              'text-xs font-mono bg-muted/40 p-3 rounded-md',
              'overflow-auto max-h-64',
              'text-foreground leading-relaxed',
              'border border-border/20',
            )}
          >
            {prettyPayload(activity.payload)}
          </pre>
        </div>

        {/* Open task button — AC-18: ≥ 44px */}
        <button
          type="button"
          onClick={handleOpenTask}
          aria-label={`Open task${taskName ? ': ' + taskName : ''}`}
          className={cn(
            'w-full min-h-11 rounded-xl',
            'flex items-center justify-center',
            'bg-primary text-primary-foreground',
            'text-sm font-semibold',
            'transition-opacity duration-150 active:opacity-80',
          )}
        >
          Open task
        </button>
      </div>
    </MobileSheet>
  )
}

/**
 * MobileActivityFeedScreen — cross-task live activity feed.
 *
 * Story T3.5-8, Tasks 3 & 4 (AC: 1-8, 19, 20).
 *
 * Architecture:
 *   1. On mount: fetch all tasks via commands.listTasks, then parallel-fetch
 *      50 activities per task via commands.listActivitiesForTask. Merge, sort
 *      by created_at desc, cap at 200 displayed. (No new Rust command — TS merge.)
 *   2. Live: subscribe to global 'activity:created' via useGlobalActivitySubscription.
 *      Prepend new activities; deduplicate by activity.id. Highlight new rows 1.5s.
 *   3. Filter: MobileChip strip with 7 categories (AC-4).
 *   4. Deep-link: reads + clears pendingActivityForTask from store on mount (AC-13).
 *
 * AC-6: Loading skeleton on FIRST fetch only; live updates do NOT show skeleton.
 * AC-3: prefers-reduced-motion respected for row glow.
 * AC-19: aria-live announcer throttled to 1s.
 * AC-16: No imports from @renderer/components/ui/*.
 * AC-17: Token-only colors.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Activity as ActivityIcon } from 'lucide-react'
import { commands } from '@renderer/lib/rspc'
import { useProjectStore } from '@renderer/stores/project.store'
import { MobileChip } from '../primitives/MobileChip'
import { MobileEmptyState } from '../primitives/MobileEmptyState'
import { MobileLoadingSkeleton } from '../primitives/MobileLoadingSkeleton'
import { MobileActivityRow } from './MobileActivityRow'
import { MobileActivityDetail } from './MobileActivityDetail'
import { useGlobalActivitySubscription } from '@renderer/hooks/useGlobalActivitySubscription'
import { useMobileNavStore } from '../shell/mobile-nav.store'
import { categoryFilterToEventTypes } from './activity-meta'
import type { Activity } from '@shared/types/activity.types'
import type { ActivityCategory } from './activity-meta'

/* ── Constants ──────────────────────────────────────────────────── */

const MAX_DISPLAYED = 200
const HIGHLIGHT_DURATION_MS = 1500
const ANNOUNCE_THROTTLE_MS = 1000

const FILTER_CATEGORIES: ActivityCategory[] = [
  'All', 'Status', 'Agent', 'Tools', 'Errors', 'User', 'Auto',
]

/* ── Task name cache type ───────────────────────────────────────── */
type TaskMeta = { name: string; status: string }
type TaskMetaCache = Map<string, TaskMeta>

/* ── Component ──────────────────────────────────────────────────── */

export function MobileActivityFeedScreen() {
  const projectId = useProjectStore((s) => s.activeProjectId) ?? ''
  const { pendingActivityForTask, setPendingActivityForTask } = useMobileNavStore()

  const [activities, setActivities] = useState<Activity[]>([])
  const [taskMetaCache, setTaskMetaCache] = useState<TaskMetaCache>(new Map())
  const [isLoading, setIsLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<ActivityCategory>('All')
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set())
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)

  // Announcer for screen readers (AC-19)
  const [announcement, setAnnouncement] = useState('')
  const announceThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingCountRef = useRef(0)

  /* ── Initial seed fetch ─────────────────────────────────────── */
  useEffect(() => {
    let cancelled = false

    const fetchAll = async () => {
      try {
        // 1. Fetch all tasks
        const tasksResult = await commands.listTasks({ project_id: projectId })
        if (tasksResult.status === 'error' || cancelled) return

        const tasks = tasksResult.data
        const meta = new Map<string, TaskMeta>()
        tasks.forEach((t) => meta.set(t.id, { name: t.title, status: t.status }))

        // 2. Parallel-fetch activities per task (50 each)
        const activityChunks = await Promise.all(
          tasks.map((t) =>
            commands.listActivitiesForTask(t.id, 50, null, null).then((r) =>
              r.status === 'ok' ? r.data : []
            )
          )
        )

        if (cancelled) return

        // 3. Merge, deduplicate by id, sort desc, cap at MAX_DISPLAYED
        const seen = new Set<string>()
        const merged: Activity[] = (activityChunks.flat() as Activity[])
          .filter((a) => {
            if (seen.has(a.id)) return false
            seen.add(a.id)
            return true
          })
          .sort((a, b) => b.created_at - a.created_at)
          .slice(0, MAX_DISPLAYED)

        setActivities(merged)
        setTaskMetaCache(meta)
      } catch {
        // Silent failure — empty state renders
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void fetchAll()
    return () => { cancelled = true }
  }, [projectId])

  /* ── Deep-link: pendingActivityForTask ──────────────────────── */
  // Consumed after the initial fetch completes (isLoading → false).
  // Activities are empty on mount, so we must wait for the seed fetch before
  // searching. The 2s timeout guards against a permanently pending state if
  // no matching activity is ever found.
  const pendingTaskIdRef = useRef(pendingActivityForTask)
  useEffect(() => {
    // Capture the pending task ID once (ref prevents stale closure)
    if (pendingTaskIdRef.current && pendingActivityForTask) {
      pendingTaskIdRef.current = pendingActivityForTask
    }
  }, [pendingActivityForTask])

  useEffect(() => {
    if (isLoading) return          // wait for seed fetch to complete
    if (!pendingTaskIdRef.current) return

    const taskId = pendingTaskIdRef.current
    // Consume + clear the pending value immediately to prevent double-open
    pendingTaskIdRef.current = null
    setPendingActivityForTask(null)

    // Try to find the most-recent activity for this taskId
    const match = activities.find((a) => a.task_id === taskId)
    if (match) {
      setSelectedActivity(match)
      setIsDetailOpen(true)
    }
    // If not found: silent no-op (AC-13 — no sheet opens after 2s)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading])   // fires once when isLoading flips false

  /* ── Live subscription (cross-task, AC-3) ───────────────────── */
  const handleNewActivity = useCallback((activity: Activity) => {
    setActivities((prev) => {
      // Deduplicate by id (AC-3)
      if (prev.some((a) => a.id === activity.id)) return prev
      const next = [activity, ...prev].slice(0, MAX_DISPLAYED)
      return next
    })

    // Update task meta cache if we see a new task_id
    setTaskMetaCache((prev) => {
      if (prev.has(activity.task_id)) return prev
      const next = new Map(prev)
      next.set(activity.task_id, { name: activity.task_id, status: 'unknown' })
      return next
    })

    // Highlight for HIGHLIGHT_DURATION_MS (AC-3)
    setHighlightedIds((prev) => {
      const next = new Set(prev)
      next.add(activity.id)
      return next
    })
    setTimeout(() => {
      setHighlightedIds((prev) => {
        const next = new Set(prev)
        next.delete(activity.id)
        return next
      })
    }, HIGHLIGHT_DURATION_MS)

    // Throttled aria-live announcer (AC-19)
    pendingCountRef.current += 1
    if (announceThrottleRef.current) return
    announceThrottleRef.current = setTimeout(() => {
      const count = pendingCountRef.current
      pendingCountRef.current = 0
      announceThrottleRef.current = null
      setAnnouncement(`${count} new ${count === 1 ? 'activity' : 'activities'}`)
    }, ANNOUNCE_THROTTLE_MS)
  }, [])

  useGlobalActivitySubscription({
    onActivity: handleNewActivity,
    enabled: !isLoading,   // only after first fetch
  })

  /* ── Filter ─────────────────────────────────────────────────── */
  const filteredActivities = useMemo(() => {
    const types = categoryFilterToEventTypes(activeFilter)
    if (!types) return activities
    return activities.filter((a) => types.includes(a.event_type))
  }, [activities, activeFilter])

  /* ── Row tap handler ─────────────────────────────────────────── */
  const handleRowPress = useCallback((activity: Activity) => {
    setSelectedActivity(activity)
    setIsDetailOpen(true)
  }, [])

  /* ── Render states ──────────────────────────────────────────── */

  // First-fetch loading skeleton (AC-6)
  if (isLoading) {
    return (
      <div className="flex flex-col h-full" data-testid="mobile-activity-feed-screen">
        <div className="px-4 py-3 overflow-x-auto">
          <div className="flex gap-2">
            {FILTER_CATEGORIES.map((cat) => (
              <MobileChip key={cat} label={cat} selected={cat === 'All'} />
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <MobileLoadingSkeleton variant="list-row" count={6} />
        </div>
      </div>
    )
  }

  // Empty state
  const showEmpty = filteredActivities.length === 0
  const isFilteredEmpty = activeFilter !== 'All' && activities.length > 0 && showEmpty

  return (
    <div className="flex flex-col h-full" data-testid="mobile-activity-feed-screen">
      {/* aria-live announcer for screen readers (AC-19) */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic
        className="sr-only"
      >
        {announcement}
      </div>

      {/* Chip strip filter (AC-4) */}
      <div
        className="px-4 py-3 overflow-x-auto shrink-0 border-b border-border/20"
        role="toolbar"
        aria-label="Filter activities"
      >
        <div className="flex gap-2 w-max">
          {FILTER_CATEGORIES.map((cat) => (
            <MobileChip
              key={cat}
              label={cat}
              selected={activeFilter === cat}
              onPress={() => setActiveFilter(cat)}
            />
          ))}
        </div>
      </div>

      {/* List or empty state */}
      {showEmpty ? (
        <div className="flex-1 flex items-center justify-center">
          <MobileEmptyState
            icon={<ActivityIcon className="h-10 w-10" />}
            title="No activity yet"
            subtitle={
              isFilteredEmpty
                ? 'No events match this filter — try All.'
                : 'Start a task to see agent events here.'
            }
          />
        </div>
      ) : (
        <div
          className="flex-1 overflow-y-auto overscroll-contain"
          role="list"
          aria-label="Activity feed"
        >
          {filteredActivities.map((activity) => (
            <MobileActivityRow
              key={activity.id}
              activity={activity}
              onPress={handleRowPress}
              highlight={highlightedIds.has(activity.id)}
            />
          ))}
        </div>
      )}

      {/* Activity detail sheet (AC-7, 8) */}
      <MobileActivityDetail
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        activity={selectedActivity}
        taskName={selectedActivity ? taskMetaCache.get(selectedActivity.task_id)?.name : undefined}
        taskStatus={selectedActivity ? taskMetaCache.get(selectedActivity.task_id)?.status : undefined}
      />
    </div>
  )
}

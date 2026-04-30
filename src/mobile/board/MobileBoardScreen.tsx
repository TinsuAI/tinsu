/**
 * MobileBoardScreen — mobile kanban board with column pager + @dnd-kit drag.
 *
 * Architecture:
 *  - MobileColumnPager (scroll-snap) hosts 5 columns in TASK_STATUS order.
 *  - DndContext wraps the pager so autoScroll operates against the pager's
 *    overflow-x scroll container (matches commit f8ec1e6 fix).
 *  - Sensors replicate desktop KanbanBoard.tsx: MouseSensor(8), TouchSensor(250/10),
 *    KeyboardSensor(sortableKeyboardCoordinates).
 *  - SortableContext per column; inline SortableMobileTaskCard wraps each card.
 *  - handleDragEnd extracted as a pure helper for testability.
 *  - Column-name pill rendered above the pager (no MobileApp.tsx refactor needed).
 *  - MobileFab opens MobileNewTaskSheet; same openSheet fn used by column headers
 *    and empty-state CTAs.
 *
 * Dev Notes:
 *  - initialStatus does NOT propagate to commands.createTask (v1 limitation).
 *    New tasks always land in 'backlog'. Documented in MobileNewTaskSheet.tsx.
 *  - MobileApp.tsx owns MobileTopAppBar. This screen renders a column-name pill
 *    inline above the pager instead of refactoring the top-bar ownership. A future
 *    story may introduce a per-screen top-bar slot if the pattern is needed widely.
 *  - No desktop component imports (KanbanBoard, TaskCard, dialogs, etc.).
 *    Only COLUMN_CONFIG constant is imported from KanbanColumn (per AC 17 allowlist).
 *
 * Token contract: bg-background column background. No inline color classes.
 * Reduced-motion: haptics gated via useReducedMotion (primitives self-gate).
 *
 * Story T3.5-3 — Mobile Board.
 */

import { useState, useCallback } from 'react'
import { Plus } from 'lucide-react'
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { cn, hapticFeedback } from '@renderer/lib/utils'
import { COLUMN_CONFIG } from '@renderer/components/board/KanbanColumn'
import { useListTasks, useUpdateTaskStatus, useReorderTasks } from '@renderer/hooks/useTaskCommands'
import { useProjectStore } from '@renderer/stores/project.store'
import { useMobileNavStore } from '../shell/mobile-nav.store'
import { useReducedMotion } from '../hooks/useReducedMotion'
import {
  MobileColumnPager,
  MobileEmptyState,
  MobileLoadingSkeleton,
  MobileFab,
} from '../primitives'
import { MobileTaskCard } from './MobileTaskCard'
import { MobileColumnHeader } from './MobileColumnHeader'
import { MobileNewTaskSheet } from './MobileNewTaskSheet'
import { TASK_STATUS, type TaskStatus, type Task } from '@shared/types/task.types'

/* ── Sorted column order from COLUMN_CONFIG ──────────────────────── */
const SORTED_STATUSES: TaskStatus[] = [...TASK_STATUS].sort(
  (a, b) => COLUMN_CONFIG[a].order - COLUMN_CONFIG[b].order,
)

/* ── Drop action type for testable handleDragEnd logic ───────────── */
export type DropAction =
  | { type: 'status-change'; taskId: string; newStatus: TaskStatus }
  | { type: 'reorder'; taskIds: string[]; status: TaskStatus }

/**
 * Pure helper: given drag result, resolve the action to perform.
 * Exported for unit testing without pointer event simulation.
 */
export function resolveDrop(params: {
  activeId: string
  overId: string
  tasksByStatus: Record<TaskStatus, Task[]>
}): DropAction | null {
  const { activeId, overId, tasksByStatus } = params

  // Find source status
  let sourceStatus: TaskStatus | null = null
  for (const status of SORTED_STATUSES) {
    if (tasksByStatus[status].some((t) => t.id === activeId)) {
      sourceStatus = status
      break
    }
  }
  if (!sourceStatus) return null

  // Determine target column: over a column droppable or a card
  let targetStatus: TaskStatus | null = null

  // Check if overId is a column droppable (format: 'mobile-col-{status}')
  const colMatch = overId.match(/^mobile-col-(.+)$/)
  if (colMatch) {
    const s = colMatch[1] as TaskStatus
    if (SORTED_STATUSES.includes(s)) targetStatus = s
  }

  // Check if overId is a task id — find its column
  if (!targetStatus) {
    for (const status of SORTED_STATUSES) {
      if (tasksByStatus[status].some((t) => t.id === overId)) {
        targetStatus = status
        break
      }
    }
  }

  if (!targetStatus) return null

  if (targetStatus !== sourceStatus) {
    // Cross-column drop → status change
    return { type: 'status-change', taskId: activeId, newStatus: targetStatus }
  }

  // Same-column drop → reorder
  const col = tasksByStatus[sourceStatus]
  const activeIdx = col.findIndex((t) => t.id === activeId)
  const overIdx = col.findIndex((t) => t.id === overId)
  if (activeIdx === -1) return null

  const newOrder = [...col.map((t) => t.id)]
  newOrder.splice(activeIdx, 1)
  const insertAt = overIdx >= 0 ? overIdx : newOrder.length
  newOrder.splice(insertAt, 0, activeId)

  return { type: 'reorder', taskIds: newOrder, status: sourceStatus }
}

/* ── SortableMobileTaskCard — inline (≤30 LOC) ──────────────────── */
interface SortableMobileTaskCardProps {
  task: Task
  onPress: () => void
}

function SortableMobileTaskCard({ task, onPress }: SortableMobileTaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { task },
  })

  const style: React.CSSProperties = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    transition,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <MobileTaskCard task={task} onPress={onPress} isDragging={isDragging} />
    </div>
  )
}

/* ── Droppable column wrapper ────────────────────────────────────── */
interface DroppableColumnProps {
  status: TaskStatus
  children: React.ReactNode
}

function DroppableColumn({ status, children }: DroppableColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `mobile-col-${status}`,
    data: { status },
  })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col gap-2 px-2 py-2 min-h-[120px] rounded-lg',
        'transition-colors duration-150',
        isOver && 'bg-primary/5',
      )}
      data-testid={`mobile-droppable-col-${status}`}
    >
      {children}
    </div>
  )
}

/* ── Main screen ─────────────────────────────────────────────────── */
export function MobileBoardScreen() {
  const projectId = useProjectStore((s) => s.activeProjectId) ?? ''
  const projectName = useProjectStore((s) => s.projectName)
  const pushRoute = useMobileNavStore((s) => s.pushRoute)
  const reduced = useReducedMotion()

  const { data: tasks = [], isLoading, isError } = useListTasks(projectId)
  const updateTaskStatus = useUpdateTaskStatus(projectId)
  const reorderTasks = useReorderTasks(projectId)

  const [activeId, setActiveId] = useState<string | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetInitialStatus, setSheetInitialStatus] = useState<TaskStatus>('backlog')

  /* ── Sensors (mirrors desktop KanbanBoard.tsx exactly) ─────────── */
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 10 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  /* ── Group tasks by status ──────────────────────────────────────── */
  const tasksByStatus: Record<TaskStatus, Task[]> = SORTED_STATUSES.reduce(
    (acc, status) => {
      acc[status] = tasks
        .filter((t) => t.status === status)
        .sort((a, b) => a.sort_order - b.sort_order)
      return acc
    },
    {} as Record<TaskStatus, Task[]>,
  )

  /* ── Open add-task sheet ─────────────────────────────────────────── */
  const openAddTaskSheet = useCallback((status: TaskStatus) => {
    setSheetInitialStatus(status)
    setSheetOpen(true)
  }, [])

  /* ── Drag handlers ───────────────────────────────────────────────── */
  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      setActiveId(event.active.id as string)
      if (!reduced) hapticFeedback(10)
    },
    [reduced],
  )

  const handleDragOver = useCallback((_event: DragOverEvent) => {
    // overId tracking not needed since resolveDrop reads from tasksByStatus
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      setActiveId(null)

      if (!over) return

      const action = resolveDrop({
        activeId: active.id as string,
        overId: over.id as string,
        tasksByStatus,
      })

      if (!action) return

      if (action.type === 'status-change') {
        updateTaskStatus.mutate({ id: action.taskId, status: action.newStatus })
      } else if (action.type === 'reorder') {
        reorderTasks.mutate({ task_ids: action.taskIds, status: action.status })
      }

      if (!reduced) hapticFeedback(10)
    },
    [tasksByStatus, updateTaskStatus, reorderTasks, reduced],
  )

  const handleDragCancel = useCallback(() => {
    setActiveId(null)
  }, [])

  /* ── Tap handler — push workspace route ─────────────────────────── */
  const handleCardPress = useCallback(
    (taskId: string) => {
      pushRoute('board', `workspace:${taskId}`)
    },
    [pushRoute],
  )

  /* ── Active drag task for overlay ───────────────────────────────── */
  const activeTask = activeId
    ? tasks.find((t) => t.id === activeId) ?? null
    : null

  /* ── Current column title for the pill above pager ──────────────── */
  const currentStatus = SORTED_STATUSES[currentIndex] ?? 'backlog'
  const currentColumnTitle = COLUMN_CONFIG[currentStatus]?.title ?? 'Board'

  /* ── Error state ─────────────────────────────────────────────────── */
  if (isError) {
    return (
      <div
        className="flex flex-col items-center justify-center h-full"
        data-testid="mobile-board-error"
      >
        <MobileEmptyState
          title="Could not load tasks"
          subtitle="Something went wrong. Tap to retry."
          action={
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="text-sm font-medium text-primary px-4 py-2 rounded-xl border border-primary/30 min-h-[2.75rem]"
            >
              Retry
            </button>
          }
        />
      </div>
    )
  }

  return (
    <div
      className="flex flex-col h-full"
      data-testid="mobile-board-screen"
    >
      {/* Column-name pill above pager (per Dev Notes §top-bar title composition) */}
      <div
        className="px-4 py-2 shrink-0 flex items-center gap-2"
        data-testid="mobile-board-column-pill"
      >
        <span className="text-sm font-semibold text-foreground">
          {currentColumnTitle}
        </span>
        {projectName && (
          <>
            <span className="text-muted-foreground/40 text-sm">·</span>
            <span className="text-sm text-muted-foreground truncate">
              {projectName}
            </span>
          </>
        )}
      </div>

      {/* DndContext wraps the pager so autoScroll targets the pager scroll container */}
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="flex-1 min-h-0">
          <MobileColumnPager
            currentIndex={currentIndex}
            onIndexChange={setCurrentIndex}
            peekPercent={8}
            ariaLabel="Kanban columns"
          >
            {SORTED_STATUSES.map((status) => {
              const colTasks = tasksByStatus[status]
              const isFirstColumn = status === SORTED_STATUSES[0]

              return (
                <div
                  key={status}
                  className="flex flex-col h-full"
                  data-testid={`mobile-column-${status}`}
                >
                  {/* Column header */}
                  <MobileColumnHeader
                    status={status}
                    count={colTasks.length}
                    onAddTask={() => openAddTaskSheet(status)}
                  />

                  {/* Column body — droppable */}
                  <DroppableColumn status={status}>
                    <SortableContext
                      items={colTasks.map((t) => t.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {/* Loading state: skeletons in first column only */}
                      {isLoading && isFirstColumn && (
                        <MobileLoadingSkeleton variant="card" count={4} />
                      )}

                      {/* Empty state */}
                      {!isLoading && colTasks.length === 0 && (
                        <MobileEmptyState
                          title={COLUMN_CONFIG[status].title}
                          subtitle="No tasks here yet."
                          action={
                            <button
                              type="button"
                              onClick={() => openAddTaskSheet(status)}
                              className="text-sm font-medium text-primary px-4 py-2 rounded-xl border border-primary/30 min-h-[2.75rem]"
                              data-testid={`mobile-add-task-${status}`}
                            >
                              Add Task
                            </button>
                          }
                        />
                      )}

                      {/* Task cards */}
                      {colTasks.map((task) => (
                        <SortableMobileTaskCard
                          key={task.id}
                          task={task}
                          onPress={() => handleCardPress(task.id)}
                        />
                      ))}
                    </SortableContext>
                  </DroppableColumn>
                </div>
              )
            })}
          </MobileColumnPager>
        </div>

        {/* Drag overlay — ghost card while dragging */}
        <DragOverlay>
          {activeTask && (
            <MobileTaskCard task={activeTask} isDragging={false} />
          )}
        </DragOverlay>
      </DndContext>

      {/* FAB — opens add-task sheet for current column */}
      <MobileFab
        icon={<Plus className="h-6 w-6" />}
        ariaLabel="Add task"
        position="bottom-right"
        onPress={() => openAddTaskSheet(currentStatus)}
      />

      {/* New task sheet */}
      <MobileNewTaskSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        initialStatus={sheetInitialStatus}
        projectId={projectId}
      />
    </div>
  )
}

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '@renderer/lib/utils'
import { StoryTaskCard, type StoryTaskCardProps } from './StoryTaskCard'

interface SortableStoryTaskCardProps extends StoryTaskCardProps {
  /** Whether this card is currently being dragged */
  isDragging?: boolean
  /** Story 3.9: Whether this task is currently syncing with its story file */
  isSyncing?: boolean
  /** TES-3.1: Whether this task is currently selected in the detail panel */
  isSelected?: boolean
}

/**
 * Sortable wrapper for StoryTaskCard that enables drag-and-drop functionality.
 *
 * Story 3.7: Story Import After Epics Phase (AC: 2)
 */
export function SortableStoryTaskCard({
  task,
  isDragging,
  isSyncing = false,
  isSelected = false,
  className,
  ...props
}: SortableStoryTaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging
  } = useSortable({
    id: task.id,
    data: {
      task,
      title: task.title,
      status: task.status
    },
    // Story 3.9: Disable drag when syncing (AC: 5)
    disabled: isSyncing
  })

  // Use prop or hook state for dragging
  const isCurrentlyDragging = isDragging ?? isSortableDragging

  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        // Placeholder styling when dragging
        isCurrentlyDragging && 'opacity-50',
        className
      )}
      data-testid={`sortable-story-task-${task.id}`}
    >
      <StoryTaskCard
        task={task}
        isSyncing={isSyncing}
        isSelected={isSelected}
        className={cn(isCurrentlyDragging && 'shadow-md')}
        {...props}
      />
    </div>
  )
}

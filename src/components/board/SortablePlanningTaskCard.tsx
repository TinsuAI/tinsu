import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '@renderer/lib/utils'
import { PlanningTaskCard, type PlanningTaskCardProps } from './PlanningTaskCard'

interface SortablePlanningTaskCardProps extends PlanningTaskCardProps {
  /** Whether this card is currently being dragged */
  isDragging?: boolean
}

export function SortablePlanningTaskCard({
  task,
  isDragging,
  className,
  ...props
}: SortablePlanningTaskCardProps) {
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
      title: task.phase_name,
      status: task.status
    }
  })

  // Use prop or hook state for dragging
  const isCurrentlyDragging = isDragging ?? isSortableDragging

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    touchAction: 'none'
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
      data-testid={`sortable-planning-task-${task.id}`}
    >
      <PlanningTaskCard
        task={task}
        className={cn(isCurrentlyDragging && 'shadow-md')}
        {...props}
      />
    </div>
  )
}

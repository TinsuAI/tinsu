import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '@renderer/lib/utils'
import { TaskCard, type TaskCardProps } from './TaskCard'

interface SortableTaskCardProps extends TaskCardProps {
  /** Whether this card is currently being dragged */
  isDragging?: boolean
}

export function SortableTaskCard({ task, isDragging, className, ...props }: SortableTaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging: isSortableDragging } =
    useSortable({
      id: task.id,
      data: {
        task,
        title: task.title,
        status: task.status
      }
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
      data-testid={`sortable-task-${task.id}`}
    >
      <TaskCard task={task} className={cn(isCurrentlyDragging && 'shadow-md')} {...props} />
    </div>
  )
}

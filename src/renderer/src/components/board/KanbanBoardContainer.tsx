import { trpc } from '@renderer/lib/trpc'
import { KanbanBoard } from './KanbanBoard'
import type { Task } from '@shared/types/task.types'

export function KanbanBoardContainer() {
  const { data: tasks, isLoading, isError, error } = trpc.tasks.getAll.useQuery()

  if (isError) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <p className="text-destructive">Failed to load tasks</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {error?.message || 'An unexpected error occurred'}
          </p>
        </div>
      </div>
    )
  }

  // Transform tasks to match the Task interface (handle date serialization from tRPC)
  const transformedTasks: Task[] = (tasks ?? []).map((task) => ({
    ...task,
    created_at: new Date(task.created_at),
    updated_at: new Date(task.updated_at)
  }))

  return <KanbanBoard tasks={transformedTasks} isLoading={isLoading} />
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { commands } from '@renderer/lib/rspc'
import type { Model } from '@renderer/lib/rspc'
import type { Task, TaskStatus, TaskType, InlineComment } from '@shared/types/task.types'

/** Convert a Rust task::Model (raw DB row) to the shared Task interface. */
function transformTask(model: Model): Task {
  return {
    ...model,
    status: model.status as TaskStatus,
    task_type: model.task_type as TaskType,
    is_start_here: model.is_start_here === 1 ? true : model.is_start_here === 0 ? false : null,
    // DB returns i64 Unix seconds; Task expects Date
    created_at: new Date(model.created_at * 1000),
    updated_at: new Date(model.updated_at * 1000),
    // inline_comments stored as JSON string in DB — parse if non-null
    inline_comments: (() => {
      if (!model.inline_comments) return null
      try {
        return JSON.parse(model.inline_comments) as InlineComment[]
      } catch {
        return null
      }
    })(),
    // project_id is non-null in Rust schema but Task expects string | null
    project_id: model.project_id,
  }
}

/** Query key factory — centralised so mutations and queries stay in sync. */
export const taskQueryKeys = {
  list: (projectId: string) => ['tasks', 'list', projectId] as const,
  listAll: () => ['tasks', 'list'] as const,
}

/**
 * Loads all tasks for a project from the Rust backend.
 * Passes empty string when no projectId is available — backend returns all tasks in that case.
 */
export function useListTasks(projectId: string) {
  return useQuery({
    queryKey: taskQueryKeys.list(projectId),
    queryFn: async () => {
      const result = await commands.listTasks({ project_id: projectId })
      if (result.status === 'error') throw new Error(JSON.stringify(result.error))
      return result.data.map(transformTask)
    },
  })
}

/** Creates a new task. Invalidates the tasks list on success. */
export function useCreateTask(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { title: string; project_id: string }) => {
      const result = await commands.createTask(input)
      if (result.status === 'error') throw new Error(JSON.stringify(result.error))
      return transformTask(result.data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskQueryKeys.list(projectId) })
    },
  })
}

/** Updates a task's status with optimistic UI. */
export function useUpdateTaskStatus(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; status: TaskStatus }) => {
      const result = await commands.updateTaskStatus({ id: input.id, status: input.status })
      if (result.status === 'error') throw new Error(JSON.stringify(result.error))
      return transformTask(result.data)
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: taskQueryKeys.listAll() })
      const previousTasks = queryClient.getQueryData<Task[]>(taskQueryKeys.list(projectId))

      queryClient.setQueryData<Task[]>(taskQueryKeys.list(projectId), (old) => {
        if (!old) return old
        return old.map((t) =>
          t.id === input.id ? { ...t, status: input.status, updated_at: new Date() } : t
        )
      })

      return { previousTasks }
    },
    onError: (_err, _vars, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(taskQueryKeys.list(projectId), context.previousTasks)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: taskQueryKeys.listAll() })
    },
  })
}

/** Reorders tasks within a column with optimistic UI. */
export function useReorderTasks(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { task_ids: string[]; status: string }) => {
      const result = await commands.reorderTasks(input)
      if (result.status === 'error') throw new Error(JSON.stringify(result.error))
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: taskQueryKeys.listAll() })
      const previousTasks = queryClient.getQueryData<Task[]>(taskQueryKeys.list(projectId))

      queryClient.setQueryData<Task[]>(taskQueryKeys.list(projectId), (old) => {
        if (!old) return old
        return old.map((task) => {
          if (task.status !== input.status) return task
          const newIndex = input.task_ids.indexOf(task.id)
          if (newIndex === -1) return task
          return { ...task, sort_order: newIndex, updated_at: new Date() }
        })
      })

      return { previousTasks }
    },
    onError: (_err, _vars, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(taskQueryKeys.list(projectId), context.previousTasks)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: taskQueryKeys.listAll() })
    },
  })
}

/** Deletes a task. Invalidates the tasks list on success. */
export function useDeleteTask(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string }) => {
      const result = await commands.deleteTask(input)
      if (result.status === 'error') throw new Error(JSON.stringify(result.error))
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: taskQueryKeys.listAll() })
      const previousTasks = queryClient.getQueryData<Task[]>(taskQueryKeys.list(projectId))

      queryClient.setQueryData<Task[]>(taskQueryKeys.list(projectId), (old) => {
        if (!old) return old
        return old.filter((t) => t.id !== input.id)
      })

      return { previousTasks }
    },
    onError: (_err, _vars, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(taskQueryKeys.list(projectId), context.previousTasks)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskQueryKeys.list(projectId) })
    },
  })
}

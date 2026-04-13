import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { commands } from '@renderer/lib/rspc'
import type { EpicModel, CreateEpicInput, UpdateEpicInput } from '@renderer/lib/rspc'
import type { Epic, EpicColor } from '@shared/types/task.types'

/** Convert a Rust EpicModel DTO to the shared Epic interface. */
function transformEpic(model: EpicModel): Epic {
  return {
    ...model,
    color: (model.color ?? 'blue') as EpicColor,
    // DB returns i64 Unix seconds; Epic expects Date
    created_at: new Date(model.created_at * 1000),
    // project_id from Rust is non-null string; Epic expects string | null
    project_id: model.project_id,
  }
}

/** Query key factory for epic queries. */
export const epicQueryKeys = {
  list: (projectId: string) => ['epics', 'list', projectId] as const,
}

/**
 * Loads all epics for a project from the Rust backend.
 * Passes empty string when no projectId is available — backend returns all epics in that case.
 */
export function useListEpics(projectId: string) {
  return useQuery({
    queryKey: epicQueryKeys.list(projectId),
    queryFn: async () => {
      const result = await commands.listEpics({ project_id: projectId })
      if (result.status === 'error') throw new Error(JSON.stringify(result.error))
      return result.data.map(transformEpic)
    },
  })
}

/** Creates a new epic. Invalidates the epics list on success. */
export function useCreateEpic(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateEpicInput) => {
      const result = await commands.createEpic(input)
      if (result.status === 'error') throw new Error(JSON.stringify(result.error))
      return transformEpic(result.data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: epicQueryKeys.list(projectId) })
    },
  })
}

/** Updates an existing epic. Invalidates the epics list on success. */
export function useUpdateEpic() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: UpdateEpicInput) => {
      const result = await commands.updateEpic(input)
      if (result.status === 'error') throw new Error(JSON.stringify(result.error))
      return transformEpic(result.data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['epics', 'list'] })
    },
  })
}

/** Deletes an epic. Invalidates the epics list on success. */
export function useDeleteEpic() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string }) => {
      const result = await commands.deleteEpic(input)
      if (result.status === 'error') throw new Error(JSON.stringify(result.error))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['epics', 'list'] })
    },
  })
}

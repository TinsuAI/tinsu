import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { commands } from '@renderer/lib/rspc'
import type { SprintModel, CreateSprintInput, UpdateSprintInput, UpdateSprintStatusInput } from '@renderer/lib/rspc'

/** Query key factory for sprint queries. */
export const sprintQueryKeys = {
  list: (projectId: string) => ['sprints', 'list', projectId] as const,
  listAll: () => ['sprints', 'list'] as const,
  active: (projectId: string) => ['sprints', 'active', projectId] as const,
}

/** Loads all sprints for a project from the Rust backend. */
export function useListSprints(projectId: string) {
  return useQuery({
    queryKey: sprintQueryKeys.list(projectId),
    queryFn: async () => {
      const result = await commands.listSprints({ project_id: projectId })
      if (result.status === 'error') throw new Error(JSON.stringify(result.error))
      return result.data
    },
  })
}

/** Creates a new sprint. Invalidates the sprints list on success. */
export function useCreateSprint(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateSprintInput) => {
      const result = await commands.createSprint(input)
      if (result.status === 'error') throw new Error(JSON.stringify(result.error))
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sprintQueryKeys.listAll() })
    },
  })
}

/** Updates an existing sprint's details. Invalidates the sprints list on success. */
export function useUpdateSprint() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: UpdateSprintInput) => {
      const result = await commands.updateSprint(input)
      if (result.status === 'error') throw new Error(JSON.stringify(result.error))
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sprintQueryKeys.listAll() })
    },
  })
}

/** Updates only the status of a sprint. Invalidates the sprints list on success. */
export function useUpdateSprintStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: UpdateSprintStatusInput) => {
      const result = await commands.updateSprintStatus(input)
      if (result.status === 'error') throw new Error(JSON.stringify(result.error))
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sprintQueryKeys.listAll() })
    },
  })
}

/** Deletes a sprint. Invalidates the sprints list on success. */
export function useDeleteSprint() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string }) => {
      const result = await commands.deleteSprint(input)
      if (result.status === 'error') throw new Error(JSON.stringify(result.error))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sprintQueryKeys.listAll() })
    },
  })
}

/** Returns the active sprint for a project, or undefined if none. */
export function useGetActiveSprint(projectId: string) {
  return useQuery({
    queryKey: sprintQueryKeys.active(projectId),
    queryFn: async () => {
      const result = await commands.getActiveSprint({ project_id: projectId })
      if (result.status === 'error') throw new Error(JSON.stringify(result.error))
      return result.data as SprintModel | null
    },
  })
}

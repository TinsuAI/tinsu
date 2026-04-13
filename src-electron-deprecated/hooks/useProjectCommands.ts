import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { commands } from '@renderer/lib/rspc'
import type { ProjectModel } from '@renderer/lib/rspc'

/** Query key factory for project queries. */
export const projectQueryKeys = {
  recent: () => ['projects', 'recent'] as const,
  validate: (path: string) => ['projects', 'validate', path] as const,
}

/** Loads recent projects. Only runs when enabled (default true). */
export function useListRecentProjects(limit = 10, enabled = true) {
  return useQuery({
    queryKey: projectQueryKeys.recent(),
    queryFn: async () => {
      const result = await commands.listRecentProjects({ limit })
      if (result.status === 'error') throw new Error(JSON.stringify(result.error))
      return result.data
    },
    enabled,
  })
}

/** Validates whether a path is an existing TinSu project directory. */
export function useValidateProjectPath(path: string) {
  return useQuery({
    queryKey: projectQueryKeys.validate(path),
    queryFn: async () => {
      const result = await commands.validateProjectPath(path)
      if (result.status === 'error') throw new Error(JSON.stringify(result.error))
      return result.data
    },
    enabled: path.length > 0,
    staleTime: 60000,
  })
}

/** Opens a project by path: reads config, upserts DB record, returns ProjectModel. */
export function useOpenProjectByPath() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (path: string) => {
      const result = await commands.openProjectByPath(path)
      if (result.status === 'error') throw new Error(JSON.stringify(result.error))
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectQueryKeys.recent() })
    },
  })
}

/** Removes a project from DB (does NOT delete files on disk). */
export function useRemoveProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const result = await commands.removeProject(id)
      if (result.status === 'error') throw new Error(JSON.stringify(result.error))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectQueryKeys.recent() })
    },
  })
}

/** Opens a native folder picker dialog to select an existing project. Returns ProjectModel or null. */
export function useOpenProjectDialog() {
  return useMutation({
    mutationFn: async () => {
      const result = await commands.openProjectDialog()
      if (result.status === 'error') throw new Error(JSON.stringify(result.error))
      return result.data as ProjectModel | null
    },
  })
}

/** Opens a native folder picker to select a parent directory. Returns path string or null. */
export function useSelectParentDirectory() {
  return useMutation({
    mutationFn: async () => {
      const result = await commands.selectParentDirectory()
      if (result.status === 'error') throw new Error(JSON.stringify(result.error))
      return result.data
    },
  })
}

/** Creates a new project directory with git + TinSu config, returns ProjectModel. */
export function useCreateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { parentDir: string; projectName: string }) => {
      const result = await commands.createProject(input.parentDir, input.projectName)
      if (result.status === 'error') throw new Error(JSON.stringify(result.error))
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectQueryKeys.recent() })
    },
  })
}

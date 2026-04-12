import { useQuery } from '@tanstack/react-query'
import { commands } from '@renderer/lib/rspc'
import type { EpicModel } from '@renderer/lib/rspc'
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

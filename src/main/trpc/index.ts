import { router } from './trpc'
import { taskRouter } from './routers/task.router'
import { configRouter } from './routers/config.router'
import { projectRouter } from './routers/project.router'
import { ptyRouter } from './routers/pty.router'
import { epicRouter } from './routers/epic.router'
import { sprintRouter } from './routers/sprint.router'
import { velocityRouter } from './routers/velocity.router'
import { agentRouter } from './routers/agent.router'
import { importRouter } from './routers/import.router'
import { syncRouter } from './routers/sync.router'
import { artifactsRouter } from './routers/artifacts.router'
import { activityRouter } from './routers/activity.router'
import { gitRouter } from './routers/git.router'
import { planningRouter } from './routers/planning.router'
import { createContext } from './context'

export const appRouter = router({
  tasks: taskRouter,
  config: configRouter,
  project: projectRouter,
  pty: ptyRouter,
  epics: epicRouter,
  sprints: sprintRouter,
  velocity: velocityRouter,
  agent: agentRouter,
  import: importRouter,
  sync: syncRouter,
  artifacts: artifactsRouter,
  activity: activityRouter,
  git: gitRouter,
  planning: planningRouter
})

// Export type for client consumption
export type AppRouter = typeof appRouter

// Export createContext for use in main process
export { createContext }

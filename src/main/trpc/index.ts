import { router } from './trpc'
import { taskRouter } from './routers/task.router'
import { configRouter } from './routers/config.router'
import { projectRouter } from './routers/project.router'
import { ptyRouter } from './routers/pty.router'
import { epicRouter } from './routers/epic.router'
import { sprintRouter } from './routers/sprint.router'
import { velocityRouter } from './routers/velocity.router'
import { createContext } from './context'

export const appRouter = router({
  tasks: taskRouter,
  config: configRouter,
  project: projectRouter,
  pty: ptyRouter,
  epics: epicRouter,
  sprints: sprintRouter,
  velocity: velocityRouter
})

// Export type for client consumption
export type AppRouter = typeof appRouter

// Export createContext for use in main process
export { createContext }

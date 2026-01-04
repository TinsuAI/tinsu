import { router } from './trpc';
import { taskRouter } from './routers/task.router';
import { createContext } from './context';

export const appRouter = router({
  tasks: taskRouter,
});

// Export type for client consumption
export type AppRouter = typeof appRouter;

// Export createContext for use in main process
export { createContext };

import { initTRPC, TRPCError } from '@trpc/server';
import type { Context } from './context';

const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        // Include original error message for TRPCErrors
        message: error.message,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

// Re-export TRPCError for use in routers
export { TRPCError };

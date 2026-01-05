import { z } from 'zod'
import { router, publicProcedure, TRPCError } from '../trpc'
import { ConfigService, ConfigError } from '../../services/config.service'
import { MethodologySchema } from '../../../shared/types/config.types'

// Cache ConfigService instances per projectRoot to avoid recreation on every request
const configServiceCache = new Map<string, ConfigService>()

function getConfigService(projectRoot: string): ConfigService {
  let service = configServiceCache.get(projectRoot)
  if (!service) {
    service = new ConfigService(projectRoot)
    configServiceCache.set(projectRoot, service)
  }
  return service
}

export const configRouter = router({
  // Get current config (creates default if doesn't exist)
  get: publicProcedure.query(({ ctx }) => {
    const projectRoot = ctx.projectRoot
    if (!projectRoot) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Project root not available in context'
      })
    }

    try {
      const configService = getConfigService(projectRoot)
      return configService.getOrCreateConfig()
    } catch (error) {
      if (error instanceof ConfigError) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message,
          cause: error
        })
      }
      throw error
    }
  }),

  // Update config with partial updates
  update: publicProcedure
    .input(
      z.object({
        projectName: z.string().min(1).optional(),
        methodology: MethodologySchema.optional(),
        version: z.string().optional()
      })
    )
    .mutation(({ ctx, input }) => {
      const projectRoot = ctx.projectRoot
      if (!projectRoot) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Project root not available in context'
        })
      }

      try {
        const configService = getConfigService(projectRoot)
        return configService.updateConfig(input)
      } catch (error) {
        if (error instanceof ConfigError) {
          if (error.code === 'NOT_FOUND') {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'Config file not found. Call config.get first to create it.',
              cause: error
            })
          }
          if (error.code === 'VALIDATION_ERROR') {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: error.message,
              cause: error
            })
          }
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error.message,
            cause: error
          })
        }
        throw error
      }
    })
})

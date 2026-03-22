import { z } from 'zod'
import { router, publicProcedure } from '../trpc'
import { BmadInstallService } from '../../services/bmad-install.service'
import { BMAD_MODULES, BMAD_TOOLS, BMAD_LANGUAGES } from '../../../shared/types/bmad.types'

const bmadInstallOptionsSchema = z.object({
  modules: z.array(z.string()).min(1, 'At least one module is required'),
  tools: z.array(z.string()),
  userName: z.string().min(1, 'User name is required'),
  communicationLanguage: z.string().default('English'),
  documentOutputLanguage: z.string().default('English'),
  outputFolder: z.string().default('_bmad-output')
})

export const bmadRouter = router({
  checkNodejs: publicProcedure.query(async () => {
    return BmadInstallService.checkNodejs()
  }),

  checkStatus: publicProcedure.query(async ({ ctx }) => {
    return BmadInstallService.checkBmadStatus(ctx.projectRoot)
  }),

  availableModules: publicProcedure.query(() => {
    return { modules: BMAD_MODULES, tools: BMAD_TOOLS, languages: BMAD_LANGUAGES }
  }),

  installNodejs: publicProcedure.mutation(async () => {
    return BmadInstallService.installNodejs()
  }),

  install: publicProcedure.input(bmadInstallOptionsSchema).mutation(async ({ ctx, input }) => {
    return BmadInstallService.installBmad(ctx.projectRoot, input)
  }),

  installToPath: publicProcedure
    .input(
      bmadInstallOptionsSchema.extend({
        projectPath: z.string().min(1, 'Project path is required')
      })
    )
    .mutation(async ({ input }) => {
      const { projectPath, ...options } = input
      return BmadInstallService.installBmad(projectPath, options)
    }),

  update: publicProcedure.input(bmadInstallOptionsSchema).mutation(async ({ ctx, input }) => {
    return BmadInstallService.updateBmad(ctx.projectRoot, input)
  })
})

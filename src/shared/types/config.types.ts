import { z } from 'zod'

// Methodology enum schema
export const MethodologySchema = z.enum(['bmad', 'taskmaster'])
export type Methodology = z.infer<typeof MethodologySchema>

// Project configuration schema with Zod validation
export const ProjectConfigSchema = z.object({
  projectName: z.string().min(1, 'Project name is required'),
  methodology: MethodologySchema,
  createdAt: z.string().datetime(), // ISO 8601
  version: z.string().default('1.0.0')
})

export type ProjectConfig = z.infer<typeof ProjectConfigSchema>

// Update schema - explicitly excludes createdAt (immutable after creation)
export const ProjectConfigUpdateSchema = ProjectConfigSchema.pick({
  projectName: true,
  methodology: true,
  version: true
}).partial()
export type ProjectConfigUpdate = z.infer<typeof ProjectConfigUpdateSchema>

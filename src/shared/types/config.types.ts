import { z } from 'zod'

// Methodology enum schema
export const MethodologySchema = z.enum(['bmad', 'taskmaster'])
export type Methodology = z.infer<typeof MethodologySchema>

// Claude model options schema for agent configuration
export const ClaudeModelSchema = z.enum(['opus', 'sonnet', 'haiku'])
export type ClaudeModel = z.infer<typeof ClaudeModelSchema>

// Default model values
export const DEFAULT_DEV_AGENT_MODEL: ClaudeModel = 'opus'
export const DEFAULT_REVIEW_AGENT_MODEL: ClaudeModel = 'sonnet'

// Project configuration schema with Zod validation
export const ProjectConfigSchema = z.object({
  projectName: z.string().min(1, 'Project name is required'),
  methodology: MethodologySchema,
  createdAt: z.string().datetime(), // ISO 8601
  version: z.string().default('1.0.0'),
  planningTasksInitialized: z.boolean().default(false),
  devAgentModel: ClaudeModelSchema.optional().default('opus'),
  reviewAgentModel: ClaudeModelSchema.optional().default('sonnet'),
  // Story 8.6 AC 4: Optional setting to preserve worktrees for inspection
  preserveWorktrees: z.boolean().optional().default(false)
})

export type ProjectConfig = z.infer<typeof ProjectConfigSchema>

// Update schema - explicitly excludes createdAt (immutable after creation)
export const ProjectConfigUpdateSchema = ProjectConfigSchema.pick({
  projectName: true,
  methodology: true,
  version: true,
  planningTasksInitialized: true,
  devAgentModel: true,
  reviewAgentModel: true,
  preserveWorktrees: true // Story 8.6 Task 2.2
}).partial()
export type ProjectConfigUpdate = z.infer<typeof ProjectConfigUpdateSchema>

import { describe, it, expect } from 'vitest'
import {
  ProjectConfigSchema,
  ProjectConfigUpdateSchema,
  ClaudeModelSchema,
  DEFAULT_DEV_AGENT_MODEL,
  DEFAULT_REVIEW_AGENT_MODEL
} from './config.types'

describe('ProjectConfigSchema', () => {
  it('validates config with planningTasksInitialized field', () => {
    const config = {
      projectName: 'Test Project',
      methodology: 'bmad' as const,
      createdAt: '2026-01-05T00:00:00.000Z',
      version: '1.0.0',
      planningTasksInitialized: true
    }
    const result = ProjectConfigSchema.safeParse(config)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.planningTasksInitialized).toBe(true)
    }
  })

  it('defaults planningTasksInitialized to false when not provided', () => {
    const config = {
      projectName: 'Test Project',
      methodology: 'bmad' as const,
      createdAt: '2026-01-05T00:00:00.000Z',
      version: '1.0.0'
    }
    const result = ProjectConfigSchema.safeParse(config)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.planningTasksInitialized).toBe(false)
    }
  })

  it('accepts planningTasksInitialized: false explicitly', () => {
    const config = {
      projectName: 'Test Project',
      methodology: 'bmad' as const,
      createdAt: '2026-01-05T00:00:00.000Z',
      version: '1.0.0',
      planningTasksInitialized: false
    }
    const result = ProjectConfigSchema.safeParse(config)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.planningTasksInitialized).toBe(false)
    }
  })
})

describe('ProjectConfigUpdateSchema', () => {
  it('allows updating planningTasksInitialized', () => {
    const update = { planningTasksInitialized: true }
    const result = ProjectConfigUpdateSchema.safeParse(update)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.planningTasksInitialized).toBe(true)
    }
  })

  it('allows partial updates without planningTasksInitialized', () => {
    const update = { projectName: 'New Name' }
    const result = ProjectConfigUpdateSchema.safeParse(update)
    expect(result.success).toBe(true)
  })

  it('allows updating devAgentModel', () => {
    const update = { devAgentModel: 'sonnet' as const }
    const result = ProjectConfigUpdateSchema.safeParse(update)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.devAgentModel).toBe('sonnet')
    }
  })

  it('allows updating reviewAgentModel', () => {
    const update = { reviewAgentModel: 'haiku' as const }
    const result = ProjectConfigUpdateSchema.safeParse(update)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.reviewAgentModel).toBe('haiku')
    }
  })
})

describe('ClaudeModelSchema', () => {
  it('accepts valid model values', () => {
    expect(ClaudeModelSchema.safeParse('opus').success).toBe(true)
    expect(ClaudeModelSchema.safeParse('sonnet').success).toBe(true)
    expect(ClaudeModelSchema.safeParse('haiku').success).toBe(true)
  })

  it('rejects invalid model values', () => {
    expect(ClaudeModelSchema.safeParse('gpt4').success).toBe(false)
    expect(ClaudeModelSchema.safeParse('claude').success).toBe(false)
    expect(ClaudeModelSchema.safeParse('').success).toBe(false)
    expect(ClaudeModelSchema.safeParse(null).success).toBe(false)
    expect(ClaudeModelSchema.safeParse(undefined).success).toBe(false)
  })

  it('has correct default model values', () => {
    expect(DEFAULT_DEV_AGENT_MODEL).toBe('opus')
    expect(DEFAULT_REVIEW_AGENT_MODEL).toBe('sonnet')
  })
})

describe('ProjectConfigSchema - Agent Model Settings', () => {
  it('validates config with agent model settings', () => {
    const config = {
      projectName: 'Test Project',
      methodology: 'bmad' as const,
      createdAt: '2026-01-05T00:00:00.000Z',
      version: '1.0.0',
      devAgentModel: 'opus' as const,
      reviewAgentModel: 'sonnet' as const
    }
    const result = ProjectConfigSchema.safeParse(config)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.devAgentModel).toBe('opus')
      expect(result.data.reviewAgentModel).toBe('sonnet')
    }
  })

  it('defaults agent model settings when not provided', () => {
    const config = {
      projectName: 'Test Project',
      methodology: 'bmad' as const,
      createdAt: '2026-01-05T00:00:00.000Z',
      version: '1.0.0'
    }
    const result = ProjectConfigSchema.safeParse(config)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.devAgentModel).toBe('opus')
      expect(result.data.reviewAgentModel).toBe('sonnet')
    }
  })

  it('accepts haiku model for both agents', () => {
    const config = {
      projectName: 'Test Project',
      methodology: 'bmad' as const,
      createdAt: '2026-01-05T00:00:00.000Z',
      version: '1.0.0',
      devAgentModel: 'haiku' as const,
      reviewAgentModel: 'haiku' as const
    }
    const result = ProjectConfigSchema.safeParse(config)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.devAgentModel).toBe('haiku')
      expect(result.data.reviewAgentModel).toBe('haiku')
    }
  })

  it('rejects invalid model values', () => {
    const config = {
      projectName: 'Test Project',
      methodology: 'bmad' as const,
      createdAt: '2026-01-05T00:00:00.000Z',
      version: '1.0.0',
      devAgentModel: 'gpt4' as unknown
    }
    const result = ProjectConfigSchema.safeParse(config)
    expect(result.success).toBe(false)
  })
})

import { describe, it, expect } from 'vitest'
import { ProjectConfigSchema, ProjectConfigUpdateSchema } from './config.types'

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
})

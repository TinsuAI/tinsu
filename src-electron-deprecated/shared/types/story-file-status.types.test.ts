import { describe, it, expect } from 'vitest'
import { STORY_FILE_STATUS, type StoryFileStatus } from './story-file-status.types'

describe('STORY_FILE_STATUS enum (Story 5.2c)', () => {
  it('contains summary_only status', () => {
    expect(STORY_FILE_STATUS).toContain('summary_only')
  })

  it('contains story_ready status', () => {
    expect(STORY_FILE_STATUS).toContain('story_ready')
  })

  it('has exactly 2 statuses', () => {
    expect(STORY_FILE_STATUS).toHaveLength(2)
  })

  it('has correct order: summary_only, story_ready', () => {
    expect(STORY_FILE_STATUS).toEqual(['summary_only', 'story_ready'])
  })

  it('StoryFileStatus type includes summary_only', () => {
    const status: StoryFileStatus = 'summary_only'
    expect(status).toBe('summary_only')
  })

  it('StoryFileStatus type includes story_ready', () => {
    const status: StoryFileStatus = 'story_ready'
    expect(status).toBe('story_ready')
  })
})

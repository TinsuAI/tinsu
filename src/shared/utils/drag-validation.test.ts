import { describe, it, expect } from 'vitest'
import { validateDragMove } from './drag-validation'
import type { Task } from '../types/task.types'

// Helper to create mock tasks
function createMockTask(overrides: Partial<Task>): Task {
  return {
    id: 'test-task',
    title: 'Test Task',
    description: null,
    status: 'backlog',
    sort_order: 0,
    epic_id: null,
    sprint_id: null,
    task_type: 'story',
    phase_number: null,
    phase_name: null,
    bmad_agent: null,
    bmad_workflow: null,
    is_start_here: null,
    artifact_path: null,
    story_number: null,
    story_file_path: null,
    story_file_status: null,
    context_notes: null, // Story 5.5
    full_content: null,
    project_id: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides
  }
}

describe('validateDragMove (Story 5.2c)', () => {
  describe('AC8: Basic tasks cannot go to create_story', () => {
    // Story 5.3b AC4: Updated message to guide users to In Progress
    it('blocks basic task from being dragged to create_story', () => {
      const basicTask = createMockTask({
        task_type: 'story',
        story_number: null // Basic task has no story_number
      })

      const result = validateDragMove(basicTask, 'create_story')
      expect(result).toBe('Basic Tasks execute directly. Drag to In Progress instead.')
    })

    it('allows basic task to go to backlog', () => {
      const basicTask = createMockTask({
        task_type: 'story',
        story_number: null
      })

      const result = validateDragMove(basicTask, 'backlog')
      expect(result).toBeUndefined()
    })

    it('allows basic task to go to in_progress', () => {
      const basicTask = createMockTask({
        task_type: 'story',
        story_number: null
      })

      const result = validateDragMove(basicTask, 'in_progress')
      expect(result).toBeUndefined()
    })

    it('allows basic task to go to review', () => {
      const basicTask = createMockTask({
        task_type: 'story',
        story_number: null
      })

      const result = validateDragMove(basicTask, 'review')
      expect(result).toBeUndefined()
    })

    it('allows basic task to go to done', () => {
      const basicTask = createMockTask({
        task_type: 'story',
        story_number: null
      })

      const result = validateDragMove(basicTask, 'done')
      expect(result).toBeUndefined()
    })
  })

  describe('AC6: Imported story tasks with summary_only blocked from work columns', () => {
    it('blocks summary_only story from being dragged to in_progress', () => {
      const importedStory = createMockTask({
        task_type: 'story',
        story_number: 1,
        story_file_status: 'summary_only'
      })

      const result = validateDragMove(importedStory, 'in_progress')
      expect(result).toBe("Story file required. Move to 'Create Story' first.")
    })

    it('blocks summary_only story from being dragged to review', () => {
      const importedStory = createMockTask({
        task_type: 'story',
        story_number: 1,
        story_file_status: 'summary_only'
      })

      const result = validateDragMove(importedStory, 'review')
      expect(result).toBe("Story file required. Move to 'Create Story' first.")
    })

    it('blocks summary_only story from being dragged to done', () => {
      const importedStory = createMockTask({
        task_type: 'story',
        story_number: 1,
        story_file_status: 'summary_only'
      })

      const result = validateDragMove(importedStory, 'done')
      expect(result).toBe("Story file required. Move to 'Create Story' first.")
    })

    it('allows summary_only story to go to backlog', () => {
      const importedStory = createMockTask({
        task_type: 'story',
        story_number: 1,
        story_file_status: 'summary_only'
      })

      const result = validateDragMove(importedStory, 'backlog')
      expect(result).toBeUndefined()
    })

    it('allows summary_only story to go to create_story', () => {
      const importedStory = createMockTask({
        task_type: 'story',
        story_number: 1,
        story_file_status: 'summary_only'
      })

      const result = validateDragMove(importedStory, 'create_story')
      expect(result).toBeUndefined()
    })
  })

  describe('AC7: story_ready tasks can go anywhere', () => {
    it('allows story_ready to go to in_progress', () => {
      const readyStory = createMockTask({
        task_type: 'story',
        story_number: 1,
        story_file_status: 'story_ready'
      })

      const result = validateDragMove(readyStory, 'in_progress')
      expect(result).toBeUndefined()
    })

    it('allows story_ready to go to review', () => {
      const readyStory = createMockTask({
        task_type: 'story',
        story_number: 1,
        story_file_status: 'story_ready'
      })

      const result = validateDragMove(readyStory, 'review')
      expect(result).toBeUndefined()
    })

    it('allows story_ready to go to done', () => {
      const readyStory = createMockTask({
        task_type: 'story',
        story_number: 1,
        story_file_status: 'story_ready'
      })

      const result = validateDragMove(readyStory, 'done')
      expect(result).toBeUndefined()
    })

    it('allows story_ready to go to backlog', () => {
      const readyStory = createMockTask({
        task_type: 'story',
        story_number: 1,
        story_file_status: 'story_ready'
      })

      const result = validateDragMove(readyStory, 'backlog')
      expect(result).toBeUndefined()
    })

    it('allows story_ready to go to create_story', () => {
      const readyStory = createMockTask({
        task_type: 'story',
        story_number: 1,
        story_file_status: 'story_ready'
      })

      const result = validateDragMove(readyStory, 'create_story')
      expect(result).toBeUndefined()
    })
  })

  describe('Planning tasks (no validation)', () => {
    it('allows planning tasks to go anywhere', () => {
      const planningTask = createMockTask({
        task_type: 'planning',
        phase_number: 1,
        phase_name: 'Product Brief'
      })

      expect(validateDragMove(planningTask, 'backlog')).toBeUndefined()
      expect(validateDragMove(planningTask, 'create_story')).toBeUndefined()
      expect(validateDragMove(planningTask, 'in_progress')).toBeUndefined()
      expect(validateDragMove(planningTask, 'review')).toBeUndefined()
      expect(validateDragMove(planningTask, 'done')).toBeUndefined()
    })
  })
})

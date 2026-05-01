import { describe, it, expect } from 'vitest'
import { isPlanningTask, isStoryTask, isImportedStoryTask, TASK_TYPE, TASK_STATUS, type Task, type TaskStatus } from './task.types'

describe('TASK_STATUS enum (Story 5.2b)', () => {
  it('includes create_story status', () => {
    expect(TASK_STATUS).toContain('create_story')
  })

  it('has correct order: backlog, create_story, in_progress, review, done', () => {
    expect(TASK_STATUS).toEqual(['backlog', 'create_story', 'in_progress', 'review', 'done'])
  })

  it('has 5 statuses', () => {
    expect(TASK_STATUS).toHaveLength(5)
  })

  it('TaskStatus type includes create_story', () => {
    const status: TaskStatus = 'create_story'
    expect(status).toBe('create_story')
  })
})

describe('Task Types (Story 3.1)', () => {
  describe('TASK_TYPE enum', () => {
    it('contains planning and story types', () => {
      expect(TASK_TYPE).toContain('planning')
      expect(TASK_TYPE).toContain('story')
      expect(TASK_TYPE).toHaveLength(2)
    })
  })

  describe('isPlanningTask type guard', () => {
    const createBaseTask = (): Omit<
      Task,
      'task_type' | 'phase_number' | 'phase_name' | 'bmad_agent' | 'bmad_workflow'
    > => ({
      id: 'task-1',
      title: 'Test Task',
      description: null,
      status: 'backlog',
      sort_order: 0,
      epic_id: null,
      sprint_id: null,
      is_start_here: null,
      project_id: null,
      artifact_path: null,
      story_number: null,
      story_file_path: null,
      story_file_status: null,
      context_notes: null, // Story 5.5
      full_content: null,
      worktree_path: null,
      branch_name: null,
      merge_commit_sha: null,
      has_merge_conflict: null,
      conflict_files: null,
      rejection_feedback: null,
      rejected_agent_run_id: null,
      inline_comments: null,
      rejection_count: null,
      last_review_commit: null,
      created_at: new Date(),
      updated_at: new Date()
    })

    it('returns true for planning tasks', () => {
      const planningTask: Task = {
        ...createBaseTask(),
        task_type: 'planning',
        phase_number: 1,
        phase_name: 'Product Brief',
        bmad_agent: 'bmad-agent-pm',
        bmad_workflow: '_bmad/bmm/workflows/1-ideation/create-product-brief/workflow.yaml'
      }

      expect(isPlanningTask(planningTask)).toBe(true)
    })

    it('returns false for story tasks', () => {
      const storyTask: Task = {
        ...createBaseTask(),
        task_type: 'story',
        phase_number: null,
        phase_name: null,
        bmad_agent: null,
        bmad_workflow: null
      }

      expect(isPlanningTask(storyTask)).toBe(false)
    })

    it('allows type narrowing to PlanningTask', () => {
      const task: Task = {
        ...createBaseTask(),
        task_type: 'planning',
        phase_number: 3,
        phase_name: 'Architecture',
        bmad_agent: 'bmad-agent-architect',
        bmad_workflow: '_bmad/bmm/workflows/3-solutioning/create-architecture/workflow.yaml'
      }

      if (isPlanningTask(task)) {
        // TypeScript should allow these accesses without error
        const phaseNum: 1 | 2 | 3 | 4 | 5 = task.phase_number
        const phaseName: string = task.phase_name
        const agent: string = task.bmad_agent
        const workflow: string = task.bmad_workflow

        expect(phaseNum).toBe(3)
        expect(phaseName).toBe('Architecture')
        expect(agent).toBe('bmad-agent-architect')
        expect(workflow).toContain('create-architecture')
      } else {
        // This should not be reached
        expect(true).toBe(false)
      }
    })

    it('returns false for malformed planning task with null phase_number', () => {
      const malformedTask: Task = {
        ...createBaseTask(),
        task_type: 'planning',
        phase_number: null, // Missing required field
        phase_name: 'Architecture',
        bmad_agent: 'bmad-agent-architect',
        bmad_workflow: '_bmad/bmm/workflows/3-solutioning/create-architecture/workflow.yaml'
      }

      expect(isPlanningTask(malformedTask)).toBe(false)
    })

    it('returns false for malformed planning task with null phase_name', () => {
      const malformedTask: Task = {
        ...createBaseTask(),
        task_type: 'planning',
        phase_number: 3,
        phase_name: null, // Missing required field
        bmad_agent: 'bmad-agent-architect',
        bmad_workflow: '_bmad/bmm/workflows/3-solutioning/create-architecture/workflow.yaml'
      }

      expect(isPlanningTask(malformedTask)).toBe(false)
    })

    it('returns false for malformed planning task with null bmad_agent', () => {
      const malformedTask: Task = {
        ...createBaseTask(),
        task_type: 'planning',
        phase_number: 3,
        phase_name: 'Architecture',
        bmad_agent: null, // Missing required field
        bmad_workflow: '_bmad/bmm/workflows/3-solutioning/create-architecture/workflow.yaml'
      }

      expect(isPlanningTask(malformedTask)).toBe(false)
    })

    it('returns false for malformed planning task with null bmad_workflow', () => {
      const malformedTask: Task = {
        ...createBaseTask(),
        task_type: 'planning',
        phase_number: 3,
        phase_name: 'Architecture',
        bmad_agent: 'bmad-agent-architect',
        bmad_workflow: null // Missing required field
      }

      expect(isPlanningTask(malformedTask)).toBe(false)
    })
  })

  describe('isStoryTask type guard', () => {
    const createBaseTask = (): Omit<
      Task,
      'task_type' | 'phase_number' | 'phase_name' | 'bmad_agent' | 'bmad_workflow'
    > => ({
      id: 'task-1',
      title: 'Test Task',
      description: null,
      status: 'backlog',
      sort_order: 0,
      epic_id: null,
      sprint_id: null,
      is_start_here: null,
      project_id: null,
      artifact_path: null,
      story_number: null,
      story_file_path: null,
      story_file_status: null,
      context_notes: null, // Story 5.5
      full_content: null,
      worktree_path: null,
      branch_name: null,
      merge_commit_sha: null,
      has_merge_conflict: null,
      conflict_files: null,
      rejection_feedback: null,
      rejected_agent_run_id: null,
      inline_comments: null,
      rejection_count: null,
      last_review_commit: null,
      created_at: new Date(),
      updated_at: new Date()
    })

    it('returns true for story tasks', () => {
      const storyTask: Task = {
        ...createBaseTask(),
        task_type: 'story',
        phase_number: null,
        phase_name: null,
        bmad_agent: null,
        bmad_workflow: null
      }

      expect(isStoryTask(storyTask)).toBe(true)
    })

    it('returns false for planning tasks', () => {
      const planningTask: Task = {
        ...createBaseTask(),
        task_type: 'planning',
        phase_number: 1,
        phase_name: 'Product Brief',
        bmad_agent: 'bmad-agent-pm',
        bmad_workflow: '_bmad/bmm/workflows/1-ideation/create-product-brief/workflow.yaml'
      }

      expect(isStoryTask(planningTask)).toBe(false)
    })

    it('allows type narrowing to StoryTask', () => {
      const task: Task = {
        ...createBaseTask(),
        task_type: 'story',
        phase_number: null,
        phase_name: null,
        bmad_agent: null,
        bmad_workflow: null
      }

      if (isStoryTask(task)) {
        // TypeScript should allow these accesses
        const phaseNum: null = task.phase_number
        const phaseName: null = task.phase_name

        expect(phaseNum).toBeNull()
        expect(phaseName).toBeNull()
      } else {
        // This should not be reached
        expect(true).toBe(false)
      }
    })
  })
})

describe('isImportedStoryTask helper (Story 5.2c)', () => {
  const createBaseTask = (): Omit<
    Task,
    'task_type' | 'phase_number' | 'phase_name' | 'bmad_agent' | 'bmad_workflow' | 'story_number' | 'story_file_status'
  > => ({
    id: 'task-1',
    title: 'Test Task',
    description: null,
    status: 'backlog',
    sort_order: 0,
    epic_id: null,
    sprint_id: null,
    is_start_here: null,
    project_id: null,
    artifact_path: null,
    story_file_path: null,
    context_notes: null, // Story 5.5
    full_content: null,
    worktree_path: null,
    branch_name: null,
    merge_commit_sha: null,
    has_merge_conflict: null,
    conflict_files: null,
    rejection_feedback: null,
    rejected_agent_run_id: null,
    inline_comments: null,
    rejection_count: null,
    last_review_commit: null,
    created_at: new Date(),
    updated_at: new Date()
  })

  it('returns true for story tasks with story_number', () => {
    const importedStoryTask: Task = {
      ...createBaseTask(),
      task_type: 'story',
      phase_number: null,
      phase_name: null,
      bmad_agent: null,
      bmad_workflow: null,
      story_number: '1',
      story_file_status: 'summary_only'
    }

    expect(isImportedStoryTask(importedStoryTask)).toBe(true)
  })

  it('returns false for story tasks without story_number (basic task)', () => {
    const basicTask: Task = {
      ...createBaseTask(),
      task_type: 'story',
      phase_number: null,
      phase_name: null,
      bmad_agent: null,
      bmad_workflow: null,
      story_number: null,
      story_file_status: null
    }

    expect(isImportedStoryTask(basicTask)).toBe(false)
  })

  it('returns false for planning tasks', () => {
    const planningTask: Task = {
      ...createBaseTask(),
      task_type: 'planning',
      phase_number: 1,
      phase_name: 'Product Brief',
      bmad_agent: 'bmad-agent-pm',
      bmad_workflow: '_bmad/bmm/workflows/1-ideation/create-product-brief/workflow.yaml',
      story_number: null,
      story_file_status: null
    }

    expect(isImportedStoryTask(planningTask)).toBe(false)
  })

  it('returns true for imported story with story_ready status', () => {
    const readyStoryTask: Task = {
      ...createBaseTask(),
      task_type: 'story',
      phase_number: null,
      phase_name: null,
      bmad_agent: null,
      bmad_workflow: null,
      story_number: '2',
      story_file_status: 'story_ready'
    }

    expect(isImportedStoryTask(readyStoryTask)).toBe(true)
  })
})

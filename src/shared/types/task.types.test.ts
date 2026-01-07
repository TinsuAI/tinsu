import { describe, it, expect } from 'vitest'
import { isPlanningTask, isStoryTask, TASK_TYPE, type Task } from './task.types'

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
      created_at: new Date(),
      updated_at: new Date()
    })

    it('returns true for planning tasks', () => {
      const planningTask: Task = {
        ...createBaseTask(),
        task_type: 'planning',
        phase_number: 1,
        phase_name: 'Product Brief',
        bmad_agent: 'bmad:bmm:agents:pm',
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
        bmad_agent: 'bmad:bmm:agents:architect',
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
        expect(agent).toBe('bmad:bmm:agents:architect')
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
        bmad_agent: 'bmad:bmm:agents:architect',
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
        bmad_agent: 'bmad:bmm:agents:architect',
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
        bmad_agent: 'bmad:bmm:agents:architect',
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
        bmad_agent: 'bmad:bmm:agents:pm',
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

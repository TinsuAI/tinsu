import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  BmadAgentLauncherService,
  BmadAgentLaunchResult
} from './bmad-agent-launcher.service'
import { ptyService } from './pty.service'
import { PlanningTask } from '../../shared/types/task.types'

// Mock ptyService
vi.mock('./pty.service', () => ({
  ptyService: {
    spawn: vi.fn()
  }
}))

describe('BmadAgentLauncherService', () => {
  const mockProjectPath = '/home/user/my-project'

  // Helper to create a valid PlanningTask
  const createMockPlanningTask = (overrides: Partial<PlanningTask> = {}): PlanningTask => ({
    id: 'task-123',
    title: 'Product Brief',
    description: null,
    status: 'in_progress',
    sort_order: 1,
    epic_id: null,
    sprint_id: null,
    task_type: 'planning',
    phase_number: 1,
    phase_name: 'Product Brief',
    bmad_agent: 'bmad:bmm:agents:pm',
    bmad_workflow: '_bmad/bmm/workflows/1-ideation/create-product-brief/workflow.yaml',
    is_start_here: true,
    artifact_path: null,
    story_number: null,
    story_file_path: null,
    story_file_status: null,
    full_content: null,
    project_id: 'project-1',
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('launchPlanningAgent', () => {
    it('launches agent with correct command for phase 1 (Product Brief)', () => {
      const mockProcessId = 'process-uuid-123'
      vi.mocked(ptyService.spawn).mockReturnValue(mockProcessId)

      const task = createMockPlanningTask({
        phase_number: 1,
        phase_name: 'Product Brief',
        bmad_agent: 'bmad:bmm:agents:pm',
        bmad_workflow: '_bmad/bmm/workflows/1-ideation/create-product-brief/workflow.yaml'
      })

      const result = BmadAgentLauncherService.launchPlanningAgent(task, mockProjectPath)

      expect(result.processId).toBe(mockProcessId)
      expect(result.command).toBe('claude')
      expect(result.args).toContain('bmad:bmm:agents:pm')
    })

    it('launches agent with correct command for phase 2 (PRD)', () => {
      const mockProcessId = 'process-uuid-456'
      vi.mocked(ptyService.spawn).mockReturnValue(mockProcessId)

      const task = createMockPlanningTask({
        phase_number: 2,
        phase_name: 'PRD',
        bmad_agent: 'bmad:bmm:agents:pm',
        bmad_workflow: '_bmad/bmm/workflows/2-discovery/create-prd/workflow.yaml'
      })

      const result = BmadAgentLauncherService.launchPlanningAgent(task, mockProjectPath)

      expect(result.processId).toBe(mockProcessId)
      expect(result.command).toBe('claude')
      expect(result.args).toContain('bmad:bmm:agents:pm')
    })

    it('launches agent with correct command for phase 3 (Architecture)', () => {
      const mockProcessId = 'process-uuid-789'
      vi.mocked(ptyService.spawn).mockReturnValue(mockProcessId)

      const task = createMockPlanningTask({
        phase_number: 3,
        phase_name: 'Architecture',
        bmad_agent: 'bmad:bmm:agents:architect',
        bmad_workflow: '_bmad/bmm/workflows/3-solutioning/create-architecture/workflow.yaml'
      })

      const result = BmadAgentLauncherService.launchPlanningAgent(task, mockProjectPath)

      expect(result.processId).toBe(mockProcessId)
      expect(result.command).toBe('claude')
      expect(result.args).toContain('bmad:bmm:agents:architect')
    })

    it('launches agent with correct command for phase 4 (UX Design)', () => {
      const mockProcessId = 'process-uuid-101'
      vi.mocked(ptyService.spawn).mockReturnValue(mockProcessId)

      const task = createMockPlanningTask({
        phase_number: 4,
        phase_name: 'UX Design',
        bmad_agent: 'bmad:bmm:agents:ux-designer',
        bmad_workflow: '_bmad/bmm/workflows/3-solutioning/create-ux-design/workflow.yaml'
      })

      const result = BmadAgentLauncherService.launchPlanningAgent(task, mockProjectPath)

      expect(result.processId).toBe(mockProcessId)
      expect(result.command).toBe('claude')
      expect(result.args).toContain('bmad:bmm:agents:ux-designer')
    })

    it('launches agent with correct command for phase 5 (Epics & Stories)', () => {
      const mockProcessId = 'process-uuid-202'
      vi.mocked(ptyService.spawn).mockReturnValue(mockProcessId)

      const task = createMockPlanningTask({
        phase_number: 5,
        phase_name: 'Epics & Stories',
        bmad_agent: 'bmad:bmm:agents:pm',
        bmad_workflow: '_bmad/bmm/workflows/3-solutioning/create-epics-and-stories/workflow.yaml'
      })

      const result = BmadAgentLauncherService.launchPlanningAgent(task, mockProjectPath)

      expect(result.processId).toBe(mockProcessId)
      expect(result.command).toBe('claude')
      expect(result.args).toContain('bmad:bmm:agents:pm')
    })

    it('uses task bmad_agent for skill argument', () => {
      const mockProcessId = 'process-uuid-303'
      vi.mocked(ptyService.spawn).mockReturnValue(mockProcessId)

      const customAgent = 'bmad:custom:agent'
      const task = createMockPlanningTask({
        bmad_agent: customAgent
      })

      const result = BmadAgentLauncherService.launchPlanningAgent(task, mockProjectPath)

      expect(result.args).toContain(customAgent)
    })

    it('sets working directory to project path', () => {
      const mockProcessId = 'process-uuid-404'
      vi.mocked(ptyService.spawn).mockReturnValue(mockProcessId)

      const task = createMockPlanningTask()

      BmadAgentLauncherService.launchPlanningAgent(task, mockProjectPath)

      expect(ptyService.spawn).toHaveBeenCalledWith(
        'claude',
        expect.any(Array),
        expect.objectContaining({ cwd: mockProjectPath })
      )
    })

    it('returns process ID from ptyService', () => {
      const expectedProcessId = 'unique-process-id-505'
      vi.mocked(ptyService.spawn).mockReturnValue(expectedProcessId)

      const task = createMockPlanningTask()

      const result = BmadAgentLauncherService.launchPlanningAgent(task, mockProjectPath)

      expect(result.processId).toBe(expectedProcessId)
    })

    it('includes command and args in result without model', () => {
      const mockProcessId = 'process-uuid-606'
      vi.mocked(ptyService.spawn).mockReturnValue(mockProcessId)

      const task = createMockPlanningTask({
        bmad_agent: 'bmad:bmm:agents:architect'
      })

      const result = BmadAgentLauncherService.launchPlanningAgent(task, mockProjectPath)

      expect(result).toEqual<BmadAgentLaunchResult>({
        processId: mockProcessId,
        command: 'claude',
        args: ['--skill', 'bmad:bmm:agents:architect']
      })
    })

    it('includes model flag when model is specified (Story 5.1)', () => {
      const mockProcessId = 'process-uuid-707'
      vi.mocked(ptyService.spawn).mockReturnValue(mockProcessId)

      const task = createMockPlanningTask({
        bmad_agent: 'bmad:bmm:agents:dev'
      })

      const result = BmadAgentLauncherService.launchPlanningAgent(task, mockProjectPath, 'opus')

      expect(result).toEqual<BmadAgentLaunchResult>({
        processId: mockProcessId,
        command: 'claude',
        args: ['--skill', 'bmad:bmm:agents:dev', '--model', 'opus']
      })
    })

    it('includes sonnet model when specified (Story 5.1)', () => {
      const mockProcessId = 'process-uuid-808'
      vi.mocked(ptyService.spawn).mockReturnValue(mockProcessId)

      const task = createMockPlanningTask({
        bmad_agent: 'bmad:bmm:agents:pm'
      })

      const result = BmadAgentLauncherService.launchPlanningAgent(task, mockProjectPath, 'sonnet')

      expect(result.args).toContain('--model')
      expect(result.args).toContain('sonnet')
    })

    it('includes haiku model when specified (Story 5.1)', () => {
      const mockProcessId = 'process-uuid-909'
      vi.mocked(ptyService.spawn).mockReturnValue(mockProcessId)

      const task = createMockPlanningTask({
        bmad_agent: 'bmad:bmm:agents:sm'
      })

      const result = BmadAgentLauncherService.launchPlanningAgent(task, mockProjectPath, 'haiku')

      expect(result.args).toContain('--model')
      expect(result.args).toContain('haiku')
    })

    it('does not include model flag when model is undefined (Story 5.1)', () => {
      const mockProcessId = 'process-uuid-1010'
      vi.mocked(ptyService.spawn).mockReturnValue(mockProcessId)

      const task = createMockPlanningTask()

      const result = BmadAgentLauncherService.launchPlanningAgent(task, mockProjectPath, undefined)

      expect(result.args).not.toContain('--model')
      expect(result.args).toEqual(['--skill', task.bmad_agent])
    })

    it('propagates ptyService.spawn errors', () => {
      const spawnError = new Error('Spawn failed')
      vi.mocked(ptyService.spawn).mockImplementation(() => {
        throw spawnError
      })

      const task = createMockPlanningTask()

      expect(() => {
        BmadAgentLauncherService.launchPlanningAgent(task, mockProjectPath)
      }).toThrow('Spawn failed')
    })
  })

  describe('launchCreateStory (Story 5.3 - AC: 1)', () => {
    const mockStoryIdentifier = '5.3'

    it('launches claude with create-story workflow command and story identifier as single arg', () => {
      const mockProcessId = 'process-create-story-1'
      vi.mocked(ptyService.spawn).mockReturnValue(mockProcessId)

      const result = BmadAgentLauncherService.launchCreateStory(mockProjectPath, mockStoryIdentifier)

      expect(result.processId).toBe(mockProcessId)
      expect(result.command).toBe('claude')
      expect(result.args).toContain('--dangerously-skip-permissions')
      expect(result.args).toContain(`/bmad:bmm:workflows:create-story ${mockStoryIdentifier}`)
    })

    it('combines workflow and story identifier in single string argument', () => {
      const mockProcessId = 'process-create-story-2'
      vi.mocked(ptyService.spawn).mockReturnValue(mockProcessId)

      const result = BmadAgentLauncherService.launchCreateStory(mockProjectPath, '5.1')

      // Workflow and story identifier should be combined in single arg
      expect(result.args).toContain('/bmad:bmm:workflows:create-story 5.1')
    })

    it('sets working directory to project path', () => {
      const mockProcessId = 'process-create-story-3'
      vi.mocked(ptyService.spawn).mockReturnValue(mockProcessId)

      BmadAgentLauncherService.launchCreateStory(mockProjectPath, mockStoryIdentifier)

      expect(ptyService.spawn).toHaveBeenCalledWith(
        'claude',
        expect.any(Array),
        expect.objectContaining({ cwd: mockProjectPath })
      )
    })

    it('includes model flag when specified', () => {
      const mockProcessId = 'process-create-story-4'
      vi.mocked(ptyService.spawn).mockReturnValue(mockProcessId)

      const result = BmadAgentLauncherService.launchCreateStory(mockProjectPath, mockStoryIdentifier, 'opus')

      expect(result.args).toContain('--model')
      expect(result.args).toContain('opus')
    })

    it('does not include model flag when undefined', () => {
      const mockProcessId = 'process-create-story-5'
      vi.mocked(ptyService.spawn).mockReturnValue(mockProcessId)

      const result = BmadAgentLauncherService.launchCreateStory(mockProjectPath, mockStoryIdentifier)

      expect(result.args).not.toContain('--model')
    })

    it('propagates ptyService.spawn errors', () => {
      const spawnError = new Error('Spawn failed')
      vi.mocked(ptyService.spawn).mockImplementation(() => {
        throw spawnError
      })

      expect(() => {
        BmadAgentLauncherService.launchCreateStory(mockProjectPath, mockStoryIdentifier)
      }).toThrow('Spawn failed')
    })
  })

  describe('launchDevStory (Story 5.3 - AC: 3)', () => {
    const mockStoryFilePath = '/path/to/story/5-3-story-task-execution-path.md'

    it('launches claude with dev-story workflow command and story path as single arg', () => {
      const mockProcessId = 'process-dev-story-1'
      vi.mocked(ptyService.spawn).mockReturnValue(mockProcessId)

      const result = BmadAgentLauncherService.launchDevStory(mockProjectPath, mockStoryFilePath)

      expect(result.processId).toBe(mockProcessId)
      expect(result.command).toBe('claude')
      expect(result.args).toContain('--dangerously-skip-permissions')
      expect(result.args).toContain(`/bmad:bmm:workflows:dev-story ${mockStoryFilePath}`)
    })

    it('combines workflow and story file path in single string argument', () => {
      const mockProcessId = 'process-dev-story-2'
      vi.mocked(ptyService.spawn).mockReturnValue(mockProcessId)

      const result = BmadAgentLauncherService.launchDevStory(mockProjectPath, mockStoryFilePath)

      // Workflow and story file path should be combined in single arg
      expect(result.args).toContain(`/bmad:bmm:workflows:dev-story ${mockStoryFilePath}`)
    })

    it('sets working directory to project path', () => {
      const mockProcessId = 'process-dev-story-3'
      vi.mocked(ptyService.spawn).mockReturnValue(mockProcessId)

      BmadAgentLauncherService.launchDevStory(mockProjectPath, mockStoryFilePath)

      expect(ptyService.spawn).toHaveBeenCalledWith(
        'claude',
        expect.any(Array),
        expect.objectContaining({ cwd: mockProjectPath })
      )
    })

    it('includes model flag when specified', () => {
      const mockProcessId = 'process-dev-story-4'
      vi.mocked(ptyService.spawn).mockReturnValue(mockProcessId)

      const result = BmadAgentLauncherService.launchDevStory(mockProjectPath, mockStoryFilePath, 'sonnet')

      expect(result.args).toContain('--model')
      expect(result.args).toContain('sonnet')
    })

    it('does not include model flag when undefined', () => {
      const mockProcessId = 'process-dev-story-5'
      vi.mocked(ptyService.spawn).mockReturnValue(mockProcessId)

      const result = BmadAgentLauncherService.launchDevStory(mockProjectPath, mockStoryFilePath)

      expect(result.args).not.toContain('--model')
    })

    it('propagates ptyService.spawn errors', () => {
      const spawnError = new Error('Spawn failed')
      vi.mocked(ptyService.spawn).mockImplementation(() => {
        throw spawnError
      })

      expect(() => {
        BmadAgentLauncherService.launchDevStory(mockProjectPath, mockStoryFilePath)
      }).toThrow('Spawn failed')
    })
  })
})

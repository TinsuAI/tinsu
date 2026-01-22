import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { BmadAgentLauncherService } from './bmad-agent-launcher.service'
import { TaskTerminalService } from './task-terminal.service'
import { PlanningTask } from '../../shared/types/task.types'

// Mock TaskTerminalService
vi.mock('./task-terminal.service', () => ({
  TaskTerminalService: {
    sendCommand: vi.fn(),
    clearContext: vi.fn()
  }
}))

describe('BmadAgentLauncherService', () => {
  const mockProjectPath = '/home/user/my-project'
  const mockTaskId = 'task-123'

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
    context_notes: null,
    full_content: null,
    project_id: 'project-1',
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides
  })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(TaskTerminalService.sendCommand).mockResolvedValue(undefined)
    vi.mocked(TaskTerminalService.clearContext).mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('launchPlanningAgent', () => {
    it('sends command to tmux session for phase 1 (Product Brief)', async () => {
      const task = createMockPlanningTask({
        phase_number: 1,
        phase_name: 'Product Brief',
        bmad_agent: 'bmad:bmm:agents:pm'
      })

      const result = await BmadAgentLauncherService.launchPlanningAgent(mockTaskId, task, mockProjectPath)

      expect(TaskTerminalService.sendCommand).toHaveBeenCalledWith(
        mockTaskId,
        expect.stringContaining('claude')
      )
      expect(TaskTerminalService.sendCommand).toHaveBeenCalledWith(
        mockTaskId,
        expect.stringContaining('bmad:bmm:agents:pm')
      )
      expect(result.success).toBe(true)
    })

    // Story 8.4: Worktree path tests
    it('uses worktree path in cd command when provided (Story 8.4)', async () => {
      const task = createMockPlanningTask()
      const worktreePath = '/home/user/my-project/.tinsu/worktrees/task-123'

      const result = await BmadAgentLauncherService.launchPlanningAgent(
        mockTaskId,
        task,
        mockProjectPath,
        undefined,
        worktreePath
      )

      expect(result.command).toContain(`cd "${worktreePath}"`)
      expect(result.command).not.toContain(mockProjectPath)
    })

    it('falls back to project path when worktree path is undefined (Story 8.4)', async () => {
      const task = createMockPlanningTask()

      const result = await BmadAgentLauncherService.launchPlanningAgent(
        mockTaskId,
        task,
        mockProjectPath,
        undefined,
        undefined
      )

      expect(result.command).toContain(`cd "${mockProjectPath}"`)
    })

    it('includes --skill flag with agent identifier', async () => {
      const task = createMockPlanningTask({
        bmad_agent: 'bmad:bmm:agents:architect'
      })

      await BmadAgentLauncherService.launchPlanningAgent(mockTaskId, task, mockProjectPath)

      expect(TaskTerminalService.sendCommand).toHaveBeenCalledWith(
        mockTaskId,
        expect.stringContaining('--skill bmad:bmm:agents:architect')
      )
    })

    it('includes cd to project path in command', async () => {
      const task = createMockPlanningTask()

      await BmadAgentLauncherService.launchPlanningAgent(mockTaskId, task, mockProjectPath)

      expect(TaskTerminalService.sendCommand).toHaveBeenCalledWith(
        mockTaskId,
        expect.stringContaining(`cd "${mockProjectPath}"`)
      )
    })

    it('includes model flag when specified (Story 5.1)', async () => {
      const task = createMockPlanningTask()

      const result = await BmadAgentLauncherService.launchPlanningAgent(mockTaskId, task, mockProjectPath, 'opus')

      expect(result.command).toContain('--model opus')
    })

    it('does not include model flag when undefined', async () => {
      const task = createMockPlanningTask()

      const result = await BmadAgentLauncherService.launchPlanningAgent(mockTaskId, task, mockProjectPath)

      expect(result.command).not.toContain('--model')
    })

    it('returns command string in result', async () => {
      const task = createMockPlanningTask({
        bmad_agent: 'bmad:bmm:agents:dev'
      })

      const result = await BmadAgentLauncherService.launchPlanningAgent(mockTaskId, task, mockProjectPath)

      expect(result.command).toContain('claude')
      expect(result.command).toContain('bmad:bmm:agents:dev')
    })

    it('propagates sendCommand errors', async () => {
      const sendError = new Error('No terminal session for task')
      vi.mocked(TaskTerminalService.sendCommand).mockRejectedValue(sendError)

      const task = createMockPlanningTask()

      await expect(
        BmadAgentLauncherService.launchPlanningAgent(mockTaskId, task, mockProjectPath)
      ).rejects.toThrow('No terminal session for task')
    })
  })

  describe('launchCreateStory (Story 5.3 - AC: 1)', () => {
    const mockStoryIdentifier = '5.3'

    it('sends command with create-story workflow and story identifier', async () => {
      const result = await BmadAgentLauncherService.launchCreateStory(
        mockTaskId,
        mockProjectPath,
        mockStoryIdentifier
      )

      expect(TaskTerminalService.sendCommand).toHaveBeenCalledWith(
        mockTaskId,
        expect.stringContaining('claude')
      )
      expect(TaskTerminalService.sendCommand).toHaveBeenCalledWith(
        mockTaskId,
        expect.stringContaining('--dangerously-skip-permissions')
      )
      expect(TaskTerminalService.sendCommand).toHaveBeenCalledWith(
        mockTaskId,
        expect.stringContaining('create-story')
      )
      expect(result.success).toBe(true)
    })

    it('includes cd to project path', async () => {
      await BmadAgentLauncherService.launchCreateStory(mockTaskId, mockProjectPath, mockStoryIdentifier)

      expect(TaskTerminalService.sendCommand).toHaveBeenCalledWith(
        mockTaskId,
        expect.stringContaining(`cd "${mockProjectPath}"`)
      )
    })

    it('includes model flag when specified', async () => {
      const result = await BmadAgentLauncherService.launchCreateStory(
        mockTaskId,
        mockProjectPath,
        mockStoryIdentifier,
        'opus'
      )

      expect(result.command).toContain('--model opus')
    })

    it('does not include model flag when undefined', async () => {
      const result = await BmadAgentLauncherService.launchCreateStory(
        mockTaskId,
        mockProjectPath,
        mockStoryIdentifier
      )

      expect(result.command).not.toContain('--model')
    })

    it('propagates sendCommand errors', async () => {
      const sendError = new Error('tmux session not found')
      vi.mocked(TaskTerminalService.sendCommand).mockRejectedValue(sendError)

      await expect(
        BmadAgentLauncherService.launchCreateStory(mockTaskId, mockProjectPath, mockStoryIdentifier)
      ).rejects.toThrow('tmux session not found')
    })

    // Story 8.4: Worktree path tests
    it('uses worktree path in cd command when provided (Story 8.4)', async () => {
      const worktreePath = '/home/user/my-project/.tinsu/worktrees/task-456'

      const result = await BmadAgentLauncherService.launchCreateStory(
        mockTaskId,
        mockProjectPath,
        mockStoryIdentifier,
        undefined,
        worktreePath
      )

      expect(result.command).toContain(`cd "${worktreePath}"`)
      expect(result.command).not.toContain(mockProjectPath)
    })

    it('falls back to project path when worktree path is undefined (Story 8.4)', async () => {
      const result = await BmadAgentLauncherService.launchCreateStory(
        mockTaskId,
        mockProjectPath,
        mockStoryIdentifier
      )

      expect(result.command).toContain(`cd "${mockProjectPath}"`)
    })
  })

  describe('launchDevStory (Story 5.3 - AC: 3)', () => {
    const mockStoryFilePath = '/path/to/story/5-3-story-task-execution-path.md'

    it('clears context before sending dev-story command', async () => {
      await BmadAgentLauncherService.launchDevStory(
        mockTaskId,
        mockProjectPath,
        mockStoryFilePath
      )

      // Verify clearContext was called before sendCommand
      expect(TaskTerminalService.clearContext).toHaveBeenCalledWith(mockTaskId)
      expect(TaskTerminalService.clearContext).toHaveBeenCalledBefore(
        vi.mocked(TaskTerminalService.sendCommand)
      )
    })

    it('continues even if clearContext fails', async () => {
      vi.mocked(TaskTerminalService.clearContext).mockRejectedValue(new Error('Clear failed'))

      const result = await BmadAgentLauncherService.launchDevStory(
        mockTaskId,
        mockProjectPath,
        mockStoryFilePath
      )

      // Should still succeed and call sendCommand
      expect(result.success).toBe(true)
      expect(TaskTerminalService.sendCommand).toHaveBeenCalled()
    })

    it('sends command with dev-story workflow and story path', async () => {
      const result = await BmadAgentLauncherService.launchDevStory(
        mockTaskId,
        mockProjectPath,
        mockStoryFilePath
      )

      expect(TaskTerminalService.sendCommand).toHaveBeenCalledWith(
        mockTaskId,
        expect.stringContaining('claude')
      )
      expect(TaskTerminalService.sendCommand).toHaveBeenCalledWith(
        mockTaskId,
        expect.stringContaining('--dangerously-skip-permissions')
      )
      expect(TaskTerminalService.sendCommand).toHaveBeenCalledWith(
        mockTaskId,
        expect.stringContaining('dev-story')
      )
      expect(result.success).toBe(true)
    })

    it('includes cd to project path', async () => {
      await BmadAgentLauncherService.launchDevStory(mockTaskId, mockProjectPath, mockStoryFilePath)

      expect(TaskTerminalService.sendCommand).toHaveBeenCalledWith(
        mockTaskId,
        expect.stringContaining(`cd "${mockProjectPath}"`)
      )
    })

    it('includes model flag when specified', async () => {
      const result = await BmadAgentLauncherService.launchDevStory(
        mockTaskId,
        mockProjectPath,
        mockStoryFilePath,
        'sonnet'
      )

      expect(result.command).toContain('--model sonnet')
    })

    it('does not include model flag when undefined', async () => {
      const result = await BmadAgentLauncherService.launchDevStory(
        mockTaskId,
        mockProjectPath,
        mockStoryFilePath
      )

      expect(result.command).not.toContain('--model')
    })

    it('propagates sendCommand errors', async () => {
      const sendError = new Error('Send failed')
      vi.mocked(TaskTerminalService.sendCommand).mockRejectedValue(sendError)

      await expect(
        BmadAgentLauncherService.launchDevStory(mockTaskId, mockProjectPath, mockStoryFilePath)
      ).rejects.toThrow('Send failed')
    })

    // Story 8.4: Worktree path tests
    it('uses worktree path in cd command when provided (Story 8.4)', async () => {
      const worktreePath = '/home/user/my-project/.tinsu/worktrees/task-789'

      const result = await BmadAgentLauncherService.launchDevStory(
        mockTaskId,
        mockProjectPath,
        mockStoryFilePath,
        undefined,
        worktreePath
      )

      expect(result.command).toContain(`cd "${worktreePath}"`)
      expect(result.command).not.toContain(mockProjectPath)
    })

    it('falls back to project path when worktree path is undefined (Story 8.4)', async () => {
      const result = await BmadAgentLauncherService.launchDevStory(
        mockTaskId,
        mockProjectPath,
        mockStoryFilePath
      )

      expect(result.command).toContain(`cd "${mockProjectPath}"`)
    })
  })

  describe('launchBasicTask (Story 5.3b - AC: 1)', () => {
    const mockTaskTitle = 'Fix login bug'
    const mockTaskDescription = 'The login button does not work on mobile Safari'

    it('sends command with task title as prompt', async () => {
      const result = await BmadAgentLauncherService.launchBasicTask(
        mockTaskId,
        mockProjectPath,
        mockTaskTitle
      )

      expect(TaskTerminalService.sendCommand).toHaveBeenCalledWith(
        mockTaskId,
        expect.stringContaining('claude')
      )
      expect(TaskTerminalService.sendCommand).toHaveBeenCalledWith(
        mockTaskId,
        expect.stringContaining('--dangerously-skip-permissions')
      )
      expect(result.success).toBe(true)
    })

    it('includes task title in command', async () => {
      const result = await BmadAgentLauncherService.launchBasicTask(
        mockTaskId,
        mockProjectPath,
        mockTaskTitle
      )

      expect(result.command).toContain(mockTaskTitle)
    })

    it('includes description in prompt when provided', async () => {
      const result = await BmadAgentLauncherService.launchBasicTask(
        mockTaskId,
        mockProjectPath,
        mockTaskTitle,
        mockTaskDescription
      )

      // Should contain both title and description
      expect(result.command).toContain(mockTaskTitle)
      expect(result.command).toContain(mockTaskDescription)
    })

    it('includes cd to project path', async () => {
      await BmadAgentLauncherService.launchBasicTask(mockTaskId, mockProjectPath, mockTaskTitle)

      expect(TaskTerminalService.sendCommand).toHaveBeenCalledWith(
        mockTaskId,
        expect.stringContaining(`cd "${mockProjectPath}"`)
      )
    })

    it('adds model flag when specified', async () => {
      const result = await BmadAgentLauncherService.launchBasicTask(
        mockTaskId,
        mockProjectPath,
        mockTaskTitle,
        undefined,
        'opus'
      )

      expect(result.command).toContain('--model opus')
    })

    it('does not include model flag when undefined', async () => {
      const result = await BmadAgentLauncherService.launchBasicTask(
        mockTaskId,
        mockProjectPath,
        mockTaskTitle
      )

      expect(result.command).not.toContain('--model')
    })

    it('does not use any workflow flags (no --skill, no /bmad prefix)', async () => {
      const result = await BmadAgentLauncherService.launchBasicTask(
        mockTaskId,
        mockProjectPath,
        mockTaskTitle,
        mockTaskDescription
      )

      // Basic tasks should NOT use workflow flags
      expect(result.command).not.toContain('--skill')
      expect(result.command).not.toContain('/bmad')
    })

    it('propagates sendCommand errors', async () => {
      const sendError = new Error('Spawn failed')
      vi.mocked(TaskTerminalService.sendCommand).mockRejectedValue(sendError)

      await expect(
        BmadAgentLauncherService.launchBasicTask(mockTaskId, mockProjectPath, mockTaskTitle)
      ).rejects.toThrow('Spawn failed')
    })

    // Story 8.4: Worktree path tests
    it('uses worktree path in cd command when provided (Story 8.4)', async () => {
      const worktreePath = '/home/user/my-project/.tinsu/worktrees/task-abc'

      const result = await BmadAgentLauncherService.launchBasicTask(
        mockTaskId,
        mockProjectPath,
        mockTaskTitle,
        mockTaskDescription,
        undefined,
        worktreePath
      )

      expect(result.command).toContain(`cd "${worktreePath}"`)
      expect(result.command).not.toContain(mockProjectPath)
    })

    it('falls back to project path when worktree path is undefined (Story 8.4)', async () => {
      const result = await BmadAgentLauncherService.launchBasicTask(
        mockTaskId,
        mockProjectPath,
        mockTaskTitle
      )

      expect(result.command).toContain(`cd "${mockProjectPath}"`)
    })
  })
})

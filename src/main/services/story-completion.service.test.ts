import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { StoryCompletionService } from './story-completion.service'
import { DetailedStoryParserService } from './detailed-story-parser.service'

// Mock DetailedStoryParserService
vi.mock('./detailed-story-parser.service', () => ({
  DetailedStoryParserService: {
    findStoryFile: vi.fn()
  }
}))

describe('StoryCompletionService', () => {
  // Create mock database with proper chaining
  function createMockDb() {
    const mockGet = vi.fn()
    const mockRun = vi.fn()
    const mockSet = vi.fn()

    const mockDb = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            get: mockGet
          }))
        }))
      })),
      update: vi.fn(() => ({
        set: mockSet.mockReturnValue({
          where: vi.fn(() => ({
            run: mockRun
          }))
        })
      })),
      // Store references for test assertions
      _mockGet: mockGet,
      _mockSet: mockSet,
      _mockRun: mockRun
    }

    return mockDb
  }

  let mockDb: ReturnType<typeof createMockDb>

  beforeEach(() => {
    vi.clearAllMocks()
    mockDb = createMockDb()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('handleCreateStoryComplete', () => {
    it('returns error when task not found', async () => {
      mockDb._mockGet.mockReturnValue(undefined)

      const result = await StoryCompletionService.handleCreateStoryComplete(
        mockDb as any,
        'nonexistent-task',
        '/project/root'
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('Task not found')
      expect(result.storyFilePath).toBeNull()
    })

    it('returns error when task is not a story task', async () => {
      mockDb._mockGet.mockReturnValue({
        id: 'task-123',
        task_type: 'planning',
        epic_id: 'epic-1',
        story_number: 1
      })

      const result = await StoryCompletionService.handleCreateStoryComplete(
        mockDb as any,
        'task-123',
        '/project/root'
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('Task is not a story task')
    })

    it('returns error when task has no epic_id', async () => {
      mockDb._mockGet.mockReturnValue({
        id: 'task-123',
        task_type: 'story',
        epic_id: null,
        story_number: 1
      })

      const result = await StoryCompletionService.handleCreateStoryComplete(
        mockDb as any,
        'task-123',
        '/project/root'
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('Task has no associated epic')
    })

    it('returns error when epic not found', async () => {
      // First call returns task, second call returns undefined (epic not found)
      mockDb._mockGet
        .mockReturnValueOnce({
          id: 'task-123',
          task_type: 'story',
          epic_id: 'epic-1',
          story_number: 1
        })
        .mockReturnValueOnce(undefined)

      const result = await StoryCompletionService.handleCreateStoryComplete(
        mockDb as any,
        'task-123',
        '/project/root'
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('Epic not found or has no epic number')
    })

    it('returns error when task has no story_number', async () => {
      mockDb._mockGet
        .mockReturnValueOnce({
          id: 'task-123',
          task_type: 'story',
          epic_id: 'epic-1',
          story_number: null
        })
        .mockReturnValueOnce({
          id: 'epic-1',
          epic_number: 5
        })

      const result = await StoryCompletionService.handleCreateStoryComplete(
        mockDb as any,
        'task-123',
        '/project/root'
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('Task has no story number')
    })

    it('returns error when story file not found', async () => {
      mockDb._mockGet
        .mockReturnValueOnce({
          id: 'task-123',
          task_type: 'story',
          epic_id: 'epic-1',
          story_number: 3
        })
        .mockReturnValueOnce({
          id: 'epic-1',
          epic_number: 5,
          sprint_id: null
        })

      vi.mocked(DetailedStoryParserService.findStoryFile).mockResolvedValue(null)

      const result = await StoryCompletionService.handleCreateStoryComplete(
        mockDb as any,
        'task-123',
        '/project/root'
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('Story file not found in implementation-artifacts')
      expect(DetailedStoryParserService.findStoryFile).toHaveBeenCalledWith(
        '/project/root/_bmad-output/implementation-artifacts',
        5,
        '3',
        undefined
      )
    })

    it('successfully updates task when story file found', async () => {
      mockDb._mockGet
        .mockReturnValueOnce({
          id: 'task-123',
          task_type: 'story',
          epic_id: 'epic-1',
          story_number: 3
        })
        .mockReturnValueOnce({
          id: 'epic-1',
          epic_number: 5,
          sprint_id: null
        })

      vi.mocked(DetailedStoryParserService.findStoryFile).mockResolvedValue({
        epicNumber: 5,
        storyNumber: '3',
        filePath: '/project/root/_bmad-output/implementation-artifacts/5-3-story-task-execution-path.md',
        fullContent: '# Story 5.3: Story Task Execution Path\n\nStatus: ready-for-dev\n\n...'
      })

      const result = await StoryCompletionService.handleCreateStoryComplete(
        mockDb as any,
        'task-123',
        '/project/root'
      )

      expect(result.success).toBe(true)
      expect(result.storyFilePath).toBe(
        '/project/root/_bmad-output/implementation-artifacts/5-3-story-task-execution-path.md'
      )

      // Verify database update was called
      expect(mockDb.update).toHaveBeenCalled()
      expect(mockDb._mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          story_file_status: 'story_ready',
          story_file_path:
            '/project/root/_bmad-output/implementation-artifacts/5-3-story-task-execution-path.md',
          full_content: '# Story 5.3: Story Task Execution Path\n\nStatus: ready-for-dev\n\n...'
        })
      )
    })

    it('handles sub-story numbers correctly', async () => {
      mockDb._mockGet
        .mockReturnValueOnce({
          id: 'task-456',
          task_type: 'story',
          epic_id: 'epic-3',
          story_number: 15 // Represents "1-5" sub-story
        })
        .mockReturnValueOnce({
          id: 'epic-3',
          epic_number: 3,
          sprint_id: null
        })

      vi.mocked(DetailedStoryParserService.findStoryFile).mockResolvedValue({
        epicNumber: 3,
        storyNumber: '15',
        filePath: '/project/root/_bmad-output/implementation-artifacts/3-1-5-multi-project-support.md',
        fullContent: '# Story 3.1.5: Multi-Project Support\n\n...'
      })

      const result = await StoryCompletionService.handleCreateStoryComplete(
        mockDb as any,
        'task-456',
        '/project/root'
      )

      expect(result.success).toBe(true)
      expect(DetailedStoryParserService.findStoryFile).toHaveBeenCalledWith(
        '/project/root/_bmad-output/implementation-artifacts',
        3,
        '15',
        undefined
      )
    })

    it('passes story_prefix from sprint when finding story file', async () => {
      mockDb._mockGet
        .mockReturnValueOnce({
          id: 'task-789',
          task_type: 'story',
          epic_id: 'epic-tes-3',
          story_number: '3'
        })
        .mockReturnValueOnce({
          id: 'epic-tes-3',
          epic_number: 3,
          sprint_id: 'sprint-tes'
        })
        .mockReturnValueOnce({
          id: 'sprint-tes',
          story_prefix: 'tes'
        })

      vi.mocked(DetailedStoryParserService.findStoryFile).mockResolvedValue({
        prefix: 'tes',
        epicNumber: 3,
        storyNumber: '3',
        filePath: '/project/root/_bmad-output/implementation-artifacts/tes-3-3-section-expand-collapse.md',
        fullContent: '# Story TES-3.3: Section Expand/Collapse\n\n...'
      })

      const result = await StoryCompletionService.handleCreateStoryComplete(
        mockDb as any,
        'task-789',
        '/project/root'
      )

      expect(result.success).toBe(true)
      expect(result.storyFilePath).toBe(
        '/project/root/_bmad-output/implementation-artifacts/tes-3-3-section-expand-collapse.md'
      )
      expect(DetailedStoryParserService.findStoryFile).toHaveBeenCalledWith(
        '/project/root/_bmad-output/implementation-artifacts',
        3,
        '3',
        'tes'
      )
    })
  })

  describe('rescanAndUpdateTask', () => {
    it('delegates to handleCreateStoryComplete', async () => {
      mockDb._mockGet.mockReturnValue(undefined)

      const result = await StoryCompletionService.rescanAndUpdateTask(
        mockDb as any,
        'task-123',
        '/project/root'
      )

      // Should return the same result as handleCreateStoryComplete
      expect(result.success).toBe(false)
      expect(result.error).toBe('Task not found')
    })
  })
})

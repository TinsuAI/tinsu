import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ContextBuilderService } from './context-builder.service'
import type { InlineComment } from '@shared/types/task.types'
import * as fs from 'fs'
import * as path from 'path'

// Mock fs module
vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  existsSync: vi.fn()
}))

describe('ContextBuilderService', () => {
  const mockStoryPath = '/home/user/project/_bmad-output/implementation-artifacts/5-5-story.md'
  const mockProjectRoot = '/home/user/project'

  const mockStoryContent = `# Story 5.5: DEV Agent: Implement Story

Status: ready-for-dev

## Story

As a founder,
I want the Dev agent to implement the story with full context injection,
So that code is written according to requirements and architecture (FR8).

## Acceptance Criteria

1. **Given** SM draft completes (or is skipped)
   **When** DEV agent spawns
   **Then** Context Builder provides: story AC, PRD summary, architecture, UX design

## Tasks / Subtasks

- [ ] Task 1: Create ContextBuilderService
- [ ] Task 2: Create DevAgentProgressService

## Dev Notes

### Critical Architecture Patterns

**Electron Process Boundaries:**
- All context building happens in main process
`

  const mockProjectContextContent = `---
project_name: 'TinSu'
---

# Project Context for AI Agents

## Critical Implementation Rules

- Use tRPC for all IPC
- Tests co-located with source
`

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('buildStoryContext', () => {
    it('loads story content from file path', () => {
      vi.mocked(fs.readFileSync).mockReturnValue(mockStoryContent)
      vi.mocked(fs.existsSync).mockReturnValue(false)

      const context = ContextBuilderService.buildStoryContext(mockStoryPath)

      expect(fs.readFileSync).toHaveBeenCalledWith(mockStoryPath, 'utf-8')
      expect(context.storyContent).toBe(mockStoryContent)
    })

    it('returns storyContent containing acceptance criteria', () => {
      vi.mocked(fs.readFileSync).mockReturnValue(mockStoryContent)
      vi.mocked(fs.existsSync).mockReturnValue(false)

      const context = ContextBuilderService.buildStoryContext(mockStoryPath)

      expect(context.storyContent).toContain('## Acceptance Criteria')
    })

    it('returns storyContent containing tasks section', () => {
      vi.mocked(fs.readFileSync).mockReturnValue(mockStoryContent)
      vi.mocked(fs.existsSync).mockReturnValue(false)

      const context = ContextBuilderService.buildStoryContext(mockStoryPath)

      expect(context.storyContent).toContain('## Tasks / Subtasks')
    })

    it('sets storyFilePath to the provided path', () => {
      vi.mocked(fs.readFileSync).mockReturnValue(mockStoryContent)
      vi.mocked(fs.existsSync).mockReturnValue(false)

      const context = ContextBuilderService.buildStoryContext(mockStoryPath)

      expect(context.storyFilePath).toBe(mockStoryPath)
    })

    it('returns undefined for optional fields when not available', () => {
      vi.mocked(fs.readFileSync).mockReturnValue(mockStoryContent)
      vi.mocked(fs.existsSync).mockReturnValue(false)

      const context = ContextBuilderService.buildStoryContext(mockStoryPath)

      expect(context.contextNotes).toBeUndefined()
      expect(context.projectContextPath).toBeUndefined()
    })

    it('throws error when story file cannot be read', () => {
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error('ENOENT: no such file')
      })

      expect(() => {
        ContextBuilderService.buildStoryContext(mockStoryPath)
      }).toThrow('ENOENT: no such file')
    })
  })

  describe('buildStoryContextWithProjectContext', () => {
    it('loads project context when available and returns in context object', () => {
      vi.mocked(fs.readFileSync).mockImplementation((filePath) => {
        if (filePath === mockStoryPath) return mockStoryContent
        if (typeof filePath === 'string' && filePath.includes('project-context.md')) {
          return mockProjectContextContent
        }
        throw new Error('File not found')
      })
      vi.mocked(fs.existsSync).mockReturnValue(true)

      const projectContextPath = path.join(mockProjectRoot, '_bmad-output/planning-artifacts/project-context.md')
      const context = ContextBuilderService.buildStoryContextWithProjectContext(
        mockStoryPath,
        projectContextPath
      )

      expect(context.storyContent).toBe(mockStoryContent)
      expect(context.projectContextContent).toBe(mockProjectContextContent)
      expect(context.projectContextPath).toBe(projectContextPath)
    })

    it('returns undefined projectContextContent when project context file does not exist', () => {
      vi.mocked(fs.readFileSync).mockReturnValue(mockStoryContent)
      vi.mocked(fs.existsSync).mockReturnValue(false)

      const projectContextPath = path.join(mockProjectRoot, '_bmad-output/planning-artifacts/project-context.md')
      const context = ContextBuilderService.buildStoryContextWithProjectContext(
        mockStoryPath,
        projectContextPath
      )

      expect(context.storyContent).toBe(mockStoryContent)
      expect(context.projectContextContent).toBeUndefined()
      expect(context.projectContextPath).toBeUndefined()
    })
  })

  describe('buildStoryContextWithNotes', () => {
    it('includes context notes when provided', () => {
      vi.mocked(fs.readFileSync).mockReturnValue(mockStoryContent)
      vi.mocked(fs.existsSync).mockReturnValue(false)

      const notes = 'Remember to use the existing auth module'
      const context = ContextBuilderService.buildStoryContextWithNotes(mockStoryPath, notes)

      expect(context.storyContent).toBe(mockStoryContent)
      expect(context.contextNotes).toBe(notes)
    })

    it('handles undefined context notes', () => {
      vi.mocked(fs.readFileSync).mockReturnValue(mockStoryContent)
      vi.mocked(fs.existsSync).mockReturnValue(false)

      const context = ContextBuilderService.buildStoryContextWithNotes(mockStoryPath, undefined)

      expect(context.storyContent).toBe(mockStoryContent)
      expect(context.contextNotes).toBeUndefined()
    })

    it('handles empty string context notes', () => {
      vi.mocked(fs.readFileSync).mockReturnValue(mockStoryContent)
      vi.mocked(fs.existsSync).mockReturnValue(false)

      const context = ContextBuilderService.buildStoryContextWithNotes(mockStoryPath, '')

      expect(context.storyContent).toBe(mockStoryContent)
      expect(context.contextNotes).toBe('')
    })
  })

  // Story 8.4: Worktree path resolution tests
  describe('resolvePathInWorktree (Story 8.4)', () => {
    it('returns absolute path unchanged', () => {
      const absolutePath = '/absolute/path/to/file.ts'

      const result = ContextBuilderService.resolvePathInWorktree(absolutePath, '/some/worktree')

      expect(result).toBe(absolutePath)
    })

    it('resolves relative path against worktree when provided', () => {
      const relativePath = 'src/index.ts'
      const worktreePath = '/project/.tinsu/worktrees/task-123'

      const result = ContextBuilderService.resolvePathInWorktree(relativePath, worktreePath)

      expect(result).toBe('/project/.tinsu/worktrees/task-123/src/index.ts')
    })

    it('returns relative path unchanged when no worktree provided', () => {
      const relativePath = 'src/index.ts'

      const result = ContextBuilderService.resolvePathInWorktree(relativePath, undefined)

      expect(result).toBe(relativePath)
    })

    it('handles paths with ../ correctly', () => {
      const relativePath = '../sibling/file.ts'
      const worktreePath = '/project/.tinsu/worktrees/task-123'

      const result = ContextBuilderService.resolvePathInWorktree(relativePath, worktreePath)

      // path.join normalizes the path
      expect(result).toBe('/project/.tinsu/worktrees/sibling/file.ts')
    })
  })

  // Story 7.5: Inline comments formatting tests
  describe('formatInlineCommentsAsMarkdown (Story 7.5)', () => {
    it('returns empty string for empty comments array', () => {
      const result = ContextBuilderService.formatInlineCommentsAsMarkdown([])

      expect(result).toBe('')
    })

    it('returns empty string for null comments', () => {
      const result = ContextBuilderService.formatInlineCommentsAsMarkdown(null as unknown as InlineComment[])

      expect(result).toBe('')
    })

    it('formats single comment correctly', () => {
      const comments: InlineComment[] = [
        { id: '1', filePath: 'src/App.tsx', lineNumber: 42, content: 'Add error handling', createdAt: Date.now() }
      ]

      const result = ContextBuilderService.formatInlineCommentsAsMarkdown(comments)

      expect(result).toContain('## Inline Review Comments')
      expect(result).toContain('### src/App.tsx')
      expect(result).toContain('- **Line 42**: Add error handling')
    })

    it('groups comments by file path', () => {
      const comments: InlineComment[] = [
        { id: '1', filePath: 'src/App.tsx', lineNumber: 42, content: 'Add error handling', createdAt: Date.now() },
        { id: '2', filePath: 'src/App.tsx', lineNumber: 55, content: 'Use async/await', createdAt: Date.now() },
        { id: '3', filePath: 'src/utils.ts', lineNumber: 10, content: 'Add type annotation', createdAt: Date.now() }
      ]

      const result = ContextBuilderService.formatInlineCommentsAsMarkdown(comments)

      expect(result).toContain('### src/App.tsx')
      expect(result).toContain('### src/utils.ts')
      expect(result).toContain('- **Line 42**: Add error handling')
      expect(result).toContain('- **Line 55**: Use async/await')
      expect(result).toContain('- **Line 10**: Add type annotation')
    })

    it('sorts comments by line number within each file', () => {
      const comments: InlineComment[] = [
        { id: '1', filePath: 'src/App.tsx', lineNumber: 100, content: 'Comment C', createdAt: Date.now() },
        { id: '2', filePath: 'src/App.tsx', lineNumber: 10, content: 'Comment A', createdAt: Date.now() },
        { id: '3', filePath: 'src/App.tsx', lineNumber: 50, content: 'Comment B', createdAt: Date.now() }
      ]

      const result = ContextBuilderService.formatInlineCommentsAsMarkdown(comments)

      const lines = result.split('\n')
      const commentLines = lines.filter(line => line.startsWith('- **Line'))

      // Should be ordered: Line 10, Line 50, Line 100
      expect(commentLines[0]).toContain('Line 10')
      expect(commentLines[1]).toContain('Line 50')
      expect(commentLines[2]).toContain('Line 100')
    })
  })

  // Story 7.6: Rejection feedback formatting tests
  describe('formatRejectionFeedbackAsMarkdown (Story 7.6)', () => {
    it('formats feedback with prominent Revision Required section', () => {
      const result = ContextBuilderService.formatRejectionFeedbackAsMarkdown(
        'Please fix the error handling',
        1
      )

      expect(result).toContain('## Revision Required')
      expect(result).toContain('> **Human Reviewer Feedback:**')
      expect(result).toContain('> Please fix the error handling')
      expect(result).toContain('Please address all feedback points before proceeding')
    })

    it('includes revision attempt number when count > 1', () => {
      const result = ContextBuilderService.formatRejectionFeedbackAsMarkdown(
        'The fix still has issues',
        2
      )

      expect(result).toContain('**Revision attempt:** #2')
      expect(result).toContain('Previous attempts did not fully address the requirements')
    })

    it('does not include revision count message for first rejection', () => {
      const result = ContextBuilderService.formatRejectionFeedbackAsMarkdown(
        'Please fix this',
        1
      )

      expect(result).not.toContain('**Revision attempt:**')
      expect(result).not.toContain('Previous attempts')
    })

    it('handles multi-line feedback correctly', () => {
      const feedback = `Please fix the following:
1. Add error handling
2. Use async/await
3. Add unit tests`

      const result = ContextBuilderService.formatRejectionFeedbackAsMarkdown(feedback, 1)

      expect(result).toContain('> Please fix the following:')
      expect(result).toContain('> 1. Add error handling')
      expect(result).toContain('> 2. Use async/await')
      expect(result).toContain('> 3. Add unit tests')
    })

    it('handles empty feedback gracefully', () => {
      const result = ContextBuilderService.formatRejectionFeedbackAsMarkdown('', 1)

      expect(result).toContain('## Revision Required')
      expect(result).toContain('> **Human Reviewer Feedback:**')
    })

    it('shows high revision count correctly', () => {
      const result = ContextBuilderService.formatRejectionFeedbackAsMarkdown(
        'Still not fixed',
        5
      )

      expect(result).toContain('**Revision attempt:** #5')
    })
  })

  describe('buildContext (Story 8.4)', () => {
    it('resolves story path relative to worktree', () => {
      vi.mocked(fs.readFileSync).mockReturnValue(mockStoryContent)
      vi.mocked(fs.existsSync).mockReturnValue(false)

      const worktreePath = '/project/.tinsu/worktrees/task-abc'
      const context = ContextBuilderService.buildContext({
        storyFilePath: 'stories/8-4-story.md',
        worktreePath
      })

      expect(fs.readFileSync).toHaveBeenCalledWith(
        '/project/.tinsu/worktrees/task-abc/stories/8-4-story.md',
        'utf-8'
      )
      expect(context.worktreeBasePath).toBe(worktreePath)
    })

    it('uses absolute story path as-is', () => {
      vi.mocked(fs.readFileSync).mockReturnValue(mockStoryContent)
      vi.mocked(fs.existsSync).mockReturnValue(false)

      const absoluteStoryPath = '/project/_bmad-output/stories/8-4-story.md'
      const context = ContextBuilderService.buildContext({
        storyFilePath: absoluteStoryPath,
        worktreePath: '/project/.tinsu/worktrees/task-abc'
      })

      expect(fs.readFileSync).toHaveBeenCalledWith(absoluteStoryPath, 'utf-8')
      expect(context.storyFilePath).toBe(absoluteStoryPath)
    })

    it('loads project context from worktree when available', () => {
      vi.mocked(fs.readFileSync).mockImplementation((filePath) => {
        if (typeof filePath === 'string' && filePath.includes('story')) return mockStoryContent
        if (typeof filePath === 'string' && filePath.includes('project-context')) return mockProjectContextContent
        throw new Error('File not found')
      })
      vi.mocked(fs.existsSync).mockReturnValue(true)

      const worktreePath = '/project/.tinsu/worktrees/task-abc'
      const context = ContextBuilderService.buildContext({
        storyFilePath: '/abs/story.md',
        projectContextPath: 'docs/project-context.md',
        worktreePath
      })

      expect(fs.existsSync).toHaveBeenCalledWith(
        '/project/.tinsu/worktrees/task-abc/docs/project-context.md'
      )
      expect(context.projectContextContent).toBe(mockProjectContextContent)
    })

    it('includes context notes when provided', () => {
      vi.mocked(fs.readFileSync).mockReturnValue(mockStoryContent)
      vi.mocked(fs.existsSync).mockReturnValue(false)

      const notes = 'Custom implementation notes'
      const context = ContextBuilderService.buildContext({
        storyFilePath: mockStoryPath,
        contextNotes: notes
      })

      expect(context.contextNotes).toBe(notes)
    })

    it('works without worktree path', () => {
      vi.mocked(fs.readFileSync).mockReturnValue(mockStoryContent)
      vi.mocked(fs.existsSync).mockReturnValue(false)

      const context = ContextBuilderService.buildContext({
        storyFilePath: mockStoryPath
      })

      expect(context.storyContent).toBe(mockStoryContent)
      expect(context.worktreeBasePath).toBeUndefined()
    })
  })
})

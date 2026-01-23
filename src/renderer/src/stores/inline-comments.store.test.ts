import { describe, it, expect, beforeEach } from 'vitest'
import { useInlineCommentsStore } from './inline-comments.store'

describe('useInlineCommentsStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useInlineCommentsStore.setState({
      commentsByTask: {},
      activeInput: null,
      expandedThreads: new Set()
    })
  })

  describe('addComment', () => {
    it('should add a comment with generated id and timestamp', () => {
      const store = useInlineCommentsStore.getState()

      store.addComment('task-1', {
        filePath: 'src/App.tsx',
        lineNumber: 42,
        content: 'This needs refactoring'
      })

      const comments = store.getCommentsForTask('task-1')
      expect(comments).toHaveLength(1)
      expect(comments[0]).toMatchObject({
        filePath: 'src/App.tsx',
        lineNumber: 42,
        content: 'This needs refactoring'
      })
      expect(comments[0].id).toBeDefined()
      expect(comments[0].createdAt).toBeDefined()
      expect(typeof comments[0].createdAt).toBe('number')
    })

    it('should add multiple comments to the same task', () => {
      const store = useInlineCommentsStore.getState()

      store.addComment('task-1', {
        filePath: 'src/App.tsx',
        lineNumber: 10,
        content: 'First comment'
      })
      store.addComment('task-1', {
        filePath: 'src/App.tsx',
        lineNumber: 20,
        content: 'Second comment'
      })

      const comments = store.getCommentsForTask('task-1')
      expect(comments).toHaveLength(2)
    })

    it('should automatically expand the thread when adding a comment', () => {
      const store = useInlineCommentsStore.getState()

      store.addComment('task-1', {
        filePath: 'src/App.tsx',
        lineNumber: 42,
        content: 'Test'
      })

      expect(store.isThreadExpanded('task-1', 'src/App.tsx', 42)).toBe(true)
    })
  })

  describe('removeComment', () => {
    it('should remove a comment by id', () => {
      const store = useInlineCommentsStore.getState()

      store.addComment('task-1', {
        filePath: 'src/App.tsx',
        lineNumber: 42,
        content: 'To be removed'
      })

      const comments = store.getCommentsForTask('task-1')
      expect(comments).toHaveLength(1)

      store.removeComment('task-1', comments[0].id)

      expect(store.getCommentsForTask('task-1')).toHaveLength(0)
    })

    it('should only remove the specified comment', () => {
      const store = useInlineCommentsStore.getState()

      store.addComment('task-1', {
        filePath: 'src/App.tsx',
        lineNumber: 10,
        content: 'Keep this'
      })
      store.addComment('task-1', {
        filePath: 'src/App.tsx',
        lineNumber: 20,
        content: 'Remove this'
      })

      const comments = store.getCommentsForTask('task-1')
      const commentToRemove = comments.find((c) => c.content === 'Remove this')!

      store.removeComment('task-1', commentToRemove.id)

      const remaining = store.getCommentsForTask('task-1')
      expect(remaining).toHaveLength(1)
      expect(remaining[0].content).toBe('Keep this')
    })
  })

  describe('setActiveInput', () => {
    it('should set the active input location', () => {
      const store = useInlineCommentsStore.getState()

      store.setActiveInput({
        taskId: 'task-1',
        filePath: 'src/App.tsx',
        lineNumber: 42
      })

      expect(useInlineCommentsStore.getState().activeInput).toEqual({
        taskId: 'task-1',
        filePath: 'src/App.tsx',
        lineNumber: 42
      })
    })

    it('should clear the active input when set to null', () => {
      const store = useInlineCommentsStore.getState()

      store.setActiveInput({
        taskId: 'task-1',
        filePath: 'src/App.tsx',
        lineNumber: 42
      })
      store.setActiveInput(null)

      expect(useInlineCommentsStore.getState().activeInput).toBeNull()
    })
  })

  describe('clearComments', () => {
    it('should clear all comments for a task', () => {
      const store = useInlineCommentsStore.getState()

      store.addComment('task-1', {
        filePath: 'src/App.tsx',
        lineNumber: 10,
        content: 'Comment 1'
      })
      store.addComment('task-1', {
        filePath: 'src/App.tsx',
        lineNumber: 20,
        content: 'Comment 2'
      })

      store.clearComments('task-1')

      expect(store.getCommentsForTask('task-1')).toHaveLength(0)
    })

    it('should not affect comments for other tasks', () => {
      const store = useInlineCommentsStore.getState()

      store.addComment('task-1', {
        filePath: 'src/App.tsx',
        lineNumber: 10,
        content: 'Task 1 comment'
      })
      store.addComment('task-2', {
        filePath: 'src/App.tsx',
        lineNumber: 20,
        content: 'Task 2 comment'
      })

      store.clearComments('task-1')

      expect(store.getCommentsForTask('task-1')).toHaveLength(0)
      expect(store.getCommentsForTask('task-2')).toHaveLength(1)
    })

    it('should also clear expanded threads for the task', () => {
      const store = useInlineCommentsStore.getState()

      store.addComment('task-1', {
        filePath: 'src/App.tsx',
        lineNumber: 42,
        content: 'Test'
      })

      expect(store.isThreadExpanded('task-1', 'src/App.tsx', 42)).toBe(true)

      store.clearComments('task-1')

      expect(store.isThreadExpanded('task-1', 'src/App.tsx', 42)).toBe(false)
    })
  })

  describe('loadComments', () => {
    it('should load comments from an array', () => {
      const store = useInlineCommentsStore.getState()

      const comments = [
        {
          id: 'comment-1',
          filePath: 'src/App.tsx',
          lineNumber: 10,
          content: 'Comment 1',
          createdAt: Date.now()
        },
        {
          id: 'comment-2',
          filePath: 'src/utils.ts',
          lineNumber: 20,
          content: 'Comment 2',
          createdAt: Date.now()
        }
      ]

      store.loadComments('task-1', comments)

      expect(store.getCommentsForTask('task-1')).toEqual(comments)
    })

    it('should replace existing comments for the task', () => {
      const store = useInlineCommentsStore.getState()

      store.addComment('task-1', {
        filePath: 'src/App.tsx',
        lineNumber: 10,
        content: 'Old comment'
      })

      const newComments = [
        {
          id: 'new-1',
          filePath: 'src/App.tsx',
          lineNumber: 20,
          content: 'New comment',
          createdAt: Date.now()
        }
      ]

      store.loadComments('task-1', newComments)

      const comments = store.getCommentsForTask('task-1')
      expect(comments).toHaveLength(1)
      expect(comments[0].id).toBe('new-1')
    })
  })

  describe('getCommentsForFile', () => {
    it('should return only comments for the specified file', () => {
      const store = useInlineCommentsStore.getState()

      store.addComment('task-1', {
        filePath: 'src/App.tsx',
        lineNumber: 10,
        content: 'App comment'
      })
      store.addComment('task-1', {
        filePath: 'src/utils.ts',
        lineNumber: 20,
        content: 'Utils comment'
      })
      store.addComment('task-1', {
        filePath: 'src/App.tsx',
        lineNumber: 30,
        content: 'Another App comment'
      })

      const appComments = store.getCommentsForFile('task-1', 'src/App.tsx')
      expect(appComments).toHaveLength(2)
      expect(appComments.every((c) => c.filePath === 'src/App.tsx')).toBe(true)
    })

    it('should return empty array if no comments for file', () => {
      const store = useInlineCommentsStore.getState()

      store.addComment('task-1', {
        filePath: 'src/App.tsx',
        lineNumber: 10,
        content: 'App comment'
      })

      const comments = store.getCommentsForFile('task-1', 'src/nonexistent.ts')
      expect(comments).toHaveLength(0)
    })
  })

  describe('toggleThread', () => {
    it('should expand a collapsed thread', () => {
      const store = useInlineCommentsStore.getState()

      expect(store.isThreadExpanded('task-1', 'src/App.tsx', 42)).toBe(false)

      store.toggleThread('task-1', 'src/App.tsx', 42)

      expect(store.isThreadExpanded('task-1', 'src/App.tsx', 42)).toBe(true)
    })

    it('should collapse an expanded thread', () => {
      const store = useInlineCommentsStore.getState()

      store.toggleThread('task-1', 'src/App.tsx', 42) // Expand
      expect(store.isThreadExpanded('task-1', 'src/App.tsx', 42)).toBe(true)

      store.toggleThread('task-1', 'src/App.tsx', 42) // Collapse
      expect(store.isThreadExpanded('task-1', 'src/App.tsx', 42)).toBe(false)
    })
  })

  describe('isThreadExpanded', () => {
    it('should return false for non-existent threads', () => {
      const store = useInlineCommentsStore.getState()

      expect(store.isThreadExpanded('task-1', 'src/App.tsx', 42)).toBe(false)
    })

    it('should differentiate between different files and lines', () => {
      const store = useInlineCommentsStore.getState()

      store.toggleThread('task-1', 'src/App.tsx', 42)

      expect(store.isThreadExpanded('task-1', 'src/App.tsx', 42)).toBe(true)
      expect(store.isThreadExpanded('task-1', 'src/App.tsx', 43)).toBe(false)
      expect(store.isThreadExpanded('task-1', 'src/Other.tsx', 42)).toBe(false)
      expect(store.isThreadExpanded('task-2', 'src/App.tsx', 42)).toBe(false)
    })
  })
})

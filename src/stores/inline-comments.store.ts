import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { InlineComment } from '@shared/types/task.types'

/**
 * Location for an active inline comment input.
 */
interface ActiveInputLocation {
  taskId: string
  filePath: string
  lineNumber: number
}

interface InlineCommentsState {
  /** Map of taskId -> array of inline comments */
  commentsByTask: Record<string, InlineComment[]>

  /** Currently active input location (where user is typing a new comment) */
  activeInput: ActiveInputLocation | null

  /** Currently expanded comment threads (taskId:filePath:lineNumber -> expanded) */
  expandedThreads: Set<string>

  /** Actions */
  addComment: (
    taskId: string,
    comment: Omit<InlineComment, 'id' | 'createdAt'>
  ) => void
  removeComment: (taskId: string, commentId: string) => void
  setActiveInput: (location: ActiveInputLocation | null) => void
  clearComments: (taskId: string) => void
  loadComments: (taskId: string, comments: InlineComment[]) => void
  getCommentsForFile: (taskId: string, filePath: string) => InlineComment[]
  getCommentsForTask: (taskId: string) => InlineComment[]
  toggleThread: (taskId: string, filePath: string, lineNumber: number) => void
  isThreadExpanded: (
    taskId: string,
    filePath: string,
    lineNumber: number
  ) => boolean
}

/**
 * Helper to create a thread key for tracking expanded state.
 */
function threadKey(
  taskId: string,
  filePath: string,
  lineNumber: number
): string {
  return `${taskId}:${filePath}:${lineNumber}`
}

/**
 * Inline comments store.
 * Manages inline review comments for the request changes workflow.
 *
 * Story 7.5: Request Changes with Inline Comments
 */
export const useInlineCommentsStore = create<InlineCommentsState>((set, get) => ({
  commentsByTask: {},
  activeInput: null,
  expandedThreads: new Set(),

  addComment: (taskId, { filePath, lineNumber, content }) => {
    const newComment: InlineComment = {
      id: uuidv4(),
      filePath,
      lineNumber,
      content,
      createdAt: Date.now()
    }

    set((state) => ({
      commentsByTask: {
        ...state.commentsByTask,
        [taskId]: [...(state.commentsByTask[taskId] || []), newComment]
      },
      // Automatically expand the thread when adding a comment
      expandedThreads: new Set([
        ...state.expandedThreads,
        threadKey(taskId, filePath, lineNumber)
      ])
    }))
  },

  removeComment: (taskId, commentId) => {
    set((state) => ({
      commentsByTask: {
        ...state.commentsByTask,
        [taskId]: (state.commentsByTask[taskId] || []).filter(
          (c) => c.id !== commentId
        )
      }
    }))
  },

  setActiveInput: (location) => {
    set({ activeInput: location })
  },

  clearComments: (taskId) => {
    set((state) => {
      const { [taskId]: _, ...rest } = state.commentsByTask
      // Also clear any expanded threads for this task
      const newExpandedThreads = new Set(
        [...state.expandedThreads].filter(
          (key) => !key.startsWith(`${taskId}:`)
        )
      )
      return {
        commentsByTask: rest,
        expandedThreads: newExpandedThreads
      }
    })
  },

  loadComments: (taskId, comments) => {
    set((state) => ({
      commentsByTask: {
        ...state.commentsByTask,
        [taskId]: comments
      }
    }))
  },

  getCommentsForFile: (taskId, filePath) => {
    const state = get()
    return (state.commentsByTask[taskId] || []).filter(
      (c) => c.filePath === filePath
    )
  },

  getCommentsForTask: (taskId) => {
    const state = get()
    return state.commentsByTask[taskId] || []
  },

  toggleThread: (taskId, filePath, lineNumber) => {
    const key = threadKey(taskId, filePath, lineNumber)
    set((state) => {
      const newExpanded = new Set(state.expandedThreads)
      if (newExpanded.has(key)) {
        newExpanded.delete(key)
      } else {
        newExpanded.add(key)
      }
      return { expandedThreads: newExpanded }
    })
  },

  isThreadExpanded: (taskId, filePath, lineNumber) => {
    const state = get()
    return state.expandedThreads.has(threadKey(taskId, filePath, lineNumber))
  }
}))

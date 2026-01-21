/**
 * Git Router Tests - TES-4.1
 *
 * Tests for the git tRPC router.
 * Tests the router procedures by mocking GitService.
 *
 * @see TES-4.1: Git Diff Data Fetching
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { gitRouter } from './git.router'
import { GitService } from '../../services/git.service'
import { TRPCError } from '../trpc'

// Mock GitService
vi.mock('../../services/git.service', () => ({
  GitService: {
    getDiff: vi.fn()
  }
}))

const mockGetDiff = GitService.getDiff as ReturnType<typeof vi.fn>

describe('gitRouter', () => {
  // Create a mock context
  const mockContext = {
    projectRoot: '/test/project/path'
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should export a valid tRPC router', () => {
    expect(gitRouter).toBeDefined()
    expect(gitRouter._def).toBeDefined()
    expect(gitRouter._def.procedures).toBeDefined()
  })

  it('should have getDiff procedure defined', () => {
    expect(gitRouter._def.procedures.getDiff).toBeDefined()
  })

  it('should call GitService.getDiff with projectRoot', async () => {
    const mockDiffResult = {
      files: [
        {
          path: 'test.ts',
          status: 'modified' as const,
          additions: 5,
          deletions: 2,
          hunks: []
        }
      ],
      summary: {
        filesChanged: 1,
        linesAdded: 5,
        linesRemoved: 2
      }
    }

    mockGetDiff.mockResolvedValueOnce(mockDiffResult)

    // Call the procedure directly
    const caller = gitRouter.createCaller(mockContext)
    const result = await caller.getDiff()

    expect(mockGetDiff).toHaveBeenCalledWith('/test/project/path')
    expect(result).toEqual(mockDiffResult)
  })

  it('should throw NOT_FOUND error when git repository not found', async () => {
    mockGetDiff.mockRejectedValueOnce(new Error('not a git repository'))

    const caller = gitRouter.createCaller(mockContext)

    await expect(caller.getDiff()).rejects.toThrow('not a git repository')
  })

  it('should throw INTERNAL_SERVER_ERROR for other git errors', async () => {
    mockGetDiff.mockRejectedValueOnce(new Error('Permission denied'))

    const caller = gitRouter.createCaller(mockContext)

    await expect(caller.getDiff()).rejects.toThrow('Permission denied')
  })
})

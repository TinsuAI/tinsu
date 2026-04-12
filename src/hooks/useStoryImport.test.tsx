import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useStoryImport } from './useStoryImport'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode } from 'react'

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn()
  }
}))

// Mock tRPC with controllable mutation
const mockMutate = vi.fn()
const mockMutateAsync = vi.fn()
const mockReset = vi.fn()
let mockIsPending = false
let mockData: { epicsCreated: number; storiesCreated: number; epicIds: string[]; storyIds: string[] } | undefined
let mockError: Error | null = null

vi.mock('@renderer/lib/trpc', async (importOriginal) => {
  const original = await importOriginal<typeof import('@renderer/lib/trpc')>()
  return {
    ...original,
    trpc: {
      ...original.trpc,
      import: {
        importStoriesFromEpics: {
          useMutation: (options: { onSuccess?: (data: typeof mockData) => void; onError?: (error: Error) => void }) => ({
            mutate: (input: { projectId: string; epicsFilePath: string }) => {
              mockMutate(input)
              if (mockError) {
                options.onError?.(mockError)
              } else if (mockData) {
                options.onSuccess?.(mockData)
              }
            },
            mutateAsync: mockMutateAsync,
            isPending: mockIsPending,
            data: mockData,
            error: mockError,
            reset: mockReset
          })
        }
      },
      useUtils: () => ({
        tasks: {
          getById: { invalidate: vi.fn() },
          getAll: { invalidate: vi.fn() },
          getAllWithEpics: { invalidate: vi.fn() }
        },
        epics: {
          getAll: { invalidate: vi.fn() }
        }
      })
    }
  }
})

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  })

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('useStoryImport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMutate.mockClear()
    mockMutateAsync.mockClear()
    mockReset.mockClear()
    mockIsPending = false
    mockData = undefined
    mockError = null
  })

  it('provides importStories function', () => {
    const { result } = renderHook(() => useStoryImport(), {
      wrapper: createWrapper()
    })

    expect(result.current.importStories).toBeDefined()
    expect(typeof result.current.importStories).toBe('function')
  })

  it('provides isImporting state', () => {
    const { result } = renderHook(() => useStoryImport(), {
      wrapper: createWrapper()
    })

    expect(result.current.isImporting).toBe(false)
  })

  it('calls mutation with correct parameters', () => {
    const { result } = renderHook(() => useStoryImport(), {
      wrapper: createWrapper()
    })

    act(() => {
      result.current.importStories('project-123', '/path/to/epics.md')
    })

    expect(mockMutate).toHaveBeenCalledWith({
      projectId: 'project-123',
      epicsFilePath: '/path/to/epics.md'
    })
  })

  it('provides importStoriesAsync for promise-based calls', () => {
    const { result } = renderHook(() => useStoryImport(), {
      wrapper: createWrapper()
    })

    expect(result.current.importStoriesAsync).toBeDefined()
    expect(typeof result.current.importStoriesAsync).toBe('function')
  })

  it('provides reset function', () => {
    const { result } = renderHook(() => useStoryImport(), {
      wrapper: createWrapper()
    })

    expect(result.current.reset).toBeDefined()
    expect(typeof result.current.reset).toBe('function')
  })
})

/**
 * MobileFileTreeSheet tests — AC 6, Story T3.5-6
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MobileFileTreeSheet } from './MobileFileTreeSheet'
import type { GitDiffFile } from '@shared/types/git-diff.types'

// Mock Radix Dialog/Portal (MobileSheet uses it)
vi.mock('@radix-ui/react-dialog', async () => {
  const actual = await vi.importActual<typeof import('@radix-ui/react-dialog')>('@radix-ui/react-dialog')
  return {
    ...actual,
    Portal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  }
})

vi.mock('@renderer/lib/utils', async () => {
  const actual = await vi.importActual<typeof import('@renderer/lib/utils')>('@renderer/lib/utils')
  return { ...actual }
})

vi.mock('../hooks/useReducedMotion', () => ({
  useReducedMotion: vi.fn(() => false),
}))

const MOCK_FILES: GitDiffFile[] = [
  {
    path: 'src/components/Button.tsx',
    status: 'modified',
    additions: 5,
    deletions: 2,
    hunks: [],
  },
  {
    path: 'src/components/NewComponent.tsx',
    status: 'added',
    additions: 30,
    deletions: 0,
    hunks: [],
  },
  {
    path: 'src/old/Legacy.tsx',
    status: 'deleted',
    additions: 0,
    deletions: 15,
    hunks: [],
  },
  {
    path: 'src/components/Renamed.tsx',
    status: 'renamed',
    additions: 2,
    deletions: 1,
    hunks: [],
    oldPath: 'src/components/Old.tsx',
  },
]

describe('MobileFileTreeSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders file rows when open', () => {
    const onOpenChange = vi.fn()
    const onFileSelect = vi.fn()

    render(
      <MobileFileTreeSheet
        open={true}
        onOpenChange={onOpenChange}
        files={MOCK_FILES}
        onFileSelect={onFileSelect}
      />,
    )

    // All 4 files should render as list items
    const items = screen.getAllByTestId('mobile-list-item')
    expect(items).toHaveLength(4)
  })

  it('sorts files: modified first, then added, deleted, renamed', () => {
    const onOpenChange = vi.fn()
    const onFileSelect = vi.fn()

    render(
      <MobileFileTreeSheet
        open={true}
        onOpenChange={onOpenChange}
        files={MOCK_FILES}
        onFileSelect={onFileSelect}
      />,
    )

    const items = screen.getAllByTestId('mobile-list-item')
    // First item should be the modified file
    expect(items[0]).toHaveTextContent('Button.tsx')
    // Second should be added
    expect(items[1]).toHaveTextContent('NewComponent.tsx')
    // Third should be deleted
    expect(items[2]).toHaveTextContent('Legacy.tsx')
    // Fourth should be renamed
    expect(items[3]).toHaveTextContent('Renamed.tsx')
  })

  it('tapping a file row calls onFileSelect with path and closes sheet', () => {
    const onOpenChange = vi.fn()
    const onFileSelect = vi.fn()

    render(
      <MobileFileTreeSheet
        open={true}
        onOpenChange={onOpenChange}
        files={MOCK_FILES}
        onFileSelect={onFileSelect}
      />,
    )

    const items = screen.getAllByTestId('mobile-list-item')
    fireEvent.click(items[0]) // Button.tsx (modified — first after sort)

    expect(onFileSelect).toHaveBeenCalledWith('src/components/Button.tsx')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('shows empty state when files array is empty', () => {
    const onOpenChange = vi.fn()
    const onFileSelect = vi.fn()

    render(
      <MobileFileTreeSheet
        open={true}
        onOpenChange={onOpenChange}
        files={[]}
        onFileSelect={onFileSelect}
      />,
    )

    expect(screen.getByText('No file changes')).toBeInTheDocument()
  })

  it('displays filename (basename) as title', () => {
    const onOpenChange = vi.fn()
    const onFileSelect = vi.fn()

    render(
      <MobileFileTreeSheet
        open={true}
        onOpenChange={onOpenChange}
        files={MOCK_FILES}
        onFileSelect={onFileSelect}
      />,
    )

    expect(screen.getByText('Button.tsx')).toBeInTheDocument()
    expect(screen.getByText('NewComponent.tsx')).toBeInTheDocument()
  })

  it('displays addition/deletion stats', () => {
    const onOpenChange = vi.fn()
    const onFileSelect = vi.fn()

    render(
      <MobileFileTreeSheet
        open={true}
        onOpenChange={onOpenChange}
        files={[MOCK_FILES[0]]} // Button.tsx: +5 -2
        onFileSelect={onFileSelect}
      />,
    )

    expect(screen.getByText('+5')).toBeInTheDocument()
    expect(screen.getByText('-2')).toBeInTheDocument()
  })
})

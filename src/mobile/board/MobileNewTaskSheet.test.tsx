import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MobileNewTaskSheet } from './MobileNewTaskSheet'

// ── Module mocks ─────────────────────────────────────────────────────

const mutateMock = vi.fn()

vi.mock('@renderer/hooks/useTaskCommands', () => ({
  useCreateTask: vi.fn(() => ({
    mutate: mutateMock,
    isPending: false,
  })),
}))

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}))

// ── Navigator.vibrate stub ────────────────────────────────────────────
beforeAll(() => {
  if (!('vibrate' in navigator)) {
    Object.defineProperty(navigator, 'vibrate', {
      value: () => true,
      writable: true,
      configurable: true,
    })
  }
})

afterEach(() => {
  vi.restoreAllMocks()
  mutateMock.mockReset()
})

// ── Helpers ──────────────────────────────────────────────────────────
function renderSheet(overrides: { open?: boolean; onOpenChange?: (v: boolean) => void } = {}) {
  const onOpenChange = overrides.onOpenChange ?? vi.fn()
  render(
    <MobileNewTaskSheet
      open={overrides.open ?? true}
      onOpenChange={onOpenChange}
      initialStatus="backlog"
      projectId="proj-1"
    />,
  )
  return { onOpenChange }
}

// ── Tests ─────────────────────────────────────────────────────────────
describe('MobileNewTaskSheet', () => {
  it('renders title input when open', () => {
    renderSheet()
    expect(screen.getByTestId('mobile-new-task-title-input')).toBeInTheDocument()
  })

  it('submitting non-empty title calls createTask mutate', async () => {
    renderSheet()
    const input = screen.getByTestId('mobile-new-task-title-input')
    fireEvent.change(input, { target: { value: 'New feature story' } })
    fireEvent.click(screen.getByTestId('mobile-bottom-action-primary'))
    expect(mutateMock).toHaveBeenCalledWith(
      { title: 'New feature story', project_id: 'proj-1' },
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    )
  })

  it('submitting empty title shows inline error and does not call mutate', () => {
    renderSheet()
    // Click without entering any text
    fireEvent.click(screen.getByTestId('mobile-bottom-action-primary'))
    expect(screen.getByTestId('mobile-new-task-title-error')).toBeInTheDocument()
    expect(mutateMock).not.toHaveBeenCalled()
  })

  it('submitting whitespace-only title shows error and does not call mutate', () => {
    renderSheet()
    const input = screen.getByTestId('mobile-new-task-title-input')
    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.click(screen.getByTestId('mobile-bottom-action-primary'))
    expect(screen.getByTestId('mobile-new-task-title-error')).toBeInTheDocument()
    expect(mutateMock).not.toHaveBeenCalled()
  })

  it('calls onOpenChange(false) on successful creation via onSuccess callback', () => {
    const onOpenChange = vi.fn()
    render(
      <MobileNewTaskSheet
        open
        onOpenChange={onOpenChange}
        initialStatus="backlog"
        projectId="proj-1"
      />,
    )
    const input = screen.getByTestId('mobile-new-task-title-input')
    fireEvent.change(input, { target: { value: 'Valid title' } })
    fireEvent.click(screen.getByTestId('mobile-bottom-action-primary'))

    // Extract the onSuccess callback passed to mutate and call it
    expect(mutateMock).toHaveBeenCalled()
    const [, callbacks] = mutateMock.mock.calls[0]
    callbacks.onSuccess()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('does not render when closed', () => {
    render(
      <MobileNewTaskSheet
        open={false}
        onOpenChange={vi.fn()}
        initialStatus="backlog"
        projectId="proj-1"
      />,
    )
    // Sheet uses portal — content is not rendered when closed
    expect(screen.queryByTestId('mobile-new-task-title-input')).not.toBeInTheDocument()
  })
})

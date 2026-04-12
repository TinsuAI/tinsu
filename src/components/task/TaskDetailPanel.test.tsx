import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TaskDetailPanel } from './TaskDetailPanel'
import { useTaskDetailPanelStore } from '@renderer/stores/task-detail-panel.store'

// Mock the TaskDetailContent component
vi.mock('./TaskDetailContent', () => ({
  TaskDetailContent: ({ taskId, onClose }: { taskId: string; onClose: () => void }) => (
    <div data-testid="mock-task-detail-content">
      <span data-testid="task-id">{taskId}</span>
      <button data-testid="close-button" onClick={onClose}>
        Close
      </button>
    </div>
  )
}))

describe('TaskDetailPanel', () => {
  beforeEach(() => {
    // Reset store state
    useTaskDetailPanelStore.setState({
      isOpen: false,
      activeTaskId: null,
      previousFocusElement: null
    })
    // Reset body overflow
    document.body.style.overflow = ''
  })

  describe('rendering', () => {
    it('should not render when activeTaskId is null', () => {
      render(<TaskDetailPanel />)

      expect(screen.queryByTestId('task-detail-panel')).not.toBeInTheDocument()
      expect(screen.queryByTestId('task-detail-backdrop')).not.toBeInTheDocument()
    })

    it('should render panel when activeTaskId is set and isOpen is true', () => {
      useTaskDetailPanelStore.setState({
        isOpen: true,
        activeTaskId: 'task-123'
      })

      render(<TaskDetailPanel />)

      expect(screen.getByTestId('task-detail-panel')).toBeInTheDocument()
      expect(screen.getByTestId('task-detail-backdrop')).toBeInTheDocument()
    })

    it('should pass taskId to TaskDetailContent', () => {
      useTaskDetailPanelStore.setState({
        isOpen: true,
        activeTaskId: 'task-456'
      })

      render(<TaskDetailPanel />)

      expect(screen.getByTestId('task-id')).toHaveTextContent('task-456')
    })
  })

  describe('slide animation classes', () => {
    it('should have translate-x-0 class when open', () => {
      useTaskDetailPanelStore.setState({
        isOpen: true,
        activeTaskId: 'task-123'
      })

      render(<TaskDetailPanel />)

      const panel = screen.getByTestId('task-detail-panel')
      expect(panel).toHaveClass('translate-x-0')
    })

    it('should have translate-x-full class when closed', () => {
      useTaskDetailPanelStore.setState({
        isOpen: false,
        activeTaskId: 'task-123' // Still has taskId but not open
      })

      render(<TaskDetailPanel />)

      const panel = screen.getByTestId('task-detail-panel')
      expect(panel).toHaveClass('translate-x-full')
    })
  })

  describe('backdrop interaction', () => {
    it('should call closePanel when backdrop is clicked', () => {
      const closePanel = vi.fn()
      useTaskDetailPanelStore.setState({
        isOpen: true,
        activeTaskId: 'task-123',
        closePanel
      })

      render(<TaskDetailPanel />)

      const backdrop = screen.getByTestId('task-detail-backdrop')
      fireEvent.click(backdrop)

      expect(closePanel).toHaveBeenCalled()
    })

    it('should have pointer-events-none when closed', () => {
      useTaskDetailPanelStore.setState({
        isOpen: false,
        activeTaskId: 'task-123'
      })

      render(<TaskDetailPanel />)

      const backdrop = screen.getByTestId('task-detail-backdrop')
      expect(backdrop).toHaveClass('pointer-events-none')
    })
  })

  describe('keyboard interaction', () => {
    it('should call closePanel when Escape key is pressed', () => {
      const closePanel = vi.fn()
      useTaskDetailPanelStore.setState({
        isOpen: true,
        activeTaskId: 'task-123',
        closePanel
      })

      render(<TaskDetailPanel />)

      fireEvent.keyDown(window, { key: 'Escape' })

      expect(closePanel).toHaveBeenCalled()
    })

    it('should not call closePanel when Escape is pressed while not open', () => {
      const closePanel = vi.fn()
      useTaskDetailPanelStore.setState({
        isOpen: false,
        activeTaskId: 'task-123',
        closePanel
      })

      render(<TaskDetailPanel />)

      fireEvent.keyDown(window, { key: 'Escape' })

      expect(closePanel).not.toHaveBeenCalled()
    })
  })

  describe('body scroll lock', () => {
    it('should set body overflow to hidden when panel opens', () => {
      useTaskDetailPanelStore.setState({
        isOpen: true,
        activeTaskId: 'task-123'
      })

      render(<TaskDetailPanel />)

      expect(document.body.style.overflow).toBe('hidden')
    })

    it('should restore body overflow when panel closes', () => {
      const { rerender } = render(<TaskDetailPanel />)

      // Open panel
      useTaskDetailPanelStore.setState({
        isOpen: true,
        activeTaskId: 'task-123'
      })
      rerender(<TaskDetailPanel />)

      expect(document.body.style.overflow).toBe('hidden')

      // Close panel
      useTaskDetailPanelStore.setState({
        isOpen: false,
        activeTaskId: null
      })
      rerender(<TaskDetailPanel />)

      expect(document.body.style.overflow).toBe('')
    })
  })

  describe('accessibility', () => {
    it('should have role="dialog"', () => {
      useTaskDetailPanelStore.setState({
        isOpen: true,
        activeTaskId: 'task-123'
      })

      render(<TaskDetailPanel />)

      const panel = screen.getByRole('dialog')
      expect(panel).toBeInTheDocument()
    })

    it('should have aria-modal="true"', () => {
      useTaskDetailPanelStore.setState({
        isOpen: true,
        activeTaskId: 'task-123'
      })

      render(<TaskDetailPanel />)

      const panel = screen.getByRole('dialog')
      expect(panel).toHaveAttribute('aria-modal', 'true')
    })

    it('should have aria-labelledby pointing to title', () => {
      useTaskDetailPanelStore.setState({
        isOpen: true,
        activeTaskId: 'task-123'
      })

      render(<TaskDetailPanel />)

      const panel = screen.getByRole('dialog')
      expect(panel).toHaveAttribute('aria-labelledby', 'task-detail-title')
    })
  })

  describe('responsive width classes', () => {
    it('should have responsive width classes', () => {
      useTaskDetailPanelStore.setState({
        isOpen: true,
        activeTaskId: 'task-123'
      })

      render(<TaskDetailPanel />)

      const panel = screen.getByTestId('task-detail-panel')
      // Full width on mobile
      expect(panel).toHaveClass('w-full')
      // 75% on tablet (sm breakpoint)
      expect(panel).toHaveClass('sm:w-[75vw]')
      // 65% on desktop (lg breakpoint)
      expect(panel).toHaveClass('lg:w-[65vw]')
    })
  })
})

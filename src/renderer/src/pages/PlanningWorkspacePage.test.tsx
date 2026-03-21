import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PlanningWorkspacePage } from './PlanningWorkspacePage'
import { usePlanningWorkspaceStore } from '@renderer/stores/planning-workspace.store'
import { useProjectStore } from '@renderer/stores/project.store'

// Mock project store
vi.mock('@renderer/stores/project.store', () => ({
  useProjectStore: vi.fn()
}))

describe('PlanningWorkspacePage', () => {
  beforeEach(() => {
    // Reset store state
    usePlanningWorkspaceStore.setState({
      isOpen: false,
      activePhase: 'analysis',
      selectedWorkflowKey: null
    })

    // Mock project store
    vi.mocked(useProjectStore).mockImplementation((selector: any) => {
      const state = { projectName: 'TestProject', projectPath: '/test' }
      return selector ? selector(state) : state
    })

    vi.clearAllMocks()
  })

  afterEach(() => {
    document.body.style.overflow = ''
  })

  describe('when closed', () => {
    it('renders nothing when isOpen is false', () => {
      const { container } = render(<PlanningWorkspacePage />)
      expect(container.firstChild).toBeNull()
    })
  })

  describe('when open', () => {
    beforeEach(() => {
      usePlanningWorkspaceStore.setState({ isOpen: true, activePhase: 'analysis' })
    })

    it('renders the workspace with header', () => {
      render(<PlanningWorkspacePage />)

      expect(screen.getByText('Board')).toBeInTheDocument()
      expect(screen.getByText('TestProject')).toBeInTheDocument()
      expect(screen.getByText('Planning Workspace')).toBeInTheDocument()
    })

    it('shows agent placeholder in header', () => {
      render(<PlanningWorkspacePage />)
      expect(screen.getByText('No agent active')).toBeInTheDocument()
    })

    it('renders all three phase tabs', () => {
      render(<PlanningWorkspacePage />)

      expect(screen.getByRole('tab', { name: 'Analysis' })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: 'Planning' })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: 'Solutioning' })).toBeInTheDocument()
    })

    it('locks body scroll', () => {
      render(<PlanningWorkspacePage />)
      expect(document.body.style.overflow).toBe('hidden')
    })

    it('restores body scroll on unmount', () => {
      const { unmount } = render(<PlanningWorkspacePage />)
      expect(document.body.style.overflow).toBe('hidden')
      unmount()
      expect(document.body.style.overflow).toBe('')
    })
  })

  describe('phase switching', () => {
    beforeEach(() => {
      usePlanningWorkspaceStore.setState({ isOpen: true, activePhase: 'analysis' })
    })

    it('shows analysis workflows by default', () => {
      render(<PlanningWorkspacePage />)

      expect(screen.getByText('Brainstorming')).toBeInTheDocument()
      expect(screen.getByText('Product Brief')).toBeInTheDocument()
      expect(screen.getByText('Market Research')).toBeInTheDocument()
      expect(screen.getByText('Domain Research')).toBeInTheDocument()
    })

    it('shows planning workflows when phase is planning', () => {
      usePlanningWorkspaceStore.setState({ isOpen: true, activePhase: 'planning' })
      render(<PlanningWorkspacePage />)

      expect(screen.getByText('Create PRD')).toBeInTheDocument()
      expect(screen.getByText('UX Design')).toBeInTheDocument()
    })

    it('shows solutioning workflows when phase is solutioning', () => {
      usePlanningWorkspaceStore.setState({ isOpen: true, activePhase: 'solutioning' })
      render(<PlanningWorkspacePage />)

      expect(screen.getByText('Architecture')).toBeInTheDocument()
      expect(screen.getByText('Epics & Stories')).toBeInTheDocument()
      expect(screen.getByText('Implementation Readiness')).toBeInTheDocument()
    })
  })

  describe('workflow selection', () => {
    beforeEach(() => {
      usePlanningWorkspaceStore.setState({ isOpen: true, activePhase: 'analysis' })
    })

    it('shows empty state placeholder when no workflow selected', () => {
      render(<PlanningWorkspacePage />)
      expect(screen.getByText('Select a workflow from the sidebar to get started')).toBeInTheDocument()
    })

    it('shows workflow detail when a workflow is clicked', async () => {
      render(<PlanningWorkspacePage />)

      fireEvent.click(screen.getByText('Brainstorming'))

      await waitFor(() => {
        expect(usePlanningWorkspaceStore.getState().selectedWorkflowKey).toBe('brainstorming')
      })
    })
  })

  describe('escape key navigation', () => {
    beforeEach(() => {
      usePlanningWorkspaceStore.setState({ isOpen: true, activePhase: 'analysis' })
    })

    it('closes workspace on Escape key', async () => {
      render(<PlanningWorkspacePage />)

      fireEvent.keyDown(window, { key: 'Escape' })

      await waitFor(() => {
        expect(usePlanningWorkspaceStore.getState().isOpen).toBe(false)
      })
    })

    it('does not close when Escape is pressed in input field', () => {
      render(<PlanningWorkspacePage />)

      const input = document.createElement('input')
      document.body.appendChild(input)
      input.focus()

      fireEvent.keyDown(window, { key: 'Escape' })

      expect(usePlanningWorkspaceStore.getState().isOpen).toBe(true)

      document.body.removeChild(input)
    })

    it('does not close when Escape is pressed in textarea', () => {
      render(<PlanningWorkspacePage />)

      const textarea = document.createElement('textarea')
      document.body.appendChild(textarea)
      textarea.focus()

      fireEvent.keyDown(window, { key: 'Escape' })

      expect(usePlanningWorkspaceStore.getState().isOpen).toBe(true)

      document.body.removeChild(textarea)
    })
  })

  describe('back button navigation', () => {
    beforeEach(() => {
      usePlanningWorkspaceStore.setState({ isOpen: true, activePhase: 'analysis' })
    })

    it('closes workspace when Board button is clicked', () => {
      render(<PlanningWorkspacePage />)

      fireEvent.click(screen.getByText('Board'))

      expect(usePlanningWorkspaceStore.getState().isOpen).toBe(false)
    })
  })
})

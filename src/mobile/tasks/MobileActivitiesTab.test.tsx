import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MobileActivitiesTab } from './MobileActivitiesTab'

// Mock ActivitiesTab — cross-tree component (AC 16, AC 8)
vi.mock('@renderer/components/task/ActivitiesTab', () => ({
  ActivitiesTab: ({ taskId }: { taskId: string }) => (
    <div data-testid="activities-tab-mock" data-task-id={taskId} />
  ),
}))

describe('MobileActivitiesTab', () => {
  it('mounts ActivitiesTab with correct taskId', () => {
    render(<MobileActivitiesTab taskId="task-abc" />)
    const tab = screen.getByTestId('activities-tab-mock')
    expect(tab).toBeInTheDocument()
    expect(tab).toHaveAttribute('data-task-id', 'task-abc')
  })

  it('wraps content in mobile-activities-tab testid', () => {
    render(<MobileActivitiesTab taskId="task-abc" />)
    expect(screen.getByTestId('mobile-activities-tab')).toBeInTheDocument()
  })

  it('passes different taskIds correctly', () => {
    render(<MobileActivitiesTab taskId="different-task-id" />)
    expect(screen.getByTestId('activities-tab-mock')).toHaveAttribute(
      'data-task-id',
      'different-task-id',
    )
  })
})

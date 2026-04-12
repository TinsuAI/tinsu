// T1.9: WorkflowRunPanel is stubbed pending full implementation in T1.10.
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WorkflowRunPanel } from './WorkflowRunPanel'

describe('WorkflowRunPanel (T1.9 stub)', () => {
  it('renders placeholder', () => {
    render(<WorkflowRunPanel />)
    expect(screen.getByTestId('workflow-run-panel')).toBeDefined()
  })
})

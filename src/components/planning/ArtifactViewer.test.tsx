// T1.9: ArtifactViewer is stubbed pending full implementation in T1.10.
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ArtifactViewer } from './ArtifactViewer'

describe('ArtifactViewer (T1.9 stub)', () => {
  it('renders placeholder', () => {
    render(<ArtifactViewer workflowKey="prd" filePath="/tmp/prd.md" onCloseFile={vi.fn()} />)
    expect(screen.getByTestId('artifact-viewer')).toBeDefined()
  })
})

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SettingsDialog } from './SettingsDialog'

// Mock AgentSettingsPanel since it has its own tests
vi.mock('@renderer/components/settings/AgentSettingsPanel', () => ({
  AgentSettingsPanel: () => <div data-testid="agent-settings-panel-mock">Agent Settings Panel</div>
}))

describe('SettingsDialog', () => {
  it('should not render when closed', () => {
    render(<SettingsDialog open={false} onOpenChange={() => {}} />)
    expect(screen.queryByTestId('settings-dialog')).not.toBeInTheDocument()
  })

  it('should render dialog when open', () => {
    render(<SettingsDialog open={true} onOpenChange={() => {}} />)
    expect(screen.getByTestId('settings-dialog')).toBeInTheDocument()
  })

  it('should render title and description', () => {
    render(<SettingsDialog open={true} onOpenChange={() => {}} />)
    expect(screen.getByText('Settings')).toBeInTheDocument()
    expect(screen.getByText(/Configure agent models/i)).toBeInTheDocument()
  })

  it('should render AgentSettingsPanel', () => {
    render(<SettingsDialog open={true} onOpenChange={() => {}} />)
    expect(screen.getByTestId('agent-settings-panel-mock')).toBeInTheDocument()
  })
})

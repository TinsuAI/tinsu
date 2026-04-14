import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { AgentSettingsPanel } from '@renderer/components/settings/AgentSettingsPanel'
import { BmadSettingsPanel } from '@renderer/components/settings/BmadSettingsPanel'
import { GitLogsPanel } from '@renderer/components/settings/GitLogsPanel'
import { SshConnectionsPanel } from '@renderer/components/settings/SshConnectionsPanel'
import { RemoteProjectsPanel } from '@renderer/components/settings/RemoteProjectsPanel'
import { useMediaQuery } from '@renderer/hooks/useMediaQuery'

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps): React.JSX.Element {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto p-0"
        data-testid="settings-dialog"
      >
        <div className="p-6">
          <DialogHeader className="mb-4">
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription>Configure agent models and project settings.</DialogDescription>
          </DialogHeader>

          <div className="space-y-8">
            <AgentSettingsPanel />
            <hr className="border-border/50" />
            <BmadSettingsPanel />
            <hr className="border-border/50" />
            <GitLogsPanel />
            <hr className="border-border/50" />
            <SshConnectionsPanel />
            <hr className="border-border/50" />
            <RemoteProjectsPanel />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { AgentSettingsPanel } from '@renderer/components/settings/AgentSettingsPanel'
import { GitLogsPanel } from '@renderer/components/settings/GitLogsPanel'

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto" data-testid="settings-dialog">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Configure agent models and other project settings.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-6">
          <AgentSettingsPanel />
          <hr className="border-border" />
          <GitLogsPanel />
        </div>
      </DialogContent>
    </Dialog>
  )
}

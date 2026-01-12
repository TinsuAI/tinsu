import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { AgentSettingsPanel } from '@renderer/components/settings/AgentSettingsPanel'

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" data-testid="settings-dialog">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Configure agent models and other project settings.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <AgentSettingsPanel />
        </div>
      </DialogContent>
    </Dialog>
  )
}

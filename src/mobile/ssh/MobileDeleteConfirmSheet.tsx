/**
 * MobileDeleteConfirmSheet — confirmation sheet before deleting an SSH connection.
 *
 * AC: 14
 *
 * Pattern: MobileSheet + 2 buttons (matches T3.5-6 approve-confirm precedent).
 * NOT AlertDialog — mobile confirmation always uses MobileSheet.
 * No swipe-to-delete-direct: confirmation is always required.
 *
 * Cross-tree allowed:
 *   @renderer/hooks/useSshCommands — useDeleteSshConnection (mobile-safe)
 *   @renderer/lib/utils — hapticFeedback
 *   sonner — toast (screen owns toasts)
 *
 * On success: closes both this sheet + parent detail sheet (via onConfirmed).
 * On error: closes ONLY this sheet; leaves detail sheet open so user sees context.
 */

import { useDeleteSshConnection } from '@renderer/hooks/useSshCommands'
import { hapticFeedback } from '@renderer/lib/utils'
import { toast } from 'sonner'
import { MobileSheet } from '../primitives/MobileSheet'
import type { SshConnectionProfile } from '@renderer/lib/rspc'

interface MobileDeleteConfirmSheetProps {
  open: boolean
  connection: SshConnectionProfile | null
  onOpenChange: (open: boolean) => void
  /** Called on successful delete — parent should close the detail sheet too */
  onConfirmed: () => void
}

export function MobileDeleteConfirmSheet({
  open,
  connection,
  onOpenChange,
  onConfirmed,
}: MobileDeleteConfirmSheetProps) {
  const deleteMutation = useDeleteSshConnection()

  const handleDelete = async () => {
    if (!connection) return
    hapticFeedback([10, 30, 10])
    try {
      await deleteMutation.mutateAsync(connection.id)
      // Success: close this sheet + parent detail sheet (via onConfirmed)
      onOpenChange(false)
      onConfirmed()
      toast.success('Connection deleted')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Delete failed'
      // Error: close ONLY this sheet; leave detail sheet open for context
      onOpenChange(false)
      toast.error('Failed to delete', { description: msg })
    }
  }

  return (
    <MobileSheet
      open={open}
      onOpenChange={onOpenChange}
      snapPoint="fit"
      title="Delete connection?"
      description={
        connection
          ? `This will permanently remove the connection to ${connection.host}.`
          : undefined
      }
    >
      <div data-testid="mobile-connection-delete-sheet" className="flex flex-col gap-2 pt-2">
        {/* Delete — destructive (AC 14: primary destructive action) */}
        <button
          type="button"
          data-testid="mobile-connection-delete-confirm-btn"
          aria-label="Confirm delete connection"
          onClick={() => void handleDelete()}
          disabled={deleteMutation.isPending}
          className="min-h-[2.75rem] w-full rounded-xl bg-destructive text-destructive-foreground text-sm font-semibold disabled:opacity-50 disabled:pointer-events-none"
        >
          {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
        </button>

        {/* Cancel — token-muted (AC 14: secondary cancel action) */}
        <button
          type="button"
          aria-label="Cancel delete"
          onClick={() => onOpenChange(false)}
          disabled={deleteMutation.isPending}
          className="min-h-[2.75rem] w-full rounded-xl bg-muted/50 border border-border/40 text-foreground text-sm font-medium disabled:opacity-50 disabled:pointer-events-none"
        >
          Cancel
        </button>
      </div>
    </MobileSheet>
  )
}

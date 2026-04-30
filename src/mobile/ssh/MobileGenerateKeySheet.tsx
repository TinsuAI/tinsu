/**
 * MobileGenerateKeySheet — fit-snap sheet for generating and installing a new SSH key.
 *
 * AC: 12
 *
 * Layered above MobileKeyPickerSheet via independent Radix Portal (parent stays mounted).
 * Opening this sheet does NOT close the key picker sheet — each MobileSheet uses its own
 * Radix Portal so they are independent. Verified by test in Task 12.6.
 *
 * Cross-tree allowed:
 *   @renderer/hooks/useSshCommands — useInstallSshKey (mobile-safe)
 *   @renderer/lib/utils — hapticFeedback
 *   sonner — toast (screen owns toasts; installSshKey hook does not auto-toast here)
 *
 * Token discipline: all Calm Command tokens — no direct color classes.
 *
 * Disabled guard: when host/port/username are blank, shows inline warning and disables button.
 * Password is required; key name is optional (defaults to `${username || 'host'}-tinsu`).
 */

import { useState } from 'react'
import { useInstallSshKey } from '@renderer/hooks/useSshCommands'
import { hapticFeedback } from '@renderer/lib/utils'
import { toast } from 'sonner'
import { MobileSheet } from '../primitives/MobileSheet'
import type { SshKeyEntry } from '@renderer/lib/rspc'

interface MobileGenerateKeySheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  host: string
  port: number
  username: string
  onSuccess: (keyName: string) => void
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1.5">
      {children}
    </label>
  )
}

function MetaDisplay({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between border-b border-border/40 py-2.5">
      <span className="text-xs uppercase tracking-widest text-muted-foreground">{label}</span>
      <span className="text-sm font-mono text-foreground">{String(value)}</span>
    </div>
  )
}

export function MobileGenerateKeySheet({
  open,
  onOpenChange,
  host,
  port,
  username,
  onSuccess,
}: MobileGenerateKeySheetProps) {
  const installMutation = useInstallSshKey()
  const [password, setPassword] = useState('')
  const [keyNameInput, setKeyNameInput] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const missingTarget = !host.trim() || !username.trim()
  const isDisabled = missingTarget || !password || installMutation.isPending

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      // Reset on close
      setPassword('')
      setKeyNameInput('')
      setErrorMsg(null)
    }
    onOpenChange(next)
  }

  const handleGenerate = async () => {
    if (isDisabled) return
    setErrorMsg(null)
    const resolvedName = keyNameInput.trim() || `${username || 'host'}-tinsu`
    try {
      const entry: SshKeyEntry = await installMutation.mutateAsync({
        host: host.trim(),
        port,
        username: username.trim(),
        password,
        key_name: resolvedName,
      })
      hapticFeedback([10, 30, 10])
      toast.success('Key generated and installed')
      onSuccess(entry.name ?? resolvedName)
      setPassword('')
      setKeyNameInput('')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Key installation failed'
      setErrorMsg(msg)
    }
  }

  return (
    <MobileSheet
      open={open}
      onOpenChange={handleOpenChange}
      snapPoint="fit"
      title="Generate New SSH Key"
      description="Provide the server password — used once to install the key, never stored."
    >
      <div data-testid="mobile-generate-key-sheet" className="flex flex-col gap-4">
        {/* Read-only target server display — lets user verify before typing password (AC 12a) */}
        <div className="rounded-xl bg-muted/20 border border-border/40 overflow-hidden px-2">
          <MetaDisplay label="Host" value={host || '—'} />
          <MetaDisplay label="Port" value={port} />
          <MetaDisplay label="Username" value={username || '—'} />
        </div>

        {/* Warning when host/port/username are not yet filled (AC 12) */}
        {missingTarget && (
          <div className="p-3 rounded-xl border bg-muted/30 border-border/40 text-muted-foreground text-sm">
            Fill in host, port, and username first.
          </div>
        )}

        {/* One-time password input */}
        <div>
          <FieldLabel>Server Password</FieldLabel>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            placeholder="Server password (used once)"
            disabled={missingTarget}
            aria-label="Server password for SSH key installation"
            className="h-12 px-4 text-base bg-card/30 border border-border/40 rounded-xl w-full text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-border disabled:opacity-50"
          />
        </div>

        {/* Optional key name */}
        <div>
          <FieldLabel>Key Name (optional)</FieldLabel>
          <input
            type="text"
            value={keyNameInput}
            onChange={(e) => setKeyNameInput(e.target.value)}
            placeholder={`${username || 'host'}-tinsu`}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            aria-label="SSH key name"
            className="h-12 px-4 text-base bg-card/30 border border-border/40 rounded-xl w-full text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-border"
          />
        </div>

        {/* Error banner with Retry */}
        {errorMsg && (
          <div className="p-3 rounded-xl border bg-destructive/10 border-destructive/40 text-destructive text-sm">
            <div className="font-medium">Installation failed</div>
            <div className="text-xs mt-1 opacity-80">{errorMsg}</div>
            <button
              type="button"
              onClick={() => void handleGenerate()}
              aria-label="Retry key installation"
              className="mt-2 text-xs underline text-destructive"
            >
              Retry
            </button>
          </div>
        )}

        {/* Generate & Install button */}
        <button
          type="button"
          data-testid="mobile-generate-key-btn"
          aria-label="Generate and install SSH key"
          onClick={() => void handleGenerate()}
          disabled={isDisabled}
          className="min-h-[2.75rem] w-full rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 disabled:pointer-events-none"
        >
          {installMutation.isPending ? 'Installing…' : 'Generate & Install'}
        </button>
      </div>
    </MobileSheet>
  )
}

/**
 * MobileConnectionDetailSheet — bottom sheet showing SSH connection metadata + actions.
 *
 * AC: 8, 14
 *
 * Cross-tree allowed:
 *   @renderer/hooks/useSshCommands — useTestSshConnection (mobile-safe)
 *   @renderer/lib/utils — cn
 *   sonner — toast (screen owns toasts; SSH hooks do not auto-toast)
 *
 * Token discipline:
 *   - Test result banners use UX-DR4 success-state (emerald tokens) + destructive tokens
 *   - All other surfaces: Calm Command tokens only
 *
 * Password-auth: shows one-time password input for test when auth_method === 'password'.
 * Saved connections are key-auth by default; password field is for test-only flows.
 */

import { useState } from 'react'
import { useTestSshConnection } from '@renderer/hooks/useSshCommands'
import { cn } from '@renderer/lib/utils'
import { MobileSheet } from '../primitives/MobileSheet'
import type { SshConnectionProfile, SshConnectionTestResult } from '@renderer/lib/rspc'
import type { ConnectionStatus } from './MobileConnectionsListScreen'

interface MobileConnectionDetailSheetProps {
  open: boolean
  connection: SshConnectionProfile | null
  onOpenChange: (open: boolean) => void
  onEdit: () => void
  onDelete: () => void
  onTestStatusChange: (id: string, status: ConnectionStatus) => void
}

type TestState = 'idle' | 'testing' | 'success' | 'error'

interface TestResult {
  state: TestState
  fingerprint?: string | null
  message?: string
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between border-b border-border/40 py-3 gap-4">
      <span className="text-xs uppercase tracking-widest text-muted-foreground shrink-0">
        {label}
      </span>
      <span className="text-sm font-mono text-foreground text-right break-all">
        {value}
      </span>
    </div>
  )
}

export function MobileConnectionDetailSheet({
  open,
  connection,
  onOpenChange,
  onEdit,
  onDelete,
  onTestStatusChange,
}: MobileConnectionDetailSheetProps) {
  const testMutation = useTestSshConnection()
  const [testResult, setTestResult] = useState<TestResult>({ state: 'idle' })
  const [testPassword, setTestPassword] = useState('')

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      // Reset test state on close
      setTestResult({ state: 'idle' })
      setTestPassword('')
    }
    onOpenChange(nextOpen)
  }

  const handleTest = async () => {
    if (!connection) return
    setTestResult({ state: 'testing' })
    onTestStatusChange(connection.id, 'testing')
    try {
      const result: SshConnectionTestResult = await testMutation.mutateAsync({
        host: connection.host,
        port: connection.port,
        username: connection.username,
        auth_method: connection.auth_method,
        key_name: connection.key_name ?? null,
        password: connection.auth_method === 'password' ? testPassword : null,
      })
      setTestResult({
        state: 'success',
        fingerprint: result.fingerprint,
      })
      onTestStatusChange(connection.id, 'connected')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Connection failed'
      setTestResult({ state: 'error', message: msg })
      onTestStatusChange(connection.id, 'error')
    }
  }

  const isTesting = testResult.state === 'testing'

  return (
    <MobileSheet
      open={open}
      onOpenChange={handleOpenChange}
      snapPoint="fit"
      title={connection?.host ?? 'Connection'}
      description={
        connection
          ? `${connection.username}@${connection.host}:${connection.port}`
          : undefined
      }
    >
      {connection && (
        <div data-testid="mobile-connection-detail-sheet" className="flex flex-col">
          {/* Metadata block (AC 8a) */}
          <div className="mb-4">
            <MetaRow label="Host" value={connection.host} />
            <MetaRow label="Port" value={String(connection.port)} />
            <MetaRow label="Username" value={connection.username} />
            <MetaRow
              label="Auth Method"
              value={connection.auth_method === 'key' ? 'SSH Key' : 'Password (test only)'}
            />
            {connection.auth_method === 'key' && connection.key_name && (
              <MetaRow label="Key Name" value={connection.key_name} />
            )}
            <MetaRow
              label="Created"
              value={new Date(connection.created_at * 1000).toLocaleString()}
            />
          </div>

          {/* One-time password input for password-auth test (AC 8) */}
          {connection.auth_method === 'password' && (
            <div className="mb-4">
              <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1.5">
                Password (for testing)
              </label>
              <input
                type="password"
                value={testPassword}
                onChange={(e) => setTestPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="Enter password to test"
                aria-label="Password for testing SSH connection"
                className="h-12 px-4 text-base bg-card/30 border border-border/40 rounded-xl w-full text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-border"
              />
            </div>
          )}

          {/* Test result banner (AC 8) */}
          {testResult.state === 'success' && (
            <div
              className={cn(
                'mb-4 p-3 rounded-xl border text-sm',
                // UX-DR4 success-state mirror
                'bg-emerald-500/10 border-emerald-500/40 text-emerald-200',
              )}
            >
              <div className="font-medium">Connection successful</div>
              {testResult.fingerprint && (
                <div className="font-mono text-xs mt-1 opacity-80 break-all">
                  {testResult.fingerprint}
                </div>
              )}
            </div>
          )}
          {testResult.state === 'error' && (
            <div className="mb-4 p-3 rounded-xl border bg-destructive/10 border-destructive/40 text-destructive text-sm">
              <div className="font-medium">Connection failed</div>
              {testResult.message && (
                <div className="text-xs mt-1 opacity-80">{testResult.message}</div>
              )}
            </div>
          )}

          {/* Action buttons (AC 8c) */}
          <div className="flex flex-col gap-2 pb-2">
            {/* Test Connection — primary */}
            <button
              type="button"
              data-testid="mobile-connection-test-btn"
              aria-label="Test SSH connection"
              onClick={() => void handleTest()}
              disabled={isTesting}
              className="min-h-[2.75rem] w-full rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 disabled:pointer-events-none"
            >
              {isTesting ? 'Testing…' : 'Test Connection'}
            </button>

            {/* Edit — secondary */}
            <button
              type="button"
              data-testid="mobile-connection-edit-btn"
              aria-label="Edit SSH connection"
              onClick={() => {
                onEdit()
                onOpenChange(false)
              }}
              className="min-h-[2.75rem] w-full rounded-xl bg-muted/50 border border-border/40 text-foreground text-sm font-medium"
            >
              Edit
            </button>

            {/* Delete — destructive */}
            <button
              type="button"
              data-testid="mobile-connection-delete-btn"
              aria-label="Delete SSH connection"
              onClick={onDelete}
              className="min-h-[2.75rem] w-full rounded-xl bg-destructive/15 border border-destructive/40 text-destructive text-sm font-medium"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </MobileSheet>
  )
}

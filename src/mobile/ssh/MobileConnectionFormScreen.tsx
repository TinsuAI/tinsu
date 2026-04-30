/**
 * MobileConnectionFormScreen — full-screen SSH connection add/edit form.
 *
 * AC: 2, 9, 10, 13, 21
 *
 * DEVIATION from UX redesign §3.6 line 325 (bottom-sheet wizard):
 *   Implemented as full-screen push to match workspace/chat/review pattern because:
 *   (a) 6+ required fields + nested install-key wizard exceed half-sheet thumb-zone budget.
 *   (b) workspace/chat/review screens established full-screen push for action-required flows.
 *   (c) The existing MobileSshConnectionForm already renders as a full-page form.
 *   This deviation is LOCKED — do not redebate (AC 2).
 *
 * DEVIATION from UX redesign §3.6 line 327 (mandatory Test before Save):
 *   Test is surfaced as a strong recommendation (result banner persists visible above Save)
 *   rather than a hard gate. Mandatory gating breaks edit flows when only key_name changes
 *   on an already-working connection. T3.5-9 may revisit with user feedback (AC 13).
 *
 * v1 back-press guard: visual — disable Save + back button during mutation pending.
 *   System back gesture still works. Hard interception deferred to T3.5-9 (AC 21).
 *
 * Cross-tree allowed:
 *   @renderer/hooks/useSshCommands — useListSshConnections, useCreateSshConnection,
 *     useUpdateSshConnection, useTestSshConnection (all mobile-safe)
 *   @renderer/lib/utils — cn, hapticFeedback
 *   sonner — toast (screen owns toasts; SSH hooks do NOT auto-toast — AC 17 Dev Notes)
 *
 * Forbidden:
 *   @renderer/components/ui/* — ALL desktop UI components (Input, Button, Label, Select, etc.)
 *   @renderer/components/remote/MobileSshConnectionForm — desktop form, parallel-tree
 */

import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import {
  useListSshConnections,
  useCreateSshConnection,
  useUpdateSshConnection,
  useTestSshConnection,
} from '@renderer/hooks/useSshCommands'
import { cn, hapticFeedback } from '@renderer/lib/utils'
import { useMobileNavStore } from '../shell/mobile-nav.store'
import { MobileSegmentedTabs } from '../primitives/MobileSegmentedTabs'
import { MobileBottomActionBar } from '../primitives/MobileBottomActionBar'
import { MobileEmptyState } from '../primitives/MobileEmptyState'
import { MobileKeyPickerSheet } from './MobileKeyPickerSheet'
import type { CreateSshConnectionInput, UpdateSshConnectionInput } from '@renderer/lib/rspc'

interface MobileConnectionFormScreenProps {
  mode: 'new' | 'edit'
  connectionId?: string
}

type AuthMethod = 'key' | 'password'

type TestState = 'idle' | 'testing' | 'success' | 'error'

interface TestResult {
  state: TestState
  message?: string
}

const AUTH_TABS = [
  { id: 'key', label: 'SSH Key' },
  { id: 'password', label: 'Password (test only)' },
]

/** Styled field label using Calm Command tokens */
function FieldLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-xs uppercase tracking-widest text-muted-foreground mb-1.5"
    >
      {children}
    </label>
  )
}

export function MobileConnectionFormScreen({ mode, connectionId }: MobileConnectionFormScreenProps) {
  const { data: connections = [], isLoading: isConnectionsLoading } = useListSshConnections()
  const createMutation = useCreateSshConnection()
  const updateMutation = useUpdateSshConnection()
  const testMutation = useTestSshConnection()
  const { popRoute } = useMobileNavStore()

  // Find existing connection for edit mode
  const existingConnection = mode === 'edit'
    ? connections.find((c) => c.id === connectionId)
    : undefined

  // Form state — initialized from existing connection in edit mode
  const [host, setHost] = useState(existingConnection?.host ?? '')
  const [port, setPort] = useState<number>(existingConnection?.port ?? 22)
  const [username, setUsername] = useState(existingConnection?.username ?? '')
  const [authMethod, setAuthMethod] = useState<AuthMethod>(
    (existingConnection?.auth_method as AuthMethod) ?? 'key',
  )
  const [keyName, setKeyName] = useState(existingConnection?.key_name ?? '')
  const [password, setPassword] = useState('')
  const [testResult, setTestResult] = useState<TestResult>({ state: 'idle' })

  // Key picker + generate key sheet state
  const [keyPickerOpen, setKeyPickerOpen] = useState(false)
  const [generateKeyOpen, setGenerateKeyOpen] = useState(false)

  const isSaving = createMutation.isPending || updateMutation.isPending
  const isTesting = testMutation.isPending

  // Validation per AC 13 + Task 11.4
  const isFormValid =
    host.trim() !== '' &&
    username.trim() !== '' &&
    port >= 1 &&
    port <= 65535 &&
    (authMethod !== 'key' || keyName.trim() !== '')

  const title = mode === 'new' ? 'New Connection' : 'Edit Connection'

  // Edit mode: connection not found (after connections have loaded)
  if (mode === 'edit' && !isConnectionsLoading && connections.length > 0 && !existingConnection) {
    return (
      <div
        data-testid="mobile-connection-form-screen"
        className="flex flex-col h-[100dvh] bg-background"
      >
        <MobileEmptyState
          title="Connection not found"
          action={
            <button
              type="button"
              onClick={() => popRoute()}
              aria-label="Back"
              className="min-h-[2.75rem] px-6 rounded-xl bg-muted/50 border border-border/40 text-foreground text-sm font-medium"
            >
              Back
            </button>
          }
        />
      </div>
    )
  }

  const handleTest = async () => {
    if (!host.trim() || !username.trim()) return
    setTestResult({ state: 'testing' })
    try {
      await testMutation.mutateAsync({
        host: host.trim(),
        port,
        username: username.trim(),
        auth_method: authMethod,
        key_name: authMethod === 'key' ? (keyName.trim() || null) : null,
        password: authMethod === 'password' ? password : null,
      })
      setTestResult({ state: 'success' })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Connection failed'
      setTestResult({ state: 'error', message: msg })
    }
  }

  const handleSave = async () => {
    if (!isFormValid) {
      // Validation buzz — long haptic, no visual shake under reduced-motion (AC 13a)
      hapticFeedback(300)
      return
    }
    hapticFeedback([10, 30, 10])
    try {
      if (mode === 'new') {
        const input: CreateSshConnectionInput = {
          host: host.trim(),
          port,
          username: username.trim(),
          auth_method: authMethod,
          key_name: authMethod === 'key' ? (keyName.trim() || null) : null,
        }
        await createMutation.mutateAsync(input)
        toast.success('Connection saved')
      } else if (connectionId) {
        const input: UpdateSshConnectionInput = {
          id: connectionId,
          host: host.trim(),
          port,
          username: username.trim(),
          auth_method: authMethod,
          key_name: authMethod === 'key' ? (keyName.trim() || null) : null,
        }
        await updateMutation.mutateAsync(input)
        toast.success('Connection updated')
      }
      popRoute()
    } catch (err) {
      hapticFeedback(300)
      const msg = err instanceof Error ? err.message : 'Save failed'
      toast.error('Failed to save', { description: msg })
    }
  }

  return (
    <div
      data-testid="mobile-connection-form-screen"
      className="flex flex-col h-[100dvh] bg-background"
    >
      {/* Inline header — mirrors MobileTopAppBar shape (AC 9a) */}
      <div
        className="flex items-center gap-3 px-4 border-b border-border/40 shrink-0"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)',
          paddingBottom: '0.75rem',
        }}
      >
        {/* Back button — disabled visually during pending (AC 21 v1 guard) */}
        <button
          type="button"
          data-testid="mobile-connection-form-back-button"
          aria-label="Back"
          onClick={() => popRoute()}
          disabled={isSaving}
          className={cn(
            'flex items-center justify-center h-9 w-9 rounded-full',
            'text-foreground bg-muted/40',
            'transition-opacity',
            isSaving ? 'opacity-50 pointer-events-none' : '',
          )}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
        </button>

        {/* Title — centred */}
        <h1 className="flex-1 text-base font-semibold text-foreground text-center">
          {title}
        </h1>

        {/* Spacer to balance back button */}
        <div className="h-9 w-9" aria-hidden />
      </div>

      {/* Scrollable form body (AC 9b) */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-5 flex flex-col gap-5">
        {/* (a) Host */}
        <div>
          <FieldLabel htmlFor="form-host">Host</FieldLabel>
          <input
            id="form-host"
            type="text"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder="e.g. 1.2.3.4 or example.com"
            inputMode="text"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            autoComplete="off"
            aria-label="Host"
            className="h-12 px-4 text-base bg-card/30 border border-border/40 rounded-xl w-full text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-border"
          />
        </div>

        {/* (b) Port */}
        <div>
          <FieldLabel htmlFor="form-port">Port</FieldLabel>
          <input
            id="form-port"
            type="number"
            inputMode="numeric"
            min={1}
            max={65535}
            value={port}
            onChange={(e) => setPort(Number(e.target.value))}
            aria-label="Port"
            className="h-12 px-4 text-base bg-card/30 border border-border/40 rounded-xl w-full text-foreground outline-none focus:border-border"
          />
        </div>

        {/* (c) Username */}
        <div>
          <FieldLabel htmlFor="form-username">Username</FieldLabel>
          <input
            id="form-username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Username"
            className="h-12 px-4 text-base bg-card/30 border border-border/40 rounded-xl w-full text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-border"
          />
        </div>

        {/* (d) Authentication method — MobileSegmentedTabs (AC 10d) */}
        <div>
          <FieldLabel>Authentication</FieldLabel>
          <MobileSegmentedTabs
            tabs={AUTH_TABS}
            activeTabId={authMethod}
            onTabChange={(id) => setAuthMethod(id as AuthMethod)}
            ariaLabel="Authentication method"
          />
        </div>

        {/* (e) SSH Key row — key mode only (AC 10e) */}
        {authMethod === 'key' && (
          <div>
            <FieldLabel>SSH Key</FieldLabel>
            <button
              type="button"
              onClick={() => setKeyPickerOpen(true)}
              aria-label={keyName ? `Selected key: ${keyName}` : 'Select an SSH key'}
              className={cn(
                'h-12 px-4 text-base bg-card/30 border border-border/40 rounded-xl w-full',
                'flex items-center justify-between text-left',
                'outline-none focus:border-border',
                keyName ? 'text-foreground' : 'text-muted-foreground/50',
              )}
            >
              <span className="truncate">{keyName || 'Select a key'}</span>
              <span className="text-muted-foreground/60 ml-2 text-lg leading-none" aria-hidden>
                ›
              </span>
            </button>
          </div>
        )}

        {/* (f) Password input — password mode only (AC 10f) */}
        {authMethod === 'password' && (
          <div>
            <FieldLabel htmlFor="form-password">Password</FieldLabel>
            <input
              id="form-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              aria-label="Password"
              className="h-12 px-4 text-base bg-card/30 border border-border/40 rounded-xl w-full text-foreground outline-none focus:border-border"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Note: Passwords are used for testing or key installation and are never stored.
            </p>
          </div>
        )}

        {/* (g) Test Connection button + result banner (AC 10g) */}
        <div>
          <button
            type="button"
            data-testid="mobile-connection-form-test-btn"
            aria-label="Test SSH connection"
            onClick={() => void handleTest()}
            disabled={isTesting || !host.trim() || !username.trim()}
            className={cn(
              'min-h-[2.75rem] w-full rounded-xl',
              'bg-muted/50 border border-border/40 text-foreground',
              'text-sm font-medium',
              'disabled:opacity-50 disabled:pointer-events-none',
            )}
          >
            {isTesting ? 'Testing…' : 'Test Connection'}
          </button>

          {/* Test result banner — persists above Save as visual reminder (AC 13 deviation) */}
          {testResult.state === 'success' && (
            <div
              className={cn(
                'mt-3 p-3 rounded-xl border text-sm',
                // UX-DR4 success-state mirror
                'bg-emerald-500/10 border-emerald-500/40 text-emerald-200',
              )}
            >
              Connection successful
            </div>
          )}
          {testResult.state === 'error' && (
            <div className="mt-3 p-3 rounded-xl border text-sm bg-destructive/10 border-destructive/40 text-destructive">
              {testResult.message ?? 'Connection failed'}
            </div>
          )}
        </div>
      </div>

      {/* Bottom action bar — Save (primary) + Cancel (secondary) (AC 9c) */}
      <MobileBottomActionBar
        primary={{
          label: 'Save',
          onPress: () => void handleSave(),
          disabled: isSaving || !isFormValid,
        }}
        secondary={{
          label: 'Cancel',
          onPress: () => popRoute(),
        }}
      />

      {/* Key picker sheet — stays open while generate sheet layers above (AC 11, 12) */}
      <MobileKeyPickerSheet
        open={keyPickerOpen}
        selectedKeyName={keyName}
        onOpenChange={setKeyPickerOpen}
        onKeySelect={(name) => {
          setKeyName(name)
          setKeyPickerOpen(false)
        }}
        host={host}
        port={port}
        username={username}
        generateKeyOpen={generateKeyOpen}
        onGenerateKeyOpenChange={setGenerateKeyOpen}
        onKeyGenerated={(name) => {
          setKeyName(name)
          setGenerateKeyOpen(false)
          // Do NOT close key picker — let user confirm the selection
        }}
      />
    </div>
  )
}

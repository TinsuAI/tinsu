import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@renderer/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/ui/select'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import {
  Plus,
  Key,
  Lock,
  Pencil,
  Trash2,
  Zap,
  CheckCircle2,
  XCircle,
  Loader2,
  Server,
  Terminal,
} from 'lucide-react'
import { commands } from '@renderer/lib/rspc'
import type {
  SshConnectionProfile,
  CreateSshConnectionInput,
  UpdateSshConnectionInput,
  TestSshConnectionInput,
  SshConnectionTestResult,
  SshKeyEntry,
  InstallSshKeyInput,
} from '@renderer/lib/rspc'

// ─── Test status state ───────────────────────────────────────────────────────

type TestStatus =
  | { state: 'idle' }
  | { state: 'testing' }
  | { state: 'success'; fingerprint: string }
  | { state: 'error'; message: string }

// ─── Add/Edit Dialog ─────────────────────────────────────────────────────────

interface ConnectionDialogProps {
  open: boolean
  onClose: () => void
  onSave: (input: CreateSshConnectionInput | UpdateSshConnectionInput) => void
  availableKeys: string[]
  initial?: SshConnectionProfile | null
  isSaving: boolean
  /** Called after a key is installed so the parent can refresh availableKeys */
  onKeyInstalled?: (entry: SshKeyEntry) => void
}

export function ConnectionDialog({
  open,
  onClose,
  onSave,
  availableKeys,
  initial,
  isSaving,
  onKeyInstalled,
}: ConnectionDialogProps) {
  const queryClient = useQueryClient()
  const [host, setHost] = useState('')
  const [port, setPort] = useState(22)
  const [username, setUsername] = useState('')
  const [authMethod, setAuthMethod] = useState<'key' | 'password'>('key')
  const [keyName, setKeyName] = useState('')
  const [password, setPassword] = useState('')
  const [testStatus, setTestStatus] = useState<TestStatus>({ state: 'idle' })

  // ── Install-key wizard state ─────────────────────────────────────────────
  const [installPassword, setInstallPassword] = useState('')
  const [installKeyName, setInstallKeyName] = useState('')
  const [installStatus, setInstallStatus] = useState<
    'idle' | 'installing' | 'success' | 'error'
  >('idle')
  const [installError, setInstallError] = useState('')

  const installMutation = useMutation({
    mutationFn: async (input: InstallSshKeyInput) => {
      const result = await commands.installSshKey(input)
      if (result.status === 'error') throw new Error(JSON.stringify(result.error))
      return result.data
    },
    onSuccess: (entry: SshKeyEntry) => {
      setInstallStatus('success')
      setKeyName(entry.name)
      setInstallPassword('')
      queryClient.invalidateQueries({ queryKey: ['ssh_keys'] })
      onKeyInstalled?.(entry)
    },
    onError: (err: Error) => {
      setInstallStatus('error')
      setInstallError(err.message)
    },
  })

  const handleInstallKey = () => {
    const name = installKeyName.trim() || `${username.replace(/[^a-z0-9]/gi, '')}-tinsu`
    setInstallStatus('installing')
    setInstallError('')
    installMutation.mutate({
      host,
      port,
      username,
      password: installPassword,
      key_name: name,
    })
  }

  React.useEffect(() => {
    if (open) {
      setHost(initial?.host ?? '')
      setPort(initial?.port ?? 22)
      setUsername(initial?.username ?? '')
      setAuthMethod((initial?.auth_method as 'key' | 'password') ?? 'key')
      setKeyName(initial?.key_name ?? '')
      setPassword('')
      setTestStatus({ state: 'idle' })
      setInstallPassword('')
      setInstallKeyName('')
      setInstallStatus('idle')
      setInstallError('')
    }
  }, [open, initial])

  const testMutation = useMutation({
    mutationFn: async (input: TestSshConnectionInput) => {
      const result = await commands.testSshConnection(input)
      if (result.status === 'error') throw new Error(JSON.stringify(result.error))
      return result.data
    },
    onSuccess: (data: SshConnectionTestResult) => {
      if (data.success) {
        setTestStatus({ state: 'success', fingerprint: data.fingerprint ?? '' })
      } else {
        setTestStatus({ state: 'error', message: data.error ?? 'Unknown error' })
      }
    },
    onError: (err: Error) => {
      setTestStatus({ state: 'error', message: err.message })
    },
  })

  const handleTest = () => {
    setTestStatus({ state: 'testing' })
    const trimmedKeyName = keyName.trim()
    testMutation.mutate({
      host,
      port,
      username,
      auth_method: authMethod,
      key_name: authMethod === 'key' ? trimmedKeyName || null : null,
      password: authMethod === 'password' ? password || null : null,
    })
  }

  const handleSave = () => {
    const trimmedKeyName = keyName.trim()
    if (initial) {
      onSave({
        id: initial.id,
        host,
        port,
        username,
        auth_method: authMethod,
        key_name: authMethod === 'key' ? trimmedKeyName || null : null,
      } as UpdateSshConnectionInput)
    } else {
      onSave({
        host,
        port,
        username,
        auth_method: authMethod,
        key_name: authMethod === 'key' ? trimmedKeyName || null : null,
      } as CreateSshConnectionInput)
    }
  }

  const isFormValid =
    host.trim() !== '' &&
    username.trim() !== '' &&
    !isNaN(port) &&
    port >= 1 &&
    port <= 65535 &&
    (authMethod !== 'key' || keyName.trim() !== '')

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="sm:max-w-[480px] border-0 p-0 overflow-hidden"
        data-testid="connection-dialog"
        style={{
          background: 'linear-gradient(145deg, #0f1117 0%, #0a0c10 100%)',
          boxShadow:
            '0 0 0 1px rgba(74,222,128,0.15), 0 32px 64px rgba(0,0,0,0.8)',
        }}
      >
        {/* Green accent strip */}
        <div
          className="h-px w-full"
          style={{
            background:
              'linear-gradient(90deg, transparent, rgba(74,222,128,0.6), transparent)',
          }}
        />

        <div className="px-6 pt-5 pb-2">
          <DialogHeader>
            <DialogTitle
              className="flex items-center gap-2 text-sm uppercase tracking-[0.15em]"
              style={{
                color: '#4ade80',
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              }}
            >
              <Terminal size={14} className="opacity-70" />
              {initial ? 'Edit Connection' : 'New Connection'}
            </DialogTitle>
          </DialogHeader>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Host + Port */}
          <div className="grid grid-cols-[1fr_100px] gap-3">
            <div className="space-y-1.5">
              <Label
                className="text-[11px] uppercase tracking-widest"
                style={{
                  color: 'rgba(74,222,128,0.5)',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                Host
              </Label>
              <Input
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="192.168.1.1"
                data-testid="host-input"
                className="border-0 text-sm h-9"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  color: '#e2e8f0',
                  boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label
                className="text-[11px] uppercase tracking-widest"
                style={{
                  color: 'rgba(74,222,128,0.5)',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                Port
              </Label>
              <Input
                type="number"
                value={port}
                onChange={(e) => setPort(Number(e.target.value))}
                min={1}
                max={65535}
                data-testid="port-input"
                className="border-0 text-sm h-9"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  color: '#e2e8f0',
                  boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              />
            </div>
          </div>

          {/* Username */}
          <div className="space-y-1.5">
            <Label
              className="text-[11px] uppercase tracking-widest"
              style={{
                color: 'rgba(74,222,128,0.5)',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              Username
            </Label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="ubuntu"
              data-testid="username-input"
              className="border-0 text-sm h-9"
              style={{
                background: 'rgba(255,255,255,0.04)',
                color: '#e2e8f0',
                boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            />
          </div>

          {/* Auth Method */}
          <div className="space-y-1.5">
            <Label
              className="text-[11px] uppercase tracking-widest"
              style={{
                color: 'rgba(74,222,128,0.5)',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              Auth Method
            </Label>
            <Select
              value={authMethod}
              onValueChange={(v) => setAuthMethod(v as 'key' | 'password')}
            >
              <SelectTrigger
                className="border-0 text-sm h-9"
                data-testid="auth-method-select"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  color: '#e2e8f0',
                  boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                style={{
                  background: '#0f1117',
                  border: '1px solid rgba(74,222,128,0.2)',
                }}
              >
                <SelectItem value="key" data-testid="auth-key-option">
                  <span className="flex items-center gap-2 text-sm">
                    <Key size={12} className="text-sky-400" />
                    SSH Key
                  </span>
                </SelectItem>
                <SelectItem value="password" data-testid="auth-password-option">
                  <span className="flex items-center gap-2 text-sm">
                    <Lock size={12} className="text-amber-400" />
                    Password
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Conditional: Key selector or Password input */}
          {authMethod === 'key' ? (
            <div className="space-y-1.5">
              <Label
                className="text-[11px] uppercase tracking-widest"
                style={{
                  color: 'rgba(74,222,128,0.5)',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                Select Key
              </Label>
              {availableKeys.length === 0 ? (
                <div className="space-y-3">
                  <p
                    className="text-[11px]"
                    style={{ color: 'rgba(255,255,255,0.35)', fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    No SSH keys yet. Enter the server password once to generate and install a key automatically.
                  </p>
                  <Input
                    type="password"
                    value={installPassword}
                    onChange={(e) => setInstallPassword(e.target.value)}
                    placeholder="Server password (one-time use)"
                    disabled={installStatus === 'installing' || installStatus === 'success'}
                    className="border-0 text-sm h-9"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      color: '#e2e8f0',
                      boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)',
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  />
                  {installStatus !== 'success' && (
                    <button
                      onClick={handleInstallKey}
                      disabled={!installPassword || !host || !username || installStatus === 'installing'}
                      className="flex w-full items-center justify-center gap-1.5 h-8 rounded text-[11px] uppercase tracking-wider transition-all disabled:opacity-40"
                      style={{
                        background: 'rgba(74,222,128,0.1)',
                        color: '#4ade80',
                        boxShadow: '0 0 0 1px rgba(74,222,128,0.3)',
                        fontFamily: "'JetBrains Mono', monospace",
                      }}
                    >
                      {installStatus === 'installing' ? (
                        <><Loader2 size={11} className="animate-spin" /> Installing…</>
                      ) : (
                        <><Key size={11} /> Generate & Install Key</>
                      )}
                    </button>
                  )}
                  {installStatus === 'success' && (
                    <div
                      className="flex items-center gap-2 px-3 py-2 rounded text-xs"
                      style={{
                        background: 'rgba(74,222,128,0.06)',
                        border: '1px solid rgba(74,222,128,0.25)',
                        color: '#4ade80',
                        fontFamily: "'JetBrains Mono', monospace",
                      }}
                    >
                      <CheckCircle2 size={11} />
                      Key installed — select it above to continue
                    </div>
                  )}
                  {installStatus === 'error' && (
                    <div
                      className="flex items-start gap-2 px-3 py-2 rounded text-xs"
                      style={{
                        background: 'rgba(248,113,113,0.06)',
                        border: '1px solid rgba(248,113,113,0.2)',
                        color: '#f87171',
                        fontFamily: "'JetBrains Mono', monospace",
                      }}
                    >
                      <XCircle size={11} className="shrink-0 mt-0.5" />
                      <span className="break-all">{installError}</span>
                    </div>
                  )}
                </div>
              ) : (
                <Select value={keyName} onValueChange={setKeyName}>
                  <SelectTrigger
                    className="border-0 text-sm h-9"
                    data-testid="key-select"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      color: '#e2e8f0',
                      boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)',
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  >
                    <SelectValue placeholder="— select key —" />
                  </SelectTrigger>
                  <SelectContent
                    style={{
                      background: '#0f1117',
                      border: '1px solid rgba(74,222,128,0.2)',
                    }}
                  >
                    {availableKeys.map((k) => (
                      <SelectItem key={k} value={k}>
                        {k}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label
                className="text-[11px] uppercase tracking-widest"
                style={{
                  color: 'rgba(74,222,128,0.5)',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                Password{' '}
                <span
                  className="normal-case tracking-normal text-[10px] ml-1"
                  style={{ color: 'rgba(255,255,255,0.25)' }}
                >
                  (not stored)
                </span>
              </Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                data-testid="password-input"
                className="border-0 text-sm h-9"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  color: '#e2e8f0',
                  boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              />
            </div>
          )}

          {/* Test Connection */}
          <div className="pt-1 space-y-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTest}
              disabled={!isFormValid || testMutation.isPending}
              data-testid="test-connection-btn"
              className="w-full h-8 text-xs border-0 gap-2 uppercase tracking-widest"
              style={{
                background: 'rgba(74,222,128,0.06)',
                color:
                  testStatus.state === 'success'
                    ? '#4ade80'
                    : testStatus.state === 'error'
                      ? '#f87171'
                      : 'rgba(74,222,128,0.7)',
                boxShadow: 'inset 0 0 0 1px rgba(74,222,128,0.2)',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              {testMutation.isPending ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Zap size={12} />
              )}
              {testMutation.isPending ? 'Testing…' : 'Test Connection'}
            </Button>

            {/* Inline result */}
            {testStatus.state === 'success' && (
              <div
                className="flex items-start gap-2 px-3 py-2 rounded text-xs"
                data-testid="test-result-success"
                style={{
                  background: 'rgba(74,222,128,0.06)',
                  border: '1px solid rgba(74,222,128,0.25)',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                <CheckCircle2
                  size={12}
                  className="text-green-400 mt-0.5 shrink-0"
                />
                <div>
                  <p className="text-green-400 font-semibold mb-0.5">
                    Connected
                  </p>
                  <p
                    className="break-all"
                    style={{
                      color: 'rgba(74,222,128,0.5)',
                      fontSize: '10px',
                    }}
                    data-testid="fingerprint-text"
                  >
                    {testStatus.fingerprint}
                  </p>
                </div>
              </div>
            )}
            {testStatus.state === 'error' && (
              <div
                className="flex items-start gap-2 px-3 py-2 rounded text-xs"
                data-testid="test-result-error"
                style={{
                  background: 'rgba(248,113,113,0.06)',
                  border: '1px solid rgba(248,113,113,0.2)',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                <XCircle
                  size={12}
                  className="text-red-400 mt-0.5 shrink-0"
                />
                <p className="text-red-400 break-all">{testStatus.message}</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          className="px-6 py-4 flex justify-end gap-2"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-xs uppercase tracking-widest h-8 px-4"
            style={{
              color: 'rgba(255,255,255,0.4)',
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!isFormValid || isSaving}
            data-testid="save-connection-btn"
            className="text-xs uppercase tracking-widest h-8 px-5 border-0"
            style={{
              background: 'rgba(74,222,128,0.15)',
              color: '#4ade80',
              boxShadow: '0 0 0 1px rgba(74,222,128,0.3)',
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            {isSaving ? (
              <Loader2 size={12} className="animate-spin mr-1" />
            ) : null}
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Connection Row ───────────────────────────────────────────────────────────

function ConnectionRow({
  profile,
  onEdit,
  onDelete,
  onQuickTest,
}: {
  profile: SshConnectionProfile
  onEdit: () => void
  onDelete: () => void
  onQuickTest: () => void
}) {
  const isKey = profile.auth_method === 'key'

  return (
    <div
      className="group relative flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200"
      data-testid="connection-row"
      style={{
        background: 'rgba(255,255,255,0.02)',
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06)',
      }}
    >
      {/* Auth-method left accent on hover */}
      <div
        className="absolute left-0 top-2 bottom-2 w-[2px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background: isKey
            ? 'linear-gradient(to bottom, transparent, #38bdf8, transparent)'
            : 'linear-gradient(to bottom, transparent, #fbbf24, transparent)',
        }}
      />

      {/* Icon */}
      <div
        className="shrink-0 w-7 h-7 rounded flex items-center justify-center"
        style={{
          background: isKey
            ? 'rgba(56,189,248,0.1)'
            : 'rgba(251,191,36,0.1)',
        }}
      >
        <Server
          size={13}
          style={{ color: isKey ? '#38bdf8' : '#fbbf24' }}
        />
      </div>

      {/* Label */}
      <div className="flex-1 min-w-0">
        <p
          className="text-sm truncate"
          data-testid="connection-label"
          style={{
            color: '#e2e8f0',
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          {profile.username}@{profile.host}:{profile.port}
        </p>
        <span
          className="inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider"
          data-testid="auth-method-badge"
          style={{
            background: isKey
              ? 'rgba(56,189,248,0.1)'
              : 'rgba(251,191,36,0.1)',
            color: isKey ? '#38bdf8' : '#fbbf24',
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          {isKey ? <Key size={8} /> : <Lock size={8} />}
          {isKey ? (profile.key_name ?? 'ssh key') : 'password'}
        </span>
      </div>

      {/* Action icons */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        <button
          onClick={onQuickTest}
          title="Test connection"
          className="w-7 h-7 rounded flex items-center justify-center transition-colors duration-150"
          data-testid="quick-test-btn"
          style={{ color: 'rgba(74,222,128,0.5)' }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.color = '#4ade80')
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.color = 'rgba(74,222,128,0.5)')
          }
        >
          <Zap size={13} />
        </button>
        <button
          onClick={onEdit}
          title="Edit"
          className="w-7 h-7 rounded flex items-center justify-center transition-colors duration-150"
          data-testid="edit-btn"
          style={{ color: 'rgba(255,255,255,0.3)' }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.color = '#e2e8f0')
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')
          }
        >
          <Pencil size={13} />
        </button>
        <button
          onClick={onDelete}
          title="Delete"
          className="w-7 h-7 rounded flex items-center justify-center transition-colors duration-150"
          data-testid="delete-btn"
          style={{ color: 'rgba(248,113,113,0.4)' }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.color = '#f87171')
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.color = 'rgba(248,113,113,0.4)')
          }
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function SshConnectionsPanel() {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<SshConnectionProfile | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SshConnectionProfile | null>(null)

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: connections = [], isLoading: connectionsLoading } = useQuery({
    queryKey: ['ssh_connections'],
    queryFn: async () => {
      const result = await commands.listSshConnections()
      if (result.status === 'error') throw new Error(JSON.stringify(result.error))
      return result.data
    },
  })

  const { data: sshKeys = [] } = useQuery({
    queryKey: ['ssh_keys'],
    queryFn: async () => {
      const result = await commands.listSshKeys()
      if (result.status === 'error') throw new Error(JSON.stringify(result.error))
      return result.data.map((k) => k.name)
    },
  })

  // ── Mutations ─────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: async (input: CreateSshConnectionInput) => {
      const result = await commands.createSshConnection(input)
      if (result.status === 'error') throw new Error(JSON.stringify(result.error))
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ssh_connections'] })
      toast.success('Connection saved')
      setDialogOpen(false)
      setEditTarget(null)
    },
    onError: (err: Error) => {
      toast.error('Failed to save connection', { description: err.message })
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (input: UpdateSshConnectionInput) => {
      const result = await commands.updateSshConnection(input)
      if (result.status === 'error') throw new Error(JSON.stringify(result.error))
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ssh_connections'] })
      toast.success('Connection updated')
      setDialogOpen(false)
      setEditTarget(null)
    },
    onError: (err: Error) => {
      toast.error('Failed to update connection', { description: err.message })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await commands.deleteSshConnection(id)
      if (result.status === 'error') throw new Error(JSON.stringify(result.error))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ssh_connections'] })
      toast.success('Connection removed')
      setDeleteTarget(null)
    },
    onError: (err: Error) => {
      toast.error('Failed to remove connection', { description: err.message })
    },
  })

  const testMutation = useMutation({
    mutationFn: async (input: TestSshConnectionInput) => {
      const result = await commands.testSshConnection(input)
      if (result.status === 'error') throw new Error(JSON.stringify(result.error))
      return result.data
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success('Connection successful', {
          description: data.fingerprint ?? undefined,
        })
      } else {
        toast.error('Connection failed', { description: data.error ?? undefined })
      }
    },
    onError: (err: Error) => {
      toast.error('Connection test failed', { description: err.message })
    },
  })

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleSave = (
    input: CreateSshConnectionInput | UpdateSshConnectionInput
  ) => {
    if ('id' in input) {
      updateMutation.mutate(input as UpdateSshConnectionInput)
    } else {
      createMutation.mutate(input as CreateSshConnectionInput)
    }
  }

  const handleTest = async (
    input: TestSshConnectionInput
  ): Promise<SshConnectionTestResult> => {
    const result = await commands.testSshConnection(input)
    if (result.status === 'error') throw new Error(JSON.stringify(result.error))
    return result.data
  }

  const handleQuickTest = (profile: SshConnectionProfile) => {
    testMutation.mutate({
      host: profile.host,
      port: profile.port,
      username: profile.username,
      auth_method: profile.auth_method,
      key_name: profile.key_name,
      password: null,
    })
  }

  const isSaving = createMutation.isPending || updateMutation.isPending

  return (
    <div data-testid="ssh-connections-panel">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3
            className="text-xs uppercase tracking-[0.2em]"
            style={{
              color: 'rgba(74,222,128,0.8)',
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            SSH Connections
          </h3>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Manage remote machine access
          </p>
        </div>
        <button
          onClick={() => {
            setEditTarget(null)
            setDialogOpen(true)
          }}
          data-testid="add-connection-btn"
          className="flex items-center gap-1.5 px-3 h-8 rounded text-xs uppercase tracking-widest transition-all duration-200"
          style={{
            background: 'rgba(74,222,128,0.08)',
            color: 'rgba(74,222,128,0.7)',
            boxShadow: '0 0 0 1px rgba(74,222,128,0.2)',
            fontFamily: "'JetBrains Mono', monospace",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(74,222,128,0.14)'
            e.currentTarget.style.color = '#4ade80'
            e.currentTarget.style.boxShadow = '0 0 0 1px rgba(74,222,128,0.4)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(74,222,128,0.08)'
            e.currentTarget.style.color = 'rgba(74,222,128,0.7)'
            e.currentTarget.style.boxShadow = '0 0 0 1px rgba(74,222,128,0.2)'
          }}
        >
          <Plus size={12} strokeWidth={2.5} />
          Add Connection
        </button>
      </div>

      {/* Body */}
      {connectionsLoading ? (
        <div className="space-y-2" data-testid="ssh-connections-loading">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-14 rounded-lg animate-pulse"
              style={{ background: 'rgba(255,255,255,0.03)' }}
            />
          ))}
        </div>
      ) : connections.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-10 rounded-lg"
          data-testid="empty-state"
          style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px dashed rgba(255,255,255,0.08)',
          }}
        >
          <Server
            size={24}
            style={{ color: 'rgba(74,222,128,0.2)', marginBottom: '10px' }}
          />
          <p
            className="text-sm"
            style={{
              color: 'rgba(255,255,255,0.3)',
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            No connections saved
          </p>
          <button
            onClick={() => {
              setEditTarget(null)
              setDialogOpen(true)
            }}
            className="mt-3 text-xs underline underline-offset-2 transition-colors"
            style={{
              color: 'rgba(74,222,128,0.5)',
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            + Add your first connection
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {connections.map((profile) => (
            <ConnectionRow
              key={profile.id}
              profile={profile}
              onEdit={() => {
                setEditTarget(profile)
                setDialogOpen(true)
              }}
              onDelete={() => setDeleteTarget(profile)}
              onQuickTest={() => handleQuickTest(profile)}
            />
          ))}
        </div>
      )}

      {/* Add / Edit dialog */}
      <ConnectionDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false)
          setEditTarget(null)
        }}
        onSave={handleSave}
        onTest={handleTest}
        availableKeys={sshKeys}
        initial={editTarget}
        isSaving={isSaving}
        onKeyInstalled={() => queryClient.invalidateQueries({ queryKey: ['ssh_keys'] })}
      />

      {/* Delete confirmation dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
      >
        <DialogContent
          className="sm:max-w-[360px] border-0 p-0 overflow-hidden"
          style={{
            background: '#0f1117',
            boxShadow:
              '0 0 0 1px rgba(248,113,113,0.2), 0 24px 48px rgba(0,0,0,0.8)',
          }}
        >
          <div className="h-px w-full" style={{ background: 'linear-gradient(90deg, transparent, rgba(248,113,113,0.5), transparent)' }} />
          <div className="px-6 pt-5 pb-2">
            <DialogHeader>
              <DialogTitle
                className="text-sm"
                style={{ color: '#f87171', fontFamily: "'JetBrains Mono', monospace" }}
              >
                Remove Connection?
              </DialogTitle>
            </DialogHeader>
          </div>
          <div className="px-6 pb-4">
            <p
              className="text-xs"
              style={{ color: 'rgba(255,255,255,0.4)', fontFamily: "'JetBrains Mono', monospace" }}
            >
              {deleteTarget &&
                `${deleteTarget.username}@${deleteTarget.host}:${deleteTarget.port} will be removed.`}
            </p>
          </div>
          <div
            className="px-6 py-4 flex justify-end gap-2"
            style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDeleteTarget(null)}
              className="text-xs uppercase tracking-widest h-8 px-4"
              style={{ color: 'rgba(255,255,255,0.4)', fontFamily: "'JetBrains Mono', monospace" }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              className="text-xs uppercase tracking-widest h-8 px-4 border-0"
              data-testid="confirm-delete-btn"
              style={{
                background: 'rgba(248,113,113,0.15)',
                color: '#f87171',
                boxShadow: '0 0 0 1px rgba(248,113,113,0.3)',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              Remove
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

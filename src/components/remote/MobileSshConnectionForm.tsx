import React, { useState, useEffect } from 'react'
import {
  useListSshKeys,
  useTestSshConnection,
  useCreateSshConnection,
  useUpdateSshConnection,
  useInstallSshKey,
} from '@renderer/hooks/useSshCommands'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/ui/select'
import {
  Key,
  Lock,
  Zap,
  CheckCircle2,
  XCircle,
  Loader2,
  Terminal,
} from 'lucide-react'
import { toast } from 'sonner'
import type {
  SshConnectionProfile,
} from '@renderer/lib/rspc'

interface MobileSshConnectionFormProps {
  initial?: SshConnectionProfile | null
  onSave?: (conn: SshConnectionProfile) => void
  onCancel?: () => void
}

type TestStatus =
  | { state: 'idle' }
  | { state: 'testing' }
  | { state: 'success'; fingerprint: string }
  | { state: 'error'; message: string }

export function MobileSshConnectionForm({
  initial,
  onSave,
  onCancel,
}: MobileSshConnectionFormProps) {
  const [host, setHost] = useState(initial?.host ?? '')
  const [port, setPort] = useState<number | string>(initial?.port ?? 22)
  const [username, setUsername] = useState(initial?.username ?? '')
  const [authMethod, setAuthMethod] = useState<'key' | 'password'>((initial?.auth_method as 'key' | 'password') ?? 'key')
  const [keyName, setKeyName] = useState(initial?.key_name ?? '')
  const [password, setPassword] = useState('')
  const [testStatus, setTestStatus] = useState<TestStatus>({ state: 'idle' })

  // Install-key wizard state
  const [installPassword, setInstallPassword] = useState('')
  const [installKeyName, setInstallKeyName] = useState('')
  const [isInstalling, setIsInstalling] = useState(false)

  const { data: sshKeys = [] } = useListSshKeys()
  const testMutation = useTestSshConnection()
  const createMutation = useCreateSshConnection()
  const updateMutation = useUpdateSshConnection()
  const installMutation = useInstallSshKey()

  // Auto-select first key if none selected and keys are available
  useEffect(() => {
    if (authMethod === 'key' && !keyName && sshKeys.length > 0) {
      setKeyName(sshKeys[0].name)
    }
  }, [authMethod, keyName, sshKeys])

  const haptic = (type: 'success' | 'error' | 'pulse') => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      if (type === 'success') {
        navigator.vibrate([10, 30, 10])
      } else if (type === 'error') {
        navigator.vibrate(300) // AC: "one long" vibration
      } else if (type === 'pulse') {
        navigator.vibrate(10)
      }
    }
  }

  const handleTest = async () => {
    haptic('pulse')
    setTestStatus({ state: 'testing' })
    try {
      const data = await testMutation.mutateAsync({
        host,
        port: Number(port),
        username,
        auth_method: authMethod,
        key_name: authMethod === 'key' ? keyName || null : null,
        password: authMethod === 'password' ? password || null : null,
      })

      if (data.success) {
        haptic('success')
        setTestStatus({ state: 'success', fingerprint: data.fingerprint ?? '' })
      } else {
        haptic('error')
        setTestStatus({ state: 'error', message: data.error ?? 'Unknown error' })
      }
    } catch (err: any) {
      haptic('error')
      setTestStatus({ state: 'error', message: err.message })
    }
  }

  const handleInstallKey = async () => {
    haptic('pulse')
    setIsInstalling(true)
    try {
      const name = installKeyName.trim() || `${username.replace(/[^a-z0-9]/gi, '')}-tinsu`
      const entry = await installMutation.mutateAsync({
        host,
        port: Number(port),
        username,
        password: installPassword,
        key_name: name,
      })
      haptic('success')
      setKeyName(entry.name)
      setInstallPassword('')
      toast.success('Key generated and installed')
    } catch (err: any) {
      haptic('error')
      toast.error('Failed to install key', { description: err.message })
    } finally {
      setIsInstalling(false)
    }
  }

  const handleSave = async () => {
    haptic('pulse')
    try {
      let savedConn: SshConnectionProfile
      if (initial) {
        savedConn = await updateMutation.mutateAsync({
          id: initial.id,
          host,
          port: Number(port),
          username,
          auth_method: authMethod,
          key_name: authMethod === 'key' ? keyName || null : null,
        })
        toast.success('Connection updated')
      } else {
        savedConn = await createMutation.mutateAsync({
          host,
          port: Number(port),
          username,
          auth_method: authMethod,
          key_name: authMethod === 'key' ? keyName || null : null,
        })
        toast.success('Connection saved')
      }
      haptic('success')
      onSave?.(savedConn)
    } catch (err: any) {
      haptic('error')
      toast.error('Failed to save connection', { description: err.message })
    }
  }

  const isFormValid =
    host.trim() !== '' &&
    username.trim() !== '' &&
    port !== '' &&
    !isNaN(Number(port)) &&
    Number(port) >= 1 &&
    Number(port) <= 65535 &&
    (authMethod !== 'key' || keyName.trim() !== '')

  const isSaving = createMutation.isPending || updateMutation.isPending

  return (
    <div className="flex flex-col h-full bg-background overflow-y-auto pb-8">
      <div className="px-6 py-6 space-y-6">
        <div className="flex items-center gap-2 mb-2">
          <Terminal size={18} className="text-primary" />
          <h2 className="text-lg font-semibold tracking-tight">
            {initial ? 'Edit SSH Connection' : 'New SSH Connection'}
          </h2>
        </div>

        {/* Host + Port */}
        <div className="grid grid-cols-[1fr_100px] gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
              Host
            </Label>
            <Input
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="e.g. 1.2.3.4 or example.com"
              className="h-11 px-4 text-base"
              autoFocus
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
              Port
            </Label>
            <Input
              type="number"
              value={port}
              onChange={(e) => {
                const val = e.target.value
                setPort(val === '' ? '' : parseInt(val, 10))
              }}
              min={1}
              max={65535}
              className="h-11 px-3 text-base"
              inputMode="numeric"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
            />
          </div>
        </div>

        {/* Username */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
            Username
          </Label>
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. root, ubuntu"
            className="h-11 px-4 text-base"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            autoComplete="username"
          />
        </div>

        {/* Auth Method */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
            Authentication
          </Label>
          <Select
            value={authMethod}
            onValueChange={(v) => setAuthMethod(v as 'key' | 'password')}
          >
            <SelectTrigger className="h-11 px-4 text-base">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="key">
                <span className="flex items-center gap-2">
                  <Key size={16} className="text-sky-400" />
                  SSH Key
                </span>
              </SelectItem>
              <SelectItem value="password">
                <span className="flex items-center gap-2">
                  <Lock size={16} className="text-amber-400" />
                  Password (test only)
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Key Selection or Password */}
        {authMethod === 'key' ? (
          <div className="space-y-3">
            <Label className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
              SSH Key
            </Label>
            {sshKeys.length === 0 ? (
              <div className="space-y-4 p-4 rounded-lg border border-border bg-accent/20">
                <p className="text-sm text-muted-foreground">
                  No keys found. Enter server password once to generate and install a key automatically.
                </p>
                <Input
                  type="password"
                  value={installPassword}
                  onChange={(e) => setInstallPassword(e.target.value)}
                  placeholder="Server password (one-time use)"
                  className="h-11 px-4 text-base bg-background"
                  disabled={isInstalling}
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  autoComplete="current-password"
                />
                <Button
                  variant="outline"
                  onClick={handleInstallKey}
                  disabled={!installPassword || !host || !username || isInstalling}
                  className="w-full h-11 uppercase tracking-widest text-xs gap-2"
                >
                  {isInstalling ? (
                    <><Loader2 size={16} className="animate-spin" /> Installing…</>
                  ) : (
                    <><Key size={16} /> Generate & Install Key</>
                  )}
                </Button>
              </div>
            ) : (
              <Select value={keyName} onValueChange={setKeyName}>
                <SelectTrigger className="h-11 px-4 text-base">
                  <SelectValue placeholder="Select an SSH key" />
                </SelectTrigger>
                <SelectContent>
                  {sshKeys.map((k) => (
                    <SelectItem key={k.name} value={k.name}>
                      {k.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <Label className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
              Password
            </Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="h-11 px-4 text-base"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              autoComplete="current-password"
            />
            <p className="text-xs text-muted-foreground">
              Note: Passwords are used for testing or key installation and are never stored.
            </p>
          </div>
        )}

        {/* Test Section */}
        <div className="pt-4 space-y-3">
          <Button
            variant="secondary"
            className="w-full h-11 text-xs uppercase tracking-widest gap-2"
            onClick={handleTest}
            disabled={!isFormValid || testMutation.isPending}
          >
            {testMutation.isPending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Zap size={16} />
            )}
            Test Connection
          </Button>

          {testStatus.state === 'success' && (
            <div className="flex items-start gap-3 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <CheckCircle2 className="text-emerald-500 mt-0.5 shrink-0" size={18} />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-emerald-500">Connection Successful</p>
                <p className="text-[10px] font-mono break-all text-emerald-500/70">
                  {testStatus.fingerprint}
                </p>
              </div>
            </div>
          )}

          {testStatus.state === 'error' && (
            <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
              <XCircle className="text-destructive mt-0.5 shrink-0" size={18} />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-destructive">Connection Failed</p>
                <p className="text-xs text-destructive/80 leading-relaxed">
                  {testStatus.message}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="mt-auto px-6 pt-4 flex flex-col gap-3">
        <Button
          size="lg"
          onClick={handleSave}
          disabled={!isFormValid || isSaving}
          className="h-12 w-full text-base font-semibold"
        >
          {isSaving ? (
            <Loader2 size={20} className="animate-spin mr-2" />
          ) : null}
          {initial ? 'Update Connection' : 'Save Connection'}
        </Button>
        <Button
          variant="ghost"
          size="lg"
          onClick={onCancel}
          className="h-12 w-full text-base text-muted-foreground"
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}

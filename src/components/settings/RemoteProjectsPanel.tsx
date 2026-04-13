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
  FolderSearch,
  FolderGit2,
  Trash2,
  Loader2,
  Plus,
  Folder,
  ChevronRight,
  Home,
  FolderOpen,
} from 'lucide-react'
import { commands } from '@renderer/lib/rspc'
import type {
  SshConnectionProfile,
  RemoteProjectProfile,
  SaveRemoteProjectInput,
  ListRemoteDirInput,
  RemoteDirEntry,
} from '@renderer/lib/rspc'

// ─── Discover Dialog ──────────────────────────────────────────────────────────

interface DiscoverDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  connections: SshConnectionProfile[]
  onSave: (input: SaveRemoteProjectInput) => void
  isSaving: boolean
  onAddConnection?: () => void
  onEditConnection?: (connection: SshConnectionProfile) => void
}

export function DiscoverProjectsDialog({
  open,
  onOpenChange,
  connections,
  onSave,
  isSaving,
  onAddConnection,
  onEditConnection,
}: DiscoverDialogProps) {
  const [connectionId, setConnectionId] = useState('')
  const [browserPath, setBrowserPath] = useState('~')
  const [browserEntries, setBrowserEntries] = useState<RemoteDirEntry[]>([])
  const [browserFilter, setBrowserFilter] = useState('')
  const [browserLoading, setBrowserLoading] = useState(false)
  const [browserError, setBrowserError] = useState('')

  React.useEffect(() => {
    if (open) {
      setConnectionId('')
      setBrowserPath('~')
      setBrowserEntries([])
      setBrowserFilter('')
      setBrowserLoading(false)
      setBrowserError('')
    }
  }, [open])

  // Browse to a directory on the remote server
  const browseTo = async (connId: string, path: string) => {
    if (!connId) return
    setBrowserLoading(true)
    setBrowserError('')
    const input: ListRemoteDirInput = { connection_id: connId, path }
    const result = await commands.listRemoteDir(input)
    setBrowserLoading(false)
    if (result.status === 'error') {
      setBrowserError(typeof result.error === 'string' ? result.error : JSON.stringify(result.error))
      setBrowserEntries([])
    } else {
      setBrowserEntries(result.data)
      setBrowserPath(path)
      setBrowserFilter('')
    }
  }

  // When connection changes, load home dir
  React.useEffect(() => {
    if (connectionId) {
      setBrowserPath('~')
      setBrowserEntries([])
      browseTo(connectionId, '~')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionId])

  const handleOpenHere = () => {
    if (!connectionId) return
    // Use the last non-empty path segment as the project name
    const pathSegments = browserPath.replace(/^~\/?/, '').split('/').filter(Boolean)
    const name = pathSegments.length > 0 ? pathSegments[pathSegments.length - 1] : browserPath
    onSave({ connection_id: connectionId, name, path: browserPath })
  }

  const selectedConn = connections.find((c) => c.id === connectionId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[520px] max-h-[80vh] border-0 p-0 overflow-hidden flex flex-col"
        data-testid="discover-dialog"
        style={{
          background: 'linear-gradient(145deg, #0f1117 0%, #0a0c10 100%)',
          boxShadow: '0 0 0 1px rgba(74,222,128,0.15), 0 32px 64px rgba(0,0,0,0.8)',
        }}
      >
        {/* Top accent */}
        <div
          className="h-px w-full shrink-0"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(74,222,128,0.6), transparent)',
          }}
        />

        <div className="px-6 pt-5 pb-3 shrink-0">
          <DialogHeader>
            <DialogTitle
              className="flex items-center gap-2 text-sm uppercase tracking-[0.15em]"
              style={{
                color: '#4ade80',
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              }}
            >
              <FolderOpen size={14} className="opacity-70" />
              Open Remote Project
            </DialogTitle>
          </DialogHeader>
        </div>

        <div className="px-6 pb-4 space-y-4 overflow-y-auto flex-1">
          {/* Connection select */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label
                className="text-[11px] uppercase tracking-widest"
                style={{
                  color: 'rgba(74,222,128,0.5)',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                SSH Connection
              </Label>
              {onAddConnection && (
                <button
                  onClick={onAddConnection}
                  className="flex items-center gap-1 text-[10px] uppercase tracking-wider transition-colors"
                  style={{
                    color: 'rgba(74,222,128,0.5)',
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#4ade80')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(74,222,128,0.5)')}
                >
                  <Plus size={10} />
                  Add connection
                </button>
              )}
            </div>

            {connections.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center py-5 rounded-lg gap-3"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px dashed rgba(74,222,128,0.15)',
                }}
              >
                <p
                  className="text-xs text-center"
                  style={{
                    color: 'rgba(255,255,255,0.35)',
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  No SSH connections configured yet.
                </p>
                {onAddConnection && (
                  <button
                    onClick={onAddConnection}
                    className="flex items-center gap-1.5 px-3 h-7 rounded text-[11px] uppercase tracking-wider transition-all"
                    style={{
                      background: 'rgba(74,222,128,0.08)',
                      color: '#4ade80',
                      boxShadow: '0 0 0 1px rgba(74,222,128,0.3)',
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(74,222,128,0.14)'
                      e.currentTarget.style.boxShadow = '0 0 0 1px rgba(74,222,128,0.5)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(74,222,128,0.08)'
                      e.currentTarget.style.boxShadow = '0 0 0 1px rgba(74,222,128,0.3)'
                    }}
                  >
                    <Plus size={11} />
                    Add SSH Connection
                  </button>
                )}
              </div>
            ) : (
              <Select value={connectionId} onValueChange={setConnectionId}>
                <SelectTrigger
                  className="border-0 text-sm h-9"
                  data-testid="connection-select"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    color: '#e2e8f0',
                    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)',
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  <SelectValue placeholder="— select connection —" />
                </SelectTrigger>
                <SelectContent
                  style={{
                    background: '#0f1117',
                    border: '1px solid rgba(74,222,128,0.2)',
                  }}
                >
                  {connections.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px' }}>
                        {c.username}@{c.host}:{c.port}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Password auth warning */}
            {selectedConn && selectedConn.auth_method === 'password' && (
              <div
                className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg"
                style={{
                  background: 'rgba(251,191,36,0.06)',
                  border: '1px solid rgba(251,191,36,0.2)',
                }}
              >
                <span style={{ color: '#fbbf24', fontSize: '13px', lineHeight: 1, marginTop: '1px' }}>⚠</span>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-[11px] leading-relaxed"
                    style={{
                      color: 'rgba(251,191,36,0.8)',
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  >
                    Discovery requires key-based auth. This connection uses a password.
                  </p>
                  {onEditConnection && (
                    <button
                      onClick={() => onEditConnection(selectedConn)}
                      className="mt-1.5 text-[10px] uppercase tracking-wider transition-colors"
                      style={{
                        color: 'rgba(251,191,36,0.6)',
                        fontFamily: "'JetBrains Mono', monospace",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#fbbf24')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(251,191,36,0.6)')}
                    >
                      Edit connection →
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Folder browser — only shown when a valid connection is selected */}
          {connectionId && selectedConn?.auth_method !== 'password' && (
            <div className="space-y-1.5">
              <Label
                className="text-[11px] uppercase tracking-widest"
                style={{
                  color: 'rgba(74,222,128,0.5)',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                Browse Folder
              </Label>

              {/* Breadcrumb */}
              <div
                className="flex items-center gap-1 px-2 py-1.5 rounded flex-wrap"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06)',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '11px',
                  minHeight: '32px',
                }}
              >
                {/* Home button */}
                <button
                  onClick={() => browseTo(connectionId, '~')}
                  className="flex items-center gap-1 transition-colors"
                  style={{ color: 'rgba(74,222,128,0.6)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#4ade80')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(74,222,128,0.6)')}
                  title="Home"
                >
                  <Home size={11} />
                </button>
                {/* Path segments — skip ~ prefix */}
                {(() => {
                  const resolved = browserPath.startsWith('~') ? browserPath : browserPath
                  const segments = resolved.replace(/^~\/?/, '').split('/').filter(Boolean)
                  return segments.map((seg, i) => {
                    const pathUpTo = segments.slice(0, i + 1)
                    // Reconstruct full path: if original started with ~, keep that
                    const target = browserPath.startsWith('~')
                      ? '~/' + pathUpTo.join('/')
                      : '/' + pathUpTo.join('/')
                    return (
                      <React.Fragment key={i}>
                        <ChevronRight size={10} style={{ color: 'rgba(255,255,255,0.2)' }} />
                        <button
                          onClick={() => browseTo(connectionId, target)}
                          className="transition-colors hover:text-white"
                          style={{ color: i === segments.length - 1 ? '#e2e8f0' : 'rgba(255,255,255,0.5)' }}
                        >
                          {seg}
                        </button>
                      </React.Fragment>
                    )
                  })
                })()}
              </div>

              {/* Filter input */}
              {!browserLoading && !browserError && browserEntries.length > 0 && (
                <Input
                  value={browserFilter}
                  onChange={(e) => setBrowserFilter(e.target.value)}
                  placeholder="Filter folders…"
                  className="border-0 text-sm h-8"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    color: '#e2e8f0',
                    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)',
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                />
              )}

              {/* Directory listing */}
              {(() => {
                const filtered = browserFilter.trim()
                  ? browserEntries.filter((e) =>
                      e.name.toLowerCase().includes(browserFilter.trim().toLowerCase())
                    )
                  : browserEntries
                return (
                  <div
                    className="rounded overflow-hidden"
                    style={{
                      border: '1px solid rgba(255,255,255,0.06)',
                      maxHeight: '160px',
                      overflowY: 'auto',
                    }}
                  >
                    {browserLoading ? (
                      <div className="flex items-center justify-center py-4 gap-2" style={{ color: 'rgba(74,222,128,0.5)' }}>
                        <Loader2 size={12} className="animate-spin" />
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px' }}>Loading…</span>
                      </div>
                    ) : browserError ? (
                      <div className="px-3 py-2 text-[11px]" style={{ color: '#f87171', fontFamily: "'JetBrains Mono', monospace" }}>
                        {browserError}
                      </div>
                    ) : filtered.length === 0 ? (
                      <div className="px-3 py-2 text-[11px]" style={{ color: 'rgba(255,255,255,0.25)', fontFamily: "'JetBrains Mono', monospace" }}>
                        {browserFilter ? 'No matches' : 'No subdirectories'}
                      </div>
                    ) : (
                      filtered.map((entry) => (
                        <button
                          key={entry.path}
                          onClick={() => browseTo(connectionId, entry.path)}
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors hover:bg-white/5"
                          style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', color: '#e2e8f0' }}
                        >
                          <Folder size={12} style={{ color: 'rgba(74,222,128,0.5)', flexShrink: 0 }} />
                          {entry.name}
                        </button>
                      ))
                    )}
                  </div>
                )
              })()}

              {/* Discover here button */}
              {/* Open this folder button */}
              <Button
                size="sm"
                onClick={handleOpenHere}
                disabled={isSaving || browserLoading}
                data-testid="open-here-btn"
                className="w-full h-9 text-xs uppercase tracking-widest border-0 gap-2"
                style={{
                  background: 'rgba(74,222,128,0.12)',
                  color: '#4ade80',
                  boxShadow: '0 0 0 1px rgba(74,222,128,0.3)',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                {isSaving ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    Opening…
                  </>
                ) : (
                  <>
                    <FolderOpen size={12} />
                    Open this folder
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Project Row ──────────────────────────────────────────────────────────────

function ProjectRow({
  project,
  connectionLabel,
  onDelete,
}: {
  project: RemoteProjectProfile
  connectionLabel: string
  onDelete: () => void
}) {
  return (
    <div
      className="group relative flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200"
      data-testid="remote-project-row"
      style={{
        background: 'rgba(255,255,255,0.02)',
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06)',
      }}
    >
      {/* Left accent on hover */}
      <div
        className="absolute left-0 top-2 bottom-2 w-[2px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background: 'linear-gradient(to bottom, transparent, rgba(74,222,128,0.6), transparent)',
        }}
      />

      <div
        className="shrink-0 w-7 h-7 rounded flex items-center justify-center"
        style={{ background: 'rgba(74,222,128,0.08)' }}
      >
        <FolderGit2 size={13} style={{ color: 'rgba(74,222,128,0.7)' }} />
      </div>

      <div className="flex-1 min-w-0 grid grid-cols-[1fr_1fr_auto] gap-x-3 items-center">
        <p
          className="text-xs font-semibold truncate"
          data-testid="project-name"
          style={{
            color: '#e2e8f0',
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          {project.name}
        </p>
        <p
          className="text-[11px] truncate"
          data-testid="project-path"
          style={{
            color: 'rgba(255,255,255,0.35)',
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          {project.path}
        </p>
        <p
          className="text-[11px] truncate"
          data-testid="connection-label-col"
          style={{
            color: 'rgba(56,189,248,0.6)',
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          {connectionLabel}
        </p>
      </div>

      <button
        onClick={onDelete}
        title="Delete"
        className="shrink-0 w-7 h-7 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150"
        data-testid="delete-project-btn"
        style={{ color: 'rgba(248,113,113,0.4)' }}
        onMouseEnter={(e) => (e.currentTarget.style.color = '#f87171')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(248,113,113,0.4)')}
      >
        <Trash2 size={13} />
      </button>
    </div>
  )
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function RemoteProjectsPanel() {
  const queryClient = useQueryClient()
  const [discoverOpen, setDiscoverOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<RemoteProjectProfile | null>(null)

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['remote_projects'],
    queryFn: async () => {
      const result = await commands.listRemoteProjects()
      if (result.status === 'error') throw new Error(JSON.stringify(result.error))
      return result.data
    },
  })

  const { data: connections = [] } = useQuery({
    queryKey: ['ssh_connections'],
    queryFn: async () => {
      const result = await commands.listSshConnections()
      if (result.status === 'error') throw new Error(JSON.stringify(result.error))
      return result.data
    },
  })

  // ── Mutations ─────────────────────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: async (input: SaveRemoteProjectInput) => {
      const result = await commands.saveRemoteProject(input)
      if (result.status === 'error') throw new Error(JSON.stringify(result.error))
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remote_projects'] })
      toast.success('Project saved')
    },
    onError: (err: Error) => {
      toast.error('Failed to save project', { description: err.message })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await commands.deleteRemoteProject(id)
      if (result.status === 'error') throw new Error(JSON.stringify(result.error))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remote_projects'] })
      toast.success('Project removed')
      setDeleteTarget(null)
    },
    onError: (err: Error) => {
      toast.error('Failed to remove project', { description: err.message })
    },
  })

  // ── Helpers ───────────────────────────────────────────────────────────────

  const connectionLabel = (connectionId: string): string => {
    const conn = connections.find((c) => c.id === connectionId)
    return conn ? `${conn.username}@${conn.host}:${conn.port}` : connectionId
  }

  return (
    <div data-testid="remote-projects-panel">
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
            Remote Projects
          </h3>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Manage remote codebase locations
          </p>
        </div>
        <button
          onClick={() => setDiscoverOpen(true)}
          data-testid="discover-btn"
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
          <FolderSearch size={12} strokeWidth={2} />
          Discover Projects
        </button>
      </div>

      {/* Body */}
      {projectsLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-12 rounded-lg animate-pulse"
              style={{ background: 'rgba(255,255,255,0.03)' }}
            />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-10 rounded-lg"
          data-testid="empty-projects-state"
          style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px dashed rgba(255,255,255,0.08)',
          }}
        >
          <FolderGit2
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
            No remote projects saved
          </p>
          <button
            onClick={() => setDiscoverOpen(true)}
            className="mt-3 text-xs underline underline-offset-2 transition-colors"
            style={{
              color: 'rgba(74,222,128,0.5)',
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            + Discover remote projects
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {projects.map((project) => (
            <ProjectRow
              key={project.id}
              project={project}
              connectionLabel={connectionLabel(project.connection_id)}
              onDelete={() => setDeleteTarget(project)}
            />
          ))}
        </div>
      )}

      {/* Discover dialog */}
      <DiscoverProjectsDialog
        open={discoverOpen}
        onOpenChange={setDiscoverOpen}
        connections={connections}
        onSave={(input) => saveMutation.mutate(input)}
        isSaving={saveMutation.isPending}
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
            boxShadow: '0 0 0 1px rgba(248,113,113,0.2), 0 24px 48px rgba(0,0,0,0.8)',
          }}
        >
          <div
            className="h-px w-full"
            style={{
              background:
                'linear-gradient(90deg, transparent, rgba(248,113,113,0.5), transparent)',
            }}
          />
          <div className="px-6 pt-5 pb-2">
            <DialogHeader>
              <DialogTitle
                className="text-sm"
                style={{
                  color: '#f87171',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                Remove Project?
              </DialogTitle>
            </DialogHeader>
          </div>
          <div className="px-6 pb-4">
            <p
              className="text-xs"
              style={{
                color: 'rgba(255,255,255,0.4)',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              {deleteTarget && `"${deleteTarget.name}" at ${deleteTarget.path} will be removed.`}
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
              style={{
                color: 'rgba(255,255,255,0.4)',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              className="text-xs uppercase tracking-widest h-8 px-4 border-0"
              data-testid="confirm-delete-project-btn"
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

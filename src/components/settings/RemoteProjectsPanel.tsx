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
  GitBranch,
  Plus,
  BookmarkPlus,
} from 'lucide-react'
import { commands } from '@renderer/lib/rspc'
import type {
  SshConnectionProfile,
  DiscoveredProject,
  RemoteProjectProfile,
  DiscoverProjectsInput,
  SaveRemoteProjectInput,
} from '@renderer/lib/rspc'

// ─── Discover Dialog ──────────────────────────────────────────────────────────

interface DiscoverDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  connections: SshConnectionProfile[]
  onSave: (input: SaveRemoteProjectInput) => void
  isSaving: boolean
}

function DiscoverProjectsDialog({
  open,
  onOpenChange,
  connections,
  onSave,
  isSaving,
}: DiscoverDialogProps) {
  const [connectionId, setConnectionId] = useState('')
  const [searchPath, setSearchPath] = useState('')
  const [discovered, setDiscovered] = useState<DiscoveredProject[]>([])
  const [hasDiscovered, setHasDiscovered] = useState(false)
  const [manualPath, setManualPath] = useState('')
  const [manualPathError, setManualPathError] = useState('')
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())

  React.useEffect(() => {
    if (open) {
      setConnectionId('')
      setSearchPath('')
      setDiscovered([])
      setHasDiscovered(false)
      setManualPath('')
      setManualPathError('')
      setSavedIds(new Set())
    }
  }, [open])

  const discoverMutation = useMutation({
    mutationFn: async (input: DiscoverProjectsInput) => {
      const result = await commands.discoverRemoteProjects(input)
      if (result.status === 'error') throw new Error(JSON.stringify(result.error))
      return result.data
    },
    onSuccess: (data) => {
      setDiscovered(data)
      setHasDiscovered(true)
    },
    onError: (err: Error) => {
      toast.error('Discovery failed', { description: err.message })
    },
  })

  const handleDiscover = () => {
    if (!connectionId) return
    const input: DiscoverProjectsInput = {
      connection_id: connectionId,
      search_path: searchPath.trim() || null,
    }
    discoverMutation.mutate(input)
  }

  const handleSaveDiscovered = (project: DiscoveredProject) => {
    onSave({
      connection_id: connectionId,
      name: project.name,
      path: project.path,
    })
    // Mark as saved optimistically
    setSavedIds((prev) => new Set(prev).add(project.path))
  }

  const handleAddManually = () => {
    const path = manualPath.trim()
    if (!path) {
      setManualPathError('Path must not be empty')
      return
    }
    if (!path.startsWith('/') && !path.startsWith('~')) {
      setManualPathError("Path must start with '/' or '~'")
      return
    }
    if (!connectionId) {
      setManualPathError('Select a connection first')
      return
    }
    setManualPathError('')
    // Use last segment as name (filter(Boolean) removes empty strings from leading/trailing slashes)
    const pathSegments = path.split('/').filter(Boolean)
    const name = pathSegments.length > 0 ? pathSegments[pathSegments.length - 1] : path
    onSave({ connection_id: connectionId, name, path })
    setManualPath('')
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
              <FolderSearch size={14} className="opacity-70" />
              Discover Remote Projects
            </DialogTitle>
          </DialogHeader>
        </div>

        <div className="px-6 pb-4 space-y-4 overflow-y-auto flex-1">
          {/* Connection select */}
          <div className="space-y-1.5">
            <Label
              className="text-[11px] uppercase tracking-widest"
              style={{
                color: 'rgba(74,222,128,0.5)',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              SSH Connection
            </Label>
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
          </div>

          {/* Search path */}
          <div className="space-y-1.5">
            <Label
              className="text-[11px] uppercase tracking-widest"
              style={{
                color: 'rgba(74,222,128,0.5)',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              Search Path{' '}
              <span
                className="normal-case tracking-normal text-[10px] ml-1"
                style={{ color: 'rgba(255,255,255,0.25)' }}
              >
                (optional, default: ~)
              </span>
            </Label>
            <Input
              value={searchPath}
              onChange={(e) => setSearchPath(e.target.value)}
              placeholder="~"
              data-testid="search-path-input"
              className="border-0 text-sm h-9"
              style={{
                background: 'rgba(255,255,255,0.04)',
                color: '#e2e8f0',
                boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            />
          </div>

          {/* Discover button */}
          <Button
            size="sm"
            onClick={handleDiscover}
            disabled={!connectionId || discoverMutation.isPending}
            data-testid="run-discover-btn"
            className="w-full h-9 text-xs uppercase tracking-widest border-0 gap-2"
            style={{
              background: connectionId ? 'rgba(74,222,128,0.12)' : 'rgba(74,222,128,0.04)',
              color: connectionId ? '#4ade80' : 'rgba(74,222,128,0.3)',
              boxShadow: connectionId ? '0 0 0 1px rgba(74,222,128,0.3)' : 'none',
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            {discoverMutation.isPending ? (
              <>
                <Loader2 size={12} className="animate-spin" data-testid="loading-discover" />
                Scanning…
              </>
            ) : (
              <>
                <FolderSearch size={12} />
                {selectedConn
                  ? `Discover on ${selectedConn.username}@${selectedConn.host}`
                  : 'Discover'}
              </>
            )}
          </Button>

          {/* Results */}
          {hasDiscovered && (
            <div className="space-y-2">
              <p
                className="text-[11px] uppercase tracking-widest"
                style={{
                  color: 'rgba(74,222,128,0.5)',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                Results
              </p>

              {discovered.length === 0 ? (
                <div
                  className="flex flex-col items-center justify-center py-8 rounded-lg"
                  data-testid="empty-discover-state"
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px dashed rgba(255,255,255,0.08)',
                  }}
                >
                  <FolderGit2
                    size={22}
                    style={{ color: 'rgba(255,255,255,0.15)', marginBottom: '8px' }}
                  />
                  <p
                    className="text-xs text-center"
                    style={{
                      color: 'rgba(255,255,255,0.3)',
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  >
                    No git repositories found.
                    <br />
                    Try a different path.
                  </p>
                </div>
              ) : (
                <div
                  className="space-y-1 rounded-lg overflow-hidden"
                  data-testid="discovered-list"
                  style={{ border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  {discovered.map((proj, idx) => {
                    const isSaved = savedIds.has(proj.path)
                    return (
                      <div
                        key={`${proj.path}-${idx}`}
                        className="group flex items-center gap-3 px-3 py-2.5 transition-colors"
                        data-testid="discovered-row"
                        style={{
                          background:
                            idx % 2 === 0
                              ? 'rgba(255,255,255,0.01)'
                              : 'rgba(255,255,255,0.025)',
                        }}
                      >
                        <GitBranch
                          size={12}
                          className="shrink-0"
                          style={{ color: 'rgba(74,222,128,0.4)' }}
                        />
                        <div className="flex-1 min-w-0">
                          <p
                            className="text-xs font-semibold truncate"
                            style={{
                              color: '#e2e8f0',
                              fontFamily: "'JetBrains Mono', monospace",
                            }}
                          >
                            {proj.name}
                          </p>
                          <p
                            className="text-[10px] truncate"
                            style={{
                              color: 'rgba(255,255,255,0.3)',
                              fontFamily: "'JetBrains Mono', monospace",
                            }}
                          >
                            {proj.path}
                          </p>
                        </div>
                        <button
                          onClick={() => handleSaveDiscovered(proj)}
                          disabled={isSaved || isSaving}
                          data-testid="save-discovered-btn"
                          className="shrink-0 flex items-center gap-1 px-2 h-6 rounded text-[10px] uppercase tracking-wider transition-all"
                          style={{
                            background: isSaved
                              ? 'rgba(74,222,128,0.08)'
                              : 'rgba(74,222,128,0.1)',
                            color: isSaved ? 'rgba(74,222,128,0.4)' : '#4ade80',
                            boxShadow: isSaved ? 'none' : '0 0 0 1px rgba(74,222,128,0.3)',
                            fontFamily: "'JetBrains Mono', monospace",
                          }}
                        >
                          <BookmarkPlus size={9} />
                          {isSaved ? 'Saved' : 'Save'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Divider */}
          <div
            className="h-px w-full"
            style={{ background: 'rgba(255,255,255,0.06)' }}
          />

          {/* Manual path */}
          <div className="space-y-2">
            <p
              className="text-[11px] uppercase tracking-widest"
              style={{
                color: 'rgba(74,222,128,0.5)',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              Add Manually
            </p>
            <div className="flex gap-2">
              <Input
                value={manualPath}
                onChange={(e) => {
                  setManualPath(e.target.value)
                  setManualPathError('')
                }}
                placeholder="/home/user/my-project"
                data-testid="manual-path-input"
                className="border-0 text-sm h-8 flex-1"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  color: '#e2e8f0',
                  boxShadow: manualPathError
                    ? 'inset 0 0 0 1px rgba(248,113,113,0.4)'
                    : 'inset 0 0 0 1px rgba(255,255,255,0.08)',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              />
              <button
                onClick={handleAddManually}
                disabled={isSaving}
                data-testid="add-manually-btn"
                className="flex items-center gap-1.5 px-3 h-8 rounded text-xs uppercase tracking-wider shrink-0 transition-all"
                style={{
                  background: 'rgba(74,222,128,0.08)',
                  color: 'rgba(74,222,128,0.7)',
                  boxShadow: '0 0 0 1px rgba(74,222,128,0.2)',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(74,222,128,0.14)'
                  e.currentTarget.style.color = '#4ade80'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(74,222,128,0.08)'
                  e.currentTarget.style.color = 'rgba(74,222,128,0.7)'
                }}
              >
                <Plus size={11} />
                Add
              </button>
            </div>
            {manualPathError && (
              <p
                className="text-[11px]"
                data-testid="manual-path-error"
                style={{
                  color: '#f87171',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                {manualPathError}
              </p>
            )}
          </div>
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

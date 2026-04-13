import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ChevronDown,
  FolderOpen,
  Trash2,
  MoreHorizontal,
  Plus,
  Monitor,
  Loader2,
  Server,
} from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { useProjectStore } from '@renderer/stores/project.store'
import { Button } from '@renderer/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@renderer/components/ui/popover'
import { toast } from 'sonner'
import { ProjectSetupDialog } from '@renderer/components/ProjectSetupDialog'
import { OpenRemoteProjectDialog } from './OpenRemoteProjectDialog'
import {
  useListRecentProjects,
  useOpenProjectByPath,
  useRemoveProject,
  useOpenProjectDialog,
} from '@renderer/hooks/useProjectCommands'
import {
  useOpenRemoteProject,
  useRemoteConnectionStatus,
} from '@renderer/hooks/useRemoteProjectSwitcher'
import { commands } from '@renderer/lib/rspc'
import type { RemoteProjectProfile, SshConnectionProfile } from '@renderer/lib/rspc'

// ─── Connection Status Badge ──────────────────────────────────────────────────

interface ConnectionBadgeProps {
  connectionId: string
  pollingEnabled: boolean
}

function ConnectionBadge({ connectionId, pollingEnabled }: ConnectionBadgeProps) {
  const { data, isPending } = useRemoteConnectionStatus(connectionId, pollingEnabled)

  if (isPending) {
    return (
      <span
        data-testid={`connection-badge-${connectionId}`}
        className="inline-flex items-center gap-1 text-[10px] font-mono text-muted-foreground/60"
      >
        <Loader2 className="h-2.5 w-2.5 animate-spin" />
        Connecting
      </span>
    )
  }

  if (data?.is_active) {
    return (
      <span
        data-testid={`connection-badge-${connectionId}`}
        className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-500"
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        Connected
      </span>
    )
  }

  return (
    <span
      data-testid={`connection-badge-${connectionId}`}
      className="inline-flex items-center gap-1 text-[10px] font-mono text-muted-foreground/50"
    >
      <span className="h-2 w-2 rounded-full border border-muted-foreground/30 bg-muted-foreground/10" />
      Disconnected
    </span>
  )
}

// ─── Remote Project Row ───────────────────────────────────────────────────────

interface RemoteProjectRowProps {
  project: RemoteProjectProfile
  sshLabel: string | undefined
  isCurrent: boolean
  popoverOpen: boolean
  onSwitch: () => void
  isPending: boolean
}

function RemoteProjectRow({
  project,
  sshLabel,
  isCurrent,
  popoverOpen,
  onSwitch,
  isPending,
}: RemoteProjectRowProps) {
  return (
    <div
      data-testid={`remote-project-${project.id}`}
      className={cn(
        'group flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors',
        'hover:bg-accent/60 hover:text-accent-foreground',
        isCurrent && 'bg-accent/30 ring-1 ring-inset ring-border/50'
      )}
    >
      <button
        onClick={onSwitch}
        className="flex flex-1 items-center gap-2 text-left"
        disabled={isPending || isCurrent}
      >
        <Monitor
          className={cn('h-4 w-4 shrink-0', isCurrent ? 'text-primary/70' : 'text-muted-foreground/60')}
        />
        <div className="flex-1 overflow-hidden">
          <div className="truncate text-sm font-medium">{project.name}</div>
          <div className="truncate text-[10px] font-mono text-muted-foreground/50">{project.path}</div>
          {sshLabel && (
            <div className="truncate text-[10px] font-mono text-blue-500/70">{sshLabel}</div>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          {isCurrent && (
            <span className="text-[10px] text-muted-foreground/60">(current)</span>
          )}
          <ConnectionBadge connectionId={project.connection_id} pollingEnabled={popoverOpen} />
        </div>
      </button>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ProjectSwitcher() {
  const [open, setOpen] = useState(false)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isRemoteDialogOpen, setIsRemoteDialogOpen] = useState(false)

  const projectName = useProjectStore((state) => state.projectName)
  const projectPath = useProjectStore((state) => state.projectPath)
  const remoteProjectId = useProjectStore((state) => state.remoteProjectId)
  const setProject = useProjectStore((state) => state.setProject)

  // All recent projects (local + remote-linked)
  const { data: allRecentProjects, isLoading: isLoadingLocal } = useListRecentProjects(10, open)

  // Filter: LOCAL section only shows projects without a remote_project_id
  const recentProjects = allRecentProjects?.filter((p) => !p.remote_project_id)

  // Remote project profiles (the saved SSH remote project records)
  const { data: remoteProjects, isLoading: isLoadingRemote } = useQuery({
    queryKey: ['remoteProjects'],
    queryFn: async () => {
      const result = await commands.listRemoteProjects()
      if (result.status === 'error') throw new Error(JSON.stringify(result.error))
      return result.data
    },
    enabled: open,
  })

  // SSH connections — needed to build the "user@host" label for each remote project
  const { data: sshConnections } = useQuery({
    queryKey: ['sshConnections'],
    queryFn: async () => {
      const result = await commands.listSshConnections()
      if (result.status === 'error') return [] as SshConnectionProfile[]
      return result.data
    },
    enabled: open,
  })

  // Build lookup: connection_id → "user@host" (include port only if non-22)
  const sshLabelByConnectionId = new Map<string, string>()
  if (sshConnections) {
    for (const conn of sshConnections) {
      const label =
        conn.port === 22
          ? `${conn.username}@${conn.host}`
          : `${conn.username}@${conn.host}:${conn.port}`
      sshLabelByConnectionId.set(conn.id, label)
    }
  }

  const openProjectMutation = useOpenProjectByPath()
  const removeProjectMutation = useRemoveProject()
  const openDialogMutation = useOpenProjectDialog()
  const openRemoteProjectMutation = useOpenRemoteProject()

  const handleOpenAnotherProject = () => {
    openDialogMutation.mutate(undefined, {
      onSuccess: (result) => {
        if (result) {
          setProject(result.id, result.path, result.name)
          setOpen(false)
          toast.success(`Opened ${result.name}`)
        }
      },
      onError: (err) => {
        toast.error(`Failed to open project: ${err.message}`)
      },
    })
  }

  const handleSwitchProject = (path: string) => {
    if (path === projectPath) {
      setOpen(false)
      return
    }

    openProjectMutation.mutate(path, {
      onSuccess: (result) => {
        setProject(result.id, result.path, result.name)
        setOpen(false)
        toast.success(`Opened ${result.name}`)
      },
      onError: (err) => {
        toast.error(`Failed to open project: ${err.message}`)
      },
    })
  }

  const handleRemoveProject = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    removeProjectMutation.mutate(id, {
      onSuccess: () => {
        toast.success('Project removed from recent list')
      },
      onError: (err) => {
        toast.error(`Failed to remove project: ${err.message}`)
      },
    })
    setMenuOpenId(null)
  }

  const handleSwitchRemoteProject = (project: RemoteProjectProfile) => {
    openRemoteProjectMutation.mutate(
      { remoteProjectId: project.id, connectionId: project.connection_id },
      { onSuccess: () => setOpen(false) }
    )
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            className="flex items-center gap-1 px-2 h-auto py-1"
            data-testid="project-switcher-trigger"
          >
            <span className="font-medium text-muted-foreground">{projectName || 'No Project'}</span>
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-80 p-2" align="start">
          {/* ── LOCAL PROJECTS ── */}
          <div className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Local Projects
          </div>

          {isLoadingLocal ? (
            <div className="px-2 py-4 text-sm text-muted-foreground">Loading...</div>
          ) : !recentProjects?.length ? (
            <div className="px-2 py-4 text-sm text-muted-foreground">No recent projects</div>
          ) : (
            <div className="flex flex-col gap-1">
              {recentProjects.map((project) => {
                const isCurrent = project.path === projectPath && !remoteProjectId

                return (
                  <div
                    key={project.id}
                    className={cn(
                      'group flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors',
                      'hover:bg-accent hover:text-accent-foreground',
                      isCurrent && 'bg-accent/50'
                    )}
                  >
                    <button
                      onClick={() => handleSwitchProject(project.path)}
                      className="flex flex-1 items-center gap-2 text-left"
                      disabled={openProjectMutation.isPending || isCurrent}
                    >
                      <FolderOpen className="h-4 w-4 shrink-0" />
                      <div className="flex-1 overflow-hidden">
                        <div className="truncate text-sm font-medium">{project.name}</div>
                        <div className="truncate text-xs text-muted-foreground">{project.path}</div>
                      </div>
                      {isCurrent && (
                        <span className="text-xs text-muted-foreground shrink-0">(current)</span>
                      )}
                    </button>

                    {/* Actions menu */}
                    <Popover
                      open={menuOpenId === project.id}
                      onOpenChange={(isOpen) => setMenuOpenId(isOpen ? project.id : null)}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-32 p-1" align="end">
                        <button
                          onClick={(e) => handleRemoveProject(e, project.id)}
                          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-3 w-3" />
                          Remove
                        </button>
                      </PopoverContent>
                    </Popover>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── REMOTE PROJECTS ── */}
          <div
            data-testid="project-switcher-remote-section"
            className="mt-3 border-t border-border/50 pt-3"
          >
            <div className="mb-2 flex items-center gap-1.5 px-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Remote Projects
              </span>
              <span className="text-[10px] text-muted-foreground/40 font-mono">◈</span>
            </div>

            {isLoadingRemote ? (
              <div className="px-2 py-3 text-sm text-muted-foreground">Loading...</div>
            ) : !remoteProjects?.length ? (
              <div className="px-2 py-3 text-xs text-muted-foreground/60 font-mono">
                No remote projects
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {remoteProjects.map((project) => (
                  <RemoteProjectRow
                    key={project.id}
                    project={project}
                    sshLabel={sshLabelByConnectionId.get(project.connection_id)}
                    isCurrent={project.id === remoteProjectId}
                    popoverOpen={open}
                    onSwitch={() => handleSwitchRemoteProject(project)}
                    isPending={openRemoteProjectMutation.isPending}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── ACTIONS ── */}
          <div className="mt-2 border-t pt-2 flex flex-col gap-1">
            <button
              onClick={() => {
                setIsCreateDialogOpen(true)
                setOpen(false)
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
            >
              <Plus className="h-4 w-4" />
              Create New Project...
            </button>
            <button
              onClick={handleOpenAnotherProject}
              disabled={openDialogMutation.isPending}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent disabled:opacity-50"
            >
              <FolderOpen className="h-4 w-4" />
              {openDialogMutation.isPending ? 'Opening...' : 'Open Another Project...'}
            </button>
            <button
              onClick={() => {
                setIsRemoteDialogOpen(true)
                setOpen(false)
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
            >
              <Server className="h-4 w-4" />
              Open Remote Project...
            </button>
          </div>
        </PopoverContent>
      </Popover>

      <ProjectSetupDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onProjectCreated={({ path, projectId, projectName: name }) => {
          setProject(projectId, path, name)
          toast.success(`Created ${name}`)
        }}
        mode="create"
      />

      <OpenRemoteProjectDialog
        open={isRemoteDialogOpen}
        onOpenChange={setIsRemoteDialogOpen}
      />
    </>
  )
}

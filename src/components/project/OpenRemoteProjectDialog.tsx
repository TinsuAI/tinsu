import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { DiscoverProjectsDialog } from '@renderer/components/settings/RemoteProjectsPanel'
import { ConnectionDialog } from '@renderer/components/settings/SshConnectionsPanel'
import { commands } from '@renderer/lib/rspc'
import type {
  SaveRemoteProjectInput,
  CreateSshConnectionInput,
  UpdateSshConnectionInput,
  SshConnectionProfile,
} from '@renderer/lib/rspc'
import { useOpenRemoteProject } from '@renderer/hooks/useRemoteProjectSwitcher'

interface OpenRemoteProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Self-contained dialog for opening a remote project.
 * Wraps DiscoverProjectsDialog with its own queries/mutations and
 * immediately switches to the project after saving.
 * Includes inline SSH connection creation/editing.
 */
export function OpenRemoteProjectDialog({ open, onOpenChange }: OpenRemoteProjectDialogProps) {
  const queryClient = useQueryClient()
  const openRemoteProject = useOpenRemoteProject()
  const [connectionDialogOpen, setConnectionDialogOpen] = useState(false)
  const [editingConnection, setEditingConnection] = useState<SshConnectionProfile | null>(null)

  const { data: connections = [] } = useQuery({
    queryKey: ['ssh_connections'],
    queryFn: async () => {
      const result = await commands.listSshConnections()
      if (result.status === 'error') throw new Error(JSON.stringify(result.error))
      return result.data
    },
    enabled: open,
  })

  const { data: sshKeys = [] } = useQuery({
    queryKey: ['ssh_keys'],
    queryFn: async () => {
      const result = await commands.listSshKeys()
      if (result.status === 'error') throw new Error(JSON.stringify(result.error))
      return result.data.map((k) => k.name)
    },
    enabled: connectionDialogOpen,
  })

  const connectionMutation = useMutation({
    mutationFn: async (input: CreateSshConnectionInput | UpdateSshConnectionInput) => {
      if (editingConnection) {
        const result = await commands.updateSshConnection(input as UpdateSshConnectionInput)
        if (result.status === 'error') throw new Error(JSON.stringify(result.error))
        return result.data
      } else {
        const result = await commands.createSshConnection(input as CreateSshConnectionInput)
        if (result.status === 'error') throw new Error(JSON.stringify(result.error))
        return result.data
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ssh_connections'] })
      toast.success(editingConnection ? 'Connection updated' : 'Connection saved')
      setConnectionDialogOpen(false)
      setEditingConnection(null)
    },
    onError: (err: Error) => {
      toast.error('Failed to save connection', { description: err.message })
    },
  })

  const saveMutation = useMutation({
    mutationFn: async (input: SaveRemoteProjectInput) => {
      const result = await commands.saveRemoteProject(input)
      if (result.status === 'error') throw new Error(JSON.stringify(result.error))
      return result.data
    },
    onSuccess: async (savedProject) => {
      queryClient.invalidateQueries({ queryKey: ['remote_projects'] })
      onOpenChange(false)
      openRemoteProject.mutate({
        remoteProjectId: savedProject.id,
        connectionId: savedProject.connection_id,
      })
    },
    onError: (err: Error) => {
      toast.error('Failed to save project', { description: err.message })
    },
  })

  const handleAddConnection = () => {
    setEditingConnection(null)
    setConnectionDialogOpen(true)
  }

  const handleEditConnection = (conn: SshConnectionProfile) => {
    setEditingConnection(conn)
    setConnectionDialogOpen(true)
  }

  return (
    <>
      <DiscoverProjectsDialog
        open={open}
        onOpenChange={onOpenChange}
        connections={connections}
        onSave={(input) => saveMutation.mutate(input)}
        isSaving={saveMutation.isPending || openRemoteProject.isPending}
        onAddConnection={handleAddConnection}
        onEditConnection={handleEditConnection}
      />

      <ConnectionDialog
        open={connectionDialogOpen}
        onClose={() => {
          setConnectionDialogOpen(false)
          setEditingConnection(null)
        }}
        onSave={(input) => connectionMutation.mutate(input)}
        availableKeys={sshKeys}
        initial={editingConnection}
        isSaving={connectionMutation.isPending}
        onKeyInstalled={() => {
          queryClient.invalidateQueries({ queryKey: ['ssh_keys'] })
        }}
      />
    </>
  )
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { commands } from '@renderer/lib/rspc'
import type {
  CreateSshConnectionInput,
  UpdateSshConnectionInput,
  TestSshConnectionInput,
  InstallSshKeyInput,
} from '@renderer/lib/rspc'
import { toast } from 'sonner'

export function useListSshKeys(enabled = true) {
  return useQuery({
    queryKey: ['ssh_keys'],
    queryFn: async () => {
      const result = await commands.listSshKeys()
      if (result.status === 'error') throw new Error(JSON.stringify(result.error))
      return result.data
    },
    enabled,
  })
}

export function useListSshConnections(enabled = true) {
  return useQuery({
    queryKey: ['ssh_connections'],
    queryFn: async () => {
      const result = await commands.listSshConnections()
      if (result.status === 'error') throw new Error(JSON.stringify(result.error))
      return result.data
    },
    enabled,
  })
}

export function useTestSshConnection() {
  return useMutation({
    mutationFn: async (input: TestSshConnectionInput) => {
      const result = await commands.testSshConnection(input)
      if (result.status === 'error') throw new Error(JSON.stringify(result.error))
      return result.data
    },
  })
}

export function useCreateSshConnection() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateSshConnectionInput) => {
      const result = await commands.createSshConnection(input)
      if (result.status === 'error') throw new Error(JSON.stringify(result.error))
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ssh_connections'] })
    },
  })
}

export function useUpdateSshConnection() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: UpdateSshConnectionInput) => {
      const result = await commands.updateSshConnection(input)
      if (result.status === 'error') throw new Error(JSON.stringify(result.error))
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ssh_connections'] })
    },
  })
}

export function useDeleteSshConnection() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const result = await commands.deleteSshConnection(id)
      if (result.status === 'error') throw new Error(JSON.stringify(result.error))
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ssh_connections'] })
    },
  })
}

export function useInstallSshKey() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: InstallSshKeyInput) => {
      const result = await commands.installSshKey(input)
      if (result.status === 'error') throw new Error(JSON.stringify(result.error))
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ssh_keys'] })
    },
  })
}

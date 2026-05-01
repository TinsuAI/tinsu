/**
 * MobileConnectionsListScreen — SSH connections list for the mobile settings tab.
 *
 * AC: 1, 3, 4, 5, 6, 22
 *
 * Cross-tree allowed:
 *   @renderer/hooks/useSshCommands — useListSshConnections (data only, mobile-safe)
 *   @renderer/lib/utils — cn (utility)
 *
 * Token discipline:
 *   - Status dots use UX-DR9 connection-state palette (emerald/amber/destructive)
 *   - All other surfaces use Calm Command tokens only
 *
 * v1 status strategy: per-row local Map updated ONLY when user explicitly tests via detail sheet.
 * No auto-test on mount — would spam network on cold-start with N connections.
 * Deferred background health-check to T3.5-9. See AC 6, Dev Notes.
 */

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useListSshConnections } from '@renderer/hooks/useSshCommands'
import { useMobileNavStore } from '../shell/mobile-nav.store'
import { MobileEmptyState } from '../primitives/MobileEmptyState'
import { MobileLoadingSkeleton } from '../primitives/MobileLoadingSkeleton'
import { MobileFab } from '../primitives/MobileFab'
import { MobileConnectionRow } from './MobileConnectionRow'
import { MobileConnectionDetailSheet } from './MobileConnectionDetailSheet'
import { MobileDeleteConfirmSheet } from './MobileDeleteConfirmSheet'
import type { SshConnectionProfile } from '@renderer/lib/rspc'

export type ConnectionStatus = 'idle' | 'testing' | 'connected' | 'error'

export function MobileConnectionsListScreen() {
  const queryClient = useQueryClient()
  const { data: connections = [], isLoading, error } = useListSshConnections()

  // Per-row local status map — updated ONLY on explicit user test (AC 6)
  const [statusMap, setStatusMap] = useState<Map<string, ConnectionStatus>>(new Map())

  // Track which row is currently swiped open
  const [swipedRowId, setSwipedRowId] = useState<string | null>(null)

  // Detail sheet state
  const [activeDetailConnectionId, setActiveDetailConnectionId] = useState<string | null>(null)

  // Delete confirm sheet state
  const [deleteCandidate, setDeleteCandidate] = useState<SshConnectionProfile | null>(null)

  const activeDetailConnection = connections.find((c) => c.id === activeDetailConnectionId) ?? null

  const handleTestStatusChange = (id: string, status: ConnectionStatus) => {
    setStatusMap((prev) => new Map(prev).set(id, status))
  }

  const handleRetry = () => {
    void queryClient.invalidateQueries({ queryKey: ['ssh_connections'] })
  }

  // Loading state — 4× list-row skeleton stacked
  if (isLoading) {
    return (
      <div data-testid="mobile-connections-screen" className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto">
          <MobileLoadingSkeleton variant="list-row" count={4} />
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return (
      <div data-testid="mobile-connections-screen" className="flex flex-col h-full">
        <MobileEmptyState
          title="Couldn't load connections"
          subtitle={msg}
          action={
            <button
              type="button"
              onClick={handleRetry}
              aria-label="Retry loading connections"
              className="min-h-[2.75rem] px-6 rounded-xl bg-primary text-primary-foreground text-sm font-medium"
            >
              Retry
            </button>
          }
        />
      </div>
    )
  }

  // Empty state — FAB hidden; CTA button is the primary action (AC 4)
  if (connections.length === 0) {
    return (
      <div data-testid="mobile-connections-screen" className="flex flex-col h-full">
        <MobileEmptyState
          title="No connections yet"
          subtitle="Add an SSH connection to start working on remote projects."
          action={
            <button
              type="button"
              data-testid="mobile-connections-empty-cta"
              aria-label="Add SSH connection"
              onClick={() => useMobileNavStore.getState().pushRoute('settings', 'connection-form:new')}
              className="min-h-[2.75rem] px-6 rounded-xl bg-primary text-primary-foreground text-sm font-medium"
            >
              Add Connection
            </button>
          }
        />
      </div>
    )
  }

  // Sort newest first by created_at descending (AC 5)
  const sorted = [...connections].sort((a, b) => b.created_at - a.created_at)

  return (
    <div data-testid="mobile-connections-screen" className="flex flex-col h-full relative">
      {/* Connection list — clicking outside a swiped row collapses it */}
      <div
        className="flex-1 overflow-y-auto"
        onClick={() => setSwipedRowId(null)}
      >
        <div role="list" aria-label="SSH connections">
          {sorted.map((connection) => (
            <MobileConnectionRow
              key={connection.id}
              connection={connection}
              status={statusMap.get(connection.id) ?? 'idle'}
              isSwiped={swipedRowId === connection.id}
              onSwipeChange={setSwipedRowId}
              onPress={() => setActiveDetailConnectionId(connection.id)}
              onEdit={() => {
                setSwipedRowId(null)
                useMobileNavStore.getState().pushRoute('settings', `connection-form:${connection.id}`)
              }}
              onDelete={() => {
                setSwipedRowId(null)
                setDeleteCandidate(connection)
              }}
            />
          ))}
        </div>
      </div>

      {/* FAB — only when data is present (AC 4: hide when empty, CTA owns primary action) */}
      <MobileFab
        icon={<Plus className="h-6 w-6" />}
        ariaLabel="Add connection"
        data-testid="mobile-connections-fab"
        onPress={() => useMobileNavStore.getState().pushRoute('settings', 'connection-form:new')}
      />

      {/* Connection detail sheet */}
      <MobileConnectionDetailSheet
        open={activeDetailConnectionId !== null}
        connection={activeDetailConnection}
        onOpenChange={(open) => {
          if (!open) setActiveDetailConnectionId(null)
        }}
        onEdit={() => {
          if (activeDetailConnectionId) {
            setActiveDetailConnectionId(null)
            useMobileNavStore.getState().pushRoute('settings', `connection-form:${activeDetailConnectionId}`)
          }
        }}
        onDelete={() => {
          if (activeDetailConnection) {
            setDeleteCandidate(activeDetailConnection)
            setActiveDetailConnectionId(null)
          }
        }}
        onTestStatusChange={handleTestStatusChange}
      />

      {/* Delete confirm sheet */}
      <MobileDeleteConfirmSheet
        open={deleteCandidate !== null}
        connection={deleteCandidate}
        onOpenChange={(open) => {
          if (!open) setDeleteCandidate(null)
        }}
        onConfirmed={() => {
          setDeleteCandidate(null)
          setActiveDetailConnectionId(null)
        }}
      />
    </div>
  )
}

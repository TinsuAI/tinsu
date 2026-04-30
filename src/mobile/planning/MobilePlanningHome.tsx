/**
 * MobilePlanningHome — session list root for the Planning tab.
 *
 * This IS the planning tab root (route 'sessions'). No separate
 * MobileSessionListScreen.tsx — session list IS planning home in v1.
 *
 * Features:
 *   - Reads projectId from useProjectStore
 *   - Queries sessions via listChatSessionsWithPreview (refetchInterval: 2000)
 *   - Sorts: 'thinking' first, then by last_message_at desc
 *   - Renders MobileSessionRow list + MobileFab (new chat)
 *   - Empty/loading/error states
 *   - MobileNewSessionSheet for persona selection
 *
 * Cross-tree imports (allowed per AC 17):
 *   - commands from @renderer/lib/rspc
 *   - useProjectStore from @renderer/stores/project.store
 *   - AGENT_PERSONA_CONFIG from @renderer/constants/planning-workspace
 *
 * Story T3.5-5 — Mobile Planning (AC 1, 2, 3, 4, 5, Task 1)
 */

import { useState } from 'react'
import { Compass, Plus } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { commands } from '@renderer/lib/rspc'
import { useProjectStore } from '@renderer/stores/project.store'
import { useMobileNavStore } from '../shell/mobile-nav.store'
import { MobileTopAppBar } from '../primitives/MobileTopAppBar'
import { MobileFab } from '../primitives/MobileFab'
import { MobileEmptyState } from '../primitives/MobileEmptyState'
import { MobileLoadingSkeleton } from '../primitives/MobileLoadingSkeleton'
import { MobileSessionRow, type ChatSessionListItemPreview } from './MobileSessionRow'
import { MobileNewSessionSheet } from './MobileNewSessionSheet'

/* ─── Helpers ───────────────────────────────────────────────────────── */

function sortSessions(sessions: ChatSessionListItemPreview[]): ChatSessionListItemPreview[] {
  return [...sessions].sort((a, b) => {
    const aPriority = a.live_status === 'thinking' ? 0 : 1
    const bPriority = b.live_status === 'thinking' ? 0 : 1
    if (aPriority !== bPriority) return aPriority - bPriority
    return (
      new Date(b.last_message_at ?? 0).getTime() -
      new Date(a.last_message_at ?? 0).getTime()
    )
  })
}

/* ─── Component ─────────────────────────────────────────────────────── */

export function MobilePlanningHome() {
  const projectId = useProjectStore((s) => s.projectId)
  const [newSessionSheetOpen, setNewSessionSheetOpen] = useState(false)

  /* ── Data ──────────────────────────────────────────────────────────── */
  const { data, isLoading, error } = useQuery({
    queryKey: ['chat-sessions-preview', projectId],
    queryFn: async () => {
      const r = await commands.listChatSessionsWithPreview(projectId as string)
      if (r.status === 'error') throw new Error(JSON.stringify(r.error))
      return r.data as ChatSessionListItemPreview[]
    },
    refetchInterval: 2000,
    enabled: !!projectId,
  })

  /* ── Navigation ────────────────────────────────────────────────────── */
  const pushRoute = useMobileNavStore((s) => s.pushRoute)

  const handleSessionTap = (sessionId: string) => {
    pushRoute('planning', `chat:${sessionId}`)
  }

  const handleSessionCreated = (sessionId: string) => {
    pushRoute('planning', `chat:${sessionId}`)
  }

  /* ── Render ────────────────────────────────────────────────────────── */

  const renderContent = () => {
    // No project selected
    if (!projectId) {
      return (
        <MobileEmptyState
          icon={<Compass className="h-10 w-10" />}
          title="No project selected"
          subtitle="Open a project to view planning sessions."
        />
      )
    }

    // Loading
    if (isLoading) {
      return (
        <div className="px-0 py-2">
          <MobileLoadingSkeleton variant="list-row" count={3} />
        </div>
      )
    }

    // Error
    if (error) {
      return (
        <MobileEmptyState
          title="Couldn't load sessions"
          subtitle={error instanceof Error ? error.message : 'Unknown error'}
        />
      )
    }

    const sessions = sortSessions(data ?? [])

    // Empty state
    if (sessions.length === 0) {
      return (
        <MobileEmptyState
          icon={<Compass className="h-10 w-10" />}
          title="No chat sessions yet"
          subtitle="Tap the + button to start a planning conversation."
        />
      )
    }

    // Session list
    return (
      <div
        role="list"
        data-testid="mobile-planning-session-list"
      >
        {sessions.map((session) => (
          <MobileSessionRow
            key={session.id}
            session={session}
            onTap={() => handleSessionTap(session.id)}
          />
        ))}
      </div>
    )
  }

  return (
    <div
      className="flex flex-col h-full bg-background"
      data-testid="mobile-planning-home"
    >
      <MobileTopAppBar title="Planning" />

      <div className="flex-1 overflow-y-auto overscroll-contain">
        {renderContent()}
      </div>

      {/* FAB — only shown when project is selected */}
      {projectId && (
        <MobileFab
          icon={<Plus className="h-6 w-6" />}
          ariaLabel="New chat session"
          onPress={() => setNewSessionSheetOpen(true)}
        />
      )}

      {/* New session sheet */}
      {projectId && (
        <MobileNewSessionSheet
          open={newSessionSheetOpen}
          onOpenChange={setNewSessionSheetOpen}
          projectId={projectId}
          onSessionCreated={handleSessionCreated}
        />
      )}
    </div>
  )
}

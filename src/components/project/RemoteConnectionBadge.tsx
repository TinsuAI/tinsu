/**
 * RemoteConnectionBadge — persistent SSH connection status indicator.
 *
 * Visible whenever a remote project is active. Shows live status (connected /
 * connecting / disconnected) polled every 5 s via the hook-forwarder health API.
 * Clicking "Disconnected" triggers an immediate reconnect attempt.
 */

import { Loader2, Server } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { useProjectStore } from '@renderer/stores/project.store'
import {
  useRemoteConnectionStatus,
  useReconnectRemoteProject,
} from '@renderer/hooks/useRemoteProjectSwitcher'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@renderer/components/ui/tooltip'

interface RemoteConnectionBadgeProps {
  className?: string
}

export function RemoteConnectionBadge({ className }: RemoteConnectionBadgeProps) {
  const remoteProjectId = useProjectStore((s) => s.remoteProjectId)
  const remoteConnectionId = useProjectStore((s) => s.remoteConnectionId)
  const projectPath = useProjectStore((s) => s.projectPath)

  const { data: hookStatus, isPending } = useRemoteConnectionStatus(
    remoteConnectionId,
    !!remoteProjectId
  )
  const reconnect = useReconnectRemoteProject()

  // Only render for remote projects
  if (!remoteProjectId || !remoteConnectionId) return null

  const isConnected = hookStatus?.is_active === true
  const isLoading = isPending || reconnect.isPending

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => {
              if (!isConnected && !isLoading) reconnect.mutate()
            }}
            disabled={isConnected || isLoading}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors',
              isConnected
                ? 'cursor-default text-emerald-500'
                : isLoading
                  ? 'cursor-default text-muted-foreground'
                  : 'cursor-pointer text-muted-foreground hover:bg-accent hover:text-foreground',
              className
            )}
            data-testid="remote-connection-badge"
          >
            <Server className="h-3 w-3 shrink-0" />

            {isLoading ? (
              <>
                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                <span>Connecting</span>
              </>
            ) : isConnected ? (
              <>
                {/* Pulsing green dot */}
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                <span>Connected</span>
              </>
            ) : (
              <>
                {/* Static gray dot */}
                <span className="h-2 w-2 shrink-0 rounded-full border border-muted-foreground/40 bg-muted" />
                <span>Disconnected · click to reconnect</span>
              </>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs text-xs">
          <p className="font-medium">{projectPath}</p>
          {hookStatus?.remote_port && (
            <p className="text-muted-foreground">Port {hookStatus.remote_port}</p>
          )}
          {!isConnected && !isLoading && (
            <p className="text-muted-foreground">SSH tunnel is down — click to reconnect</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

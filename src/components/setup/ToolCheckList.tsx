/**
 * ToolCheckList
 *
 * Displays a vertical list of tool verification results with status icons,
 * version info, install hints, and optional install action buttons.
 */

import React from 'react'
import { CheckCircle2, XCircle, Loader2, AlertTriangle, Lock } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import type { ToolCheckResult } from '@shared/types/tool-verification.types'

function StatusIcon({ status }: { status: ToolCheckResult['status'] }): React.JSX.Element {
  if (status === 'installed') {
    return <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
  }
  if (status === 'error') {
    return <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
  }
  return <XCircle className="h-4 w-4 shrink-0 text-destructive" />
}

export interface ToolCheckListProps {
  results: ToolCheckResult[]
  isChecking: boolean
  onInstallAction?: (toolId: string) => void
}

export function ToolCheckList({
  results,
  isChecking,
  onInstallAction
}: ToolCheckListProps): React.JSX.Element {
  return (
    <div className="space-y-2" data-testid="tool-check-list">
      {results.map((result) => (
        <div
          key={result.id}
          className="flex items-center gap-3 rounded-md border border-input px-3 py-2.5 text-sm"
          data-testid={`tool-check-${result.id}`}
        >
          {/* Status icon or spinner */}
          {isChecking ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
          ) : (
            <StatusIcon status={result.status} />
          )}

          {/* Tool name + lock icon + version */}
          <div className="flex flex-1 items-center gap-1.5 min-w-0">
            <span className="font-medium">{result.name}</span>
            {result.critical && (
              <Lock className="h-3 w-3 shrink-0 text-muted-foreground" aria-label="Required" />
            )}
            {result.status === 'installed' && result.version && (
              <span className="text-xs text-muted-foreground">v{result.version}</span>
            )}
            {result.status !== 'installed' && result.installHint && (
              <span className="truncate text-xs text-muted-foreground">{result.installHint}</span>
            )}
          </div>

          {/* Install button (not shown for bmad — it has its own form) */}
          {result.status !== 'installed' && result.id !== 'bmad' && onInstallAction && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onInstallAction(result.id)}
              disabled={isChecking}
              data-testid={`install-${result.id}`}
            >
              Install
            </Button>
          )}
        </div>
      ))}
    </div>
  )
}

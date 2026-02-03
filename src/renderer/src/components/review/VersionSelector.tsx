/**
 * VersionSelector Component - Story 7.7
 *
 * Provides version history dropdown with status badges and comparison functionality
 * for reviewing different iterations of task review submissions.
 *
 * @see Story 7.7: Review History & Comparison
 * AC 1: Version selector showing "v1, v2, v3..." with comparison capability
 * AC 2: Compare any two versions to see changes between iterations
 */

import * as React from 'react'
import { cn } from '@renderer/lib/utils'
import { trpc } from '@renderer/lib/trpc'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { GitCompare, History, CheckCircle2, XCircle, MessageSquareWarning, Clock } from 'lucide-react'
import type { VersionStatusOutcome } from '@shared/types/task.types'

export interface VersionSelectorProps {
  /** Task ID to fetch versions for */
  taskId: string
  /** Task status (to determine appropriate empty state message) */
  taskStatus?: string
  /** Currently selected version number */
  selectedVersion: number | null
  /** Version number being compared against (null if not comparing) */
  compareVersion: number | null
  /** Callback when primary version selection changes */
  onVersionSelect: (version: number) => void
  /** Callback when comparison version selection changes (null to disable compare) */
  onCompareSelect: (version: number | null) => void
  /** Optional className for styling */
  className?: string
}

/**
 * Maps status outcome to display configuration.
 *
 * Note: 'current' is a UI-only status (not stored in database).
 * It's applied client-side when version_number === latestVersionNumber
 * to highlight the most recent version in the dropdown.
 */
const STATUS_CONFIG: Record<
  VersionStatusOutcome | 'current',
  { label: string; icon: React.ElementType; className: string }
> = {
  pending: {
    label: 'Pending',
    icon: Clock,
    className:
      'bg-gradient-to-r from-slate-500/25 to-slate-600/15 text-slate-300 border-slate-500/40'
  },
  rejected: {
    label: 'Rejected',
    icon: XCircle,
    className: 'bg-gradient-to-r from-red-500/25 to-red-600/15 text-red-300 border-red-500/40'
  },
  changes_requested: {
    label: 'Changes',
    icon: MessageSquareWarning,
    className:
      'bg-gradient-to-r from-amber-500/25 to-amber-600/15 text-amber-300 border-amber-500/40'
  },
  approved: {
    label: 'Approved',
    icon: CheckCircle2,
    className:
      'bg-gradient-to-r from-emerald-500/25 to-emerald-600/15 text-emerald-300 border-emerald-500/40'
  },
  current: {
    label: 'Current',
    icon: History,
    className:
      'bg-gradient-to-r from-violet-500/25 to-violet-600/15 text-violet-300 border-violet-500/40'
  }
}

/** Status badge component for version items */
function StatusBadge({
  status,
  isCurrent,
  size = 'default'
}: {
  status: VersionStatusOutcome
  isCurrent: boolean
  size?: 'default' | 'sm'
}) {
  const config = isCurrent ? STATUS_CONFIG.current : STATUS_CONFIG[status]
  const Icon = config.icon

  const sizeClasses = size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border font-medium transition-all',
        sizeClasses,
        config.className
      )}
    >
      <Icon className={size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
      {config.label}
    </span>
  )
}

/**
 * VersionSelector displays version history with status indicators
 * and enables comparison between different review iterations.
 */
export function VersionSelector({
  taskId,
  taskStatus,
  selectedVersion,
  compareVersion,
  onVersionSelect,
  onCompareSelect,
  className
}: VersionSelectorProps): React.JSX.Element {
  // Fetch version history for the task
  const { data: versions, isLoading, error } = trpc.tasks.getTaskVersions.useQuery(
    { taskId },
    { enabled: !!taskId }
  )

  // Show error state if query failed
  if (error) {
    return (
      <div className={cn('flex items-center gap-2 text-sm text-red-400', className)}>
        <XCircle className="h-4 w-4" />
        <span>Failed to load versions</span>
      </div>
    )
  }

  // If loading or no versions, show minimal state
  if (isLoading) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <div className="h-9 w-24 animate-pulse rounded-md bg-secondary/50" />
      </div>
    )
  }

  // No versions yet - determine appropriate message based on task status
  if (!versions || versions.length === 0) {
    const isInReview = taskStatus === 'review'
    return (
      <div className={cn('flex items-center gap-2 text-sm text-muted-foreground', className)}>
        <History className="h-4 w-4" />
        <span>{isInReview ? 'First review' : 'Not yet in review'}</span>
      </div>
    )
  }

  // Find highest version number (current version in review)
  const latestVersionNumber = Math.max(...versions.map((v) => v.version_number))

  // Get version by number helper
  const getVersion = (num: number) => versions.find((v) => v.version_number === num)

  // Default to latest version if none selected
  const effectiveSelected = selectedVersion ?? latestVersionNumber

  return (
    <div className={cn('flex items-center gap-3', className)}>
      {/* Primary Version Selector */}
      <div className="flex items-center gap-2">
        <History className="h-4 w-4 text-muted-foreground" />

        <Select
          value={String(effectiveSelected)}
          onValueChange={(val) => onVersionSelect(Number(val))}
        >
          <SelectTrigger
            className={cn(
              'h-9 w-auto min-w-[120px] gap-2 border-secondary bg-secondary/30',
              'hover:bg-secondary/50 transition-colors'
            )}
          >
            <SelectValue placeholder="Select version">
              <span className="flex items-center gap-2">
                <span className="font-mono font-semibold text-violet-400">
                  v{effectiveSelected}
                </span>
                {getVersion(effectiveSelected) && (
                  <StatusBadge
                    status={getVersion(effectiveSelected)!.status_outcome as VersionStatusOutcome}
                    isCurrent={effectiveSelected === latestVersionNumber}
                    size="sm"
                  />
                )}
              </span>
            </SelectValue>
          </SelectTrigger>

          <SelectContent className="min-w-[200px]">
            {versions.map((version) => {
              const isCurrent = version.version_number === latestVersionNumber

              return (
                <SelectItem
                  key={version.id}
                  value={String(version.version_number)}
                  className="py-2"
                >
                  <div className="flex w-full items-center justify-between gap-3">
                    <span className="font-mono font-semibold text-foreground">
                      v{version.version_number}
                    </span>
                    <StatusBadge
                      status={version.status_outcome as VersionStatusOutcome}
                      isCurrent={isCurrent}
                    />
                  </div>
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
      </div>

      {/* Comparison Selector - Only show if multiple versions exist */}
      {versions.length > 1 && (
        <>
          <div className="flex items-center gap-2 text-muted-foreground">
            <GitCompare className="h-4 w-4" />
            <span className="text-xs">vs</span>
          </div>

          <Select
            value={compareVersion ? String(compareVersion) : 'none'}
            onValueChange={(val) => onCompareSelect(val === 'none' ? null : Number(val))}
          >
            <SelectTrigger
              className={cn(
                'h-9 w-auto min-w-[120px] gap-2 border-secondary',
                compareVersion ? 'bg-cyan-500/10 border-cyan-500/30' : 'bg-secondary/30',
                'hover:bg-secondary/50 transition-colors'
              )}
            >
              <SelectValue placeholder="Compare with...">
                {compareVersion ? (
                  <span className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-cyan-400">v{compareVersion}</span>
                    {getVersion(compareVersion) && (
                      <StatusBadge
                        status={getVersion(compareVersion)!.status_outcome as VersionStatusOutcome}
                        isCurrent={compareVersion === latestVersionNumber}
                        size="sm"
                      />
                    )}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Compare...</span>
                )}
              </SelectValue>
            </SelectTrigger>

            <SelectContent className="min-w-[200px]">
              {/* Option to disable comparison */}
              <SelectItem value="none" className="py-2 text-muted-foreground">
                <span className="italic">No comparison</span>
              </SelectItem>

              {/* Version options (excluding currently selected) */}
              {versions
                .filter((v) => v.version_number !== effectiveSelected)
                .map((version) => {
                  const isCurrent = version.version_number === latestVersionNumber

                  return (
                    <SelectItem
                      key={version.id}
                      value={String(version.version_number)}
                      className="py-2"
                    >
                      <div className="flex w-full items-center justify-between gap-3">
                        <span className="font-mono font-semibold text-foreground">
                          v{version.version_number}
                        </span>
                        <StatusBadge
                          status={version.status_outcome as VersionStatusOutcome}
                          isCurrent={isCurrent}
                        />
                      </div>
                    </SelectItem>
                  )
                })}
            </SelectContent>
          </Select>
        </>
      )}

      {/* Comparison indicator when actively comparing */}
      {compareVersion && (
        <span className="rounded-md bg-cyan-500/10 px-2 py-1 text-xs text-cyan-300 border border-cyan-500/20">
          Showing diff: v{Math.min(effectiveSelected, compareVersion)} → v
          {Math.max(effectiveSelected, compareVersion)}
        </span>
      )}
    </div>
  )
}

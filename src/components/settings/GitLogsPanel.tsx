/**
 * Git Logs Panel - Story 8.10
 *
 * Settings panel for viewing git operation logs.
 * Displays logs by date with log statistics.
 *
 * @see Story 8.10: Task 8.1, 8.2, 8.3, 8.4, 8.5
 */

import { useState } from 'react'
import { FileText, Trash2, ChevronDown, ChevronRight, AlertCircle, CheckCircle2, Clock } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { trpc } from '@renderer/lib/trpc'

/**
 * Log entry from the git log service.
 */
interface GitLogEntry {
  timestamp: string
  operationType: string
  taskId?: string
  status: 'started' | 'succeeded' | 'failed'
  command?: string
  exitCode?: number
  durationMs?: number
  error?: string
  details?: Record<string, unknown>
}

/**
 * Gets a human-readable operation label.
 */
function getOperationLabel(operationType: string): string {
  const labels: Record<string, string> = {
    createWorktree: 'Create Worktree',
    removeWorktree: 'Remove Worktree',
    merge: 'Merge Branch',
    detectConflicts: 'Detect Conflicts',
    stageFile: 'Stage File',
    completeMerge: 'Complete Merge',
    autoCommit: 'Auto Commit',
    checkGit: 'Check Git'
  }
  return labels[operationType] || operationType
}

/**
 * Gets the status icon for a log entry.
 */
function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'succeeded':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />
    case 'failed':
      return <AlertCircle className="h-4 w-4 text-red-500" />
    case 'started':
      return <Clock className="h-4 w-4 text-blue-500" />
    default:
      return <Clock className="h-4 w-4 text-muted-foreground" />
  }
}

/**
 * Formats a timestamp for display.
 */
function formatTime(timestamp: string): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString()
}

/**
 * Formats duration in milliseconds to human-readable string.
 */
function formatDuration(durationMs: number): string {
  if (durationMs < 1000) {
    return `${durationMs}ms`
  }
  return `${(durationMs / 1000).toFixed(1)}s`
}

/**
 * Single log entry component.
 */
function LogEntryItem({ entry }: { entry: GitLogEntry }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border rounded-md p-2 text-sm">
      <div
        className="flex items-center gap-2 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        <StatusIcon status={entry.status} />
        <span className="font-medium">{getOperationLabel(entry.operationType)}</span>
        <span className="text-muted-foreground">{formatTime(entry.timestamp)}</span>
        {entry.durationMs && (
          <span className="text-xs text-muted-foreground">
            ({formatDuration(entry.durationMs)})
          </span>
        )}
      </div>

      {expanded && (
        <div className="ml-6 mt-2 space-y-1 text-xs">
          {entry.taskId && (
            <div>
              <span className="text-muted-foreground">Task:</span> {entry.taskId}
            </div>
          )}
          {entry.command && (
            <div>
              <span className="text-muted-foreground">Command:</span>{' '}
              <code className="bg-muted px-1 rounded">{entry.command}</code>
            </div>
          )}
          {entry.error && (
            <div className="text-red-500">
              <span className="text-muted-foreground">Error:</span> {entry.error}
            </div>
          )}
          {entry.exitCode !== undefined && (
            <div>
              <span className="text-muted-foreground">Exit code:</span> {entry.exitCode}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Panel for viewing git operation logs in settings.
 *
 * Features:
 * - Select logs by date
 * - View log entries with details
 * - Clean up old logs
 * - Show log statistics
 *
 * @see Story 8.10: Task 8.1, 8.2, 8.3, 8.4, 8.5
 */
export function GitLogsPanel() {
  const [selectedDate, setSelectedDate] = useState<string>('')

  // Fetch available log dates
  const { data: logDates = [], isLoading: datesLoading } = trpc.git.getLogDates.useQuery()

  // Fetch log stats
  const { data: logStats } = trpc.git.getLogStats.useQuery()

  // Fetch logs for selected date
  const { data: logs = [], isLoading: logsLoading } = trpc.git.getLogs.useQuery(
    { date: selectedDate || undefined },
    { enabled: !!selectedDate || logDates.length > 0 }
  )

  // Cleanup mutation
  const cleanupMutation = trpc.git.cleanupLogs.useMutation()

  // Set default date to most recent if not selected
  if (!selectedDate && logDates.length > 0 && !datesLoading) {
    setSelectedDate(logDates[0])
  }

  const handleCleanup = async () => {
    await cleanupMutation.mutateAsync()
    // Refetch dates after cleanup
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-medium">Git Operation Logs</h3>
        </div>

        {logStats && (
          <span className="text-sm text-muted-foreground">
            {logStats.fileCount} file(s), {logStats.totalSizeFormatted}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Select value={selectedDate} onValueChange={setSelectedDate}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={datesLoading ? 'Loading...' : 'Select date'} />
          </SelectTrigger>
          <SelectContent>
            {logDates.map((date) => (
              <SelectItem key={date} value={date}>
                {date}
              </SelectItem>
            ))}
            {logDates.length === 0 && !datesLoading && (
              <SelectItem value="_none" disabled>
                No logs available
              </SelectItem>
            )}
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="sm"
          onClick={handleCleanup}
          disabled={cleanupMutation.isPending}
        >
          <Trash2 className="h-4 w-4 mr-1" />
          Cleanup Old
        </Button>
      </div>

      <div className="space-y-2 max-h-[300px] overflow-y-auto">
        {logsLoading ? (
          <div className="text-sm text-muted-foreground py-4 text-center">
            Loading logs...
          </div>
        ) : logs.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center">
            No logs for this date
          </div>
        ) : (
          logs.map((entry, index) => (
            <LogEntryItem key={`${entry.timestamp}-${index}`} entry={entry} />
          ))
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Logs are automatically deleted after 7 days.
      </p>
    </div>
  )
}

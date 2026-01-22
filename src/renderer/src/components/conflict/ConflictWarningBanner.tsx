import { cn } from '@renderer/lib/utils'
import { AlertTriangle, X, FileCode2, Terminal } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'

/**
 * Props for ConflictWarningBanner component.
 */
interface ConflictWarningBannerProps {
  /** List of files with merge conflicts */
  conflictFiles: string[]
  /** Optional callback when banner is dismissed */
  onDismiss?: () => void
  /** Optional additional CSS classes */
  className?: string
}

/**
 * Warning banner displayed when a task has merge conflicts.
 *
 * Shows a prominent amber warning with the list of conflicting files
 * and instructions to resolve conflicts in the task's terminal.
 *
 * Story 8.7: Merge Conflict Detection (AC: 3)
 *
 * @example
 * ```tsx
 * <ConflictWarningBanner
 *   conflictFiles={['src/main.ts', 'package.json']}
 *   onDismiss={() => setShowBanner(false)}
 * />
 * ```
 */
export function ConflictWarningBanner({
  conflictFiles,
  onDismiss,
  className
}: ConflictWarningBannerProps) {
  if (conflictFiles.length === 0) {
    return null
  }

  return (
    <div
      className={cn(
        // Base container with amber warning gradient
        'relative overflow-hidden rounded-lg',
        // Layered background for depth (matching TinSu card system)
        'bg-gradient-to-br from-amber-950/40 via-amber-900/30 to-orange-950/40',
        // Subtle border with amber glow
        'border border-amber-700/40',
        // Inset shadow for depth
        'shadow-[inset_0_1px_0_rgba(251,191,36,0.1),0_2px_8px_-2px_rgba(0,0,0,0.5)]',
        // Padding
        'p-4',
        className
      )}
      role="alert"
      aria-live="polite"
      data-testid="conflict-warning-banner"
    >
      {/* Ambient glow effect */}
      <div className="absolute -top-8 -left-8 h-24 w-24 rounded-full bg-amber-500/10 blur-2xl" />
      <div className="absolute -bottom-4 -right-4 h-16 w-16 rounded-full bg-orange-500/10 blur-xl" />

      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            {/* Warning icon with pulse animation */}
            <div className="flex-shrink-0 rounded-md bg-amber-500/20 p-2">
              <AlertTriangle className="h-5 w-5 text-amber-400 animate-pulse" />
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-amber-200">
                Merge Conflicts Detected
              </h3>
              <p className="mt-1 text-xs text-amber-300/80">
                This task has conflicts with the main branch that must be resolved before completing.
              </p>
            </div>
          </div>

          {/* Dismiss button */}
          {onDismiss && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onDismiss}
              className="h-6 w-6 text-amber-400/60 hover:text-amber-300 hover:bg-amber-500/20"
              aria-label="Dismiss warning"
              data-testid="conflict-banner-dismiss"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Conflicting files list */}
        <div className="mt-3">
          <div className="flex items-center gap-1.5 text-xs text-amber-400/70 mb-2">
            <FileCode2 className="h-3.5 w-3.5" />
            <span className="font-medium">
              {conflictFiles.length} conflicting {conflictFiles.length === 1 ? 'file' : 'files'}:
            </span>
          </div>

          <div
            className={cn(
              'rounded-md bg-black/30 border border-amber-800/30',
              'max-h-28 overflow-y-auto',
              // Custom scrollbar styling
              'scrollbar-thin scrollbar-thumb-amber-700/50 scrollbar-track-transparent'
            )}
          >
            <ul className="divide-y divide-amber-800/20">
              {conflictFiles.map((file, index) => (
                <li
                  key={`${file}-${index}`}
                  className="px-3 py-1.5 text-xs font-mono text-amber-100/90 truncate hover:bg-amber-500/10 transition-colors"
                  title={file}
                >
                  {file}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-3 flex items-start gap-2 rounded-md bg-amber-500/10 border border-amber-700/30 p-2.5">
          <Terminal className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-amber-200/90">
            <span className="font-medium">To resolve:</span>{' '}
            Open the task's terminal, resolve conflicts manually, then commit the changes.
            After resolving, move the task to Done again.
          </div>
        </div>
      </div>
    </div>
  )
}

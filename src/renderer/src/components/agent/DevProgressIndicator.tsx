import { cn } from '@renderer/lib/utils'
import { CheckIcon } from 'lucide-react'

/**
 * Step identifier for the DEV agent workflow progress.
 */
export type ProgressStep = 'sm' | 'dev' | 'review' | null

/**
 * Props for the DevProgressIndicator component.
 */
interface DevProgressIndicatorProps {
  /** Current step in the workflow. null = idle/not started */
  currentStep: ProgressStep
  /** Show summary text instead of step indicators */
  showSummary?: boolean
  /** Additional CSS classes */
  className?: string
}

/**
 * Step configuration for the progress indicator.
 */
interface StepConfig {
  key: ProgressStep
  label: string
}

const STEPS: StepConfig[] = [
  { key: 'sm', label: 'SM' },
  { key: 'dev', label: 'DEV' },
  { key: 'review', label: 'Review' }
]

/**
 * Determines if a step is completed based on the current step.
 */
function isStepCompleted(stepKey: ProgressStep, currentStep: ProgressStep): boolean {
  if (currentStep === null || stepKey === null) return false

  const stepOrder = { sm: 1, dev: 2, review: 3 }
  return stepOrder[stepKey] < stepOrder[currentStep]
}

/**
 * Determines if a step is the current active step.
 */
function isStepCurrent(stepKey: ProgressStep, currentStep: ProgressStep): boolean {
  return stepKey === currentStep
}

/**
 * Progress indicator component for the DEV agent workflow.
 *
 * Story 5.5 - AC: 2
 *
 * Displays a stepper showing the current step in the DEV agent workflow:
 * [SM] → [DEV] → [Review]
 *
 * - Completed steps show green checkmarks
 * - Current step pulses blue
 * - Future steps are grayed out
 *
 * @example
 * ```tsx
 * <DevProgressIndicator currentStep="dev" />
 * // Shows: [SM ✓] → [DEV ●] → [Review]
 *
 * <DevProgressIndicator currentStep="review" showSummary />
 * // Shows: "Ready for human review"
 * ```
 */
export function DevProgressIndicator({
  currentStep,
  showSummary,
  className
}: DevProgressIndicatorProps) {
  // Summary mode: show text instead of steps
  if (showSummary) {
    return (
      <span
        className={cn('text-xs text-muted-foreground', className)}
        data-testid="dev-progress-indicator"
      >
        Ready for human review
      </span>
    )
  }

  return (
    <div
      className={cn('flex items-center gap-1 text-xs', className)}
      data-testid="dev-progress-indicator"
      role="progressbar"
      aria-valuenow={currentStep ? STEPS.findIndex((s) => s.key === currentStep) + 1 : 0}
      aria-valuemin={0}
      aria-valuemax={3}
    >
      {STEPS.map((step, index) => {
        const isCompleted = isStepCompleted(step.key, currentStep)
        const isCurrent = isStepCurrent(step.key, currentStep)

        return (
          <div key={step.key} className="flex items-center gap-1">
            {/* Step indicator */}
            <div
              className={cn(
                'flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-medium transition-colors',
                // Completed: green with checkmark
                isCompleted && 'bg-green-500 text-white',
                // Current: blue with pulse
                isCurrent && 'bg-blue-500 text-white animate-pulse',
                // Not reached: muted/gray
                !isCompleted && !isCurrent && 'bg-muted text-muted-foreground'
              )}
              data-testid={`progress-step-${step.key}`}
              title={step.label}
            >
              {isCompleted ? (
                <CheckIcon className="w-3 h-3" />
              ) : step.key === 'review' ? (
                // Show "R" for Review to keep it short
                'R'
              ) : (
                // First letter for SM and DEV
                step.label[0]
              )}
            </div>

            {/* Connector arrow (except after last step) */}
            {index < STEPS.length - 1 && (
              <span className="text-muted-foreground">→</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

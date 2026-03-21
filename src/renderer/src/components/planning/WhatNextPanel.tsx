import { useState, useCallback } from 'react'
import { Compass, CheckCircle2, ChevronRight, SkipForward, FileOutput } from 'lucide-react'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'
import { trpc } from '@renderer/lib/trpc'
import { usePlanningWorkspaceStore } from '@renderer/stores'
import { useNextRecommendation, type RecommendationResult } from '@renderer/hooks/useNextRecommendation'

/**
 * "What Next?" Recommender Panel — Story 9.4
 *
 * Displays the next recommended BMAD planning step based on artifact presence.
 * Sits at the top of the PhaseProgressDashboard as the primary actionable element.
 */
export function WhatNextPanel() {
  const { data: project } = trpc.project.getCurrent.useQuery()
  const projectId = project?.id ?? ''

  const { data: artifacts } = trpc.planning.scanArtifacts.useQuery(
    { projectId },
    { enabled: !!projectId, refetchOnWindowFocus: true }
  )

  const [skippedKeys, setSkippedKeys] = useState<string[]>([])

  const recommendation = useNextRecommendation(artifacts, skippedKeys)

  const setActivePhase = usePlanningWorkspaceStore((s) => s.setActivePhase)
  const setSelectedWorkflow = usePlanningWorkspaceStore((s) => s.setSelectedWorkflow)

  const handleStart = useCallback(
    (rec: Exclude<RecommendationResult, { complete: true; message: string } | null>) => {
      setActivePhase(rec.phase)
      setSelectedWorkflow(rec.workflowKey)
    },
    [setActivePhase, setSelectedWorkflow]
  )

  const handleSkip = useCallback(
    (workflowKey: string) => {
      setSkippedKeys((prev) => [...prev, workflowKey])
    },
    []
  )

  // ── Loading state ──
  if (!project || !artifacts) {
    return (
      <section aria-label="What next recommendation loading">
        <div className="mb-3 flex items-center gap-2">
          <Compass className="h-4 w-4 text-cyan-500/40" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground/40">
            Next Step
          </h2>
        </div>
        <div className="rounded-xl border border-border bg-card/50 p-5">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 animate-pulse rounded-lg bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-48 animate-pulse rounded bg-muted" />
              <div className="h-3 w-72 animate-pulse rounded bg-muted" />
            </div>
          </div>
        </div>
      </section>
    )
  }

  // ── No recommendation (null) — don't render anything ──
  if (!recommendation) {
    return null
  }

  // ── Completion state ──
  if ('complete' in recommendation) {
    return (
      <section aria-label="Planning complete">
        <div className="mb-3 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground">
            Planning Status
          </h2>
        </div>
        <div className="relative overflow-hidden rounded-xl border border-emerald-500/20 bg-card/50 p-5 ring-1 ring-emerald-500/10">
          {/* Subtle emerald glow backdrop */}
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-emerald-500/5 blur-2xl" />

          <div className="relative flex items-center gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 ring-1 ring-emerald-500/20">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">
                All Planning Complete
              </p>
              <p className="mt-0.5 text-xs text-emerald-500/80">
                {recommendation.message}
              </p>
            </div>
          </div>
        </div>
      </section>
    )
  }

  // ── Recommendation state ──
  return (
    <section aria-label="What next recommendation">
      <div className="mb-3 flex items-center gap-2">
        <Compass className="h-4 w-4 text-cyan-500" />
        <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground">
          Next Step
        </h2>
      </div>
      <div className="relative overflow-hidden rounded-xl border border-border bg-card/50 p-5 ring-1 ring-cyan-500/20">
        {/* Subtle cyan glow backdrop */}
        <div className="absolute -left-6 -top-6 h-28 w-28 rounded-full bg-cyan-500/5 blur-2xl" />

        <div className="relative flex items-start gap-4">
          {/* Icon block */}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 ring-1 ring-cyan-500/20">
            <Compass className="h-5 w-5 text-cyan-500" />
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-base font-medium text-foreground">
                {recommendation.label}
              </span>
              {recommendation.optional && (
                <Badge
                  variant="outline"
                  className="border-cyan-500/20 bg-cyan-500/5 px-1.5 py-0 text-[10px] font-normal text-cyan-500/70"
                >
                  optional
                </Badge>
              )}
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {recommendation.reason}
            </p>
            <div className="flex items-center gap-1.5 text-muted-foreground/60">
              <FileOutput className="h-3 w-3" />
              <span className="font-mono text-[11px]">
                {recommendation.produces}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex shrink-0 items-center gap-2">
            {recommendation.optional && (
              <button
                type="button"
                onClick={() => handleSkip(recommendation.workflowKey)}
                className={cn(
                  'inline-flex items-center gap-1 rounded-md px-2.5 py-1.5',
                  'text-xs text-muted-foreground transition-colors',
                  'hover:bg-muted hover:text-foreground'
                )}
              >
                <SkipForward className="h-3 w-3" />
                Skip
              </button>
            )}
            <Button
              onClick={() => handleStart(recommendation)}
              className="gap-1.5 bg-cyan-600 text-white shadow-md shadow-cyan-500/15 hover:bg-cyan-500"
              size="sm"
            >
              Start
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}

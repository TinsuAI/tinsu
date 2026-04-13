/**
 * WhatNextPanel — T1.10 implementation.
 * Recommends the next BMAD planning step based on existing artifacts.
 *
 * Story T1.10 AC: 10
 */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Lightbulb, CheckCircle2, ArrowRight, SkipForward } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { commands } from '@renderer/lib/rspc'
import { useProjectStore, usePlanningWorkspaceStore } from '@renderer/stores'
import { useNextRecommendation } from '@renderer/hooks/useNextRecommendation'
import { BMAD_WORKFLOWS } from '@renderer/constants/planning-workspace'

export function WhatNextPanel() {
  const activeProjectId = useProjectStore((s) => s.activeProjectId)
  const setSelectedWorkflow = usePlanningWorkspaceStore((s) => s.setSelectedWorkflow)
  const [skippedKeys, setSkippedKeys] = useState<string[]>([])

  const { data: artifacts, isLoading } = useQuery({
    queryKey: ['scan-artifacts', activeProjectId],
    queryFn: async () => {
      if (!activeProjectId) return []
      const r = await commands.scanArtifacts(activeProjectId)
      if (r.status === 'error') throw new Error(JSON.stringify(r.error))
      return r.data
    },
    enabled: !!activeProjectId,
    staleTime: 0,
    refetchOnWindowFocus: true,
  })

  const mappedArtifacts = artifacts?.map((a) => ({
    workflowKey: a.workflow_key,
    exists: a.exists,
  }))
  const recommendation = useNextRecommendation(mappedArtifacts, skippedKeys)

  if (!activeProjectId) return null

  if (isLoading) {
    return (
      <div
        data-testid="what-next-panel"
        className="rounded-md border border-border/40 bg-card/30 p-4"
      >
        <div className="flex items-center gap-3">
          <div className="h-7 w-7 animate-pulse rounded-md bg-muted/50" />
          <div className="space-y-2 flex-1">
            <div className="h-4 w-48 animate-pulse rounded bg-muted/50" />
            <div className="h-3 w-64 animate-pulse rounded bg-muted/40" />
          </div>
        </div>
      </div>
    )
  }

  if (!recommendation) {
    return (
      <div
        data-testid="what-next-panel"
        className="flex items-center gap-2 rounded-md border border-border/30 bg-card/20 px-4 py-3"
      >
        <Lightbulb className="h-4 w-4 shrink-0 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          Start with Product Brief to begin planning
        </p>
      </div>
    )
  }

  if ('complete' in recommendation && recommendation.complete) {
    return (
      <div
        data-testid="what-next-panel"
        className="flex items-center gap-3 rounded-md border border-emerald-500/30 bg-emerald-950/20 px-4 py-3"
      >
        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
        <div>
          <p className="text-sm font-medium text-emerald-400">All planning artifacts complete!</p>
          <p className="text-xs text-emerald-400/60">{recommendation.message}</p>
        </div>
      </div>
    )
  }

  // recommendation is a workflow recommendation
  const rec = recommendation as {
    workflowKey: string
    label: string
    reason: string
    produces: string
    optional?: boolean
  }
  const workflow = BMAD_WORKFLOWS.find((w) => w.key === rec.workflowKey)

  return (
    <div
      data-testid="what-next-panel"
      className="rounded-md border border-cyan-500/20 bg-cyan-950/10 p-4"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded bg-cyan-500/10 p-1.5">
          <Lightbulb className="h-4 w-4 text-cyan-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-xs font-medium uppercase tracking-widest text-cyan-400/60">
              Next Step
            </span>
            {rec.optional && (
              <span className="rounded border border-muted-foreground/20 px-1.5 py-0.5 text-[10px] text-muted-foreground/60">
                optional
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-foreground mb-1">
            {workflow?.name ?? rec.label}
          </p>
          <p className="text-xs text-muted-foreground mb-2">{rec.reason}</p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded border border-border/40 bg-muted/30 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
              {rec.produces}
            </code>
            <div className="flex items-center gap-1.5 ml-auto">
              {rec.optional && (
                <button
                  onClick={() =>
                    setSkippedKeys((prev) => [...prev, rec.workflowKey])
                  }
                  className="flex items-center gap-1 rounded px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted/30 hover:text-foreground transition-colors"
                >
                  <SkipForward className="h-3 w-3" />
                  Skip
                </button>
              )}
              <button
                onClick={() => setSelectedWorkflow(rec.workflowKey)}
                className="flex items-center gap-1.5 rounded bg-cyan-500/15 px-3 py-1 text-xs font-medium text-cyan-400 hover:bg-cyan-500/25 transition-colors border border-cyan-500/20"
              >
                Start
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

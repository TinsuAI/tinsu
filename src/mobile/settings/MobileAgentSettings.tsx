/**
 * MobileAgentSettings — agent model selection screen.
 *
 * Story T3.5-8, Task 6 (AC: 10a, 16, 17, 18, 19, 20).
 *
 * Route key: 'agent-settings' (pushed via pushRoute('settings', 'agent-settings')).
 * Renders INSIDE MobileScreen shell — tab bar visible (AC-14).
 *
 * Two MobileSettingsRow entries open picker sheets (MobileSheet snap='fit'):
 *   - Dev agent model (opus / sonnet / haiku)
 *   - Review agent model (opus / sonnet / haiku)
 *
 * Data: reads via trpc.config.get, saves via trpc.config.update.
 * Autosave on selection (no explicit Save button). AC-10a.
 * Shows success/error toast via sonner. AC-10a.
 *
 * AC-16: No imports from @renderer/components/ui/*.
 * AC-17: Token-only colors.
 * AC-18: min-h-11 touch targets.
 * AC-19: Accessibility via MobileSettingsRow roles.
 */

import { useState } from 'react'
import { Bot, Check } from 'lucide-react'
import { toast } from 'sonner'
import { trpc } from '@renderer/lib/trpc'
import { useMobileNavStore } from '../shell/mobile-nav.store'
import { MobileTopAppBar } from '../primitives/MobileTopAppBar'
import { MobileSettingsRow } from '../primitives/MobileSettingsRow'
import { MobileSheet } from '../primitives/MobileSheet'
import { MobileLoadingSkeleton } from '../primitives/MobileLoadingSkeleton'
import { cn } from '@renderer/lib/utils'
import type { ClaudeModel } from '@shared/types/config.types'

/* ── Constants ──────────────────────────────────────────────────── */

const MODEL_OPTIONS: { value: ClaudeModel; label: string; description: string }[] = [
  { value: 'opus',    label: 'Claude Opus',    description: 'Most capable' },
  { value: 'sonnet',  label: 'Claude Sonnet',  description: 'Balanced' },
  { value: 'haiku',   label: 'Claude Haiku',   description: 'Fastest' },
]

type PickerTarget = 'dev' | 'review' | null

/* ── Component ──────────────────────────────────────────────────── */

export function MobileAgentSettings() {
  const { popRoute } = useMobileNavStore()
  const [pickerOpen, setPickerOpen] = useState<PickerTarget>(null)

  // Read config via tRPC (mirrors desktop AgentSettingsPanel pattern)
  const { data: config, isLoading } = trpc.config.get.useQuery()
  const utils = trpc.useUtils()

  const updateConfig = trpc.config.update.useMutation({
    onSuccess: () => {
      void utils.config.get.invalidate()
      toast.success('Agent settings updated')
    },
    onError: (error) => {
      toast.error('Failed to update settings', { description: error.message })
    },
  })

  const handleSelect = (target: PickerTarget, model: ClaudeModel) => {
    if (!target) return
    setPickerOpen(null)
    if (target === 'dev') {
      updateConfig.mutate({ devAgentModel: model })
    } else {
      updateConfig.mutate({ reviewAgentModel: model })
    }
  }

  const currentPicker = pickerOpen
  const currentPickerValue =
    currentPicker === 'dev'
      ? (config?.devAgentModel ?? 'opus')
      : (config?.reviewAgentModel ?? 'sonnet')

  return (
    <div className="flex flex-col h-full" data-testid="mobile-agent-settings">
      {/* Sub-screen top bar with back button (AC-13) */}
      <MobileTopAppBar
        title="Agent"
        backButton={{
          onClick: () => popRoute('settings'),
          ariaLabel: 'Back to settings',
        }}
      />

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="pt-4">
            <MobileLoadingSkeleton variant="list-row" count={2} />
          </div>
        ) : (
          <div role="list" aria-label="Agent model settings">
            <MobileSettingsRow
              icon={<Bot className="h-4 w-4" />}
              title="Dev agent model"
              value={MODEL_OPTIONS.find((m) => m.value === config?.devAgentModel)?.label ?? 'Opus'}
              trailing="chevron"
              onPress={() => setPickerOpen('dev')}
              data-testid="agent-row-dev"
            />
            <MobileSettingsRow
              icon={<Bot className="h-4 w-4" />}
              title="Review agent model"
              value={MODEL_OPTIONS.find((m) => m.value === config?.reviewAgentModel)?.label ?? 'Sonnet'}
              trailing="chevron"
              onPress={() => setPickerOpen('review')}
              data-testid="agent-row-review"
            />
          </div>
        )}
      </div>

      {/* Model picker sheet */}
      <MobileSheet
        open={pickerOpen !== null}
        onOpenChange={(open) => { if (!open) setPickerOpen(null) }}
        snapPoint="fit"
        title={pickerOpen === 'dev' ? 'Dev agent model' : 'Review agent model'}
        ariaLabel="Select model"
      >
        <div role="list" aria-label="Model options" className="pb-2">
          {MODEL_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="listitem"
              aria-label={`${opt.label}: ${opt.description}${currentPickerValue === opt.value ? ', selected' : ''}`}
              data-testid={`model-option-${opt.value}`}
              onClick={() => handleSelect(currentPicker, opt.value)}
              className={cn(
                'w-full flex items-center gap-3 min-h-11 px-4 py-3',
                'border-b border-border/20 text-left',
                'transition-colors duration-100 active:bg-muted/30',
              )}
            >
              <span className="flex-1 flex flex-col gap-0.5">
                <span className="text-sm font-medium text-foreground">{opt.label}</span>
                <span className="text-xs text-muted-foreground">{opt.description}</span>
              </span>
              {currentPickerValue === opt.value && (
                <Check className="h-4 w-4 text-primary shrink-0" aria-hidden />
              )}
            </button>
          ))}
        </div>
      </MobileSheet>
    </div>
  )
}

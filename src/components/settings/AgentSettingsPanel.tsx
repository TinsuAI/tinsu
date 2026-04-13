import { Info } from 'lucide-react'
import { toast } from 'sonner'
import { trpc } from '@renderer/lib/trpc'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { Label } from '@renderer/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@renderer/components/ui/popover'
import type { ClaudeModel } from '@shared/types/config.types'

const MODEL_OPTIONS: { value: ClaudeModel; label: string; description: string }[] = [
  { value: 'opus', label: 'Claude Opus', description: 'Most capable - best for complex tasks' },
  { value: 'sonnet', label: 'Claude Sonnet', description: 'Balanced - good for most tasks' },
  { value: 'haiku', label: 'Claude Haiku', description: 'Fastest - simple tasks only' }
]

export function AgentSettingsPanel() {
  const { data: config, isLoading } = trpc.config.get.useQuery()
  const utils = trpc.useUtils()

  const updateConfig = trpc.config.update.useMutation({
    onSuccess: () => {
      utils.config.get.invalidate()
      toast.success('Agent settings updated')
    },
    onError: (error) => {
      toast.error('Failed to update settings', {
        description: error.message
      })
    }
  })

  const handleDevModelChange = (value: string) => {
    updateConfig.mutate({ devAgentModel: value as ClaudeModel })
  }

  const handleReviewModelChange = (value: string) => {
    updateConfig.mutate({ reviewAgentModel: value as ClaudeModel })
  }

  if (isLoading) {
    return (
      <div className="space-y-6 p-4" data-testid="agent-settings-loading">
        <div className="h-10 animate-pulse rounded bg-muted" />
        <div className="h-10 animate-pulse rounded bg-muted" />
      </div>
    )
  }

  return (
    <div className="space-y-6" data-testid="agent-settings-panel">
      {/* Dev Agent Model */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label htmlFor="dev-agent-model" className="text-sm font-medium">
            Dev Agent Model
          </Label>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                data-testid="dev-agent-info"
              >
                <Info className="h-4 w-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent side="right" className="w-64 text-sm">
              Use a powerful model for Dev Agent - it handles complex implementation tasks
              like /dev-story and Basic Task execution.
            </PopoverContent>
          </Popover>
        </div>
        <Select
          value={config?.devAgentModel ?? 'opus'}
          onValueChange={handleDevModelChange}
          disabled={updateConfig.isPending}
        >
          <SelectTrigger id="dev-agent-model" data-testid="dev-agent-model-select">
            <SelectValue placeholder="Select model" />
          </SelectTrigger>
          <SelectContent>
            {MODEL_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} data-testid={`dev-model-${opt.value}`}>
                <span className="font-medium">{opt.label}</span>
                <span className="ml-2 text-muted-foreground">- {opt.description}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Review Agent Model */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label htmlFor="review-agent-model" className="text-sm font-medium">
            Review Agent Model
          </Label>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                data-testid="review-agent-info"
              >
                <Info className="h-4 w-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent side="right" className="w-64 text-sm">
              Use a faster model for Review Agent - it handles code review tasks where
              speed matters more than maximum capability.
            </PopoverContent>
          </Popover>
        </div>
        <Select
          value={config?.reviewAgentModel ?? 'sonnet'}
          onValueChange={handleReviewModelChange}
          disabled={updateConfig.isPending}
        >
          <SelectTrigger id="review-agent-model" data-testid="review-agent-model-select">
            <SelectValue placeholder="Select model" />
          </SelectTrigger>
          <SelectContent>
            {MODEL_OPTIONS.map((opt) => (
              <SelectItem
                key={opt.value}
                value={opt.value}
                data-testid={`review-model-${opt.value}`}
              >
                <span className="font-medium">{opt.label}</span>
                <span className="ml-2 text-muted-foreground">- {opt.description}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Recommendation Badge */}
      <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4 text-sm">
        <p className="font-medium text-blue-400">Recommended Setup</p>
        <p className="mt-1 text-muted-foreground">
          Use <strong>Opus</strong> for Dev Agent (powerful for implementation) and{' '}
          <strong>Sonnet</strong> for Review Agent (fast enough for code review).
        </p>
      </div>

      {/* Info Box */}
      <div className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">How it works:</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>Story Tasks use BMAD workflows automatically</li>
          <li>Basic Tasks execute directly with Claude Code</li>
          <li>Model settings apply to both execution modes</li>
        </ul>
      </div>
    </div>
  )
}

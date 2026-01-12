# Story 5.1: Agent Model Configuration

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a founder,
I want to configure the AI model settings for task execution,
So that I can optimize cost/performance for different agent roles.

## Acceptance Criteria

1. **Given** the project settings panel
   **When** I view agent configuration
   **Then** I see model selection for:
   - Dev Agent model (used for /dev-story and Basic Task execution)
   - Review Agent model (used for automated code review)
   **And** settings persist in .tinsu/config.yaml

2. **Given** I configure models
   **When** I select different models for Dev and Review agents
   **Then** a tooltip explains: "Use powerful model for Dev, faster model for Review"
   **And** I can select from available Claude models (Opus, Sonnet, etc.)

3. **Given** the dual-mode execution system
   **When** I view settings
   **Then** I understand that:
   - Story Tasks automatically use BMAD workflows
   - Basic Tasks automatically use direct Claude Code execution
   - Model settings apply to both modes

4. **Given** I save model settings
   **When** a task starts execution
   **Then** the configured models are used for that execution
   **And** in-progress tasks continue with their original model settings

## Tasks / Subtasks

- [x] Task 1: Extend config schema with agent model settings (AC: 1)
  - [x] Modify `src/shared/types/config.types.ts` to add:
    - `devAgentModel`: enum of Claude model options
    - `reviewAgentModel`: enum of Claude model options
  - [x] Create `ClaudeModelSchema` Zod validator with options: 'opus', 'sonnet', 'haiku'
  - [x] Add default values: devAgentModel = 'opus', reviewAgentModel = 'sonnet'
  - [x] Write tests for schema validation

- [x] Task 2: Extend ConfigService to handle agent model settings (AC: 1)
  - [x] Modify `src/main/services/config.service.ts`
  - [x] Add `devAgentModel` and `reviewAgentModel` to config structure
  - [x] Ensure backward compatibility with existing configs (migration logic)
  - [x] Add getter methods: `getDevAgentModel()`, `getReviewAgentModel()`
  - [x] Write tests for config migration and default values

- [x] Task 3: Extend config.router for model settings (AC: 1, 4)
  - [x] Modify `src/main/trpc/routers/config.router.ts`
  - [x] Add `devAgentModel` and `reviewAgentModel` to update mutation input schema
  - [x] Ensure settings are properly validated and persisted
  - [x] Write tests for router mutations

- [x] Task 4: Create AgentSettingsPanel component (AC: 1, 2, 3)
  - [x] Create `src/renderer/src/components/settings/AgentSettingsPanel.tsx`
  - [x] Add model selection dropdowns for Dev and Review agents
  - [x] Add tooltips explaining each setting
  - [x] Add info text about dual-mode execution
  - [x] Use shadcn/ui Select and Popover components
  - [x] Write component tests

- [x] Task 5: Integrate AgentSettingsPanel into settings (AC: 1, 2, 3)
  - [x] Determine where settings panel lives (SettingsDialog accessible from Header)
  - [x] Wire up tRPC mutations for config updates
  - [x] Add save confirmation toast
  - [x] Write integration tests

- [x] Task 6: Update BmadAgentLauncherService to use configured model (AC: 4)
  - [x] Modify `src/main/services/bmad-agent-launcher.service.ts`
  - [x] Read configured `devAgentModel` from config
  - [x] Pass model flag to Claude CLI: `--model <model>` (verify CLI flag)
  - [x] Write tests for model flag passing

- [x] Task 7: Prepare for Review Agent integration (AC: 4)
  - [x] Document how `reviewAgentModel` will be used (placeholder for Story 5.6)
  - [x] Add config retrieval method for future use
  - [x] No implementation needed yet - just structure

- [x] Task 8: Write comprehensive unit and integration tests (AC: all)
  - [x] Test settings persistence via ConfigService
  - [x] Test model selection UI workflow via component tests
  - [x] Test configured model is passed to Claude CLI via service tests
  - [x] Ensure all Story 5.1 tests pass (85 tests for Story 5.1)

## Dev Notes

### Critical Architecture Patterns

**Electron Context:**
This is an Electron desktop app. All database and config operations happen in the main process via services. The renderer NEVER directly accesses the file system or config files.

**IMPORTANT: Run `npm run rebuild:electron` after any DB schema changes to recompile native modules for Electron.**

### Previous Story Intelligence (Story 3.4)

**Key Learnings from Story 3.4:**
1. Tests must pass before completion (currently 714+ tests)
2. Use existing patterns from services for consistency
3. Commit message format: `5.1 done: <description>`
4. Always rebuild after DB changes: `npm run rebuild:electron`
5. `BmadAgentLauncherService` already exists for spawning Claude CLI
6. `ClaudeCliDetectorService` verifies CLI installation
7. `agent.router` already handles agent launching
8. `config.router` pattern shows how to add config updates
9. `ConfigService` handles reading/writing `.tinsu/config.yaml`

**Files Created in 3.4:**
- `src/main/services/bmad-agent-launcher.service.ts` - Agent spawning
- `src/main/services/claude-cli-detector.service.ts` - CLI detection
- `src/main/trpc/routers/agent.router.ts` - Agent procedures
- `src/renderer/src/hooks/useAgentLauncher.ts` - Agent launch hook

### Existing Infrastructure to Use

**Current Config Structure (from `.tinsu/config.yaml`):**
```yaml
projectName: tinsu
methodology: bmad
createdAt: "2026-01-05T06:51:03.222Z"
version: 1.0.0
planningTasksInitialized: true
```

**ConfigService Pattern (from `src/main/services/config.service.ts`):**
```typescript
export class ConfigService {
  constructor(private projectRoot: string) {}

  getOrCreateConfig(): ProjectConfig { /* ... */ }
  updateConfig(updates: Partial<ProjectConfig>): ProjectConfig { /* ... */ }
  // Add new methods for agent models
}
```

**Config Types (from `src/shared/types/config.types.ts`):**
```typescript
export const MethodologySchema = z.enum(['bmad', 'taskmaster', 'custom'])
export type Methodology = z.infer<typeof MethodologySchema>

export interface ProjectConfig {
  projectName: string
  methodology: Methodology
  createdAt: string
  version: string
  planningTasksInitialized?: boolean
  // ADD: devAgentModel, reviewAgentModel
}
```

**Config Router Pattern (from `src/main/trpc/routers/config.router.ts`):**
```typescript
update: publicProcedure
  .input(z.object({
    projectName: z.string().min(1).optional(),
    methodology: MethodologySchema.optional(),
    // ADD: devAgentModel, reviewAgentModel
  }))
  .mutation(({ ctx, input }) => {
    const configService = getConfigService(ctx.projectRoot)
    return configService.updateConfig(input)
  })
```

### Claude Code CLI Model Flag Research

**Based on Claude Code CLI documentation, model selection flags:**
```bash
# Use specific model for execution
claude --model opus    # Use Claude Opus
claude --model sonnet  # Use Claude Sonnet
claude --model haiku   # Use Claude Haiku

# Alternative: may use full model ID
claude --model claude-opus-4-5-20251101
claude --model claude-sonnet-4-20250514
```

**Model Options to Support:**
| Display Name | CLI Flag | Description |
|--------------|----------|-------------|
| Claude Opus | `opus` | Most capable, slower, expensive |
| Claude Sonnet | `sonnet` | Balanced performance/cost |
| Claude Haiku | `haiku` | Fastest, cheapest |

**Recommendation for defaults:**
- Dev Agent: `opus` (powerful for implementation)
- Review Agent: `sonnet` (good enough for code review, faster)

### Component Patterns to Follow

**Config Type Extension:**
```typescript
// src/shared/types/config.types.ts

export const ClaudeModelSchema = z.enum(['opus', 'sonnet', 'haiku'])
export type ClaudeModel = z.infer<typeof ClaudeModelSchema>

export interface ProjectConfig {
  projectName: string
  methodology: Methodology
  createdAt: string
  version: string
  planningTasksInitialized?: boolean
  devAgentModel?: ClaudeModel      // Default: 'opus'
  reviewAgentModel?: ClaudeModel   // Default: 'sonnet'
}
```

**AgentSettingsPanel Component:**
```typescript
// src/renderer/src/components/settings/AgentSettingsPanel.tsx
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Info } from 'lucide-react'
import { trpc } from '@renderer/lib/trpc'

const MODEL_OPTIONS = [
  { value: 'opus', label: 'Claude Opus', description: 'Most capable - best for complex tasks' },
  { value: 'sonnet', label: 'Claude Sonnet', description: 'Balanced - good for most tasks' },
  { value: 'haiku', label: 'Claude Haiku', description: 'Fastest - simple tasks only' }
]

export function AgentSettingsPanel() {
  const { data: config } = trpc.config.get.useQuery()
  const updateConfig = trpc.config.update.useMutation()

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Dev Agent Model</label>
          <Tooltip>
            <TooltipTrigger><Info className="h-4 w-4 text-muted-foreground" /></TooltipTrigger>
            <TooltipContent>Used for /dev-story and Basic Task execution</TooltipContent>
          </Tooltip>
        </div>
        <Select
          value={config?.devAgentModel ?? 'opus'}
          onValueChange={(value) => updateConfig.mutate({ devAgentModel: value as ClaudeModel })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MODEL_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label} - {opt.description}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Review Agent Model</label>
          <Tooltip>
            <TooltipTrigger><Info className="h-4 w-4 text-muted-foreground" /></TooltipTrigger>
            <TooltipContent>Used for automated code review (separate model recommended)</TooltipContent>
          </Tooltip>
        </div>
        <Select
          value={config?.reviewAgentModel ?? 'sonnet'}
          onValueChange={(value) => updateConfig.mutate({ reviewAgentModel: value as ClaudeModel })}
        >
          {/* Same options */}
        </Select>
      </div>

      <div className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
        <p><strong>How it works:</strong></p>
        <ul className="list-disc list-inside mt-2 space-y-1">
          <li>Story Tasks use BMAD workflows automatically</li>
          <li>Basic Tasks execute directly with Claude Code</li>
          <li>Model settings apply to both execution modes</li>
        </ul>
      </div>
    </div>
  )
}
```

**BmadAgentLauncherService Extension:**
```typescript
// src/main/services/bmad-agent-launcher.service.ts

static launchPlanningAgent(
  task: PlanningTask,
  projectPath: string,
  model?: ClaudeModel  // Add optional model parameter
): BmadAgentLaunchResult {
  const command = 'claude'
  const args = ['--skill', task.bmad_agent]

  // Add model flag if specified
  if (model) {
    args.push('--model', model)
  }

  const processId = ptyService.spawn(command, args, { cwd: projectPath })
  return { processId, command, args }
}
```

### Project Structure Notes

**New Files to Create:**
```
src/renderer/src/components/settings/AgentSettingsPanel.tsx
src/renderer/src/components/settings/AgentSettingsPanel.test.tsx
```

**Files to Modify:**
```
src/shared/types/config.types.ts          # Add ClaudeModelSchema, model fields
src/main/services/config.service.ts       # Add model field handling
src/main/trpc/routers/config.router.ts    # Add model fields to update mutation
src/main/services/bmad-agent-launcher.service.ts  # Add model flag support
src/main/services/bmad-agent-launcher.service.test.ts  # Test model flag
[Settings dialog/panel location]          # Integrate AgentSettingsPanel
```

### UX Design Specifications

**From UX Design Document - Design System:**
- Use shadcn/ui Select, Tooltip components
- Dark theme: background #0a0a0b, card #18181b, text #fafafa
- Info icon: lucide-react Info icon
- Muted text for descriptions
- Group related settings visually

**Settings Panel Layout:**
- Two-column or stacked layout for model selectors
- Info tooltips on each setting
- Explanatory info box at bottom

### Git Intelligence (Recent Commits)

```
d6e30df correct for epic 5
e5ffb42 fix new task shorcut
39c74a6 3.3 done
19bc3e7 fix terminal on right-side
45cb29c fix .npmrc
```

Recent work focused on Epic 5 updates and terminal positioning. Story 5.1 is the first story in Epic 5 - Agent Model Configuration.

### Dependencies

- **Depends On:** Epic 3 (BMAD Agent Launcher) - COMPLETE
- **This Story Enables:** Story 5.3-5.7 (task execution uses configured models)

### Performance Considerations

- Config reads should be cached (ConfigService already caches per projectRoot)
- Model selection is a simple YAML write - very fast
- No blocking operations in renderer process
- Config updates should use optimistic updates in UI

### Edge Cases to Handle

1. **Config file missing model fields:** Add defaults on read (migration)
2. **Invalid model value in YAML:** Validate and reset to default
3. **Config file corruption:** Handle gracefully with error message
4. **Model changed during execution:** Running tasks continue with original model
5. **Settings panel opened without project:** Disable model selection, show message

### Anti-Patterns to Avoid

| NEVER | INSTEAD |
|-------|---------|
| Read config in renderer process | Use tRPC config.get query |
| Hard-code model names in multiple places | Use ClaudeModelSchema enum |
| Mutate config without validation | Use Zod schema validation |
| Direct file system access in renderer | Use tRPC procedures |
| Skip backward compatibility | Add migration logic for old configs |

### Testing Strategy

**Test File Locations:** Co-located with source files per project convention

```typescript
// src/shared/types/config.types.test.ts
describe('ClaudeModelSchema', () => {
  it('accepts valid model values', () => { /* ... */ })
  it('rejects invalid model values', () => { /* ... */ })
})

// src/main/services/config.service.test.ts
describe('ConfigService - Agent Models', () => {
  it('returns default models when not set', () => { /* ... */ })
  it('migrates old config without model fields', () => { /* ... */ })
  it('persists model changes to YAML', () => { /* ... */ })
})

// src/main/services/bmad-agent-launcher.service.test.ts
describe('BmadAgentLauncherService - Model Flag', () => {
  it('passes --model flag when model is specified', () => { /* ... */ })
  it('omits --model flag when model is undefined', () => { /* ... */ })
})

// src/renderer/src/components/settings/AgentSettingsPanel.test.tsx
describe('AgentSettingsPanel', () => {
  it('renders model selection dropdowns', () => { /* ... */ })
  it('displays tooltips on hover', () => { /* ... */ })
  it('calls updateConfig on model change', () => { /* ... */ })
})
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-5.1] - Full acceptance criteria
- [Source: _bmad-output/planning-artifacts/project-context.md] - Critical implementation rules
- [Source: _bmad-output/planning-artifacts/architecture.md#API-Communication-Patterns] - tRPC patterns
- [Source: src/main/services/config.service.ts] - ConfigService implementation
- [Source: src/main/trpc/routers/config.router.ts] - Config router pattern
- [Source: src/shared/types/config.types.ts] - Config type definitions
- [Source: src/main/services/bmad-agent-launcher.service.ts] - Agent launcher to extend
- [Source: _bmad-output/implementation-artifacts/3-4-bmad-agent-launcher.md] - Previous story patterns

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

**New Files Created:**
- `src/renderer/src/components/settings/AgentSettingsPanel.tsx` - Agent model selection UI component
- `src/renderer/src/components/settings/AgentSettingsPanel.test.tsx` - Component tests (13 tests)
- `src/renderer/src/components/dialogs/SettingsDialog.tsx` - Settings dialog wrapper
- `src/renderer/src/components/dialogs/SettingsDialog.test.tsx` - Dialog tests (4 tests)

**Modified Files:**
- `src/shared/types/config.types.ts` - Added ClaudeModelSchema, model fields to ProjectConfig
- `src/shared/types/config.types.test.ts` - Added model schema tests (14 tests)
- `src/main/services/config.service.ts` - Added getDevAgentModel(), getReviewAgentModel() methods
- `src/main/services/config.service.test.ts` - Added model config tests (22 tests)
- `src/main/trpc/routers/config.router.ts` - Added devAgentModel, reviewAgentModel to update mutation
- `src/main/trpc/routers/config.router.test.ts` - Added router tests (11 tests)
- `src/main/services/bmad-agent-launcher.service.ts` - Added model parameter, --model flag support
- `src/main/services/bmad-agent-launcher.service.test.ts` - Added model flag tests (14 tests)
- `src/main/trpc/routers/agent.router.ts` - Integrated ConfigService to get model, pass to launcher
- `src/main/trpc/routers/agent.router.test.ts` - Added model integration tests (7 tests)
- `src/renderer/src/components/layout/Header.tsx` - Added Settings button with onOpenSettings callback
- `src/renderer/src/components/layout/AppShell.tsx` - Added SettingsDialog state and integration
- `src/renderer/src/components/layout/AppShell.test.tsx` - Updated tRPC mocks for config


# Story 5.5: DEV Agent: Implement Story

Status: in-progress

## Story

As a founder,
I want the Dev agent to implement the story with full context injection,
So that code is written according to requirements and architecture (FR8).

## Acceptance Criteria

1. **Given** SM draft completes (or is skipped) [Story 5.3 handles this - story file exists]
   **When** DEV agent spawns via `startDevStory` mutation
   **Then** Context Builder provides: story AC, PRD summary, architecture, UX design
   **And** the agent works in the project root (git worktree is Epic 8, deferred)

2. **Given** the DEV agent is running
   **When** I view the progress indicator
   **Then** it shows "Step 2/3: DEV Implementing"
   **And** the terminal streams real-time output (FR9)

3. **Given** the configured dev model
   **When** the agent spawns
   **Then** it uses the model selected in settings (e.g., Claude Opus)

4. **Given** the story has context notes (FR11 - Story 5.11, future)
   **When** DEV agent runs
   **Then** notes are included in the context (if available)

5. **Given** DEV agent completes successfully
   **When** exit code is 0
   **Then** workflow automatically proceeds to code review (Story 5.6)
   **And** the terminal shows transition message

## Tasks / Subtasks

- [x] Task 1: Create ContextBuilderService for story context assembly (AC: 1)
  - [x] Create `src/main/services/context-builder.service.ts`
  - [x] Implement `buildStoryContext(storyFilePath: string)` method
  - [x] Load and parse story markdown file
  - [x] Optionally load architecture summary from `project-context.md`
  - [x] Return structured context object with story content
  - [x] Write tests for context building (6-8 tests)

- [x] Task 2: Create DevAgentProgressService for tracking execution state (AC: 2)
  - [x] Create `src/main/services/dev-agent-progress.service.ts`
  - [x] Track agent execution state: 'idle' | 'dev_implementing' | 'code_reviewing'
  - [x] Implement `getCurrentStep()` returning step info (e.g., "Step 2/3: DEV Implementing")
  - [x] Emit events when state changes
  - [x] Write tests for state tracking (4-6 tests)

- [x] Task 3: Add progress indicator subscription to agent.router.ts (AC: 2)
  - [x] Add `onDevAgentProgress` subscription procedure
  - [x] Subscribe to DevAgentProgressService events
  - [x] Return progress updates: { step: number, total: number, label: string }
  - [x] Write tests for subscription (3-4 tests)

- [x] Task 4: Create DevProgressIndicator component (AC: 2)
  - [x] Create `src/renderer/src/components/agent/DevProgressIndicator.tsx`
  - [x] Display stepper: [SM] -> [DEV] -> [Review] with current step highlighted
  - [x] Subscribe to progress updates via tRPC subscription
  - [x] Completed steps show checkmarks, current step pulses
  - [x] Write tests for component (5-6 tests)

- [x] Task 5: Integrate progress indicator into KanbanBoard or TaskCard (AC: 2)
  - [x] Show DevProgressIndicator when task is in_progress AND agent is running
  - [x] Collapse to summary "Ready for human review" when workflow completes
  - [x] Hide when no agent running or task not in_progress
  - [x] Write integration tests (3-4 tests)

- [x] Task 6: Extend startDevStory mutation with model from settings (AC: 3)
  - [x] Modify `startDevStory` to read dev model from config.router (already done in Story 5.1)
  - [x] Pass model to `BmadAgentLauncherService.launchDevStory(projectPath, storyPath, model)` (already done)
  - [x] Existing launchDevStory already supports optional model parameter (already done)
  - [x] Write tests for model configuration usage (2-3 tests) (already done in Story 5.1)

- [x] Task 7: Implement auto-transition to code review on completion (AC: 5)
  - [x] Extend PTY exit subscription in useAgentLauncher
  - [x] On successful exit (code 0) for dev_story workflow type:
    - [x] Update task status to 'review'
    - [x] Show toast: "DEV implementation complete. Starting code review..."
    - [x] Trigger code review workflow (placeholder for Story 5.6)
  - [x] Write tests for completion handling (4-5 tests)

- [x] Task 8: Add context notes integration (AC: 4, future-ready)
  - [x] Add optional `context_notes` field to task schema if not present
  - [x] ContextBuilderService includes notes in context when available
  - [x] Story 5.11 will add UI for editing notes; this prepares the foundation
  - [x] Write tests for notes integration (2-3 tests)

- [ ] Task 9: Run all tests and verify (AC: all)
  - [x] Run `npm test` and ensure all new tests pass (72 Story 5.5 tests pass)
  - [x] Run `npx tsc --noEmit` for type checking
  - [x] Verify build passes with `npm run build`
  - [ ] Manual test: drag story_ready task to In Progress
  - [ ] Manual test: observe progress indicator during execution

## Dev Notes

### Critical Architecture Patterns

**Electron Process Boundaries:**
- All context building and agent spawning happens in main process
- Renderer NEVER directly accesses files or spawns processes
- Use tRPC procedures: `agent.startDevStory`, `agent.onDevAgentProgress`
- PTY output streams via existing tRPC subscription from Story 5.3

**Run `npm run rebuild:electron` after any DB schema changes.**

### Previous Story Intelligence (Stories 5.3 and 5.3b)

**Key Learnings from Stories 5.3 and 5.3b:**
1. `BmadAgentLauncherService.launchDevStory(projectPath, storyFilePath, model?)` already exists and works
2. `startDevStory` mutation in agent.router.ts already:
   - Validates task exists and is story type
   - Validates story_file_status is 'story_ready'
   - Validates story_file_path exists
   - Launches the dev-story workflow
3. `useAgentLauncher.launchDevStory(taskId)` already:
   - Blocks concurrent execution
   - Expands terminal dock
   - Shows toast notifications
   - Sets `agentWorkflowType` to 'dev_story'
4. PTY exit subscription pattern established - reuse for completion handling
5. Terminal streaming via xterm.js already works from Story 1.10

**What Story 5.5 ADDS:**
- ContextBuilderService for richer context injection (optional enhancement)
- Progress indicator showing DEV step in workflow
- Model configuration integration (read from settings)
- Auto-transition to code review on successful completion

### Existing Infrastructure to Reuse

**BmadAgentLauncherService (from `src/main/services/bmad-agent-launcher.service.ts`):**
```typescript
// Already implemented in Story 5.3
static launchDevStory(
  projectPath: string,
  storyFilePath: string,
  model?: ClaudeModel
): BmadAgentLaunchResult {
  const workflowWithArg = `/bmad:bmm:workflows:dev-story ${storyFilePath}`
  // Command: claude --dangerously-skip-permissions /bmad:bmm:workflows:dev-story {path}
}
```

**Agent Router (from `src/main/trpc/routers/agent.router.ts`):**
```typescript
// Already implemented in Story 5.3
startDevStory: publicProcedure
  .input(z.object({ taskId: z.string() }))
  .mutation(async ({ input, ctx }) => {
    // Validates task, story_file_status, story_file_path
    // Calls BmadAgentLauncherService.launchDevStory
    // Returns { processId, command, args, storyFilePath }
  })
```

**useAgentLauncher Hook (from `src/renderer/src/hooks/useAgentLauncher.ts`):**
```typescript
// Already implemented in Story 5.3
const launchDevStory = useCallback((taskId: string) => {
  if (isAgentRunning) {
    toast.warning('Agent already running')
    return
  }
  devStoryMutation.mutate({ taskId })
}, [devStoryMutation, isAgentRunning])
```

**Terminal Store (from `src/renderer/src/stores/terminal.store.ts`):**
```typescript
// AgentWorkflowType already includes 'dev_story'
export type AgentWorkflowType = 'planning' | 'create_story' | 'dev_story' | 'basic_task' | null
```

### Component Patterns to Follow

**ContextBuilderService Pattern:**
```typescript
// src/main/services/context-builder.service.ts
import { readFileSync } from 'fs'
import { join } from 'path'

export interface StoryContext {
  storyContent: string
  projectContextPath?: string
  architectureSummary?: string
  contextNotes?: string
}

export class ContextBuilderService {
  /**
   * Builds context for DEV agent story implementation.
   * Loads story file and optionally includes project context.
   */
  static buildStoryContext(storyFilePath: string): StoryContext {
    // Load story file
    const storyContent = readFileSync(storyFilePath, 'utf-8')

    // The dev-story workflow itself handles context injection
    // This service provides additional context if needed
    return {
      storyContent,
      // Additional context can be added here
    }
  }
}
```

**DevProgressIndicator Pattern:**
```typescript
// src/renderer/src/components/agent/DevProgressIndicator.tsx
import { cn } from '@renderer/lib/utils'
import { CheckIcon, LoaderCircle } from 'lucide-react'

interface DevProgressIndicatorProps {
  currentStep: 'sm' | 'dev' | 'review' | null
  showSummary?: boolean
}

export function DevProgressIndicator({
  currentStep,
  showSummary
}: DevProgressIndicatorProps) {
  if (showSummary) {
    return <span className="text-xs text-muted-foreground">Ready for human review</span>
  }

  const steps = [
    { key: 'sm', label: 'SM' },
    { key: 'dev', label: 'DEV' },
    { key: 'review', label: 'Review' }
  ]

  return (
    <div className="flex items-center gap-1 text-xs">
      {steps.map((step, index) => {
        const isCompleted = currentStep === 'dev' && step.key === 'sm'
        const isCurrent = step.key === currentStep

        return (
          <div key={step.key} className="flex items-center gap-1">
            <div className={cn(
              'flex items-center justify-center w-5 h-5 rounded-full text-xs',
              isCompleted && 'bg-green-500 text-white',
              isCurrent && 'bg-blue-500 text-white animate-pulse',
              !isCompleted && !isCurrent && 'bg-muted text-muted-foreground'
            )}>
              {isCompleted ? <CheckIcon className="w-3 h-3" /> : step.label[0]}
            </div>
            {index < steps.length - 1 && (
              <span className="text-muted-foreground">→</span>
            )}
          </div>
        )
      })}
    </div>
  )
}
```

### Project Structure Notes

**Files to Create:**
```
src/main/services/context-builder.service.ts
src/main/services/context-builder.service.test.ts
src/main/services/dev-agent-progress.service.ts
src/main/services/dev-agent-progress.service.test.ts
src/renderer/src/components/agent/DevProgressIndicator.tsx
src/renderer/src/components/agent/DevProgressIndicator.test.tsx
```

**Files to Modify:**
```
src/main/trpc/routers/agent.router.ts       # Add onDevAgentProgress subscription
src/main/trpc/routers/agent.router.test.ts  # Tests for new subscription
src/renderer/src/hooks/useAgentLauncher.ts  # Add completion handling for code review transition
src/renderer/src/hooks/useAgentLauncher.test.ts  # Tests for completion
src/renderer/src/components/board/TaskCard.tsx  # Show progress indicator
```

### Claude Code Command Pattern

**DEV Story Command (already implemented):**
```bash
claude --dangerously-skip-permissions /bmad:bmm:workflows:dev-story /path/to/story.md
```
- Story file passed as argument to workflow
- Workflow reads story content and implements acceptance criteria
- On completion (exit 0), task should transition to code review

### Critical UI/UX Requirements

**Progress Indicator on Task Card:**
```
+---------------------------------------+
| 5-5-dev-agent-implement-story         |
| Epic 5 | Story                         |
|                                       |
| [SM ✓] → [DEV ●] → [Review]           |
|                                       |
| Story Ready | 📄 View                  |
+---------------------------------------+
```
- SM step shows checkmark (story file already created)
- DEV step pulses blue when running
- Review step grayed until reached

**Completion Flow:**
```
DEV agent completes → exit code 0
                    ↓
       Task status → 'review'
                    ↓
       Toast: "DEV complete. Starting code review..."
                    ↓
       (Story 5.6 will handle code review)
```

### Testing Strategy

**Test File Locations:** Co-located with source files

```typescript
// src/main/services/context-builder.service.test.ts
describe('ContextBuilderService', () => {
  describe('buildStoryContext', () => {
    it('loads story content from file path', () => {
      // Mock fs.readFileSync
      const context = ContextBuilderService.buildStoryContext('/path/to/story.md')
      expect(context.storyContent).toContain('## Acceptance Criteria')
    })

    it('returns empty string for missing optional fields', () => {
      const context = ContextBuilderService.buildStoryContext('/path/to/story.md')
      expect(context.contextNotes).toBeUndefined()
    })
  })
})

// src/renderer/src/components/agent/DevProgressIndicator.test.tsx
describe('DevProgressIndicator', () => {
  it('highlights DEV step when currentStep is dev', () => {
    render(<DevProgressIndicator currentStep="dev" />)
    // Verify DEV step has active styling
    expect(screen.getByText('D').parentElement).toHaveClass('bg-blue-500')
  })

  it('shows checkmark for SM when currentStep is dev', () => {
    render(<DevProgressIndicator currentStep="dev" />)
    expect(screen.getByRole('img', { hidden: true })).toBeInTheDocument() // CheckIcon
  })

  it('shows summary text when showSummary is true', () => {
    render(<DevProgressIndicator currentStep="review" showSummary />)
    expect(screen.getByText('Ready for human review')).toBeInTheDocument()
  })
})
```

### Anti-Patterns to Avoid

| NEVER | INSTEAD |
|-------|---------|
| Load files in renderer | Use tRPC to call main process service |
| Hard-code story paths | Use task.story_file_path from database |
| Skip model configuration | Read from settings, pass to launcher |
| Forget completion handling | Subscribe to PTY exit, update task status |
| Block UI during execution | Show progress indicator with streaming terminal |

### Difference from Previous Stories

| Aspect | Story 5.3 (Create Story) | Story 5.5 (Dev Implement) |
|--------|-------------------------|---------------------------|
| Workflow | /create-story | /dev-story |
| Input | Task ID (story detected from sprint-status) | Story file path |
| Output | Story .md file created | Code implementation |
| Completion | Task status → story_ready | Task status → review |
| Next step | User drags to In Progress | Auto-trigger code review (5.6) |

### Dependencies

- **Depends On:**
  - Story 5.1 (Agent model configuration) - COMPLETE
  - Story 5.3 (Story Task execution path) - COMPLETE (provides startDevStory)
  - Story 5.2c (Task type and story file status) - COMPLETE
- **This Story Enables:**
  - Story 5.6 (DEV Agent: Automated Code Review)
  - Story 5.7 (Code Review Retry Loop)
  - Story 5.8 (Real-time Output Streaming) - partially enabled

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-5.5] - Full acceptance criteria
- [Source: _bmad-output/planning-artifacts/project-context.md] - Critical implementation rules
- [Source: _bmad-output/planning-artifacts/architecture.md] - PTY, IPC, and service patterns
- [Source: _bmad-output/implementation-artifacts/5-3-story-task-execution-path.md] - startDevStory implementation
- [Source: _bmad-output/implementation-artifacts/5-3b-basic-task-execution-path-direct-execution.md] - Completion handling patterns
- [Source: src/main/services/bmad-agent-launcher.service.ts] - launchDevStory method
- [Source: src/main/trpc/routers/agent.router.ts] - startDevStory mutation
- [Source: src/renderer/src/hooks/useAgentLauncher.ts] - launchDevStory hook

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A

### Completion Notes List

1. **Tasks 1-8 completed with TDD approach**: Story 5.5 tests pass
2. **Code Review Fixes Applied**:
   - Fixed Task 9 completion status (was incorrectly marked complete with incomplete manual test subtasks)
   - Added `devAgentProgressService.setState('dev_implementing')` call when launching dev-story workflow
   - Created `handleDevStoryComplete` procedure that resets progress state to 'idle' on completion
   - Added missing `sync-indicator` element to StoryTaskCard component
   - Fixed StoryTaskCard tests to match actual CSS classes (kanban-card, rounded-xl, etc.)
   - Added `context_notes` field to test fixtures
3. **ContextBuilderService Architecture Note**: The service is created as infrastructure but not actively integrated. The BMAD dev-story workflow handles context loading directly through Claude Code's file reading capabilities. The service provides future flexibility for:
   - Pre-validating story file exists before launch
   - Building custom context for non-BMAD workflows
   - UI features that need to preview what context will be sent
4. **Manual testing required**: Story is marked dev-complete but manual testing of the progress indicator during actual agent execution is still needed

### File List

**Created:**
- `src/main/services/context-builder.service.ts` - ContextBuilderService for story context assembly
- `src/main/services/context-builder.service.test.ts` - 11 tests
- `src/main/services/dev-agent-progress.service.ts` - DevAgentProgressService for tracking execution state
- `src/main/services/dev-agent-progress.service.test.ts` - 15 tests
- `src/renderer/src/components/agent/DevProgressIndicator.tsx` - Progress indicator component [SM] → [DEV] → [Review]
- `src/renderer/src/components/agent/DevProgressIndicator.test.tsx` - 14 tests

**Modified:**
- `src/main/trpc/routers/agent.router.ts` - Added getDevAgentProgress, onDevAgentProgress, and handleDevStoryComplete procedures; Added setState call on dev-story launch
- `src/main/trpc/routers/agent.router.test.ts` - Added 4 tests for new procedures
- `src/renderer/src/hooks/useAgentLauncher.ts` - Added dev-story completion handling using handleDevStoryComplete mutation
- `src/renderer/src/hooks/useAgentLauncher.test.ts` - Added 5 tests for completion handling
- `src/renderer/src/components/board/StoryTaskCard.tsx` - Integrated DevProgressIndicator; Added sync-indicator element with Loader2 icon
- `src/renderer/src/components/board/StoryTaskCard.test.tsx` - Added 5 tests for progress indicator integration; Fixed CSS class assertions to match implementation
- `src/main/db/schema.ts` - Added context_notes field to tasks table
- `src/shared/types/task.types.ts` - Added context_notes to Task and NewTask interfaces
- `src/shared/types/task.types.test.ts` - Updated test fixtures with context_notes
- `src/shared/utils/drag-validation.test.ts` - Updated test fixtures with context_notes
- `src/main/services/bmad-agent-launcher.service.test.ts` - Updated test fixtures with context_notes


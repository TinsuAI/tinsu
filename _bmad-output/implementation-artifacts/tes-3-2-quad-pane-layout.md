# Story TES-3.2: Quad-Pane Layout

Status: done

---

## Story

As a user,
I want to see Terminal, Activities, Diff, and Content all at once,
So that I have complete visibility without switching tabs.

**Story ID:** TES-3.2
**Epic:** TES Epic 3 - Quad-Pane Task Workspace

---

## Acceptance Criteria

1. **Given** the task detail panel is open on a large screen (1024px+), **When** the layout renders, **Then** four sections are displayed in a 2x2 grid, **And** Terminal is top-left, Activities is top-right, **And** Diff is bottom-left, Content is bottom-right

2. **Given** each section in the quad-pane, **When** displayed, **Then** each section has a header with section name, **And** each section has an expand button in the header, **And** sections have subtle borders for visual separation

3. **Given** the viewport is resized, **When** width remains above 1024px, **Then** the quad-pane layout is maintained with proportional sizing

---

## Tasks / Subtasks

- [x] Task 1: Create QuadPaneLayout component shell (AC: #1, #2)
  - [x] 1.1: Create `src/renderer/src/components/task/QuadPaneLayout.tsx` with 2x2 CSS Grid container
  - [x] 1.2: Define grid template: `grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr`
  - [x] 1.3: Add gap spacing between panes using `gap-3` (12px)
  - [x] 1.4: Ensure grid fills available height with `h-full` on container
  - [x] 1.5: Write unit tests for QuadPaneLayout rendering all 4 children

- [x] Task 2: Create QuadPaneSection wrapper component (AC: #2)
  - [x] 2.1: Create `src/renderer/src/components/task/QuadPaneSection.tsx` with header + content structure
  - [x] 2.2: Header includes: section icon, section name, expand button (Maximize2 icon)
  - [x] 2.3: Add subtle border styling: `border border-border/30 rounded-lg`
  - [x] 2.4: Add background for visual separation: `bg-card/30`
  - [x] 2.5: Content area scrollable independently: `overflow-auto`
  - [x] 2.6: Write unit tests for section header, expand button, and content rendering

- [x] Task 3: Integrate existing tab content into quad-pane sections (AC: #1)
  - [x] 3.1: Refactor `TaskDetailContent.tsx` to support both tabbed and quad-pane modes
  - [x] 3.2: Create `QuadPaneTerminalSection` wrapping existing `TaskTerminal` component
  - [x] 3.3: Create `QuadPaneActivitiesSection` wrapping existing `ActivitiesTab` component
  - [x] 3.4: Create `QuadPaneDiffSection` with placeholder (Epic 4 will implement full diff viewer)
  - [x] 3.5: Create `QuadPaneContentSection` wrapping existing markdown content display
  - [x] 3.6: Write integration tests for quad-pane with all sections

- [x] Task 4: Add quad-pane store for section state (AC: #2)
  - [x] 4.1: Create `src/renderer/src/stores/quad-pane.store.ts` using Zustand
  - [x] 4.2: Add state: `expandedSection: 'terminal' | 'activities' | 'diff' | 'content' | null`
  - [x] 4.3: Add state: `layoutMode: 'quad' | 'tabbed'` (for responsive fallback)
  - [x] 4.4: Add action: `expandSection(section)`, `collapseSection()`, `setLayoutMode(mode)`
  - [x] 4.5: Write unit tests for store state transitions

- [x] Task 5: Implement responsive breakpoint detection (AC: #3)
  - [x] 5.1: Create custom hook `useQuadPaneLayout` to detect viewport width
  - [x] 5.2: Return `layoutMode: 'quad'` when width >= 1024px
  - [x] 5.3: Return `layoutMode: 'tabbed'` when width < 1024px
  - [x] 5.4: Use `ResizeObserver` or `window.matchMedia` for efficient detection
  - [x] 5.5: Update quad-pane store's `layoutMode` on viewport change
  - [x] 5.6: Write tests for breakpoint detection and mode switching

- [x] Task 6: Conditional layout rendering in TaskDetailContent (AC: #1, #3)
  - [x] 6.1: Modify `TaskDetailContent` to check `layoutMode` from store/hook
  - [x] 6.2: Render `QuadPaneLayout` when `layoutMode === 'quad'`
  - [x] 6.3: Render existing tabbed interface when `layoutMode === 'tabbed'`
  - [x] 6.4: Ensure smooth transition when resizing across breakpoint
  - [x] 6.5: Preserve scroll positions and state when switching layouts
  - [x] 6.6: Write tests for conditional rendering based on viewport

- [x] Task 7: Add Diff placeholder section (AC: #1, #2)
  - [x] 7.1: Create `DiffPlaceholder.tsx` component with "Diff viewer coming soon" message
  - [x] 7.2: Style to match quad-pane visual language
  - [x] 7.3: Add icon (GitDiff from lucide-react) for visual consistency
  - [x] 7.4: Note: Full diff implementation deferred to Epic 4 (TES-4.x stories)

---

## Dev Notes

### Architecture Compliance

This story implements **FR21** from the Task Execution Sandbox PRD:
> FR21: User can view task details with all 4 sections visible simultaneously on large screens (Terminal, Activities, Diff, Content in a quad-pane layout)

And **UX1** from the UX Design Specification:
> UX1: Quad-pane Task Detail Layout — all 4 sections (Terminal, Activities, Diff, Content) visible simultaneously on large screens

[Source: _bmad-output/planning-artifacts/prd-task-execution-sandbox.md#task-detail-view]
[Source: _bmad-output/planning-artifacts/ux-design-specification.md#the-4-tab-task-detail-interface]

### Current State Analysis (From TES-3.1)

**Existing Implementation:**
- `TaskDetailPanel.tsx` at `src/renderer/src/components/task/TaskDetailPanel.tsx` - Slide-over container (65% desktop width)
- `TaskDetailContent.tsx` at `src/renderer/src/components/task/TaskDetailContent.tsx` - Currently uses tabbed interface
- Uses tabs: Content (1), Activities (2), Terminal (3)
- Tab state managed locally via `useState<'content' | 'activities' | 'terminal'>('content')`
- Keyboard shortcuts: 1/2/3 for tab switching already implemented

**Components to Reuse:**
- `TaskTerminal` component at `src/renderer/src/components/task/TaskTerminal.tsx`
- `ActivitiesTab` component at `src/renderer/src/components/task/ActivitiesTab.tsx`
- Markdown content rendering already in `TaskDetailContent.tsx`

**Required Transformation:**
- Add responsive check for 1024px+ screens
- Create 2x2 CSS Grid layout for quad-pane mode
- Wrap each section with header + expand button
- Keep tabbed mode as fallback for smaller screens

### Previous Story Learnings (TES-3.1) - CRITICAL

**From TES-3.1 (Task Detail Panel Container) - COMPLETED:**
- Panel uses slide-over from right with 65% desktop width
- Glass morphism styling: `bg-background/95 backdrop-blur-xl`
- Cinematic depth with layered shadows
- Body scroll lock when panel is open
- Focus management with `previousFocusElement` tracking
- Keyboard: Escape to close (checks for editor focus first)
- Tab keyboard shortcuts (1/2/3) implemented in `TaskDetailContent`

**Code Patterns Established:**
```typescript
// Zustand store pattern from task-detail-panel.store.ts
export const useTaskDetailPanelStore = create<State & Actions>((set) => ({
  isOpen: false,
  activeTaskId: null,
  previousFocusElement: null,
  openPanel: (id) => set({ isOpen: true, activeTaskId: id, previousFocusElement: document.activeElement as HTMLElement }),
  closePanel: () => set((state) => { ... }),
  switchTask: (id) => set({ activeTaskId: id })
}))
```

**Files Modified in TES-3.1:**
- `src/renderer/src/components/board/KanbanBoardContainer.tsx` - Integrated TaskDetailPanel
- `src/renderer/src/components/board/KanbanBoard.tsx` - Added selectedTaskId prop
- `src/renderer/src/components/board/TaskCard.tsx` - Added onClick and isSelected props
- `src/renderer/src/components/board/SortableStoryTaskCard.tsx` - Pass through isSelected
- `src/renderer/src/globals.css` - Added panel-specific CSS classes

**Git Intelligence - Recent Commits:**
```
955db90 chore: complete code review for tes-3-1 (Task Detail Panel)
2652105 deps: update electron-builder to 26.5.0.
d9a5093 feat: Add real-time activity streaming to the ActivitiesTab
```

### Technical Implementation Guidance

**1. QuadPaneLayout Component Structure**

```typescript
// src/renderer/src/components/task/QuadPaneLayout.tsx
import { ReactNode } from 'react'
import { cn } from '@renderer/lib/utils'

interface QuadPaneLayoutProps {
  terminal: ReactNode
  activities: ReactNode
  diff: ReactNode
  content: ReactNode
  className?: string
}

export function QuadPaneLayout({
  terminal,
  activities,
  diff,
  content,
  className
}: QuadPaneLayoutProps) {
  return (
    <div
      className={cn(
        'grid h-full grid-cols-2 grid-rows-2 gap-3',
        className
      )}
    >
      {/* Top-left: Terminal */}
      <div className="min-h-0">{terminal}</div>

      {/* Top-right: Activities */}
      <div className="min-h-0">{activities}</div>

      {/* Bottom-left: Diff */}
      <div className="min-h-0">{diff}</div>

      {/* Bottom-right: Content */}
      <div className="min-h-0">{content}</div>
    </div>
  )
}
```

**2. QuadPaneSection Component**

```typescript
// src/renderer/src/components/task/QuadPaneSection.tsx
import { ReactNode } from 'react'
import { Maximize2, LucideIcon } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { Button } from '@renderer/components/ui/button'

interface QuadPaneSectionProps {
  title: string
  icon: LucideIcon
  children: ReactNode
  onExpand?: () => void
  className?: string
}

export function QuadPaneSection({
  title,
  icon: Icon,
  children,
  onExpand,
  className
}: QuadPaneSectionProps) {
  return (
    <div
      className={cn(
        'flex h-full flex-col overflow-hidden',
        'rounded-lg border border-border/30 bg-card/30',
        className
      )}
    >
      {/* Section header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border/20 px-3 py-2">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Icon className="h-4 w-4" />
          {title}
        </div>
        {onExpand && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            onClick={onExpand}
            aria-label={`Expand ${title}`}
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Section content */}
      <div className="min-h-0 flex-1 overflow-auto">
        {children}
      </div>
    </div>
  )
}
```

**3. Responsive Hook**

```typescript
// src/renderer/src/hooks/useQuadPaneLayout.ts
import { useState, useEffect } from 'react'
import { useQuadPaneStore } from '@renderer/stores/quad-pane.store'

const QUAD_PANE_BREAKPOINT = 1024

export function useQuadPaneLayout() {
  const { setLayoutMode } = useQuadPaneStore()
  const [layoutMode, setLocalLayoutMode] = useState<'quad' | 'tabbed'>(() =>
    typeof window !== 'undefined' && window.innerWidth >= QUAD_PANE_BREAKPOINT
      ? 'quad'
      : 'tabbed'
  )

  useEffect(() => {
    const mediaQuery = window.matchMedia(`(min-width: ${QUAD_PANE_BREAKPOINT}px)`)

    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      const mode = e.matches ? 'quad' : 'tabbed'
      setLocalLayoutMode(mode)
      setLayoutMode(mode)
    }

    // Initial check
    handleChange(mediaQuery)

    // Listen for changes
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [setLayoutMode])

  return layoutMode
}
```

**4. Quad-Pane Store**

```typescript
// src/renderer/src/stores/quad-pane.store.ts
import { create } from 'zustand'

type SectionId = 'terminal' | 'activities' | 'diff' | 'content'
type LayoutMode = 'quad' | 'tabbed'

interface QuadPaneState {
  expandedSection: SectionId | null
  layoutMode: LayoutMode
}

interface QuadPaneActions {
  expandSection: (section: SectionId) => void
  collapseSection: () => void
  setLayoutMode: (mode: LayoutMode) => void
}

export const useQuadPaneStore = create<QuadPaneState & QuadPaneActions>((set) => ({
  expandedSection: null,
  layoutMode: 'quad',

  expandSection: (section) => set({ expandedSection: section }),
  collapseSection: () => set({ expandedSection: null }),
  setLayoutMode: (mode) => set({ layoutMode: mode })
}))
```

**5. Integration in TaskDetailContent**

```typescript
// Modify TaskDetailContent.tsx
import { useQuadPaneLayout } from '@renderer/hooks/useQuadPaneLayout'
import { QuadPaneLayout } from './QuadPaneLayout'
import { QuadPaneSection } from './QuadPaneSection'
import { Terminal, Activity, GitDiff, BookOpen } from 'lucide-react'

export function TaskDetailContent({ taskId, onClose }: TaskDetailContentProps) {
  const layoutMode = useQuadPaneLayout()

  // ... existing state and data fetching ...

  // Render quad-pane on large screens
  if (layoutMode === 'quad') {
    return (
      <div className="flex h-full flex-col">
        {/* Header (same as before) */}
        <header>...</header>

        {/* Quad-pane layout */}
        <div className="min-h-0 flex-1 p-4">
          <QuadPaneLayout
            terminal={
              <QuadPaneSection title="Terminal" icon={Terminal}>
                <TaskTerminal ref={terminalRef} taskId={taskId} />
              </QuadPaneSection>
            }
            activities={
              <QuadPaneSection title="Activities" icon={Activity}>
                <ActivitiesTab taskId={taskId} />
              </QuadPaneSection>
            }
            diff={
              <QuadPaneSection title="Diff" icon={GitDiff}>
                <DiffPlaceholder />
              </QuadPaneSection>
            }
            content={
              <QuadPaneSection title="Content" icon={BookOpen}>
                {/* Existing markdown content */}
              </QuadPaneSection>
            }
          />
        </div>
      </div>
    )
  }

  // Existing tabbed layout for smaller screens
  return (
    // ... existing tabbed implementation ...
  )
}
```

### Project Structure Notes

**Files to Create:**

| File | Purpose |
|------|---------|
| `src/renderer/src/components/task/QuadPaneLayout.tsx` | 2x2 CSS Grid container |
| `src/renderer/src/components/task/QuadPaneLayout.test.tsx` | Layout tests |
| `src/renderer/src/components/task/QuadPaneSection.tsx` | Section wrapper with header |
| `src/renderer/src/components/task/QuadPaneSection.test.tsx` | Section tests |
| `src/renderer/src/components/task/DiffPlaceholder.tsx` | Placeholder for Epic 4 |
| `src/renderer/src/stores/quad-pane.store.ts` | Quad-pane state management |
| `src/renderer/src/stores/quad-pane.store.test.ts` | Store tests |
| `src/renderer/src/hooks/useQuadPaneLayout.ts` | Responsive breakpoint hook |
| `src/renderer/src/hooks/useQuadPaneLayout.test.ts` | Hook tests |

**Files to Modify:**

| File | Action | Purpose |
|------|--------|---------|
| `src/renderer/src/components/task/TaskDetailContent.tsx` | MODIFY | Add conditional quad-pane vs tabbed rendering |
| `src/renderer/src/stores/index.ts` | MODIFY | Export new quad-pane store |

**Naming Conventions:**
| Element | Convention | Example |
|---------|------------|---------|
| Components | PascalCase | `QuadPaneLayout`, `QuadPaneSection` |
| Stores | kebab-case + .store.ts | `quad-pane.store.ts` |
| Hooks | camelCase with use prefix | `useQuadPaneLayout` |

[Source: _bmad-output/planning-artifacts/project-context.md#naming-conventions]

### CSS Grid Notes

**Critical:** Use `min-h-0` on grid children to prevent content from overflowing grid cells. This is a common CSS Grid gotcha with flex children.

```css
/* Grid cell needs min-h-0 to allow overflow:auto to work on children */
.grid-child {
  min-height: 0; /* Allows flex/grid children to shrink */
}
```

### Non-Functional Requirements

| NFR | Target | Notes |
|-----|--------|-------|
| Layout render | <100ms | CSS Grid is performant |
| Resize response | <16ms | 60fps responsive resize |
| Memory | Minimal | No duplicate DOM for sections |
| Scroll independence | Yes | Each section scrolls independently |

[Source: _bmad-output/planning-artifacts/epics-task-execution-sandbox.md#non-functional-requirements]

### Scope Notes

**In Scope (This Story):**
- 2x2 CSS Grid quad-pane layout for 1024px+ screens
- Section headers with title, icon, expand button
- Responsive detection (quad vs tabbed mode)
- Integration of existing Terminal and Activities components
- Diff placeholder (visual stub only)
- Content section with markdown rendering
- Quad-pane store for expanded section state

**Out of Scope (Future Stories):**
- Section expand/collapse to full view (Story 3.3)
- Full diff viewer implementation (Epic 4)
- Workflow phase indicators (Epic 5)
- Manual trigger buttons (Epic 5)

### Simplicity Assessment

This is a **moderate complexity story** involving:
- New CSS Grid layout component
- Responsive breakpoint detection
- Store for expanded section state
- Refactoring TaskDetailContent for conditional rendering

**Key Complexity Points:**
1. Ensuring grid cells don't overflow (min-h-0 pattern)
2. Preserving existing terminal/activities functionality in new wrapper
3. Smooth transition when resizing across breakpoint
4. Independent scrolling in each section

**Risk Mitigation:**
- Keep existing tabbed layout as fallback
- Test terminal attachment in grid context
- Use established store patterns from TES-3.1

### Important Notes

**🎨 FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.**

This story is primarily a **frontend layout architecture change**. The dev agent should:
1. Create QuadPaneLayout grid component
2. Create QuadPaneSection wrapper with header
3. Set up responsive hook and store
4. Refactor TaskDetailContent for conditional rendering
5. Add Diff placeholder
6. Write comprehensive tests for all new components

### References

- [Architecture: Task Detail View](/_bmad-output/planning-artifacts/architecture.md#task-execution-sandbox-architecture)
- [PRD: FR21-FR25](/_bmad-output/planning-artifacts/prd-task-execution-sandbox.md#task-detail-view)
- [UX Design: Quad-Pane Layout](/_bmad-output/planning-artifacts/ux-design-specification.md#the-4-tab-task-detail-interface)
- [Epics: Story 3.2](/_bmad-output/planning-artifacts/epics-task-execution-sandbox.md#story-32-quad-pane-layout)
- [Project Context](/_bmad-output/planning-artifacts/project-context.md)
- [TES-3.1: Task Detail Panel Container](/_bmad-output/implementation-artifacts/tes-3-1-task-detail-panel-container.md)

### Testing Notes

Run tests with:
```bash
npm test src/renderer/src/components/task/QuadPaneLayout.test.tsx
npm test src/renderer/src/components/task/QuadPaneSection.test.tsx
npm test src/renderer/src/stores/quad-pane.store.test.ts
npm test src/renderer/src/hooks/useQuadPaneLayout.test.ts
```

**Remember native module rebuild:**
```bash
npm run rebuild:node   # Before tests
npm run rebuild:electron  # After tests (automatic via posttest)
```

---

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A - No debug issues encountered

### Completion Notes List

- Created QuadPaneLayout component with 2x2 CSS Grid layout
- Created QuadPaneSection wrapper with header (icon, title, expand button) and scrollable content
- Created DiffPlaceholder component for Epic 4 implementation
- Created quad-pane.store.ts with Zustand for section state management
- Created useQuadPaneLayout hook using window.matchMedia for efficient breakpoint detection
- Refactored TaskDetailContent.tsx to conditionally render quad-pane (1024px+) or tabbed layout
- Extracted markdownComponents constant for shared markdown rendering
- All 43 unit tests passing across 4 test files
- Design follows "Mission Control Station" aesthetic with glass morphism and hover effects

### File List

**New Files:**
- `src/renderer/src/components/task/QuadPaneLayout.tsx` - 2x2 CSS Grid container component
- `src/renderer/src/components/task/QuadPaneLayout.test.tsx` - 9 unit tests
- `src/renderer/src/components/task/QuadPaneSection.tsx` - Section wrapper with header
- `src/renderer/src/components/task/QuadPaneSection.test.tsx` - 15 unit tests
- `src/renderer/src/components/task/DiffPlaceholder.tsx` - Placeholder for Epic 4
- `src/renderer/src/components/task/MarkdownComponents.tsx` - Shared markdown component overrides
- `src/renderer/src/components/ui/code-block.tsx` - Syntax highlighting component
- `src/renderer/src/stores/quad-pane.store.ts` - Zustand store for section state
- `src/renderer/src/stores/quad-pane.store.test.ts` - 12 unit tests
- `src/renderer/src/hooks/useQuadPaneLayout.ts` - Responsive breakpoint detection hook
- `src/renderer/src/hooks/useQuadPaneLayout.test.ts` - 7 unit tests

**Modified Files:**
- `src/renderer/src/components/task/TaskDetailContent.tsx` - Added conditional quad-pane/tabbed rendering
- `src/renderer/src/components/task/TaskDetailContent.test.tsx` - Updated tests for responsive layout

---

## Change Log

| Date | Change Description |
|------|-------------------|
| 2026-01-19 | Story created from TES Epic 3 breakdown. Ready for dev-story execution. |
| 2026-01-19 | Implementation complete. All 7 tasks completed with 43 passing tests. Ready for review. |

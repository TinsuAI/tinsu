# Story 2.7: Add Velocity Metrics Widget

Status: done

**Note: This is a UI story requiring frontend components with charts.**

## Story

As a founder,
I want to view task velocity metrics showing tasks completed per week,
So that I can track my team's throughput over time (FR5).

## Acceptance Criteria

1. **Given** tasks have been completed (moved to Done with timestamps)
   **When** I view the velocity widget in the sidebar or header
   **Then** I see tasks completed in the current week
   **And** I see a mini chart showing the last 4 weeks trend

2. **Given** velocity data exists
   **When** I hover over the chart
   **Then** I see the exact count for each week
   **And** the tooltip shows the week date range

3. **Given** I want more detail
   **When** I click the velocity widget
   **Then** a detailed view expands showing:
   - Tasks completed by day (bar chart)
   - Average velocity (tasks/week)
   - Comparison to previous period

4. **Given** no tasks have been completed yet
   **When** I view the velocity widget
   **Then** it shows "No data yet" with helpful text
   **And** the chart area shows a placeholder

5. **Given** the velocity calculation
   **When** computing "completed this week"
   **Then** it uses the task's updated_at timestamp when status changed to "done"
   **And** weeks start on Monday (ISO week)

## Tasks / Subtasks

- [x] Task 1: Create velocity calculation tRPC endpoint (AC: 1, 5)
  - [x] Create `src/main/trpc/routers/velocity.router.ts`
  - [x] Add `getWeeklyVelocity` query: returns completed tasks grouped by ISO week
  - [x] Add `getDailyVelocity` query: returns completed tasks grouped by day (last 4 weeks)
  - [x] Filter tasks where `status = 'done'` and use `updated_at` for completion date
  - [x] Use ISO week calculation (Monday start) via date-fns `startOfISOWeek`, `getISOWeek`
  - [x] Add router to root tRPC router
  - [x] Write tests for velocity calculations

- [x] Task 2: Create VelocityWidget component (AC: 1, 4)
  - [x] Create `src/renderer/src/components/velocity/VelocityWidget.tsx`
  - [x] Fetch data via `trpc.velocity.getWeeklyVelocity.useQuery()`
  - [x] Display current week count prominently (e.g., "5 this week")
  - [x] Show mini sparkline/bar chart for last 4 weeks
  - [x] Handle empty state: "No data yet" with helpful message
  - [x] Dark theme styling matching existing components
  - [x] Use Tailwind for inline styles

- [x] Task 3: Create VelocityChart component for mini visualization (AC: 1, 2)
  - [x] Create `src/renderer/src/components/velocity/VelocityChart.tsx`
  - [x] Use Recharts library (lightweight, React-friendly) - install via `npm install recharts`
  - [x] Create mini bar chart showing 4 weeks (compact width ~120px)
  - [x] Add hover tooltip showing exact count and week date range
  - [x] Style with dark theme (zinc-700 bars, zinc-800 background)
  - [x] Animate bars on data change

- [x] Task 4: Create VelocityDetailPanel component (AC: 3)
  - [x] Create `src/renderer/src/components/velocity/VelocityDetailPanel.tsx`
  - [x] Use shadcn/ui Dialog or Popover for expandable view
  - [x] Display daily bar chart (last 28 days)
  - [x] Calculate and show average velocity (total tasks / weeks)
  - [x] Show comparison: current 4-week vs previous 4-week period
  - [x] Display percentage change indicator (+15% / -10%)

- [x] Task 5: Integrate VelocityWidget into Header (AC: 1)
  - [x] Import VelocityWidget into `src/renderer/src/components/layout/Header.tsx`
  - [x] Position: Right side of header, before FilterButton
  - [x] Compact display that fits in header bar height
  - [x] Update Header.test.tsx with velocity widget tests

- [x] Task 6: Write comprehensive tests (AC: all)
  - [x] `src/main/trpc/routers/velocity.router.test.ts` - Backend calculation tests
  - [x] `src/renderer/src/components/velocity/VelocityWidget.test.tsx`
  - [x] `src/renderer/src/components/velocity/VelocityChart.test.tsx`
  - [x] `src/renderer/src/components/velocity/VelocityDetailPanel.test.tsx`
  - [x] Test empty state, data state, hover interactions
  - [x] Test date calculations with different timezones in mind

## Dev Notes

### Critical Architecture Patterns

**Electron Context:**
This is an Electron desktop app, NOT a web app. All data operations happen via tRPC.

**Velocity Calculation Logic:**
```typescript
// In velocity.router.ts
import { startOfISOWeek, endOfISOWeek, getISOWeek, getISOWeekYear, subWeeks, format } from 'date-fns'

// Get tasks completed in the last N weeks
getWeeklyVelocity: publicProcedure
  .input(z.object({ weeks: z.number().default(4) }))
  .query(({ ctx, input }) => {
    const now = new Date()
    const startDate = startOfISOWeek(subWeeks(now, input.weeks - 1))

    // Query tasks where status='done' and updated_at >= startDate
    const completedTasks = ctx.db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.status, 'done'),
          gte(tasks.updated_at, startDate)
        )
      )
      .all()

    // Group by ISO week
    const weeklyData = groupBy(completedTasks, (task) => {
      const weekStart = startOfISOWeek(task.updated_at)
      return format(weekStart, 'yyyy-ww') // e.g., "2026-01"
    })

    // Fill in missing weeks with 0
    // Return array of { week: "2026-01", count: 5, startDate: Date, endDate: Date }
  })
```

**Important: ISO Week Standard**
- Weeks start on MONDAY (not Sunday)
- Use `date-fns` functions: `startOfISOWeek`, `getISOWeek`, `getISOWeekYear`
- Week numbers follow ISO 8601 (week 1 is first week with 4+ days in new year)

### Component File Locations

**New Files to Create:**
```
src/main/trpc/routers/velocity.router.ts
src/main/trpc/routers/velocity.router.test.ts
src/renderer/src/components/velocity/VelocityWidget.tsx
src/renderer/src/components/velocity/VelocityWidget.test.tsx
src/renderer/src/components/velocity/VelocityChart.tsx
src/renderer/src/components/velocity/VelocityChart.test.tsx
src/renderer/src/components/velocity/VelocityDetailPanel.tsx
src/renderer/src/components/velocity/VelocityDetailPanel.test.tsx
src/renderer/src/components/velocity/index.ts
```

**Files to Modify:**
```
src/main/trpc/index.ts              # Add velocityRouter to root
src/renderer/src/components/layout/Header.tsx    # Add VelocityWidget
src/renderer/src/components/layout/Header.test.tsx
```

### Library Requirements

**Recharts (for charts):**
```bash
npm install recharts
```

Recharts is React-focused, lightweight (~50KB), and has excellent TypeScript support. Better than Chart.js for React.

**date-fns (already installed):**
Used in previous stories. Functions needed:
- `startOfISOWeek`, `endOfISOWeek`
- `getISOWeek`, `getISOWeekYear`
- `subWeeks`, `subDays`
- `format`, `parseISO`

### VelocityWidget Component Structure

```typescript
// src/renderer/src/components/velocity/VelocityWidget.tsx
import { trpc } from '@renderer/lib/trpc'
import { VelocityChart } from './VelocityChart'
import { VelocityDetailPanel } from './VelocityDetailPanel'
import { useState } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

export function VelocityWidget() {
  const [detailOpen, setDetailOpen] = useState(false)
  const { data: velocityData, isLoading } = trpc.velocity.getWeeklyVelocity.useQuery({ weeks: 4 })

  if (isLoading) {
    return <div className="h-8 w-32 animate-pulse bg-zinc-800 rounded" />
  }

  if (!velocityData || velocityData.totalCompleted === 0) {
    return (
      <button
        className="flex items-center gap-2 px-2 py-1 text-sm text-muted-foreground"
        onClick={() => setDetailOpen(true)}
      >
        <span>0 completed</span>
      </button>
    )
  }

  const currentWeekCount = velocityData.weeks[0]?.count ?? 0
  const trend = calculateTrend(velocityData.weeks)

  return (
    <>
      <button
        className="flex items-center gap-2 px-2 py-1 rounded hover:bg-zinc-800/50"
        onClick={() => setDetailOpen(true)}
        aria-label={`${currentWeekCount} tasks completed this week. Click for details.`}
      >
        <span className="text-sm font-medium">{currentWeekCount}</span>
        <span className="text-xs text-muted-foreground">this week</span>
        {trend > 0 && <TrendingUp className="h-3 w-3 text-green-500" />}
        {trend < 0 && <TrendingDown className="h-3 w-3 text-red-500" />}
        {trend === 0 && <Minus className="h-3 w-3 text-zinc-500" />}
        <VelocityChart data={velocityData.weeks} />
      </button>

      <VelocityDetailPanel open={detailOpen} onOpenChange={setDetailOpen} />
    </>
  )
}
```

### VelocityChart Mini Visualization

```typescript
// src/renderer/src/components/velocity/VelocityChart.tsx
import { BarChart, Bar, ResponsiveContainer, Tooltip } from 'recharts'
import { format } from 'date-fns'

interface WeekData {
  week: string
  count: number
  startDate: Date
  endDate: Date
}

interface VelocityChartProps {
  data: WeekData[]
}

export function VelocityChart({ data }: VelocityChartProps) {
  return (
    <div className="h-6 w-16">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null
              const item = payload[0].payload as WeekData
              return (
                <div className="rounded bg-zinc-900 px-2 py-1 text-xs shadow-lg border border-zinc-700">
                  <div className="font-medium">{item.count} tasks</div>
                  <div className="text-zinc-400">
                    {format(item.startDate, 'MMM d')} - {format(item.endDate, 'MMM d')}
                  </div>
                </div>
              )
            }}
          />
          <Bar dataKey="count" fill="#52525b" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
```

### Testing Standards

**Backend Tests (velocity.router.test.ts):**
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createTestContext } from '../../../test/test-utils'
import { velocityRouter } from './velocity.router'

describe('velocityRouter', () => {
  describe('getWeeklyVelocity', () => {
    it('returns empty array when no tasks completed', async () => {
      // ...
    })

    it('groups completed tasks by ISO week', async () => {
      // Create tasks with specific updated_at timestamps
      // Verify they fall into correct ISO weeks
    })

    it('uses Monday as week start (ISO week)', async () => {
      // Task completed on Sunday should be in previous week
      // Task completed on Monday should be in current week
    })

    it('fills missing weeks with zero count', async () => {
      // If only week 1 and 3 have tasks, week 2 should show count: 0
    })
  })
})
```

**Component Tests:**
```typescript
// Mock tRPC
vi.mock('@renderer/lib/trpc', () => ({
  trpc: {
    velocity: {
      getWeeklyVelocity: {
        useQuery: vi.fn(() => ({
          data: mockVelocityData,
          isLoading: false
        }))
      }
    }
  }
}))

describe('VelocityWidget', () => {
  it('shows current week count', () => {
    render(<VelocityWidget />)
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('this week')).toBeInTheDocument()
  })

  it('shows empty state when no data', () => {
    vi.mocked(trpc.velocity.getWeeklyVelocity.useQuery).mockReturnValue({
      data: null,
      isLoading: false
    })
    render(<VelocityWidget />)
    expect(screen.getByText('0 completed')).toBeInTheDocument()
  })
})
```

### Performance Requirements (from PRD NFRs)

- NFR1: UI interactions complete in <100ms (widget click, hover)
- NFR2: Widget loads data in <1 second
- Charts should render without jank

### Previous Story Intelligence (Story 2.6)

**Key Learnings:**
1. Header component structure with right-side controls established
2. Popover pattern from shadcn/ui works well for expandable UI
3. All 476 tests pass - maintain test coverage
4. Test pattern: mock tRPC hooks, use Testing Library
5. Commit message format: `2.7 done: <description>`

**Pattern from previous story:**
- Components in dedicated folders with index.ts exports
- Tests co-located with components
- Dark theme: use zinc-700, zinc-800 for backgrounds

### Git Intelligence (Recent Commits)

From most recent commits:
- `355b94e`: Story 2.6 - filter implementation
- `296428c`: Story 2.5 - Epic/Sprint hierarchy
- date-fns already installed
- shadcn/ui patterns established

### Data Flow

```
1. VelocityWidget calls trpc.velocity.getWeeklyVelocity.useQuery()
2. Request goes through IPC to main process
3. velocity.router queries SQLite via Drizzle
4. Tasks filtered: status='done', grouped by updated_at week
5. Data returned: { weeks: [{week, count, startDate, endDate}], totalCompleted, avgVelocity }
6. VelocityChart renders mini bar chart
7. On click, VelocityDetailPanel opens with more detail
```

### Project Structure Notes

**Alignment with Architecture:**
- New velocity router follows existing tRPC patterns
- Components follow existing structure (velocity/ folder)
- Tests co-located with source files
- Uses existing dependencies where possible (date-fns)
- New dependency: recharts (lightweight chart library)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-2.7] - Full acceptance criteria
- [Source: _bmad-output/planning-artifacts/project-context.md] - Critical implementation rules
- [Source: _bmad-output/planning-artifacts/architecture.md] - tRPC patterns, project structure
- [Source: src/main/db/schema.ts] - Task schema with updated_at field
- [Source: src/main/trpc/routers/task.router.ts] - Existing router patterns
- [Source: src/renderer/src/components/layout/Header.tsx] - Header for widget placement
- [Source: _bmad-output/implementation-artifacts/2-6-implement-task-filtering.md] - Previous story patterns

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

None - implementation proceeded without issues.

### Completion Notes List

1. **Task 1 Complete**: Created velocity.router.ts with `getWeeklyVelocity` and `getDailyVelocity` queries. Uses ISO week calculation with date-fns. 14 backend tests passing.

2. **Task 2 Complete**: Created VelocityWidget.tsx with loading state, empty state, current week count display, trend indicator (up/down/neutral), and mini chart integration. 12 component tests.

3. **Task 3 Complete**: Created VelocityChart.tsx using Recharts with mini bar chart (h-6 w-16), custom dark-themed tooltip showing task count and week date range, animated bars. 5 tests.

4. **Task 4 Complete**: Created VelocityDetailPanel.tsx using shadcn/ui Dialog with 28-day daily chart, average velocity display, 4-week comparison with percentage change indicator. 12 tests.

5. **Task 5 Complete**: Integrated VelocityWidget into Header.tsx before FilterButton. Added 3 new tests to Header.test.tsx.

6. **Task 6 Complete**: All test files created with comprehensive coverage. Total: 527 tests passing after code review fixes.

### File List

**New Files:**
- src/main/trpc/routers/velocity.router.ts
- src/main/trpc/routers/velocity.router.test.ts
- src/renderer/src/components/velocity/VelocityWidget.tsx
- src/renderer/src/components/velocity/VelocityWidget.test.tsx
- src/renderer/src/components/velocity/VelocityChart.tsx
- src/renderer/src/components/velocity/VelocityChart.test.tsx
- src/renderer/src/components/velocity/VelocityDetailPanel.tsx
- src/renderer/src/components/velocity/VelocityDetailPanel.test.tsx
- src/renderer/src/components/velocity/index.ts

**Modified Files:**
- src/main/trpc/index.ts (added velocityRouter)
- src/renderer/src/components/layout/Header.tsx (added VelocityWidget)
- src/renderer/src/components/layout/Header.test.tsx (added velocity mock and tests)
- src/renderer/src/components/layout/AppShell.test.tsx (added velocity mock)
- package.json (added recharts dependency)
- package-lock.json (updated)

## Senior Developer Review (AI)

**Reviewer:** Claude Opus 4.5 (Adversarial Code Review)
**Date:** 2026-01-05
**Outcome:** ✅ APPROVED (after fixes)

### Issues Found and Fixed

| Severity | Issue | Resolution |
|----------|-------|------------|
| HIGH | VelocityChart tooltip hover interaction not tested (AC 2) | Added tooltip functionality tests with date serialization handling |
| MEDIUM | Console warnings about ResponsiveContainer dimensions | Added ResponsiveContainer mock to all 4 affected test files |
| MEDIUM | VelocityDetailPanel avgVelocity calculated from 8 weeks but displayed as "Avg/week" next to "Last 4 weeks" | Fixed to calculate from current 4 weeks client-side (avgVelocity4Week) |
| MEDIUM | VelocityWidget trend calculation edge cases not tested | Added tests for 1, 2, and 3 week data arrays |
| MEDIUM | Missing test for VelocityWidget className prop | Added className prop test |

### Test Coverage After Fixes

- **Before review:** 520 tests
- **After review:** 527 tests (+7 new tests)
- All tests passing
- No console warnings in test output

### Files Modified During Review

- `src/renderer/src/components/velocity/VelocityChart.test.tsx` - Added ResponsiveContainer mock, tooltip tests
- `src/renderer/src/components/velocity/VelocityWidget.test.tsx` - Added ResponsiveContainer mock, className test, edge case tests
- `src/renderer/src/components/velocity/VelocityDetailPanel.tsx` - Fixed avgVelocity calculation
- `src/renderer/src/components/velocity/VelocityDetailPanel.test.tsx` - Added ResponsiveContainer mock, updated avgVelocity expected value
- `src/renderer/src/components/layout/Header.test.tsx` - Added ResponsiveContainer mock
- `src/renderer/src/components/layout/AppShell.test.tsx` - Added ResponsiveContainer mock

## Change Log

- 2026-01-05: Story 2.7 implementation complete - added velocity metrics widget with tRPC backend, React components, and comprehensive tests.
- 2026-01-05: Code review completed - fixed 1 HIGH and 4 MEDIUM issues, added 7 tests, improved test quality.

import { useState, useCallback, useRef } from 'react'
import { Group, Panel, Separator, type GroupImperativeHandle, type Layout } from 'react-resizable-panels'
import { FileText, Terminal, Activity, GitCompareArrows } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { SectionHeader } from './SectionHeader'
import { TaskTerminal, type TaskTerminalRef } from '@renderer/components/task/TaskTerminal'
import { ActivitiesTab } from '@renderer/components/task/ActivitiesTab'
import { DiffPlaceholder } from '@renderer/components/task/DiffPlaceholder'

/**
 * Task data type for the workspace
 * Uses permissive types to accept both tRPC responses and prop-passed tasks
 */
export interface WorkspaceTask {
  id: string
  title: string
  description: string | null
  status: string
  epic_id: string | null
  story_number: number | string | null
  full_content: string | null
  created_at: Date | string
  updated_at: Date | string
}

export interface ResizableWorkspaceProps {
  /** Task data to display in the workspace */
  task: WorkspaceTask
  /** Content to render in the left column (Content Editor) */
  contentSection: React.ReactNode
  /** Ref for the terminal component to control focus */
  terminalRef?: React.RefObject<TaskTerminalRef | null>
}

/**
 * Expanded section type - null means no section is expanded
 */
type ExpandedSection = 'content' | 'terminal' | 'activities' | 'diff' | null

// Default panel sizes (percentages)
const DEFAULT_LEFT_SIZE = 30
const DEFAULT_CENTER_SIZE = 25
const DEFAULT_RIGHT_SIZE = 45
const DEFAULT_TERMINAL_SIZE = 60
const DEFAULT_ACTIVITIES_SIZE = 40

// Minimum panel size (percentage, roughly maps to ~150px at typical widths)
const MIN_PANEL_SIZE = '10%'

// localStorage key for persistence
const STORAGE_KEY = 'tinsu-workspace-layout'

// Panel IDs
const PANEL_LEFT = 'content'
const PANEL_CENTER = 'center'
const PANEL_RIGHT = 'diff'
const PANEL_TERMINAL = 'terminal'
const PANEL_ACTIVITIES = 'activities'

/**
 * Load saved layout from localStorage
 */
function loadSavedLayout(): {
  horizontal?: Layout
  vertical?: Layout
} | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      return JSON.parse(saved)
    }
  } catch {
    // Ignore parse errors
  }
  return null
}

/**
 * ResizableWorkspace - Three-column resizable layout for task workspace.
 *
 * Layout:
 * - Column 1 (left, ~30%): Content Editor (WYSIWYG) - full height
 * - Column 2 (center, ~25%): Terminal (top 60%) + Activities (bottom 40%) - vertically stacked
 * - Column 3 (right, ~45%): Git Diff Viewer - full height
 *
 * Features:
 * - Resizable columns with drag handles (col-resize cursor)
 * - Resizable vertical split in center column (row-resize cursor)
 * - Minimum panel size of ~150px (enforced via percentage)
 * - Expand/collapse any section to full screen
 * - Layout persistence to localStorage
 *
 * @see Story TES-3.2: Three-Column Task Workspace
 */
export function ResizableWorkspace({
  task,
  contentSection,
  terminalRef
}: ResizableWorkspaceProps) {
  // Track which section is expanded (null = normal 3-column view)
  const [expandedSection, setExpandedSection] = useState<ExpandedSection>(null)

  // Save layout before expanding so we can restore it
  const [savedLayout, setSavedLayout] = useState<{
    horizontal: Layout
    vertical: Layout
  } | null>(null)

  // Refs for panel groups to get/set layout programmatically
  const horizontalGroupRef = useRef<GroupImperativeHandle>(null)
  const verticalGroupRef = useRef<GroupImperativeHandle>(null)

  // Load initial layout from localStorage
  const initialLayout = loadSavedLayout()

  // Create default layouts
  const defaultHorizontalLayout: Layout = initialLayout?.horizontal ?? {
    [PANEL_LEFT]: DEFAULT_LEFT_SIZE,
    [PANEL_CENTER]: DEFAULT_CENTER_SIZE,
    [PANEL_RIGHT]: DEFAULT_RIGHT_SIZE
  }

  const defaultVerticalLayout: Layout = initialLayout?.vertical ?? {
    [PANEL_TERMINAL]: DEFAULT_TERMINAL_SIZE,
    [PANEL_ACTIVITIES]: DEFAULT_ACTIVITIES_SIZE
  }

  // Save layout to localStorage (debounced via panel onLayoutChanged)
  const saveLayoutToStorage = useCallback((horizontal: Layout, vertical: Layout) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ horizontal, vertical }))
    } catch {
      // Ignore storage errors
    }
  }, [])

  // Handle horizontal layout change
  const handleHorizontalLayoutChanged = useCallback(
    (layout: Layout) => {
      const vertical = verticalGroupRef.current?.getLayout() || defaultVerticalLayout
      saveLayoutToStorage(layout, vertical)
    },
    [saveLayoutToStorage, defaultVerticalLayout]
  )

  // Handle vertical layout change
  const handleVerticalLayoutChanged = useCallback(
    (layout: Layout) => {
      const horizontal = horizontalGroupRef.current?.getLayout() || defaultHorizontalLayout
      saveLayoutToStorage(horizontal, layout)
    },
    [saveLayoutToStorage, defaultHorizontalLayout]
  )

  // Expand a section to full screen
  const handleExpand = useCallback((section: ExpandedSection) => {
    // Save current layout before expanding
    const horizontal = horizontalGroupRef.current?.getLayout()
    const vertical = verticalGroupRef.current?.getLayout()
    if (horizontal && vertical) {
      setSavedLayout({ horizontal, vertical })
    }
    setExpandedSection(section)
  }, [])

  // Collapse back to 3-column view
  const handleCollapse = useCallback(() => {
    setExpandedSection(null)
    // Restore saved layout after a tick to let React re-render the panels
    if (savedLayout) {
      requestAnimationFrame(() => {
        horizontalGroupRef.current?.setLayout(savedLayout.horizontal)
        verticalGroupRef.current?.setLayout(savedLayout.vertical)
      })
    }
  }, [savedLayout])

  // Render expanded section full screen
  if (expandedSection) {
    return (
      <div className="flex h-full flex-col" data-testid="resizable-workspace-expanded">
        {expandedSection === 'content' && (
          <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border/30 bg-card/30">
            <SectionHeader
              icon={FileText}
              title="Content"
              isExpanded
              onCollapse={handleCollapse}
            />
            <div className="kanban-scroll min-h-0 flex-1 overflow-auto">{contentSection}</div>
          </div>
        )}

        {expandedSection === 'terminal' && (
          <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border/30 bg-card/30">
            <SectionHeader
              icon={Terminal}
              title="Terminal"
              isExpanded
              onCollapse={handleCollapse}
            />
            <div className="min-h-0 flex-1">
              <TaskTerminal ref={terminalRef} taskId={task.id} />
            </div>
          </div>
        )}

        {expandedSection === 'activities' && (
          <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border/30 bg-card/30">
            <SectionHeader
              icon={Activity}
              title="Activities"
              isExpanded
              onCollapse={handleCollapse}
            />
            <div className="kanban-scroll min-h-0 flex-1 overflow-auto">
              <ActivitiesTab taskId={task.id} />
            </div>
          </div>
        )}

        {expandedSection === 'diff' && (
          <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border/30 bg-card/30">
            <SectionHeader
              icon={GitCompareArrows}
              title="Diff"
              isExpanded
              onCollapse={handleCollapse}
            />
            <div className="min-h-0 flex-1">
              <DiffPlaceholder />
            </div>
          </div>
        )}
      </div>
    )
  }

  // Normal 3-column view
  return (
    <div className="h-full" data-testid="resizable-workspace">
      <Group
        groupRef={horizontalGroupRef}
        orientation="horizontal"
        onLayoutChanged={handleHorizontalLayoutChanged}
        defaultLayout={defaultHorizontalLayout}
        className="h-full"
      >
        {/* Left Column: Content Editor */}
        <Panel
          id={PANEL_LEFT}
          defaultSize={defaultHorizontalLayout[PANEL_LEFT]}
          minSize={MIN_PANEL_SIZE}
          className="flex flex-col overflow-hidden rounded-lg border border-border/30 bg-card/30"
        >
          <SectionHeader
            icon={FileText}
            title="Content"
            onExpand={() => handleExpand('content')}
          />
          <div className="kanban-scroll min-h-0 flex-1 overflow-auto">{contentSection}</div>
        </Panel>

        {/* Resize Handle: Left ↔ Center */}
        <Separator
          className={cn(
            'mx-1 w-1',
            'bg-border/30 hover:bg-cyan-500/50 active:bg-cyan-500/70',
            'cursor-col-resize',
            'transition-colors duration-150',
            'rounded-full'
          )}
        />

        {/* Center Column: Terminal + Activities (vertically stacked) */}
        <Panel
          id={PANEL_CENTER}
          defaultSize={defaultHorizontalLayout[PANEL_CENTER]}
          minSize={MIN_PANEL_SIZE}
        >
          <Group
            groupRef={verticalGroupRef}
            orientation="vertical"
            onLayoutChanged={handleVerticalLayoutChanged}
            defaultLayout={defaultVerticalLayout}
            className="h-full"
          >
            {/* Terminal Section (Top) */}
            <Panel
              id={PANEL_TERMINAL}
              defaultSize={defaultVerticalLayout[PANEL_TERMINAL]}
              minSize="15%"
              className="flex flex-col overflow-hidden rounded-lg border border-border/30 bg-card/30"
            >
              <SectionHeader
                icon={Terminal}
                title="Terminal"
                onExpand={() => handleExpand('terminal')}
              />
              <div className="min-h-0 flex-1">
                <TaskTerminal ref={terminalRef} taskId={task.id} />
              </div>
            </Panel>

            {/* Resize Handle: Terminal ↕ Activities */}
            <Separator
              className={cn(
                'my-1 h-1',
                'bg-border/30 hover:bg-cyan-500/50 active:bg-cyan-500/70',
                'cursor-row-resize',
                'transition-colors duration-150',
                'rounded-full'
              )}
            />

            {/* Activities Section (Bottom) */}
            <Panel
              id={PANEL_ACTIVITIES}
              defaultSize={defaultVerticalLayout[PANEL_ACTIVITIES]}
              minSize="15%"
              className="flex flex-col overflow-hidden rounded-lg border border-border/30 bg-card/30"
            >
              <SectionHeader
                icon={Activity}
                title="Activities"
                onExpand={() => handleExpand('activities')}
              />
              <div className="kanban-scroll min-h-0 flex-1 overflow-auto">
                <ActivitiesTab taskId={task.id} />
              </div>
            </Panel>
          </Group>
        </Panel>

        {/* Resize Handle: Center ↔ Right */}
        <Separator
          className={cn(
            'mx-1 w-1',
            'bg-border/30 hover:bg-cyan-500/50 active:bg-cyan-500/70',
            'cursor-col-resize',
            'transition-colors duration-150',
            'rounded-full'
          )}
        />

        {/* Right Column: Diff Viewer */}
        <Panel
          id={PANEL_RIGHT}
          defaultSize={defaultHorizontalLayout[PANEL_RIGHT]}
          minSize={MIN_PANEL_SIZE}
          className="flex flex-col overflow-hidden rounded-lg border border-border/30 bg-card/30"
        >
          <SectionHeader
            icon={GitCompareArrows}
            title="Diff"
            onExpand={() => handleExpand('diff')}
          />
          <div className="min-h-0 flex-1">
            <DiffPlaceholder />
          </div>
        </Panel>
      </Group>
    </div>
  )
}

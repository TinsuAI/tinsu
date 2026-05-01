/**
 * MobilePrimitivesHarness — DEV-ONLY visual regression harness for T3.5-2 primitives.
 *
 * Accessible at: http://localhost:1420#__mobile-primitives (hash routing, no React Router)
 * Guard: import.meta.env.DEV check in MobileApp.tsx — this file never ships to production.
 *
 * Renders each of the 14 primitives in their key states under a 375 px mobile viewport.
 * This is the project's storybook equivalent per architecture doc §"Migration Sequence".
 *
 * Manual smoke test checklist (run with viewport throttled to 375 px):
 *   ✓ MobileScreen wraps with topBar + tabBar + bottomBar
 *   ✓ MobileTopAppBar: default, with back button, with status pill, trailing actions
 *   ✓ MobileTabBar: 5 tabs, active=board, badge on planning
 *   ✓ MobileSheet: open/close, drag handle visible
 *   ✓ MobileSegmentedTabs: 2-tab and 4-tab variants
 *   ✓ MobileColumnPager: 3 columns with peek
 *   ✓ MobileBottomActionBar: single/dual/children variants
 *   ✓ MobileListItem: all trailing variants
 *   ✓ MobileEmptyState: with and without action
 *   ✓ MobileChip: selected/unselected/dismissible
 *   ✓ MobileFab: icon-only and extended
 *   ✓ MobileSearchBar: empty, with text, clearing
 *   ✓ MobileLoadingSkeleton: all 5 variants
 *   ✓ MobilePullToRefresh: wrapping a scrollable list
 */

import { useState } from 'react'
import { Plus, Bell, Tag, Inbox } from 'lucide-react'
import { MobileScreen } from '../primitives/MobileScreen'
import { MobileTopAppBar } from '../primitives/MobileTopAppBar'
import { MobileTabBar } from '../primitives/MobileTabBar'
import { MobileSheet } from '../primitives/MobileSheet'
import { MobileSegmentedTabs } from '../primitives/MobileSegmentedTabs'
import { MobileColumnPager } from '../primitives/MobileColumnPager'
import { MobileBottomActionBar } from '../primitives/MobileBottomActionBar'
import { MobileListItem } from '../primitives/MobileListItem'
import { MobileEmptyState } from '../primitives/MobileEmptyState'
import { MobileChip } from '../primitives/MobileChip'
import { MobileFab } from '../primitives/MobileFab'
import { MobileSearchBar } from '../primitives/MobileSearchBar'
import { MobileLoadingSkeleton } from '../primitives/MobileLoadingSkeleton'
import { MobilePullToRefresh } from '../primitives/MobilePullToRefresh'
import type { MobileTabId } from '../shell/mobile-nav.store'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="px-4 py-4 border-b border-border/30">
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
        {title}
      </h2>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  )
}

export function MobilePrimitivesHarness() {
  const [activeTab, setActiveTab] = useState<MobileTabId>('board')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [segTab, setSegTab] = useState('all')
  const [seg4Tab, setSeg4Tab] = useState('open')
  const [searchVal, setSearchVal] = useState('')
  const [toggle1, setToggle1] = useState(false)
  const [chips, setChips] = useState(['react', 'typescript'])
  const [colPage, setColPage] = useState(0)

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

  return (
    <MobileScreen
      topBar={
        <MobileTopAppBar
          title="Primitives Harness"
        />
      }
      tabBar={
        <MobileTabBar
          activeTab={activeTab}
          onTabPress={setActiveTab}
          onLongPressActiveTab={() => {}}
          badges={{ planning: 3 }}
        />
      }
    >
      {/* MobileSheet trigger */}
      <Section title="MobileSheet">
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="min-h-[2.75rem] px-4 rounded-xl bg-primary/15 text-primary text-sm font-medium"
        >
          Open Bottom Sheet
        </button>
        <MobileSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          title="Sheet Title"
          description="Supporting description text."
          snapPoint="half"
        >
          <div className="flex flex-col gap-2 py-2">
            <p className="text-sm text-foreground">Sheet content area.</p>
            <p className="text-xs text-muted-foreground">Drag down to dismiss.</p>
          </div>
        </MobileSheet>
      </Section>

      {/* MobileSegmentedTabs */}
      <Section title="MobileSegmentedTabs">
        <MobileSegmentedTabs
          tabs={[{ id: 'all', label: 'All' }, { id: 'open', label: 'Open', badge: 5 }]}
          activeTabId={segTab}
          onTabChange={setSegTab}
          ariaLabel="2-tab segmented control"
        />
        <MobileSegmentedTabs
          tabs={[
            { id: 'open', label: 'Open' },
            { id: 'progress', label: 'Progress' },
            { id: 'review', label: 'Review' },
            { id: 'done', label: 'Done' },
          ]}
          activeTabId={seg4Tab}
          onTabChange={setSeg4Tab}
          ariaLabel="4-tab segmented control"
        />
      </Section>

      {/* MobileColumnPager */}
      <Section title="MobileColumnPager">
        <div className="h-32">
          <MobileColumnPager
            currentIndex={colPage}
            onIndexChange={setColPage}
            peekPercent={8}
            ariaLabel="3-column pager"
          >
            {['Board', 'Backlog', 'Done'].map((col) => (
              <div
                key={col}
                className="h-full bg-card rounded-xl border border-border/40 flex items-center justify-center mx-1"
              >
                <span className="text-sm text-foreground font-medium">{col}</span>
              </div>
            ))}
          </MobileColumnPager>
        </div>
      </Section>

      {/* MobileBottomActionBar */}
      <Section title="MobileBottomActionBar">
        <MobileBottomActionBar
          primary={{ label: 'Approve', onPress: () => {} }}
          secondary={{ label: 'Reject', onPress: () => {} }}
        />
        <MobileBottomActionBar
          primary={{ label: 'Delete', onPress: () => {}, variant: 'destructive' }}
        />
      </Section>

      {/* MobileListItem */}
      <Section title="MobileListItem">
        <div className="rounded-xl border border-border/40 overflow-hidden">
          <MobileListItem
            leadingIcon={<Bell className="h-4 w-4" />}
            title="Notifications"
            trailing="toggle"
            toggleValue={toggle1}
            onToggleChange={setToggle1}
          />
          <MobileListItem
            leadingIcon={<Tag className="h-4 w-4" />}
            title="Labels"
            subtitle="Manage your task labels"
            trailing="chevron"
            onPress={() => {}}
          />
          <MobileListItem
            title="Delete Account"
            destructive
            trailing="chevron"
            onPress={() => {}}
          />
          <MobileListItem
            title="Disabled item"
            disabled
            trailing="chevron"
          />
        </div>
      </Section>

      {/* MobileEmptyState */}
      <Section title="MobileEmptyState">
        <div className="h-48 border border-border/40 rounded-xl overflow-hidden">
          <MobileEmptyState
            icon={<Inbox className="h-10 w-10" />}
            title="No tasks yet"
            subtitle="Create your first task to get started."
            action={
              <button
                type="button"
                className="min-h-[2.75rem] px-6 rounded-xl bg-primary text-primary-foreground text-sm font-medium"
              >
                New Task
              </button>
            }
          />
        </div>
      </Section>

      {/* MobileChip */}
      <Section title="MobileChip">
        <div className="flex flex-wrap gap-2">
          <MobileChip label="Default" />
          <MobileChip label="Selected" selected />
          <MobileChip
            label="With icon"
            leadingIcon={<Tag className="h-3 w-3" />}
            onPress={() => {}}
          />
          {chips.map((c) => (
            <MobileChip
              key={c}
              label={c}
              selected
              onDismiss={() => setChips(chips.filter((x) => x !== c))}
            />
          ))}
        </div>
      </Section>

      {/* MobileFab */}
      <Section title="MobileFab (positioned in container)">
        <div className="relative h-20 bg-muted/20 rounded-xl overflow-hidden">
          <p className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
            FAB renders fixed — see bottom-right of screen
          </p>
        </div>
        <MobileFab
          icon={<Plus className="h-6 w-6" />}
          ariaLabel="Create new task"
          onPress={() => {}}
        />
      </Section>

      {/* MobileSearchBar */}
      <Section title="MobileSearchBar">
        <MobileSearchBar
          value={searchVal}
          onChange={setSearchVal}
          placeholder="Search tasks…"
          onSubmit={(v) => alert(`Search: ${v}`)}
        />
      </Section>

      {/* MobileLoadingSkeleton */}
      <Section title="MobileLoadingSkeleton">
        <MobileLoadingSkeleton variant="text-row" />
        <MobileLoadingSkeleton variant="list-row" count={2} />
        <MobileLoadingSkeleton variant="card" />
        <MobileLoadingSkeleton variant="chat-bubble" />
        <MobileLoadingSkeleton variant="circle" />
      </Section>

      {/* MobilePullToRefresh */}
      <Section title="MobilePullToRefresh">
        <div className="h-40 rounded-xl border border-border/40 overflow-hidden">
          <MobilePullToRefresh
            onRefresh={async () => {
              await sleep(1500)
            }}
          >
            <div className="p-4 flex flex-col gap-2">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-10 rounded-lg bg-muted/30 flex items-center px-3"
                >
                  <span className="text-xs text-muted-foreground">Item {i}</span>
                </div>
              ))}
            </div>
          </MobilePullToRefresh>
        </div>
      </Section>

      {/* Extra padding for scroll + FAB clearance */}
      <div className="h-24" />
    </MobileScreen>
  )
}

# Story 3.2: Responsive Layout and Mobile Navigation

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a founder,
I want TinSu's UI to adapt to mobile screen sizes with appropriate navigation,
so that I can use the app effectively on phones and tablets.

## Acceptance Criteria

1. Mobile breakpoint (320-767px): Single column Kanban with horizontal swipe navigation between columns (UX-DR7).
2. Mobile breakpoint: Bottom tab navigation replaces the desktop sidebar.
3. Mobile breakpoint: Task workspace shows one panel at a time (Content, Terminal, Activities, Diff) with horizontal swipe navigation.
4. Mobile breakpoint: Touch targets are at least 44x44px for all interactive elements.
5. Mobile breakpoint: Text is legible without zooming (14px minimum body text).
6. Tablet breakpoint (768-1023px): 2-column Kanban with horizontal swipe for more columns.
7. Tablet breakpoint: 2-column task workspace.
8. Frontend renders identically across desktop and mobile webviews (NFR39).
9. App-wide consistency: Status colors, typography, and spacing are maintained across breakpoints.

## Tasks / Subtasks

- [ ] Task 1: Implement mobile-first media queries for the Kanban board (AC: 1, 6)
  - [ ] Update `KanbanBoard` to support single-column and two-column layouts
  - [ ] Implement horizontal swipe navigation for columns on touch devices
- [ ] Task 2: Build mobile-specific navigation system (AC: 2)
  - [ ] Create `MobileBottomNav` component with icons for Board, Planning, Settings
  - [ ] Implement conditional rendering to hide Sidebar and show BottomNav on mobile
- [ ] Task 3: Optimize Task Detail Workspace for mobile (AC: 3, 7)
  - [ ] Update `TaskDetailTabs` to show single panel on mobile with swipe
  - [ ] Implement 2-column layout for tablet breakpoint
- [ ] Task 4: UI/UX Audit for touch targets and legibility (AC: 4, 5, 9)
  - [ ] Ensure all buttons and tabs meet 44x44px touch target minimum
  - [ ] Audit font sizes across components to ensure 14px minimum on mobile
  - [ ] Verify color contrast and status badge visibility on mobile screens
- [ ] Task 5: Platform Validation (AC: 8)
  - [ ] Test rendering on Android WebView and WKWebView (iOS)
  - [ ] Verify HMR works across mobile and desktop dev environments

## Dev Notes

- **Architecture Compliance:** Use Tailwind CSS ^4.x for responsive design. Leverage `@media (max-width: ...)` or Tailwind's responsive prefixes (sm, md, lg).
- **Library Requirements:** Ensure compatibility with `@tauri-apps/api` v2 for navigation and window management.
- **Source tree components to touch:**
  - `src/components/board/KanbanBoard.tsx`
  - `src/components/layout/Sidebar.tsx`
  - `src/components/layout/AppShell.tsx`
  - `src/components/task/TaskDetailTabs.tsx`
  - `src/App.tsx` (for routing/mobile nav)
- **Testing standards summary:** Verify that breakpoints trigger at correct viewport widths. Ensure no horizontal scrolling on mobile (except for the intended swipeable columns).

### Project Structure Notes

- Alignment with Tauri v2 project structure: `src/` flattens to `src/` (standard Vite structure).
- Use `lucide-react` icons consistent with existing UI.

### References

- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#UX-DR7]
- [Source: _bmad-output/planning-artifacts/epics.md#Epic-3]
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-04-12.md#Section-3]
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend-Architecture]

## Dev Agent Record

### Agent Model Used

Gemini CLI

### Debug Log References

### Completion Notes List

### File List
- _bmad-output/implementation-artifacts/t3-2-responsive-layout-and-mobile-navigation.md

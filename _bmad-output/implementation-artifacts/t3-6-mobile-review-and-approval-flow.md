# Story t3-6: Mobile Review and Approval Flow

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a founder,
I want to review code diffs and approve or reject tasks from my phone,
so that I can unblock agent work and keep the project moving without needing my laptop.

## Acceptance Criteria

1. **Given** a task in Review status, **When** opened on a mobile device (320-767px), **Then** the diff viewer displays changes in a mobile-optimized unified view.
2. **Given** the mobile diff viewer, **When** viewing multiple files, **Then** a collapsible file tree with touch-friendly targets (min 44x44px) allows quick navigation and status overview (Modified/Added/Deleted).
3. **Given** the mobile review workspace, **When** at the bottom of the screen, **Then** a sticky action bar provides "Approve", "Reject", and "Pause" controls.
4. **Given** the "Approve" action, **When** tapped, **Then** a confirmation dialog appears **And** upon confirmation, triggers the remote git merge and task completion.
5. **Given** the "Reject" action, **When** tapped, **Then** a full-screen or slide-over text input opens for feedback **And** upon submission, returns the task to In Progress with the feedback attached.
6. **Given** UI specifications, **When** viewing diffs, **Then** haptic feedback fires on primary actions (Approve/Reject) and the theme follows "Terminal Luxe" (background #0a0a0b).

## Tasks / Subtasks

- [ ] Task 1: Create MobileDiffViewer component (AC: 1, 6)
  - [ ] Implement `src/components/review/MobileDiffViewer.tsx`.
  - [ ] Use a unified diff format optimized for narrow screens.
  - [ ] Integrate with `MonacoEditor` if feasible, or use a lightweight markdown-based diff renderer for mobile.
- [ ] Task 2: Implement Mobile File Tree (AC: 2)
  - [ ] Create `src/components/review/MobileFileTree.tsx`.
  - [ ] Ensure all list items and chevrons meet the 44px touch target minimum.
  - [ ] Add change type indicators (icons + colors).
- [ ] Task 3: Build Mobile Review Action Bar (AC: 3)
  - [ ] Implement `src/components/review/MobileReviewActionBar.tsx`.
  - [ ] Ensure the bar is sticky at the bottom and handles safe area insets on iOS/Android.
  - [ ] Implement haptic feedback triggers for buttons.
- [ ] Task 4: Approval and Rejection Logic (AC: 4, 5)
  - [ ] Implement `ApproveDialog` and `RejectFeedbackSheet` for mobile.
  - [ ] Hook up to `useReviewCommands` (rspc mutations).
  - [ ] Ensure rejection feedback is properly passed to the backend for agent re-execution.
- [ ] Task 5: Integration and State Management
  - [ ] Update `src/pages/TaskWorkspace.tsx` to switch to mobile review components based on viewport size.
  - [ ] Ensure state preservation when switching between diff, terminal, and activities tabs.
- [ ] Task 6: Platform Validation
  - [ ] Test on Android and iOS (Tauri mobile).
  - [ ] Verify scroll performance and touch interactions on large diffs.

## Dev Notes

- **Architecture Compliance:** Use `rspc` for all mutations and queries. Follow the "Calm Command" design system tokens.
- **Library Requirements:** Reuse `Monaco` if performance allows, otherwise consider `react-diff-view` or custom rendering for mobile.
- **Remote Context:** Ensure git operations are executed via the `RemoteGitService` when working on remote projects.
- **UX DR:** Follow [UX-DR7] for mobile breakpoint behavior and [UX-DR20] for review action UX.

### Project Structure Notes

- New components: `src/components/review/MobileDiffViewer.tsx`, `src/components/review/MobileFileTree.tsx`, `src/components/review/MobileReviewActionBar.tsx`.
- Modified pages: `src/pages/TaskWorkspace.tsx`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#T3.6]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#UX-DR7]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#UX-DR20]
- [Source: _bmad-output/implementation-artifacts/1-10-terminal-dock-component.md]
- [Source: _bmad-output/implementation-artifacts/t3-2-responsive-layout-and-mobile-navigation.md]

## Dev Agent Record

### Agent Model Used

Gemini CLI

### Debug Log References

### Completion Notes List

### File List
- src/components/review/MobileDiffViewer.tsx
- src/components/review/MobileFileTree.tsx
- src/components/review/MobileReviewActionBar.tsx
- src/pages/TaskWorkspace.tsx

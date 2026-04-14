# Story t3-7: Mobile Chat with Planning Agents

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a founder,
I want to chat with planning agents (PM, Architect, UX Designer, Dev) from my phone,
so that I can continue planning work during commutes or away from my desk.

## Acceptance Criteria

1. **Given** planning workspace from Epic 1 and mobile layout from T3.2, **When** I open the Planning Workspace on mobile, **Then** the chat interface displays in a full-screen mobile view.
2. **Given** the mobile chat interface, **When** accessed, **Then** the session list is accessible via a slide-out panel (drawer) or a top selector.
3. **Given** a chat session, **When** active, **Then** I can send messages using the device keyboard with a dedicated "Send" button that is thumb-accessible.
4. **Given** chat messages, **When** rendered, **Then** message bubbles, code blocks, and markdown content wrap correctly and remain legible in mobile width (320px+).
5. **Given** the mobile planning workspace, **When** navigating, **Then** I can switch between agent sessions without losing context or interrupting background agent thinking.
6. **Given** agent activity, **When** occurring, **Then** session status indicators (thinking, idle, completed) are clearly visible in the header or session list.

## Tasks / Subtasks

- [ ] Task 1: Create Mobile Planning Layout (AC: 1)
  - [ ] Implement mobile-responsive version of `src/pages/PlanningWorkspace.tsx`.
  - [ ] Use `useQuadPaneLayout` or similar hook to detect mobile viewport.
  - [ ] Ensure full-height layout (100dvh) to avoid mobile browser chrome issues.
- [ ] Task 2: Implement Mobile Session Drawer (AC: 2, 5, 6)
  - [ ] Create `src/components/planning/MobileSessionDrawer.tsx`.
  - [ ] Include session list with live status indicators and last message preview.
  - [ ] Use `shadcn/ui` Drawer or Sheet component for a native feel.
- [ ] Task 3: Optimize Chat Input for Mobile (AC: 3)
  - [ ] Update `src/components/planning/ChatInput.tsx` for touch devices.
  - [ ] Add a visible "Send" icon button for mobile (replacing or supplementing Enter-to-send).
  - [ ] Handle `visualViewport` changes to prevent the keyboard from obscuring the input field.
- [ ] Task 4: Mobile-Optimized Message Rendering (AC: 4)
  - [ ] Review `src/components/planning/MessageBubble.tsx` for overflow issues.
  - [ ] Ensure code blocks use horizontal scrolling instead of stretching the container.
  - [ ] Adjust padding and font sizes for 320px-375px viewports.
- [ ] Task 5: Integration and State Management
  - [ ] Ensure `useChatSessions` and `useChatMessages` hooks work correctly on mobile platforms (Tauri mobile).
  - [ ] Verify that Tauri Event listeners for chat updates remain active in the background on mobile.
- [ ] Task 6: Platform Validation
  - [ ] Test on Android and iOS (Tauri mobile simulators).
  - [ ] Verify scrolling performance with long chat histories.

## Dev Notes

- **Architecture Compliance:** Use `rspc` for all chat mutations and queries.
- **Mobile UX:** Follow [UX-DR7] for mobile breakpoint behavior. Use `hapticFeedback` on message send.
- **Background Work:** Ensure that navigating away from a session on mobile doesn't disconnect the local PTY/tmux listener.

### Project Structure Notes

- New components: `src/components/planning/MobileSessionDrawer.tsx`.
- Modified pages: `src/pages/PlanningWorkspace.tsx`.
- Modified components: `src/components/planning/ChatInput.tsx`, `src/components/planning/MessageBubble.tsx`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#T3.7]
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-04-12.md]
- [Source: _bmad-output/implementation-artifacts/10-2-chat-panel-ui-and-message-bubbles.md]
- [Source: _bmad-output/implementation-artifacts/t3-2-responsive-layout-and-mobile-navigation.md]

## Dev Agent Record

### Agent Model Used

Gemini CLI

### Debug Log References

### Completion Notes List

### File List
- src/components/planning/MobileSessionDrawer.tsx
- src/pages/PlanningWorkspace.tsx
- src/components/planning/ChatInput.tsx
- src/components/planning/MessageBubble.tsx

# Story t3-5: Mobile Terminal View

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a founder,
I want a touch-optimized terminal view on my mobile device,
so that I can interact with agents and run commands on the go with full CLI support.

## Acceptance Criteria

1. **Given** a mobile viewport (320-767px), **When** the terminal panel is active in the task workspace, **Then** it occupies 100% width and the available viewport height (minus nav and headers).
2. **Given** the mobile terminal, **When** I use touch gestures, **Then** I can scroll smoothly through output **And** long-press to select text **And** double-tap to toggle a temporary full-screen mode.
3. **Given** the on-screen keyboard is visible, **When** typing in the terminal, **Then** the viewport resizes automatically **And** the active command line remains visible above the keyboard.
4. **Given** mobile input limitations, **When** the terminal has focus, **Then** a mobile-specific accessory toolbar appears with common CLI keys (Tab, Ctrl, Alt, Esc, Arrow Up/Down/Left/Right).
5. **Given** a remote project, **When** the terminal initializes on mobile, **Then** it automatically attaches to the correct remote tmux session via the SSH bridge (t2-4).
6. **Given** performance requirements, **When** streaming high-frequency output on mobile, **Then** the terminal maintains 60fps rendering without UI freezes (NFR5).

## Tasks / Subtasks

- [ ] Task 1: Create MobileTerminal component (AC: 1, 2)
  - [ ] Create `src/components/terminal/MobileTerminal.tsx` as a mobile-optimized variant of `XTerminal`.
  - [ ] Implement responsive height calculation that accounts for mobile address bars and safe areas.
  - [ ] Integrate `Hammer.js` or similar for touch gesture support (long-press, double-tap).
- [ ] Task 2: Implement Mobile CLI Accessory Bar (AC: 4)
  - [ ] Create `TerminalAccessoryBar` component with buttons for `Tab`, `Ctrl`, `Alt`, `Esc`, and `Arrows`.
  - [ ] Implement focus-triggered visibility for the accessory bar.
  - [ ] Ensure buttons meet 44x44px touch target minimums.
- [ ] Task 3: Keyboard and Viewport Management (AC: 3)
  - [ ] Implement `VisualViewport` API listeners to detect keyboard-driven layout changes.
  - [ ] Add auto-scroll logic to ensure the cursor is always visible in the resized viewport.
  - [ ] Fix xterm.js "fit" logic for dynamic mobile viewport resizing.
- [ ] Task 4: Connect to Tmux/SSH Session (AC: 5)
  - [ ] Integrate with `useTmuxCommands` hook to identify and attach to the project-specific session.
  - [ ] Implement "re-attach" logic for mobile reconnection scenarios (WiFi/Cellular handoff).
- [ ] Task 5: Performance Optimization (AC: 6)
  - [ ] Optimize xterm.js rendering options for mobile (e.g., `canvas` vs `dom` renderer).
  - [ ] Implement throttling for output streaming during high-volume agent activity.
- [ ] Task 6: Platform Validation
  - [ ] Test on Android Chrome (WebView) and iOS Safari (WKWebView).
  - [ ] Verify touch selection and clipboard integration on both platforms.

## Dev Notes

- **Architecture Compliance:** Leverage `@tauri-apps/api` v2 for window and system integrations. Use `rspc` for all backend communication.
- **Library Requirements:** Use `@xterm/xterm` v5+ and `@xterm/addon-fit`. Consider `@xterm/addon-canvas` for better mobile performance.
- **Styling:** Use Tailwind CSS 4.x for mobile-first utility styling. Maintain "Terminal Luxe" aesthetic (background #0a0a0b).
- **Remote Context:** Ensure the terminal correctly differentiates between local and remote sessions based on `Project.is_remote` flag.

### Project Structure Notes

- New components: `src/components/terminal/MobileTerminal.tsx`, `src/components/terminal/TerminalAccessoryBar.tsx`.
- Updated hooks: `src/hooks/useTerminal.ts` (add mobile-specific logic).

### References

- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#UX-DR12]
- [Source: _bmad-output/implementation-artifacts/1-10-terminal-dock-component.md]
- [Source: _bmad-output/implementation-artifacts/t3-2-responsive-layout-and-mobile-navigation.md]
- [Source: _bmad-output/implementation-artifacts/t3-4-mobile-ssh-connection-flow.md]
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-04-12.md]

## Dev Agent Record

### Agent Model Used

Gemini CLI

### Debug Log References

### Completion Notes List

### File List
- src/components/terminal/MobileTerminal.tsx
- src/components/terminal/TerminalAccessoryBar.tsx
- src/hooks/useTerminal.ts

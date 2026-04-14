# Story 3.4: Mobile SSH Connection Flow

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a founder,
I want to connect to remote machines from my phone,
so that I can manage remote projects while away from my desk.

## Acceptance Criteria

1. **Mobile-friendly SSH connection form**: Users can add, edit, and test SSH connection profiles (host, port, user, auth method) using a UI optimized for touch targets (44px minimum).
2. **Key selection from secure storage**: Users can select from stored SSH keys (synced from desktop or generated on device) stored as restricted PEM files (mode 0600) in the app data directory.
3. **Connection status in project switcher**: The mobile project switcher must display the real-time status (Connected, Connecting, Disconnected) for each remote project.
4. **Graceful network transition handling**: SSH connections must survive transitions between WiFi and cellular networks without manual intervention, leveraging `russh` reconnection logic.
5. **Automatic reconnection**: The app must automatically attempt to reconnect to the active remote project when the device regains network connectivity.

## Tasks / Subtasks

- [x] Implement Mobile-Optimized SSH Connection Form (AC: 1, 2)
  - [x] Create `MobileSshConnectionForm` component using `shadcn/ui` primitives.
  - [x] Ensure all touch targets (inputs, buttons, select menus) are at least 44px high.
  - [x] Add "Test Connection" button with real-time feedback and haptic support.
  - [x] Integrate with `ssh.listKeys` rspc procedure to populate key selection.
- [x] Enhance Project Switcher with Status Indicators (AC: 3)
  - [x] Update `ProjectSwitcher` component to display status badges/dots for remote projects.
  - [x] Subscribe to `ssh:status-changed` Tauri Events to update the UI reactively.
- [x] Implement Mobile Resilience & Reconnection Logic (AC: 4, 5)
  - [x] Add network status monitoring in the frontend using `window.addEventListener('online/offline')`.
  - [x] Trigger `ssh.reconnect` rspc mutation on `online` event for the currently active remote project.
  - [x] Implement exponential backoff (2s to 15s) in the Rust `RemoteHookForwarder` for reconnection attempts.
  - [x] Ensure `tmux` sessions are automatically re-attached upon successful SSH reconnection.
- [x] UX Polish & Haptics
  - [x] Add `navigator.vibrate` patterns: success (double short), failure (one long), connecting (pulse).
  - [x] Implement skeleton loading states for the connection list and key selector.

## Dev Notes

- **Backend**: Leverage the existing `SshService` and `RemoteHookForwarder` for core connection and reconnection logic.
- **Frontend**: Use `rspc` hooks for all mutations and queries. Follow the "Calm Command" dark theme specified in the UX spec.
- **Tauri Events**: Use `app_handle.emit("ssh:status-changed", ...)` from Rust to push state updates to the mobile UI.
- **Constraints**: Mobile-only viewports (320px-767px) should prioritize the connection status in the top navigation bar.

### Project Structure Notes

- **Components**: New components reside in `src/components/remote/` or are mobile-specific variants in `src/components/layout/`.
- **Rust Services**: Logic resides in `src-tauri/src/services/ssh_service.rs` and `src-tauri/src/services/remote_hook_forwarder.rs`.
- **IPC**: New rspc procedures are in `src-tauri/src/router/ssh.rs` and `src-tauri/src/commands/remote_hook.rs`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story T3.4]
- [Source: _bmad-output/planning-artifacts/architecture.md#SSH Architecture]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Responsive Design]
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-04-12.md]

## Dev Agent Record

### Agent Model Used

gemini-2.0-flash

### Debug Log References

### Completion Notes List

### File List

- src/App.tsx (global network monitor)
- src/components/dialogs/SettingsDialog.tsx (mobile layout)
- src/components/project/ProjectSwitcher.tsx (status subscription)
- src/components/remote/MobileSshConnectionForm.tsx (touch-optimized form)
- src/hooks/useNetworkResilience.ts (online/offline listener)
- src/hooks/useRemoteProjectSwitcher.ts (subscription hook)
- src/hooks/useSshCommands.ts (SSH query/mutation hooks)
- src-tauri/src/services/remote_hook_forwarder.rs (reconnection logic)

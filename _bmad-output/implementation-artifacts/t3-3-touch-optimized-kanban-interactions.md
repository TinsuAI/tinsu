# Story 3.3: Touch-Optimized Kanban Interactions

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a founder,
I want to drag tasks, tap to open, and swipe between columns on mobile,
so that the core Kanban workflow is natural on touch devices.

## Acceptance Criteria

1. **Long-press a task card to start dragging**: Touch users must long-press (e.g., 250ms) to initiate a drag to prevent accidental drags while scrolling.
2. **Drop the card on a visible column**: Dragging a card to a column header or area updates its status.
3. **Swipe to reveal adjacent columns while dragging**: If a card is dragged to the edge of the screen, the horizontal scroll should update to reveal more columns.
4. **Tap a card to open the task detail view**: A standard tap (without long-press) should trigger the task click action.
5. **Swipe left/right on the board to navigate between columns**: Native horizontal scrolling with snap-points (already partially implemented) should feel smooth.
6. **Drag-and-drop feels smooth at 60fps with no jank**: Implementation must be performant on mobile webviews.
7. **Haptic feedback fires on drag start and drop**: Use `window.navigator.vibrate` if available to provide tactile feedback.

## Tasks / Subtasks

- [ ] Configure @dnd-kit TouchSensor (AC: 1, 4)
  - [ ] Add `TouchSensor` to `useSensors` in `KanbanBoard.tsx`.
  - [ ] Set `activationConstraint` with `delay` (e.g., 250ms) and `tolerance`.
- [ ] Implement Haptic Feedback (AC: 7)
  - [ ] Add `vibrate` calls in `handleDragStart` and `handleDragEnd`.
- [ ] Enhance Horizontal Auto-scrolling during Drag (AC: 3)
  - [ ] Ensure @dnd-kit's auto-scroll behavior works correctly with the `snap-x` container.
- [ ] Optimize Touch Targets (AC: 4)
  - [ ] Ensure tap actions are not blocked by the touch sensor's delay.
- [ ] Performance Audit (AC: 6)
  - [ ] Verify 60fps performance on mobile device/simulator.

## Dev Notes

- **Sensors:** `KanbanBoard.tsx` currently only uses `PointerSensor` and `KeyboardSensor`. Adding `TouchSensor` is mandatory for mobile.
- **DndContext:** Ensure `collisionDetection` remains `pointerWithin` or check if `rectIntersection` is better for touch.
- **Haptics:** `navigator.vibrate(10)` is a good subtle value for drag start.
- **CSS snap:** The `snap-x snap-mandatory` on the board container might conflict with @dnd-kit's auto-scroll. May need to temporarily disable `snap-type` during active drag.

### Project Structure Notes

- **Components:** Primary work in `src/components/board/KanbanBoard.tsx`.
- **Styles:** Check `src/globals.css` for any mobile-specific overrides needed for touch-action.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story T3.3]
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-04-12.md]
- [Source: src/components/board/KanbanBoard.tsx]

## Dev Agent Record

### Agent Model Used

gemini-2.0-flash

### Debug Log References

### Completion Notes List

### File List

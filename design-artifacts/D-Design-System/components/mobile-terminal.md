# Mobile Terminal [cnt-001]

**Type:** Layout
**Category:** Container
**Purpose:** Touch-optimized terminal interface for mobile devices

---

## Overview

The Mobile Terminal is a responsive variant of the standard terminal dock, optimized for small viewports (320-767px). It provides a full CLI experience with touch-optimized scrolling, text selection, and keyboard management.

---

## Variants

This component has no variants.

---

## States

**Required States:**

- **default**: Standard view within the task workspace.
- **active**: Terminal has focus, accessory bar is visible.
- **fullscreen**: Temporary full-screen mode toggled by double-tap.
- **typing**: On-screen keyboard is visible, viewport is resized.

**Optional States:**

- **loading**: Initializing session or re-attaching to tmux.
- **disconnected**: Session lost, showing reconnect button.

**State Descriptions:**

- **Default**: Occupies 100% width and available height in task workspace.
- **Fullscreen**: Covers entire viewport (z-index: 200).
- **Typing**: Viewport height reduced, cursor maintained in view.

---

## Styling

### Visual Properties

**Size:** Dynamic (100% width, viewport-aware height)
**Shape:** Square (flush with viewport edges)
**Colors:** 
- Background: #0a0a0b (Terminal Luxe)
- Text: #fafafa (Primary)
- Selection: rgba(59, 130, 246, 0.3)
**Typography:** JetBrains Mono (12px on mobile)
**Spacing:** 0px padding (content flush to edges)

### Design Tokens

```yaml
colors:
  background: "#0a0a0b"
  text: "#fafafa"
  primary: "#3b82f6"

typography:
  font-family: "JetBrains Mono"
  font-size: "12px"

spacing:
  padding: 0

effects:
  border-radius: 0
```

### Library Component

**Library:** @xterm/xterm
**Component:** Terminal
**Customizations:** 
- `cursorBlink: true`
- `theme: { background: '#0a0a0b' }`
- Addons: `FitAddon`, `CanvasAddon` (for performance)

---

## Behavior

### Interactions

**Scroll:**
Smooth momentum scrolling via touch gestures.

**Long-press:**
Triggers native text selection mode.

**Double-tap:**
Toggles full-screen mode.

**Keyboard:**
Viewport resize handling via `VisualViewport` API.

### Animations

- **Fullscreen Transition**: 200ms ease-in-out fade/scale.
- **Accessory Bar Slide**: 150ms slide-up from bottom.

---

## Accessibility

**ARIA Attributes:**

- role: terminal
- aria-label: Mobile Terminal Output
- aria-live: polite

**Keyboard Support:**

- Full CLI support via on-screen keyboard + accessory bar.

**Screen Reader:**
Announces new output lines as they arrive.

---

## Usage

### When to Use

- When the application is accessed on a mobile viewport (width < 768px).
- When a user needs to monitor or interact with an agent on the go.

### When Not to Use

- On desktop viewports (use standard TerminalDock).
- For non-interactive logs (use ActivityLog).

### Best Practices

- Always ensure the cursor is visible above the keyboard.
- Use Canvas renderer for 60fps performance on mobile.
- Provide clear visual feedback for touch selection.

---

## Used In

**Pages:** Task Workspace

**Usage Count:** 1

---

## Related Components

- Terminal Accessory Bar [cnt-002] - Required companion for CLI input.
- Task Workspace [cnt-003] - Parent container.

---

## Version History

**Created:** 2026-04-14
**Last Updated:** 2026-04-14

**Changes:**

- 2026-04-14: Created component specification for t3-5.

---

## Notes

Requires `VisualViewport` API for reliable keyboard detection.

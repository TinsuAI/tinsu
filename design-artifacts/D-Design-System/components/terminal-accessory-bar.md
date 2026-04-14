# Terminal Accessory Bar [cnt-002]

**Type:** Layout
**Category:** Container
**Purpose:** Auxiliary input bar for common CLI keys on mobile

---

## Overview

The Terminal Accessory Bar provides touch-optimized buttons for keys that are often missing or hard to reach on mobile keyboards (Tab, Ctrl, Alt, Esc, Arrow keys). It appears above the on-screen keyboard when the terminal has focus.

---

## Variants

This component has no variants.

---

## States

**Required States:**

- **default**: Visible above keyboard.
- **pressed**: Button feedback on touch.
- **active-modifier**: Ctrl/Alt/Shift in toggled-on state.

**State Descriptions:**

- **Default**: Semi-transparent dark background, 44px height.
- **Pressed**: Subtle color change and haptic feedback (if available).
- **Active Modifier**: Primary color highlight for the active key.

---

## Styling

### Visual Properties

**Size:** Height: 44px, Width: 100%
**Shape:** Square bottom (sits on keyboard), rounded top (optional)
**Colors:**
- Background: rgba(24, 24, 27, 0.95) (Card-like)
- Text: #fafafa
- Button Surface: rgba(39, 39, 42, 0.8)
- Active Modifier: #3b82f6 (Primary)
**Typography:** System font (Inter) 14px, bold
**Spacing:** Gap: 4px between buttons, Padding: 4px

### Design Tokens

```yaml
colors:
  background: "rgba(24, 24, 27, 0.95)"
  button: "rgba(39, 39, 42, 0.8)"
  active: "#3b82f6"

spacing:
  height: 44px
  gap: 4px
```

### Library Component

**Library:** shadcn/ui
**Component:** Button (custom variant)
**Customizations:** 
- `size: icon` (min-width: 44px for targets)
- `variant: ghost`

---

## Behavior

### Interactions

**Tap:**
Sends the corresponding key event to the xterm.js instance.

**Toggle (Ctrl/Alt):**
Locks the modifier key until next keypress or second tap.

**Haptic:**
Light vibration (10ms) on each tap.

---

## Accessibility

**ARIA Attributes:**

- role: toolbar
- aria-label: Terminal Keyboard Shortcuts

**Touch Targets:**
All buttons meet 44x44px minimum touch area.

---

## Usage

### When to Use

- Exclusively on mobile viewports when the Terminal component is focused.

### When Not to Use

- Desktop viewports.
- Non-CLI input fields.

---

## Related Components

- Mobile Terminal [cnt-001] - The primary receiver of these key events.

---

## Version History

**Created:** 2026-04-14
**Last Updated:** 2026-04-14

**Changes:**

- 2026-04-14: Created component specification for t3-5.

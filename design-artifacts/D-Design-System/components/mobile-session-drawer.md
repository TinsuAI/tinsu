# Mobile Session Drawer [cnt-004]

**Type:** Navigation
**Category:** Overlay
**Purpose:** Session management and switching for mobile planning workspace

---

## Overview

The Mobile Session Drawer is a slide-out panel that allows users to browse, search, and switch between active and historical chat sessions in the Planning Workspace. It provides a quick way to navigate between different agent personas (PM, Architect, etc.) without losing context.

---

## Variants

- **Left Drawer**: Slides out from the left edge of the screen.
- **Top Selector**: A dropdown or horizontal scroll bar for quick switching (optional).

---

## States

**Required States:**

- **closed**: Hidden from view, only trigger is visible.
- **open**: Visible, covering a portion of the screen (typically 80-90% width).
- **loading**: Fetching session list from database.
- **empty**: No sessions found for the current project.

**Optional States:**

- **searching**: Filtered list based on user input.

**State Descriptions:**

- **Closed**: `translate-x-[-100%]` or `hidden`.
- **Open**: `translate-x-0` with backdrop overlay.
- **Loading**: Showing skeleton loaders for session cards.

---

## Styling

### Visual Properties

**Size:** 85% width, 100% height
**Shape:** Rounded right edges (lg)
**Colors:** 
- Background: var(--background)
- Border: var(--border)
- Backdrop: rgba(0, 0, 0, 0.4)
**Typography:** Geist (standard UI font)
**Spacing:** 16px padding

### Design Tokens

```yaml
colors:
  background: "var(--background)"
  border: "var(--border)"
  backdrop: "rgba(0,0,0,0.4)"

spacing:
  padding: "1rem"
  item-gap: "0.5rem"

effects:
  border-radius: "0 0.5rem 0.5rem 0"
  shadow: "var(--shadow-lg)"
```

### Library Component

**Library:** @radix-ui/react-dialog (as a basis for Sheet/Drawer)
**Component:** Content, Overlay, Portal

---

## Behavior

### Interactions

**Trigger:**
Tap on "Sessions" or agent icon in the header.

**Selection:**
Tap on a session card to switch to that session and close the drawer.

**Dismiss:**
Tap on backdrop, swipe left, or tap "Close" button.

### Animations

- **Slide-in**: 300ms ease-out from left.
- **Fade-in (Backdrop)**: 200ms ease-in.

---

## Accessibility

**ARIA Attributes:**

- role: dialog
- aria-modal: true
- aria-label: Session List

**Keyboard Support:**
- Escape to close.
- Trap focus within drawer when open.

---

## Usage

### When to Use

- In the Planning Workspace on mobile devices (width < 1024px).
- When multiple chat sessions are active.

### When Not to Use

- On desktop viewports (use persistent sidebar).

---

## Used In

**Pages:** Planning Workspace

**Usage Count:** 1

---

## Related Components

- Chat Session List [cmp-005] - Rendered inside the drawer.
- Agent Persona Indicator [cmp-006] - Often used as a trigger.

---

## Version History

**Created:** 2026-04-15
**Last Updated:** 2026-04-15

**Changes:**

- 2026-04-15: Created component specification for t3-7.

---

## Notes

Should support horizontal swipe gesture for native feel.

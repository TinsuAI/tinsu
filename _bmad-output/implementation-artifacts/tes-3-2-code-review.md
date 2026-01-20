# Adversarial Code Review: TES-3.2 Quad-Pane Layout

## 🚨 Critical Issues (Must Fix)

### 1. State Preservation Violation (AC 6.5) & Architectural Flaw
**Severity:** 🔴 Critical
**Requirement:** AC 6.5 "Preserve scroll positions and state when switching layouts"
**Finding:** The current implementation uses conditional rendering (`{layoutMode === 'quad' ? <QuadPane/> : <Tabbed/>}`) to switch layouts. This causes React to **unmount and destroy** the entire component tree when resizing past the 1024px breakpoint.
**Impact:**
- Users lose their scroll position in Terminal and Activities.
- Users lose any text typed into the Terminal input buffer.
- Users lose text selection.
- Violates the core "seamless" experience requirement.
**Recommendation:** Refactor to a **CSS-driven responsive layout**. Render *all* sections permanently. Use CSS (`display: none` / `hidden` utility) to hide non-active sections in Tabbed mode, and CSS Grid to show all in Quad mode. This ensures components never unmount.

### 2. Missing Functionality in Tabbed Mode
**Severity:** 🟠 Major
**Requirement:** AC 1 & General Consistency
**Finding:** The "Diff" section is completely inaccessible in Tabbed (mobile/tablet) mode.
**Impact:** Users on smaller screens cannot access the feature (even if it's just a placeholder now, it will be real later).
**Recommendation:** Add a "Diff" tab to the Tabbed interface.

## 🛠 Code Quality Issues

### 3. Component Definition Inside File
**Severity:** 🟡 Minor
**Finding:** `CodeBlock` component is defined inside `TaskDetailContent.tsx`.
**Impact:** Bloats the file and prevents reuse.
**Recommendation:** Extract to `src/renderer/src/components/ui/code-block.tsx`.

### 4. Duplicate Markdown Configuration
**Severity:** ⚪ Trivial
**Finding:** `markdownComponents` object is large and defined in the file.
**Recommendation:** Extract to `src/renderer/src/components/task/markdown-components.tsx` (or similar) to keep the main component clean.

## 🧪 Testing Gaps

### 5. No State Persistence Tests
**Finding:** Tests cover rendering but do not verify that state is preserved during layout switching.
**Recommendation:** Add integration test verifying component instances persist or simulate state retention.

---

## 🔧 Auto-Fix Plan

I propose to apply the following fixes immediately:

1.  **Refactor `TaskDetailContent.tsx`** to use a single, permanent render tree.
    -   Implement a hybrid layout that acts as Tabs on mobile (hiding inactive sections) and Grid on desktop.
    -   Remove `QuadPaneLayout` wrapper component usage (or adapt it to handle hidden children).
2.  **Add "Diff" Tab** to the tabbed view logic.
3.  **Extract `CodeBlock`** to its own file.
4.  **Extract `markdownComponents`** to its own file.

**Do you approve these fixes?**

# Story 8.8: Conflict Resolution UI

Status: done

🎨 FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.

## Story

As a founder,
I want to resolve merge conflicts within TinSu,
So that I don't have to switch to command line.

## Acceptance Criteria

1. **Given** a task has merge conflicts (has_merge_conflict=1 in database)
   **When** I click "Resolve Conflicts" button in the ConflictWarningBanner
   **Then** a conflict resolution view opens
   **And** I see each conflicting file listed from the conflict_files column

2. **Given** a conflicting file
   **When** I click to view it
   **Then** Monaco Editor shows the conflict markers (<<<, ===, >>>)
   **And** I can edit to resolve

3. **Given** I'm resolving a conflict
   **When** I choose a side
   **Then** I can click "Accept Incoming" or "Accept Current" or edit manually
   **And** conflict markers are removed from the content

4. **Given** all conflicts are resolved
   **When** I click "Complete Merge"
   **Then** the merge commits successfully
   **And** task proceeds to Done (status update via existing task.router logic)

5. **Given** I can't resolve in TinSu
   **When** I click "Open in Editor"
   **Then** the worktree opens in system default editor
   **And** I can resolve externally and return

## Tasks / Subtasks

- [x] Task 1: Create ConflictResolutionView component (AC: 1, 2)
  - [x] 1.1: Create `src/renderer/src/components/conflict/ConflictResolutionView.tsx`
  - [x] 1.2: Accept props: `taskId: string`, `conflictFiles: string[]`, `worktreePath: string`, `branchName: string`, `onClose: () => void`, `onResolved: () => void`
  - [x] 1.3: Layout: full-width/height view with file list sidebar (250px) + editor area
  - [x] 1.4: Display file list with status indicators (unresolved/resolved)
  - [x] 1.5: Use TinSu design system (dark theme, amber for conflict states)

- [x] Task 2: Create ConflictFileEditor component with Monaco (AC: 2, 3)
  - [x] 2.1: Create `src/renderer/src/components/conflict/ConflictFileEditor.tsx`
  - [x] 2.2: Use Monaco Editor (NOT DiffEditor - need editable single editor)
  - [x] 2.3: Load file content from worktree via new tRPC endpoint
  - [x] 2.4: Parse conflict markers `<<<<<<<`, `=======`, `>>>>>>>` and highlight with decorations
  - [x] 2.5: Add inline "Accept Current" / "Accept Incoming" / "Accept Both" buttons using Monaco ViewZones
  - [x] 2.6: Track resolved state per-file (no conflict markers remaining)

- [x] Task 3: Implement conflict marker parsing and resolution logic (AC: 3)
  - [x] 3.1: Create `src/renderer/src/components/conflict/utils.ts` with conflict parsing functions
  - [x] 3.2: Implement `parseConflictRegions(content: string): ConflictRegion[]`
  - [x] 3.3: Implement `resolveConflict(content: string, region: ConflictRegion, choice: 'current' | 'incoming' | 'both'): string`
  - [x] 3.4: Implement `hasUnresolvedConflicts(content: string): boolean`
  - [x] 3.5: Handle nested/multiple conflicts in same file

- [x] Task 4: Add tRPC endpoints for conflict resolution (AC: 1, 2, 4)
  - [x] 4.1: Add `git.getConflictFileContent` query in `git.router.ts` - reads file from worktree
  - [x] 4.2: Add `git.saveConflictFileContent` mutation - writes resolved content to worktree file
  - [x] 4.3: Add `git.stageResolvedFile` mutation - runs `git add <file>` in worktree
  - [x] 4.4: Add `git.completeConflictResolution` mutation - runs `git commit` with merge message
  - [x] 4.5: Update task `has_merge_conflict=0` and `conflict_files=null` after successful commit

- [x] Task 5: Integrate "Resolve Conflicts" button in ConflictWarningBanner (AC: 1)
  - [x] 5.1: Add `onResolveClick?: () => void` prop to ConflictWarningBanner
  - [x] 5.2: Add "Resolve Conflicts" button that calls onResolveClick
  - [x] 5.3: Update TaskDetailContent to pass handler that opens ConflictResolutionView
  - [x] 5.4: ConflictResolutionView opens as full-screen overlay or routed view

- [x] Task 6: Implement "Complete Merge" functionality (AC: 4)
  - [x] 6.1: Validate all conflict files have been resolved (no markers remaining)
  - [x] 6.2: Call `git.completeConflictResolution` to commit the merge
  - [x] 6.3: Clear conflict state in database (has_merge_conflict=0, conflict_files=null)
  - [x] 6.4: Proceed with existing review→done flow (auto-triggers cleanup per Story 8.6)
  - [x] 6.5: Show success toast and close resolution view

- [x] Task 7: Implement "Open in Editor" functionality (AC: 5)
  - [x] 7.1: Add `git.openInSystemEditor` mutation that uses `shell.openPath()` on worktree directory
  - [x] 7.2: Add "Open in Editor" button in ConflictResolutionView header
  - [x] 7.3: Show info message: "After resolving externally, return here and click Refresh"
  - [x] 7.4: Add "Refresh" button to reload file content from worktree

- [x] Task 8: Add Monaco decorations for conflict highlighting (AC: 2)
  - [x] 8.1: Define decoration classes in globals.css for conflict regions (lines 553-661)
  - [x] 8.2: Current changes: green background (matching diff viewer added lines)
  - [x] 8.3: Incoming changes: blue background (distinct from removed - this is incoming)
  - [x] 8.4: Separator line (=======): neutral gray/muted background
  - [x] 8.5: Use `editor.deltaDecorations()` to apply conflict highlighting

- [x] Task 9: Add unit tests for conflict parsing utilities (AC: 3)
  - [x] 9.1: Test `parseConflictRegions` parses single conflict correctly
  - [x] 9.2: Test `parseConflictRegions` handles multiple conflicts in one file
  - [x] 9.3: Test `resolveConflict` with 'current' choice removes incoming and markers
  - [x] 9.4: Test `resolveConflict` with 'incoming' choice removes current and markers
  - [x] 9.5: Test `resolveConflict` with 'both' choice keeps both, removes markers
  - [x] 9.6: Test `hasUnresolvedConflicts` detects markers correctly
  - [x] 9.7: Test edge case: no conflicts in file

- [x] Task 10: Add integration tests for conflict resolution flow (AC: 1, 4)
  - [x] 10.1: Test ConflictResolutionView renders file list correctly
  - [x] 10.2: Test file selection updates editor content
  - [x] 10.3: Test "Accept Current" removes incoming section and markers (via ConflictFileEditor.test.tsx)
  - [x] 10.4: Test "Complete Merge" button disabled until all files resolved
  - [x] 10.5: Test successful merge clears conflict state in database (covered via ConflictResolutionView.test.tsx)

## Dev Notes

### Critical Implementation Context

**Story 8.8 builds directly on Story 8.7 infrastructure:**
- `has_merge_conflict` (integer) column in tasks table tracks conflict state
- `conflict_files` (text, JSON array) stores list of conflicting file paths
- `ConflictWarningBanner` component already displays conflicts and needs "Resolve" button
- `ConflictDetectionResult` interface in git.service.ts provides conflict info

**Existing Monaco Infrastructure (TES-4.4):**
- `MonacoDiffEditor` component exists but uses read-only DiffEditor
- For conflict resolution, need EDITABLE Monaco Editor (not DiffEditor)
- Theme registration in `src/renderer/src/components/diff/theme.ts`
- Use same TinSu dark theme (`TINSU_DARK_THEME`) for consistency

### Git Conflict Marker Format

Standard git conflict markers (merge style):
```
<<<<<<< HEAD
Current branch content (ours)
=======
Incoming branch content (theirs)
>>>>>>> feature-branch
```

With diff3 style (includes common ancestor):
```
<<<<<<< HEAD
Current branch content (ours)
||||||| merged common ancestors
Original content before divergence
=======
Incoming branch content (theirs)
>>>>>>> feature-branch
```

**Implementation should handle both formats** - check for `|||||||` marker presence.

### Conflict Resolution Choices

Per [Git documentation](https://git-scm.com/book/en/v2/Git-Tools-Advanced-Merging):
- **Accept Current (`--ours`)**: Keep HEAD version, discard incoming
- **Accept Incoming (`--theirs`)**: Keep incoming version, discard current
- **Accept Both**: Concatenate both versions (remove markers only)
- **Manual Edit**: User edits content directly, then removes markers

### Monaco Editor for Editable Conflicts

Unlike the read-only DiffEditor, conflict resolution requires:
```typescript
import Editor from '@monaco-editor/react'  // NOT DiffEditor

<Editor
  value={fileContent}
  onChange={(value) => setFileContent(value || '')}
  language={getLanguageFromPath(filePath)}
  theme={TINSU_DARK_THEME}
  options={{
    readOnly: false,  // MUST be editable
    minimap: { enabled: false },
    // ... other options
  }}
/>
```

### Monaco Decorations for Conflict Highlighting

Use `editor.deltaDecorations()` to highlight conflict regions:
```typescript
const decorations = editor.deltaDecorations([], [
  {
    range: new monaco.Range(startLine, 1, endLine, 1),
    options: {
      isWholeLine: true,
      className: 'conflict-current-region',  // Green background
      marginClassName: 'conflict-margin-current'
    }
  },
  // ... more decorations for incoming, separator
])
```

Define CSS classes in `globals.css`:
```css
.conflict-current-region {
  background: rgba(34, 197, 94, 0.15);  /* --status-running green */
}
.conflict-incoming-region {
  background: rgba(59, 130, 246, 0.15);  /* --primary blue */
}
.conflict-separator {
  background: rgba(161, 161, 170, 0.1);  /* --text-muted */
}
```

### Inline Resolution Buttons with Monaco ViewZones/Widgets

Two approaches for "Accept Current/Incoming" buttons:
1. **ViewZones** - Insert content between lines (preferred)
2. **Content Widgets** - Overlay widgets at specific positions

ViewZone approach:
```typescript
editor.changeViewZones((accessor) => {
  accessor.addZone({
    afterLineNumber: conflictStartLine,
    heightInLines: 1,
    domNode: createButtonsElement()  // React portal or DOM
  })
})
```

### tRPC Endpoints for File Operations

**Reading file content from worktree:**
```typescript
// git.router.ts
getConflictFileContent: t.procedure
  .input(z.object({ worktreePath: z.string(), filePath: z.string() }))
  .query(async ({ input }) => {
    const fullPath = path.join(input.worktreePath, input.filePath)
    return fs.readFileSync(fullPath, 'utf-8')
  })
```

**Writing resolved content:**
```typescript
saveConflictFileContent: t.procedure
  .input(z.object({
    worktreePath: z.string(),
    filePath: z.string(),
    content: z.string()
  }))
  .mutation(async ({ input }) => {
    const fullPath = path.join(input.worktreePath, input.filePath)
    fs.writeFileSync(fullPath, input.content, 'utf-8')
    return { success: true }
  })
```

### Completing the Merge

After all conflicts resolved:
```bash
# Stage all resolved files
git -C {worktreePath} add .

# Complete the merge commit (Git auto-generates merge message)
git -C {worktreePath} commit --no-edit
```

**Important:** The merge was started with `git merge --no-commit --no-ff` during conflict detection. After resolution, just run `git commit` (not `git merge` again).

### Opening in System Editor

Use Electron's `shell.openPath()`:
```typescript
// git.router.ts
openInSystemEditor: t.procedure
  .input(z.object({ path: z.string() }))
  .mutation(async ({ input }) => {
    const { shell } = require('electron')
    return shell.openPath(input.path)
  })
```

### Previous Story Intelligence (8-7)

From Story 8-7 completion notes:
- ConflictWarningBanner created in `components/conflict/`
- Conflict indicator added to TaskCard (amber AlertTriangle)
- Integration with TaskDetailContent shows banner below header
- Banner is dismissible and resets on task change
- Database stores conflict state across sessions

Key files created in 8-7:
- `src/renderer/src/components/conflict/ConflictWarningBanner.tsx`
- `src/renderer/src/components/conflict/ConflictWarningBanner.test.tsx`
- `src/renderer/src/components/conflict/index.ts`

### UI/UX Design Guidelines

Per `ux-design-specification.md`:
- Use amber/warning colors for conflict states
- Maintain "Calm Command" dark theme
- Keyboard shortcuts where applicable (e.g., `C` for Accept Current, `I` for Accept Incoming)
- Show clear progress: "3 of 5 files resolved"
- Success toast on completion: "Conflicts resolved - merge complete"

### Architecture Compliance

Per `project-context.md` and `architecture.md`:
- All file operations in main process via tRPC
- NO direct `fs` access in renderer
- Use Zod for input validation on tRPC endpoints
- Path validation using existing `validatePath()` pattern in GitService
- Error handling: throw `TRPCError` with clear messages

### Testing Strategy

Per project patterns:
- Co-locate tests with source files (`.test.tsx`)
- Mock file system operations in unit tests
- Use temp directories for integration tests
- Test both success and error paths

### Project Structure Notes

**Files to create:**
- `src/renderer/src/components/conflict/ConflictResolutionView.tsx`
- `src/renderer/src/components/conflict/ConflictResolutionView.test.tsx`
- `src/renderer/src/components/conflict/ConflictFileEditor.tsx`
- `src/renderer/src/components/conflict/ConflictFileEditor.test.tsx`
- `src/renderer/src/components/conflict/utils.ts`
- `src/renderer/src/components/conflict/utils.test.ts`

**Files to modify:**
- `src/renderer/src/components/conflict/ConflictWarningBanner.tsx` - Add "Resolve Conflicts" button
- `src/renderer/src/components/conflict/index.ts` - Export new components
- `src/renderer/src/components/task/TaskDetailContent.tsx` - Add ConflictResolutionView integration
- `src/main/trpc/routers/git.router.ts` - Add file read/write/stage/commit endpoints
- `src/main/trpc/routers/task.router.ts` - Clear conflict state after successful merge
- `src/renderer/src/globals.css` - Add conflict decoration CSS classes

**Files to reference:**
- `src/main/services/git.service.ts` - Existing git operations (lines 1423-1536)
- `src/renderer/src/components/diff/MonacoDiffEditor.tsx` - Monaco setup patterns
- `src/renderer/src/components/diff/theme.ts` - TinSu theme registration
- `src/main/db/schema.ts` - tasks table with conflict columns

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 8.8]
- [Source: _bmad-output/implementation-artifacts/8-7-merge-conflict-detection.md - previous story with all conflict infrastructure]
- [Source: src/main/services/git.service.ts:1423-1536 - detectMergeConflicts() method]
- [Source: src/renderer/src/components/conflict/ConflictWarningBanner.tsx - existing banner component]
- [Source: src/renderer/src/components/diff/MonacoDiffEditor.tsx - Monaco patterns]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Conflict Resolution]
- [Monaco Editor deltaDecorations API](https://github.com/microsoft/monaco-editor/issues/1529)
- [Git Advanced Merging - Conflict Markers](https://git-scm.com/book/en/v2/Git-Tools-Advanced-Merging)
- [Git Merge Conflict Resolution](https://www.atlassian.com/git/tutorials/using-branches/merge-conflicts)

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)

### Debug Log References

N/A

### Completion Notes List

**Implementation Complete:**
- ✅ All 10 tasks completed successfully
- ✅ Full conflict resolution UI with Monaco Editor
- ✅ ViewZones with inline "Accept Current/Incoming/Both" buttons
- ✅ Complete test coverage (utils, ConflictResolutionView, ConflictFileEditor)
- ✅ All tRPC endpoints implemented with path validation
- ✅ CSS decorations for conflict highlighting (globals.css:553-661)
- ✅ GitService methods: stageFile(), completeMergeCommit()
- ✅ Integration with TaskDetailContent and ConflictWarningBanner

**Key Design Decisions:**
1. Used Monaco Editor (not DiffEditor) for editable conflict resolution
2. ViewZones for inline resolution buttons above each conflict region
3. Full support for both standard and diff3 conflict formats
4. Real-time conflict detection with `hasUnresolvedConflicts()` utility
5. File-by-file resolution tracking with progress indicator
6. External editor support via Electron's shell.openPath()

**Testing:**
- Unit tests: 26 tests in utils.test.ts
- Integration tests: 12 tests in ConflictResolutionView.test.tsx
- Component tests: 9 test suites in ConflictFileEditor.test.tsx

### File List

**New Files Created:**
- `src/renderer/src/components/conflict/ConflictResolutionView.tsx` (582 lines)
- `src/renderer/src/components/conflict/ConflictResolutionView.test.tsx` (193 lines)
- `src/renderer/src/components/conflict/ConflictFileEditor.tsx` (448 lines)
- `src/renderer/src/components/conflict/ConflictFileEditor.test.tsx` (252 lines)
- `src/renderer/src/components/conflict/utils.ts` (362 lines)
- `src/renderer/src/components/conflict/utils.test.ts` (326 lines)

**Modified Files:**
- `src/main/services/git.service.ts` (added stageFile, completeMergeCommit methods)
- `src/main/trpc/routers/git.router.ts` (added 5 endpoints: getConflictFileContent, saveConflictFileContent, stageResolvedFile, completeConflictResolution, openInSystemEditor)
- `src/renderer/src/components/conflict/ConflictWarningBanner.tsx` (added onResolveClick prop and Resolve button)
- `src/renderer/src/components/conflict/ConflictWarningBanner.test.tsx` (added tests for Resolve button)
- `src/renderer/src/components/conflict/index.ts` (exported new components)
- `src/renderer/src/components/task/TaskDetailContent.tsx` (integrated ConflictResolutionView)
- `src/renderer/src/globals.css` (added conflict decoration CSS classes, lines 553-661)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (status updates)

# Story tes-4.4: Monaco Diff Viewer Integration

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want to see syntax-highlighted diffs,
So that I can easily read and understand code changes.

## Acceptance Criteria

1. **Given** a file diff is displayed
   **When** Monaco diff editor renders
   **Then** the original (left) and modified (right) versions are shown
   **And** syntax highlighting matches the file type (detected from extension)

2. **Given** a diff hunk shows added lines
   **When** rendered
   **Then** added lines have green background (rgba(34, 197, 94, 0.15))
   **And** the "+" gutter indicator is visible

3. **Given** a diff hunk shows removed lines
   **When** rendered
   **Then** removed lines have red background (rgba(239, 68, 68, 0.15))
   **And** the "-" gutter indicator is visible

4. **Given** the diff viewer is displayed
   **When** the user scrolls
   **Then** both sides scroll in sync (in split view)
   **And** line numbers are visible in the gutter

5. **Given** a large file with many changes
   **When** displayed
   **Then** unchanged sections are collapsed by default
   **And** clicking expands to show context

## Tasks / Subtasks

- [x] Task 1: Install Monaco Editor dependencies (AC: #1)
  - [x] 1.1: Add `@monaco-editor/react` package to dependencies
  - [x] 1.2: Verify compatibility with electron-vite bundling
  - [x] 1.3: Update vite config if needed for Monaco web workers (not needed - works out of box)

- [x] Task 2: Create MonacoDiffEditor component (AC: #1, #4)
  - [x] 2.1: Create `src/renderer/src/components/diff/MonacoDiffEditor.tsx`
  - [x] 2.2: Define `MonacoDiffEditorProps` interface with `original: string`, `modified: string`, `language: string`, `filePath: string`
  - [x] 2.3: Import and configure `DiffEditor` from `@monaco-editor/react`
  - [x] 2.4: Set up editor options for read-only mode
  - [x] 2.5: Configure synchronized scrolling between original and modified panes
  - [x] 2.6: Add line numbers to gutter
  - [x] 2.7: Export from `src/renderer/src/components/diff/index.ts`

- [x] Task 3: Implement language detection from file extension (AC: #1)
  - [x] 3.1: Create language mapping function `getLanguageFromPath(filePath: string): string`
  - [x] 3.2: Support common extensions: `.ts`, `.tsx`, `.js`, `.jsx`, `.json`, `.md`, `.css`, `.html`, `.sql`, `.yaml`, `.yml`
  - [x] 3.3: Default to `plaintext` for unknown extensions
  - [x] 3.4: Add unit tests for language detection

- [x] Task 4: Configure diff highlighting colors (AC: #2, #3)
  - [x] 4.1: Configure Monaco theme with custom diff colors
  - [x] 4.2: Set added line background: `rgba(34, 197, 94, 0.15)` (green-500 at 15% opacity)
  - [x] 4.3: Set removed line background: `rgba(239, 68, 68, 0.15)` (red-500 at 15% opacity)
  - [x] 4.4: Ensure gutter indicators ("+" and "-") are visible

- [x] Task 5: Implement file content reconstruction (AC: #1)
  - [x] 5.1: Create function `reconstructFileContent(hunks: GitDiffHunk[]): { original: string, modified: string }`
  - [x] 5.2: Build original content from context + removed lines
  - [x] 5.3: Build modified content from context + added lines
  - [x] 5.4: Add unit tests for content reconstruction

- [x] Task 6: Handle large files with collapsible sections (AC: #5)
  - [x] 6.1: Configure Monaco to collapse unchanged sections automatically
  - [x] 6.2: Set `diffEditor.hideUnchangedRegions.enabled: true` option
  - [x] 6.3: Configure `diffEditor.hideUnchangedRegions.minimumLineCount` threshold
  - [x] 6.4: Add expand/collapse UI hint text (Monaco provides this automatically)

- [x] Task 7: Integrate Monaco into DiffPlaceholder (AC: #1-5)
  - [x] 7.1: Replace hunk preview div with MonacoDiffEditor component
  - [x] 7.2: Pass reconstructed original/modified content to Monaco
  - [x] 7.3: Pass detected language based on file extension
  - [x] 7.4: Handle loading state while Monaco initializes
  - [x] 7.5: Add height constraint for diff viewer section

- [x] Task 8: Add dark theme support (AC: #1)
  - [x] 8.1: Create custom Monaco dark theme matching TinSu's design
  - [x] 8.2: Configure background colors to match workspace panels
  - [x] 8.3: Ensure text colors meet contrast requirements

- [x] Task 9: Add unit tests for MonacoDiffEditor (AC: #1-5)
  - [x] 9.1: Create `src/renderer/src/components/diff/MonacoDiffEditor.test.tsx`
  - [x] 9.2: Test component renders with original and modified content
  - [x] 9.3: Test language detection is applied
  - [x] 9.4: Test diff highlighting colors are configured
  - [x] 9.5: Mock Monaco editor for testing environment

### Code Review Follow-ups (LOW Priority)

- [ ] [AI-Review][LOW] Add aria-live announcements for loading state [MonacoDiffEditor.tsx:112]
  - Improve screen reader experience by announcing when diff completes loading
  - Add `aria-live="polite"` to loading skeleton
  - Consider announcing when Monaco mounts successfully

- [ ] [AI-Review][LOW] Document height prop string format support [MonacoDiffEditor.tsx:33-34]
  - Add JSDoc comment explaining which string formats are supported
  - Test edge cases: "100%", "calc()", "50vh"
  - Document Monaco's height handling behavior

- [ ] [AI-Review][LOW] Document magic number rationale [MonacoDiffEditor.tsx:138-139]
  - Add JSDoc explaining why `minimumLineCount: 3` and `contextLineCount: 3`
  - Document trade-offs of different values
  - Consider making these configurable via props if use cases emerge

## Dev Notes

### Architecture Compliance

This story integrates Monaco Editor for syntax-highlighted diff viewing. It follows established TES patterns:

**Component Pattern:**
- Use `@monaco-editor/react` wrapper for React integration (version 4.7.0 per architecture.md)
- Follow existing diff component patterns from `DiffSummaryBar.tsx` and `FileTree.tsx`
- Components go in `src/renderer/src/components/diff/` folder
- Co-locate tests next to component files
- Export from `index.ts` barrel file

**Technology Decision:**
- Monaco Editor is specifically chosen in architecture.md for "VS Code-quality diffs, syntax highlighting, handles large files"
- This replaces the current hunk preview with a full-featured diff viewer

### Critical Implementation Details

**Monaco Editor Package:**
```bash
npm install @monaco-editor/react monaco-editor
```

**Required Vite Configuration:**
Monaco Editor uses web workers. Electron-vite may need configuration:
```typescript
// electron.vite.config.ts - if worker loading fails
import monacoEditorPlugin from 'vite-plugin-monaco-editor'

export default defineConfig({
  renderer: {
    plugins: [
      monacoEditorPlugin({
        languageWorkers: ['editorWorkerService', 'typescript', 'json', 'css', 'html']
      })
    ]
  }
})
```

**Monaco DiffEditor Setup:**
```typescript
import { DiffEditor } from '@monaco-editor/react'

<DiffEditor
  original={originalContent}
  modified={modifiedContent}
  language={language}
  theme="tinsu-dark"
  options={{
    readOnly: true,
    renderSideBySide: true,        // Split view
    enableSplitViewResizing: true,
    originalEditable: false,
    minimap: { enabled: false },
    lineNumbers: 'on',
    scrollBeyondLastLine: false,
    wordWrap: 'off',
    diffWordWrap: 'off',
    renderIndicators: true,
    // Collapse unchanged regions
    diffEditor: {
      hideUnchangedRegions: {
        enabled: true,
        minimumLineCount: 3,
        contextLineCount: 3
      }
    }
  }}
/>
```

**Language Detection Mapping:**
```typescript
const LANGUAGE_MAP: Record<string, string> = {
  // JavaScript/TypeScript
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  // Web
  '.html': 'html',
  '.css': 'css',
  '.scss': 'scss',
  '.less': 'less',
  // Data
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.xml': 'xml',
  // Markdown
  '.md': 'markdown',
  '.mdx': 'markdown',
  // Database
  '.sql': 'sql',
  // Shell
  '.sh': 'shell',
  '.bash': 'shell',
  '.zsh': 'shell',
  // Python
  '.py': 'python',
  // Rust
  '.rs': 'rust',
  // Go
  '.go': 'go',
  // Other
  '.txt': 'plaintext'
}

export function getLanguageFromPath(filePath: string): string {
  const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase()
  return LANGUAGE_MAP[ext] ?? 'plaintext'
}
```

**File Content Reconstruction:**
```typescript
// Reconstruct original and modified content from hunks
export function reconstructFileContent(hunks: GitDiffHunk[]): { original: string; modified: string } {
  const originalLines: string[] = []
  const modifiedLines: string[] = []

  for (const hunk of hunks) {
    for (const line of hunk.lines) {
      if (line.type === 'context') {
        originalLines.push(line.content)
        modifiedLines.push(line.content)
      } else if (line.type === 'remove') {
        originalLines.push(line.content)
      } else if (line.type === 'add') {
        modifiedLines.push(line.content)
      }
    }
  }

  return {
    original: originalLines.join('\n'),
    modified: modifiedLines.join('\n')
  }
}
```

**Custom Dark Theme:**
```typescript
import * as monaco from 'monaco-editor'

// Define custom theme
monaco.editor.defineTheme('tinsu-dark', {
  base: 'vs-dark',
  inherit: true,
  rules: [],
  colors: {
    'editor.background': '#1a1a1a',
    'diffEditor.insertedTextBackground': 'rgba(34, 197, 94, 0.15)',  // green-500 at 15%
    'diffEditor.removedTextBackground': 'rgba(239, 68, 68, 0.15)',   // red-500 at 15%
    'diffEditor.insertedLineBackground': 'rgba(34, 197, 94, 0.08)',
    'diffEditor.removedLineBackground': 'rgba(239, 68, 68, 0.08)',
    'diffEditorGutter.insertedLineBackground': 'rgba(34, 197, 94, 0.3)',
    'diffEditorGutter.removedLineBackground': 'rgba(239, 68, 68, 0.3)'
  }
})
```

**TypeScript Interfaces (from git.service.ts):**
```typescript
interface GitDiffHunk {
  oldStart: number
  oldCount: number
  newStart: number
  newCount: number
  lines: GitDiffLine[]
}

interface GitDiffLine {
  type: 'context' | 'add' | 'remove'
  content: string
  oldLineNumber?: number
  newLineNumber?: number
}

interface GitDiffFile {
  path: string
  oldPath?: string
  status: 'added' | 'modified' | 'deleted' | 'renamed'
  additions: number
  deletions: number
  hunks: GitDiffHunk[]
}
```

### Project Structure Notes

**Files to Create:**
```
src/renderer/src/components/diff/MonacoDiffEditor.tsx        # Main Monaco component
src/renderer/src/components/diff/MonacoDiffEditor.test.tsx   # Co-located tests
src/renderer/src/components/diff/utils.ts                    # Language detection, content reconstruction
src/renderer/src/components/diff/utils.test.ts               # Utility tests
src/renderer/src/components/diff/theme.ts                    # Custom Monaco theme
```

**Files to Modify:**
```
src/renderer/src/components/diff/index.ts                    # Add MonacoDiffEditor export
src/renderer/src/components/task/DiffPlaceholder.tsx         # Replace hunk preview with Monaco
package.json                                                 # Add @monaco-editor/react
electron.vite.config.ts                                      # Add Monaco worker config (if needed)
```

**Component Props Interface:**
```typescript
interface MonacoDiffEditorProps {
  /** Original file content (before changes) */
  original: string
  /** Modified file content (after changes) */
  modified: string
  /** Programming language for syntax highlighting */
  language: string
  /** File path for reference */
  filePath: string
  /** Optional additional CSS classes */
  className?: string
  /** Optional height (default: 300px) */
  height?: string | number
}
```

### Previous Story Intelligence (TES-4-1, TES-4-2, TES-4-3)

**Learnings from TES-4-1 (Git Diff Data Fetching):**
- GitService provides `files` array with `hunks` containing all diff data
- Each hunk has `lines` with `type: 'context' | 'add' | 'remove'` and `content`
- useDiff hook exposes `diff?.files` for accessing hunks
- Types exported from `@main/services` or `@main/services/git.service`

**Learnings from TES-4-2 (Diff Summary Bar):**
- Components go in `components/diff/` folder with barrel export
- Use `cn()` for conditional styling
- Follow aria-label patterns for accessibility
- Co-locate tests with `.test.tsx` suffix

**Learnings from TES-4-3 (File Tree Component):**
- DiffPlaceholder.tsx already has file selection state (`selectedFile`)
- File refs for scroll-into-view functionality exist
- Hunk preview (lines 228-254) will be REPLACED with Monaco diff viewer
- Current preview shows only first 4 lines - Monaco will show full content

**Code Review Patterns to Apply:**
- Add aria-labels for accessibility
- Handle edge cases (empty hunks, no content)
- Use `useMemo` for expensive computations (content reconstruction)
- Test loading states properly

### Git Intelligence (Recent Commits)

```
2cb11d8 tes-4-3 done - FileTree component created
d928c66 tes-4-2 done - DiffSummaryBar component created
6705b91 tes-4-1 done - GitService and useDiff hook implemented
7f14740 tes-3-3 done - Section expand/collapse
a8beb52 tes-3-2 done - Three-column resizable workspace
```

**Relevant Files from Previous Stories:**
- `src/main/services/git.service.ts` - GitService with getDiff() (lines 58-71 for types)
- `src/renderer/src/hooks/useDiff.ts` - React hook for diff data
- `src/renderer/src/components/diff/DiffSummaryBar.tsx` - Summary component pattern
- `src/renderer/src/components/diff/FileTree.tsx` - File selection pattern
- `src/renderer/src/components/task/DiffPlaceholder.tsx` - Integration point (lines 228-254 to replace)

### Library Specifics (CRITICAL)

**Monaco Editor Version:**
- Architecture specifies Monaco Editor 4.7.0
- Use `@monaco-editor/react` wrapper for React integration
- This wrapper handles Monaco's web worker loading

**Import Pattern:**
```typescript
// Wrapper for React (preferred)
import { DiffEditor } from '@monaco-editor/react'

// Direct Monaco access (for theme registration)
import * as monaco from 'monaco-editor'
```

**Worker Loading:**
Monaco uses web workers for language features. Electron-vite should handle this automatically, but if workers fail to load:
1. Add `vite-plugin-monaco-editor` plugin
2. Or configure worker URLs manually

**Performance Considerations:**
- Monaco is a heavy library (~1MB gzipped)
- Use lazy loading with `React.lazy()` if needed for initial load performance
- DiffEditor creates two editor instances - consider memory for many open files

### Testing Strategy

**Unit Tests (`MonacoDiffEditor.test.tsx`):**
Monaco is difficult to test in JSDOM. Strategies:
1. Mock `@monaco-editor/react` module
2. Test props are passed correctly
3. Test utility functions separately
4. Skip visual/interaction tests (handled by E2E)

**Example Mock:**
```typescript
vi.mock('@monaco-editor/react', () => ({
  DiffEditor: vi.fn(({ original, modified, language }: any) => (
    <div data-testid="mock-diff-editor">
      <div data-testid="original">{original}</div>
      <div data-testid="modified">{modified}</div>
      <div data-testid="language">{language}</div>
    </div>
  ))
}))
```

**Utility Function Tests (`utils.test.ts`):**
- Test `getLanguageFromPath()` with various extensions
- Test `reconstructFileContent()` with sample hunks
- Test edge cases: empty hunks, all additions, all deletions

### 🎨 FRONTEND/UI STORY: Dev agent MUST use /frontend-design skill to implement this story.

### References

- [Source: _bmad-output/planning-artifacts/epics-task-execution-sandbox.md#Story 4.4: Monaco Diff Viewer Integration] - Story requirements (lines 1407-1443)
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend Architecture] - Monaco Editor choice (lines 214-218)
- [Source: _bmad-output/planning-artifacts/project-context.md#Technology Stack] - Monaco version 4.7.0 (line 31)
- [Source: src/renderer/src/components/task/DiffPlaceholder.tsx] - Integration point (lines 228-254)
- [Source: src/main/services/git.service.ts] - GitDiffHunk, GitDiffLine types
- [Source: _bmad-output/implementation-artifacts/tes-4-3-file-tree-component.md] - Previous story patterns
- [Source: _bmad-output/implementation-artifacts/tes-4-2-diff-summary-bar.md] - Component structure patterns
- [Source: _bmad-output/implementation-artifacts/tes-4-1-git-diff-data-fetching.md] - Git data structure

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

None - implementation completed without debugging issues.

### Completion Notes List

- Installed `@monaco-editor/react` and `monaco-editor` packages successfully
- Monaco Editor works out-of-box with electron-vite - no additional vite plugin configuration needed
- Created `MonacoDiffEditor` component with full VS Code-quality diff viewing
- Custom `tinsu-dark` theme configured with exact acceptance criteria colors
- Language detection supports 20+ file extensions with case-insensitive matching
- Content reconstruction handles context, added, and removed lines correctly
- Integration preserves existing DiffPlaceholder UX - click file preview to expand Monaco viewer
- All 58 new tests pass (38 for utils, 20 for component)
- Build bundle size increased by ~5MB (Monaco is a heavy library as documented)
- Added error handling for Monaco initialization failures
- Implemented thread-safe theme registration using React refs
- Added error boundary with retry functionality for Monaco crashes

### File List

**New Files:**
- src/renderer/src/components/diff/MonacoDiffEditor.tsx
- src/renderer/src/components/diff/MonacoDiffEditor.test.tsx
- src/renderer/src/components/diff/utils.ts
- src/renderer/src/components/diff/utils.test.ts
- src/renderer/src/components/diff/theme.ts

**Modified Files:**
- package.json (added @monaco-editor/react, monaco-editor)
- package-lock.json (updated dependencies)
- src/renderer/src/components/diff/index.ts (added exports)
- src/renderer/src/components/task/DiffPlaceholder.tsx (integrated Monaco viewer)
- _bmad-output/implementation-artifacts/sprint-status.yaml (updated story status)
- tsconfig.web.tsbuildinfo (TypeScript build cache)

## Change Log

- 2026-01-21: Implemented Monaco Diff Viewer Integration (TES-4.4)
- 2026-01-21: Code Review - Fixed 8 HIGH/MEDIUM issues: error handling, thread safety, TypeScript types, documentation accuracy


---
title: 'Chat Attachments — File & Image Sharing in Planning Workspace'
slug: 'chat-attachments'
created: '2026-03-23'
status: 'completed'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['Electron', 'React', 'TypeScript', 'Drizzle ORM', 'better-sqlite3', 'tRPC', 'Zod', 'Zustand', 'TanStack Query', 'node-pty', '@dnd-kit', 'Tailwind CSS', 'vitest', '@testing-library/react']
files_to_modify: ['src/main/db/schema.ts', 'src/main/db/index.ts', 'src/main/trpc/routers/chat-session.router.ts', 'src/main/services/chat-cli.service.ts', 'src/renderer/src/components/planning/ChatInput.tsx', 'src/renderer/src/components/planning/ChatPanel.tsx', 'src/renderer/src/components/planning/ChatMessageBubble.tsx', 'src/renderer/src/components/planning/ChatMessageArea.tsx']
code_patterns: ['tRPC for all main↔renderer IPC', 'Renderer cannot import fs/child_process', 'Drizzle schema + manual migration in db/index.ts', 'dialog.showOpenDialog via tRPC mutation', '@dnd-kit for DnD', 'file:// protocol for local images in Electron', 'ptyService.write(processId, message + \\r) for CLI input', 'tool_name/tool_input fields for special message types']
test_patterns: ['vitest + @testing-library/react + @testing-library/user-event', 'Mock tRPC client + Zustand stores', 'data-testid selectors', 'describe/it with AC references', 'vi.fn() for mocks, waitFor for async']
---

# Tech-Spec: Chat Attachments — File & Image Sharing in Planning Workspace

**Created:** 2026-03-23

## Overview

### Problem Statement

Users collaborating with AI agents in the planning workspace chat cannot share visual or document context (screenshots, PDFs, spreadsheets, mockups) during conversations. The chat only supports text input, forcing users to manually set up file references outside the conversation flow, breaking the collaborative rhythm.

### Solution

Add attachment support to ChatInput — clipboard paste (Phase 1), drag-and-drop + file picker (Phase 2) — saving files to `.tinsu/data/attachments/<session-id>/`, rendering inline image previews in chat bubbles, and passing file paths in the CLI message so agents can read and analyze files with their filesystem tools.

### Scope

**In Scope:**
- Phase 1: Image paste from clipboard (Cmd+V), inline image preview before and after send, multiple attachments per message
- Phase 2: Drag-and-drop from Finder, attach button/file picker, support for PDF/Excel/Markdown/any file type, file icon + name display for non-image files
- Storage at `.tinsu/data/attachments/<session-id>/` (already gitignored via `.tinsu/data/`)
- Separate `chat_message_attachments` table for attachment metadata
- CLI message includes absolute file paths for agent to read/analyze
- No file size or quantity limitations (app runs locally on user's machine)

**Out of Scope:**
- Audio/video playback or streaming
- File editing within chat
- Cloud storage / sync
- Attachment search across sessions
- Session attachment cleanup/management UI

## Context for Development

### Codebase Patterns

- **Process boundary:** Renderer CANNOT import `fs`, `child_process`, or call `ipcRenderer` directly. ALL file operations go through tRPC mutations to the main process.
- **State management:** Server state via tRPC + TanStack Query. Local UI state via Zustand stores. Never use `useState` for server data.
- **Styling:** Inline Tailwind classes only, use `cn()` utility from `@renderer/lib/utils` for conditionals. Color tokens: `foreground`, `background`, `muted-foreground`, `border`. Opacity modifiers: `/20`, `/30`, `/40`, `/60`, `/90`.
- **Database:** Drizzle ORM with `sqliteTable`. Table names: `snake_case` plural. Column names: `snake_case`. Migrations are manual SQL in `applyIncrementalMigrations()` in `db/index.ts`. Run `npm run rebuild:electron` after schema changes.
- **tRPC:** Queries use `camelCase` with `get`/`list` prefix. Mutations use verb prefix. Input validation via Zod. Errors via `TRPCError`. Return data directly, never `{ success, data }` wrappers.
- **Components:** PascalCase filenames. Props interfaces defined inline. `data-testid` attributes for test selectors.
- **CLI integration:** Messages sent to Claude CLI via `ptyService.write(processId, message + '\r')`. CLI can read any file from filesystem using its Read tool and view images by path.
- **Special messages:** `chat_messages.tool_name` and `tool_input` (JSON string) used for special message types like `__artifact_created__` and `__notification__`.
- **Existing DnD:** `@dnd-kit` already in use for KanbanBoard — available for file drop zones.
- **Existing file picker:** `dialog.showOpenDialog()` already exposed as tRPC mutation in `config.router.ts` with Zod-validated filters.

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `src/renderer/src/components/planning/ChatInput.tsx` | Text input component — extend with paste/drop handlers and attachment preview |
| `src/renderer/src/components/planning/ChatPanel.tsx` | Chat orchestrator — wire attachments through `handleSend` to tRPC |
| `src/renderer/src/components/planning/ChatMessageBubble.tsx` | Message rendering — add inline image display and file chips |
| `src/renderer/src/components/planning/ChatMessageArea.tsx` | Message grouping and scroll — handle attachment segments |
| `src/main/db/schema.ts` | Drizzle schema — add `chat_message_attachments` table |
| `src/main/db/index.ts` | Migrations — add CREATE TABLE for attachments |
| `src/main/trpc/routers/chat-session.router.ts` | Chat API — extend `sendChatMessage` input, add attachment procedures |
| `src/main/services/chat-cli.service.ts` | CLI process — format message with file paths for stdin |
| `src/main/trpc/routers/config.router.ts` | Reference: existing `showOpenDialog` pattern |
| `src/renderer/src/components/board/KanbanBoard.tsx` | Reference: existing `@dnd-kit` drag-and-drop pattern |

### Technical Decisions

1. **Separate `chat_message_attachments` table** (not a JSON column on `chat_messages`): Allows proper FK cascade on message delete, indexing by message_id, and avoids JSON parsing overhead. Follows existing normalized schema pattern.

2. **File storage at `.tinsu/data/attachments/<session-id>/`**: Already gitignored via `.tinsu/data/`. Organized by session for easy cleanup. Absolute paths stored in DB for CLI reference.

3. **Clipboard paste via `onPaste` event handler**: Intercept `ClipboardEvent`, check `clipboardData.items` for image types, extract as `File` objects. No external library needed.

4. **File saving via tRPC mutation**: Renderer reads file as `ArrayBuffer` via `FileReader` API, sends base64-encoded data to main process tRPC mutation which writes to disk. This respects the process boundary (renderer cannot use `fs`).

5. **CLI message format**: Append file paths after the text content, one per line:
   ```
   User's text message

   [Attached files — please read and analyze these:]
   /absolute/path/to/.tinsu/data/attachments/session-id/screenshot.png
   /absolute/path/to/.tinsu/data/attachments/session-id/research.pdf
   ```

6. **Inline image rendering**: Use `file://` protocol with absolute path in `<img>` tags. Electron's renderer process can load local files via `file://`.

7. **Pending attachments as local state**: Files staged before send live in component-level `useState` (not Zustand) since they're transient per-message, not cross-component state.

8. **Filename collision handling**: Append UUID suffix to filenames on save (e.g., `screenshot-a1b2c3d4.png`) to avoid overwrites when pasting multiple images.

## Implementation Plan

### Phase 1: Image Paste & Inline Preview

#### Task 1: Database schema — `chat_message_attachments` table

- File: `src/main/db/schema.ts`
- Action: Add `chat_message_attachments` table definition after the `chat_messages` table:
  ```typescript
  export const chat_message_attachments = sqliteTable(
    'chat_message_attachments',
    {
      id: text('id').primaryKey(),
      message_id: text('message_id').notNull()
        .references(() => chat_messages.id, { onDelete: 'cascade' }),
      file_name: text('file_name').notNull(),
      file_path: text('file_path').notNull(),     // absolute path on disk
      mime_type: text('mime_type').notNull(),
      file_size: integer('file_size').notNull(),   // bytes
      created_at: integer('created_at', { mode: 'timestamp' }).notNull()
    },
    (table) => [
      index('idx_chat_message_attachments_message_id').on(table.message_id)
    ]
  )
  ```
- Action: Export types `ChatMessageAttachment` (InferSelectModel) and `NewChatMessageAttachment` (InferInsertModel).

#### Task 2: Database migration

- File: `src/main/db/index.ts`
- Action: Add migration SQL inside `applyIncrementalMigrations()`:
  ```sql
  CREATE TABLE IF NOT EXISTS chat_message_attachments (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_chat_message_attachments_message_id
    ON chat_message_attachments(message_id);
  ```
- Notes: Run `npm run rebuild:electron` after this change.

#### Task 3: tRPC — `saveAttachment` mutation (file write to disk)

- File: `src/main/trpc/routers/chat-session.router.ts`
- Action: Add `saveAttachment` mutation to the existing `chatSessionRouter`:
  - Input: `{ sessionId: string, fileName: string, mimeType: string, base64Data: string }`
  - Logic:
    1. Resolve project root from session's `project_id`
    2. Build target dir: `path.join(projectRoot, '.tinsu', 'data', 'attachments', sessionId)`
    3. `mkdirSync(targetDir, { recursive: true })`
    4. Generate unique filename: `${nameWithoutExt}-${crypto.randomUUID().slice(0, 8)}${ext}`
    5. Decode base64 → `Buffer.from(base64Data, 'base64')`
    6. `writeFileSync(targetPath, buffer)`
    7. Return `{ filePath: targetPath, fileName: uniqueFileName, fileSize: buffer.length }`
  - Notes: Synchronous write is fine here — files are local, and we need the path before the message is sent.

#### Task 4: tRPC — Extend `sendChatMessage` to accept attachments

- File: `src/main/trpc/routers/chat-session.router.ts`
- Action: Extend the `sendChatMessage` input schema:
  ```typescript
  .input(z.object({
    sessionId: z.string().min(1),
    content: z.string().min(0),  // Allow empty string (image-only messages)
    attachments: z.array(z.object({
      filePath: z.string(),
      fileName: z.string(),
      mimeType: z.string(),
      fileSize: z.number()
    })).optional()
  }))
  ```
- Action: After storing the user message in `chat_messages`, if `attachments` is provided:
  1. Insert each attachment into `chat_message_attachments` with `message_id` = the new message's `id`
  2. Format the CLI message by appending file paths:
     ```
     ${content}

     [Attached files — please read and analyze these:]
     ${attachments.map(a => a.filePath).join('\n')}
     ```
  3. Send the formatted message (not just `content`) to the CLI via `sendMessage`/`spawnSession`/`resumeSession`
- Action: Update content validation from `.min(1)` to `.min(0)` and add a `.refine()` that requires either non-empty content OR at least one attachment.

#### Task 5: tRPC — `getMessageAttachments` query

- File: `src/main/trpc/routers/chat-session.router.ts`
- Action: Add query to fetch attachments for a list of message IDs (batch):
  ```typescript
  getMessageAttachments: publicProcedure
    .input(z.object({
      messageIds: z.array(z.string().min(1))
    }))
    .query(({ input }) => {
      return db.select()
        .from(chat_message_attachments)
        .where(inArray(chat_message_attachments.message_id, input.messageIds))
        .all()
    })
  ```
- Notes: Batching by message IDs avoids N+1 queries when rendering a message list. The caller passes all user message IDs from the current page.

#### Task 6: ChatInput — `onPaste` handler for images

- File: `src/renderer/src/components/planning/ChatInput.tsx`
- Action: Add `onPaste` handler to the textarea:
  ```typescript
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items)
    const imageItems = items.filter(item => item.type.startsWith('image/'))
    if (imageItems.length === 0) return  // Let normal text paste proceed

    e.preventDefault()
    const files = imageItems
      .map(item => item.getAsFile())
      .filter((f): f is File => f !== null)

    onAttachmentsAdded(files)
  }, [onAttachmentsAdded])
  ```
- Action: Add new props to `ChatInputProps`:
  ```typescript
  interface ChatInputProps {
    onSend: (content: string, attachments: PendingAttachment[]) => void  // Updated signature
    onAttachmentsAdded: (files: File[]) => void
    pendingAttachments: PendingAttachment[]
    onRemoveAttachment: (index: number) => void
    disabled?: boolean
    autoFocus?: boolean
    initialValue?: string | null
    onInitialValueConsumed?: () => void
  }
  ```
- Action: Define `PendingAttachment` type (export from ChatInput or a shared types file):
  ```typescript
  export interface PendingAttachment {
    file: File
    previewUrl: string  // Object URL for image preview, empty for non-images
    isImage: boolean
  }
  ```
- Action: Update `handleSubmit` to pass `pendingAttachments` to `onSend`:
  ```typescript
  const handleSubmit = useCallback(() => {
    const trimmed = value.trim()
    if (!trimmed && pendingAttachments.length === 0) return
    if (disabled) return
    onSend(trimmed, pendingAttachments)
    setValue('')
  }, [value, onSend, disabled, pendingAttachments])
  ```
- Action: Add the `onPaste` handler to the textarea element.

#### Task 7: ChatInput — Attachment preview strip

- File: `src/renderer/src/components/planning/ChatInput.tsx`
- Action: Render a preview strip above the textarea when `pendingAttachments.length > 0`:
  ```tsx
  {pendingAttachments.length > 0 && (
    <div className="flex gap-2 px-3 py-2 border-b border-border/30 overflow-x-auto"
         data-testid="chat-attachment-preview-strip">
      {pendingAttachments.map((att, i) => (
        <div key={i} className="relative flex-shrink-0 group" data-testid={`attachment-preview-${i}`}>
          {att.isImage ? (
            <img src={att.previewUrl} alt={att.file.name}
                 className="h-16 w-16 rounded object-cover border border-border/30" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded border border-border/30 bg-muted/40">
              <FileIcon className="h-6 w-6 text-muted-foreground" />
            </div>
          )}
          <button onClick={() => onRemoveAttachment(i)}
                  className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs group-hover:flex"
                  data-testid={`remove-attachment-${i}`}>
            ×
          </button>
          <span className="mt-0.5 block max-w-[64px] truncate text-[10px] text-muted-foreground">
            {att.file.name}
          </span>
        </div>
      ))}
    </div>
  )}
  ```
- Notes: Preview uses `URL.createObjectURL(file)` for images. Revoke URLs in cleanup effect or on remove.

#### Task 8: ChatPanel — Manage pending attachments and wire to `sendChatMessage`

- File: `src/renderer/src/components/planning/ChatPanel.tsx`
- Action: Add pending attachment state:
  ```typescript
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([])
  ```
- Action: Add handlers:
  ```typescript
  const handleAttachmentsAdded = useCallback((files: File[]) => {
    const newAttachments = files.map(file => ({
      file,
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : '',
      isImage: file.type.startsWith('image/')
    }))
    setPendingAttachments(prev => [...prev, ...newAttachments])
  }, [])

  const handleRemoveAttachment = useCallback((index: number) => {
    setPendingAttachments(prev => {
      const removed = prev[index]
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl)
      return prev.filter((_, i) => i !== index)
    })
  }, [])
  ```
- Action: Update `handleSend` to:
  1. Accept `(content: string, attachments: PendingAttachment[])` signature
  2. For each attachment, call `saveAttachment` mutation to write file to disk and get back `{ filePath, fileName, fileSize }`
  3. Call `sendChatMessage` with `{ sessionId, content, attachments: savedAttachments }`
  4. Clear `pendingAttachments` after successful send
  5. Revoke all preview object URLs
- Action: Pass `pendingAttachments`, `handleAttachmentsAdded`, `handleRemoveAttachment` to `<ChatInput>`.

#### Task 9: ChatMessageBubble — Render inline images for sent messages

- File: `src/renderer/src/components/planning/ChatMessageBubble.tsx`
- Action: Add optional `attachments` prop:
  ```typescript
  interface ChatMessageBubbleProps {
    message: ChatMessage
    attachments?: ChatMessageAttachment[]
  }
  ```
- Action: Render attachments inside the message bubble, above the text content:
  ```tsx
  {attachments && attachments.length > 0 && (
    <div className="mb-2 flex flex-wrap gap-2" data-testid="message-attachments">
      {attachments.map(att => (
        att.mime_type.startsWith('image/') ? (
          <img key={att.id} src={`file://${att.file_path}`} alt={att.file_name}
               className="max-h-64 max-w-xs rounded border border-border/20 object-contain cursor-pointer"
               data-testid={`attachment-image-${att.id}`}
               onClick={() => { /* future: lightbox */ }} />
        ) : (
          <div key={att.id} className="flex items-center gap-2 rounded border border-border/30 bg-muted/30 px-2.5 py-1.5"
               data-testid={`attachment-file-${att.id}`}>
            <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-foreground/80">{att.file_name}</span>
            <span className="text-[10px] text-muted-foreground">
              {formatFileSize(att.file_size)}
            </span>
          </div>
        )
      ))}
    </div>
  )}
  ```
- Action: Add `formatFileSize` helper (local to file):
  ```typescript
  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }
  ```

#### Task 10: ChatMessageArea — Fetch and pass attachments to bubbles

- File: `src/renderer/src/components/planning/ChatMessageArea.tsx`
- Action: Accept a new prop `attachmentsByMessageId: Record<string, ChatMessageAttachment[]>` — a pre-built lookup map.
- Action: When rendering a `'message'` segment, pass attachments:
  ```tsx
  <ChatMessageBubble
    message={segment.message}
    attachments={attachmentsByMessageId[segment.message.id]}
  />
  ```
- File: `src/renderer/src/components/planning/ChatPanel.tsx`
- Action: Add a query to fetch attachments for all user messages in the current session:
  ```typescript
  const userMessageIds = messages
    .filter(m => m.role === 'user')
    .map(m => m.id)

  const { data: attachments = [] } = trpc.chatSession.getMessageAttachments.useQuery(
    { messageIds: userMessageIds },
    { enabled: userMessageIds.length > 0 }
  )

  const attachmentsByMessageId = useMemo(() => {
    const map: Record<string, ChatMessageAttachment[]> = {}
    for (const att of attachments) {
      ;(map[att.message_id] ??= []).push(att)
    }
    return map
  }, [attachments])
  ```
- Action: Pass `attachmentsByMessageId` to `<ChatMessageArea>`.

### Phase 2: Drag-and-Drop & File Picker

#### Task 11: ChatInput — Drag-and-drop handler

- File: `src/renderer/src/components/planning/ChatInput.tsx`
- Action: Add drag-and-drop state and handlers:
  ```typescript
  const [isDragOver, setIsDragOver] = useState(false)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) onAttachmentsAdded(files)
  }, [onAttachmentsAdded])
  ```
- Action: Apply drag handlers to the input wrapper `<div>` (not just textarea) and add visual feedback:
  ```tsx
  <div className={cn(
    "relative rounded-lg border transition-colors",
    isDragOver ? "border-cyan-500/60 bg-cyan-500/5" : "border-border/40 bg-background/60"
  )}
  onDragOver={handleDragOver}
  onDragLeave={handleDragLeave}
  onDrop={handleDrop}>
  ```
- Action: Add a drop overlay when dragging:
  ```tsx
  {isDragOver && (
    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg border-2 border-dashed border-cyan-500/60 bg-cyan-500/10"
         data-testid="chat-drop-overlay">
      <span className="text-sm text-cyan-400">Drop files here</span>
    </div>
  )}
  ```

#### Task 12: ChatInput — Attach button with file picker

- File: `src/renderer/src/components/planning/ChatInput.tsx`
- Action: Add an attach button (paperclip icon) to the left of the textarea:
  ```tsx
  <button onClick={handleAttachClick}
          className="flex h-8 w-8 items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors"
          data-testid="chat-attach-button"
          title="Attach files">
    <Paperclip className="h-4 w-4" />
  </button>
  ```
- Action: Add new prop `onAttachClick: () => void` to `ChatInputProps`. The handler in ChatPanel calls the file picker:
  ```typescript
  // In ChatPanel:
  const handleAttachClick = useCallback(async () => {
    const result = await showOpenDialog.mutateAsync({
      properties: ['openFile', 'multiSelections'],
      title: 'Attach files'
    })
    if (result && result.length > 0) {
      // For files selected via dialog, we need to read them
      // Call a tRPC mutation that copies files to .tinsu/data/attachments/ and returns metadata
      const saved = await copyFilesToAttachments.mutateAsync({
        sessionId: activeSessionId,
        filePaths: result
      })
      // Add to pending attachments with saved metadata
    }
  }, [activeSessionId])
  ```

#### Task 13: tRPC — `copyFilesToAttachments` mutation (for file picker / external files)

- File: `src/main/trpc/routers/chat-session.router.ts`
- Action: Add mutation that copies files from their original location to `.tinsu/data/attachments/<session-id>/`:
  - Input: `{ sessionId: string, filePaths: string[] }`
  - Logic: For each file path:
    1. Read the file with `readFileSync`
    2. Detect mime type from extension (use a simple lookup map)
    3. Copy to `.tinsu/data/attachments/<session-id>/<unique-name>`
    4. Return array of `{ filePath, fileName, mimeType, fileSize }`
  - Notes: This is needed because files from the file picker are at arbitrary filesystem locations. We copy them to ensure they persist in the project's attachment storage and the paths are predictable.

### Acceptance Criteria

#### Phase 1: Image Paste

- [ ] AC 1: Given the user is in a chat session, when they press Cmd+V with an image on the clipboard, then the image appears as a thumbnail preview in the attachment strip above the textarea.
- [ ] AC 2: Given the user has one or more image previews staged, when they hover over a preview, then a remove (×) button appears allowing them to discard it before sending.
- [ ] AC 3: Given the user has pasted images and typed a text message, when they press Enter, then the message is sent with both text and attachment file paths to the CLI agent.
- [ ] AC 4: Given the user has pasted images with no text, when they press Enter, then the message is sent with only the attachment file paths (empty content is allowed when attachments exist).
- [ ] AC 5: Given a message was sent with image attachments, when the message renders in the chat history, then the images display inline in the message bubble at a reasonable size (max 256px height, max 320px width).
- [ ] AC 6: Given a message was sent with attachments, when the CLI agent receives the message, then the message includes absolute file paths the agent can read with its Read tool.
- [ ] AC 7: Given attachments are saved, when they are stored on disk, then they are located at `.tinsu/data/attachments/<session-id>/` and the metadata is recorded in the `chat_message_attachments` table with correct `message_id`, `file_name`, `file_path`, `mime_type`, and `file_size`.
- [ ] AC 8: Given a pasted image has no filename, when it is saved, then a generated name is used (e.g., `paste-<uuid-prefix>.png`).

#### Phase 2: Drag-and-Drop & File Picker

- [ ] AC 9: Given the user drags files from Finder over the chat input area, when the files enter the drop zone, then a visual overlay appears ("Drop files here") with a dashed cyan border.
- [ ] AC 10: Given the user drops files onto the chat input, when the drop completes, then all dropped files appear as previews in the attachment strip (images as thumbnails, non-images as file icon + name).
- [ ] AC 11: Given the user clicks the attach (paperclip) button, when the native file picker opens, then they can select multiple files of any type.
- [ ] AC 12: Given the user selects files via the file picker, when they confirm, then the files are copied to `.tinsu/data/attachments/<session-id>/` and appear in the attachment preview strip.
- [ ] AC 13: Given a message was sent with non-image attachments (PDF, Excel, etc.), when the message renders in chat history, then each non-image file displays as a chip with paperclip icon, filename, and file size.
- [ ] AC 14: Given the user sends a message with a mix of images and documents, when the message renders, then images display inline and documents display as file chips, all within the same message bubble.

## Additional Context

### Dependencies

- **No new external libraries required.** All capabilities exist in the current stack:
  - Clipboard API (browser native) for paste handling
  - `FileReader` API (browser native) for reading files as base64 in renderer
  - `fs` (Node.js) for file writes in main process
  - `@dnd-kit` (already installed) for drag-and-drop if needed, though native HTML5 drag events suffice for file drops
  - `electron.dialog` (already used) for native file picker
  - `lucide-react` (already installed) for `Paperclip`, `FileIcon`, `X` icons

### Testing Strategy

**Unit Tests (vitest + @testing-library/react):**

1. **ChatInput.test.tsx** — Extend existing tests:
   - Test `onPaste` with mocked `ClipboardEvent` containing image items → calls `onAttachmentsAdded`
   - Test `onPaste` with text-only clipboard → does NOT intercept (normal paste proceeds)
   - Test attachment preview strip renders when `pendingAttachments` has items
   - Test remove button calls `onRemoveAttachment` with correct index
   - Test Enter submits with attachments via `onSend(content, attachments)`
   - Test Enter is blocked when no text AND no attachments
   - Test drag-over shows drop overlay (Phase 2)
   - Test drop calls `onAttachmentsAdded` with files (Phase 2)

2. **ChatPanel.test.tsx** — Extend existing tests:
   - Test `handleSend` calls `saveAttachment` for each pending attachment
   - Test `handleSend` calls `sendChatMessage` with `attachments` array
   - Test attachments are cleared after successful send
   - Test `attachmentsByMessageId` is built correctly from query results

3. **ChatMessageBubble.test.tsx** — New/extend:
   - Test renders `<img>` with `file://` src for image attachments
   - Test renders file chip for non-image attachments
   - Test renders both images and file chips in mixed messages
   - Test `formatFileSize` utility returns correct strings

4. **chat-session.router.test.ts** — Extend existing tests:
   - Test `saveAttachment` writes file to correct directory
   - Test `saveAttachment` returns correct metadata
   - Test `sendChatMessage` with attachments stores records in `chat_message_attachments`
   - Test `sendChatMessage` formats CLI message with file paths appended
   - Test `getMessageAttachments` returns correct attachments for message IDs
   - Test `copyFilesToAttachments` copies external files to `.tinsu/data/attachments/` (Phase 2)

**Manual Testing:**
- Paste a screenshot from macOS screenshot tool (Cmd+Shift+4) → verify preview + send + inline render
- Paste an image copied from a web browser → verify same flow
- Paste text → verify normal paste behavior unchanged
- Send image-only message (no text) → verify agent receives file path
- Send text + multiple images → verify all render inline in bubble
- Drag a PDF from Finder → verify file chip preview + send (Phase 2)
- Use attach button → verify native picker opens, file appears in preview (Phase 2)

### Notes

- **Electron `file://` security**: Electron's default `webSecurity` may block `file://` URLs in `<img>` tags. If so, register a custom protocol (e.g., `tinsu-file://`) via `protocol.registerFileProtocol` in the main process, or adjust `webPreferences`. Verify during Phase 1 implementation.
- **Object URL cleanup**: `URL.createObjectURL()` creates blob URLs that must be revoked to avoid memory leaks. Revoke on: attachment removal, successful send, and component unmount.
- **Large file transfer**: Base64 encoding increases payload size by ~33%. For very large files (100MB+), consider switching to a streaming approach where the renderer sends the file path and the main process reads it directly. But since there are no size limits and this runs locally, base64 via tRPC is pragmatic for Phase 1.
- **CLI message length**: Very long messages (many file paths) should still work — Claude CLI accepts stdin of arbitrary length. However, if file paths are extremely long, the message may look noisy. Future improvement: use relative paths or a more structured format.
- **Future considerations** (out of scope):
  - Image lightbox/zoom on click in message bubble
  - Attachment cleanup when sessions are deleted (cascade file deletion)
  - Clipboard paste of non-image files (e.g., copied PDF from Finder)
  - Thumbnail generation for PDFs and documents

## Review Notes
- Adversarial review completed
- Findings: 16 total, 12 fixed, 4 skipped (2 noise, 2 consistent with codebase/out of scope)
- Resolution approach: auto-fix
- Fixed: F1 (path sanitization), F2 (file validation), F3 (null window), F4 (size limit), F5 (URL leak cleanup), F8 (persona race guard), F9 (type-safe originalPath), F10 (empty content CLI format), F11 (dragLeave flicker), F14 (UUID fallback)
- Skipped: F6 (sync I/O — consistent with codebase), F13 (noise), F15 (out of scope), F16 (noise)

/**
 * Stub types for chat/DB schema types.
 * These were previously imported from src/main/db/schema (Electron backend).
 * Full Drizzle-backed types will be restored in T1.3 when rspc IPC is wired.
 */

export interface ChatMessageAttachment {
  id: string
  message_id: string
  file_name: string
  file_path: string
  file_size: number
  mime_type: string
}

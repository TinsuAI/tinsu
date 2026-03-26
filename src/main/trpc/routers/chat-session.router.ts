/**
 * Chat Session Router - Story 10.1, 10.3, 10.6
 *
 * tRPC router for chat session CRUD operations and CLI session management.
 * Provides procedures for creating, listing, messaging, updating chat sessions,
 * sending messages to Claude Code CLI sessions, deleting sessions, and
 * listing sessions with message previews.
 *
 * @see Story 10.1: Chat Session Schema & Hook Endpoint (AC: 5)
 * @see Story 10.3: Claude Code CLI Chat Session Spawning (AC: 1, 2, 5)
 * @see Story 10.6: Session Persistence & Resume (AC: 1, 5, 6)
 */

import { z } from 'zod'
import crypto from 'crypto'
import { join, extname, basename } from 'path'
import { mkdirSync, writeFileSync, readFileSync, statSync } from 'fs'
import { dialog, BrowserWindow } from 'electron'
import { eq, desc, asc, sql, and, inArray } from 'drizzle-orm'
import { router, publicProcedure, TRPCError } from '../trpc'
import { db } from '../../db'
import {
  chat_sessions,
  chat_messages,
  chat_message_attachments,
  projects,
  CHAT_SESSION_STATUS,
  CHAT_MESSAGE_ROLE
} from '../../db/schema'
import { chatCliService } from '../../services'
import { PersonaContextService } from '../../services/persona-context.service'

/** Simple mime type lookup from file extension */
function mimeFromExt(filePath: string): string {
  const ext = extname(filePath).toLowerCase()
  const map: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.bmp': 'image/bmp',
    '.pdf': 'application/pdf',
    '.md': 'text/markdown',
    '.txt': 'text/plain',
    '.json': 'application/json',
    '.csv': 'text/csv',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.xls': 'application/vnd.ms-excel',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.zip': 'application/zip',
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.ts': 'application/typescript',
    '.yaml': 'text/yaml',
    '.yml': 'text/yaml'
  }
  return map[ext] ?? 'application/octet-stream'
}

/**
 * Get project path from project ID.
 * Queries the projects table to resolve the filesystem path.
 *
 * @param projectId - The project's internal ID
 * @returns The project's filesystem path
 * @throws TRPCError NOT_FOUND if project doesn't exist
 *
 * @see Story 10.3 Task 3.2
 */
function getProjectPath(projectId: string): string {
  const project = db
    .select({ path: projects.path })
    .from(projects)
    .where(eq(projects.id, projectId))
    .get()

  if (!project) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: `Project not found: ${projectId}`
    })
  }

  return project.path
}

/**
 * Chat session router procedures.
 *
 * - create: Create a new chat session
 * - list: List chat sessions for a project
 * - getMessages: Get messages for a chat session
 * - addMessage: Add a message to a chat session
 * - updateStatus: Update a chat session's status
 */
export const chatSessionRouter = router({
  /**
   * Create a new chat session.
   *
   * Generates a unique session UUID for Claude Code's --session-id flag.
   * Returns the created session record.
   *
   * @example
   * ```typescript
   * const session = await trpc.chatSession.create.mutate({
   *   agentPersona: 'bmad-pm',
   *   workflowPhase: 'prd',
   *   projectId: 'project-123'
   * })
   * ```
   */
  create: publicProcedure
    .input(
      z.object({
        agentPersona: z.string().min(1),
        workflowPhase: z.string().optional(),
        projectId: z.string().min(1),
        workflowKey: z.string().optional(),
        skipPermissions: z.boolean().default(true)
      })
    )
    .mutation(({ input }) => {
      const id = crypto.randomUUID()
      const sessionUuid = crypto.randomUUID()
      const now = new Date()

      db.insert(chat_sessions)
        .values({
          id,
          session_uuid: sessionUuid,
          agent_persona: input.agentPersona,
          workflow_phase: input.workflowPhase ?? null,
          project_id: input.projectId,
          workflow_key: input.workflowKey ?? null,
          skip_permissions: input.skipPermissions,
          status: 'active',
          created_at: now,
          updated_at: now
        })
        .run()

      return db.select().from(chat_sessions).where(eq(chat_sessions.id, id)).get()!
    }),

  /**
   * List chat sessions for a project.
   *
   * Returns sessions ordered by last_message_at desc (nulls last), then created_at desc.
   *
   * @example
   * ```typescript
   * const sessions = await trpc.chatSession.list.query({
   *   projectId: 'project-123'
   * })
   * ```
   */
  list: publicProcedure
    .input(
      z.object({
        projectId: z.string().min(1)
      })
    )
    .query(({ input }) => {
      return db
        .select()
        .from(chat_sessions)
        .where(eq(chat_sessions.project_id, input.projectId))
        .orderBy(
          desc(sql`COALESCE(${chat_sessions.last_message_at}, 0)`),
          desc(chat_sessions.created_at)
        )
        .all()
    }),

  /**
   * Get the most recent active/paused chat session bound to a specific workflow key.
   *
   * Used by the chat-centric planning workspace to resume the exact session
   * for a workflow step when the user clicks it in the sidebar.
   *
   * @example
   * ```typescript
   * const session = await trpc.chatSession.getByWorkflowKey.query({
   *   projectId: 'project-123',
   *   workflowKey: 'brainstorming'
   * })
   * ```
   */
  getByWorkflowKey: publicProcedure
    .input(
      z.object({
        projectId: z.string().min(1),
        workflowKey: z.string().min(1)
      })
    )
    .query(({ input }) => {
      return (
        db
          .select()
          .from(chat_sessions)
          .where(
            and(
              eq(chat_sessions.project_id, input.projectId),
              eq(chat_sessions.workflow_key, input.workflowKey),
              inArray(chat_sessions.status, ['active', 'paused'])
            )
          )
          .orderBy(desc(chat_sessions.updated_at))
          .limit(1)
          .get() ?? null
      )
    }),

  /**
   * Get messages for a chat session.
   *
   * Returns messages ordered by created_at ascending (oldest first).
   * Supports pagination via limit and offset.
   *
   * @example
   * ```typescript
   * const messages = await trpc.chatSession.getMessages.query({
   *   sessionId: 'session-123',
   *   limit: 50
   * })
   * ```
   */
  getMessages: publicProcedure
    .input(
      z.object({
        sessionId: z.string().min(1)
      })
    )
    .query(({ input }) => {
      return db
        .select()
        .from(chat_messages)
        .where(eq(chat_messages.session_id, input.sessionId))
        .orderBy(asc(chat_messages.created_at))
        .all()
    }),

  /**
   * Add a message to a chat session.
   *
   * Inserts a new message and updates the session's last_message_at timestamp.
   * Validates role against CHAT_MESSAGE_ROLE enum.
   *
   * @example
   * ```typescript
   * const message = await trpc.chatSession.addMessage.mutate({
   *   sessionId: 'session-123',
   *   role: 'user',
   *   content: 'Hello agent!'
   * })
   * ```
   *
   * @see Story 10.2: Chat Panel UI & Message Bubbles (AC: 6)
   */
  addMessage: publicProcedure
    .input(
      z.object({
        sessionId: z.string().min(1),
        role: z.enum(CHAT_MESSAGE_ROLE),
        content: z.string().min(1),
        toolName: z.string().optional(),
        toolInput: z.string().optional()
      })
    )
    .mutation(({ input }) => {
      const session = db
        .select()
        .from(chat_sessions)
        .where(eq(chat_sessions.id, input.sessionId))
        .get()

      if (!session) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Chat session not found: ${input.sessionId}`
        })
      }

      const id = crypto.randomUUID()
      const now = new Date()

      db.insert(chat_messages)
        .values({
          id,
          session_id: input.sessionId,
          role: input.role,
          content: input.content,
          tool_name: input.toolName ?? null,
          tool_input: input.toolInput ?? null,
          created_at: now
        })
        .run()

      // Update session's last_message_at
      db.update(chat_sessions)
        .set({ last_message_at: now })
        .where(eq(chat_sessions.id, input.sessionId))
        .run()

      return db.select().from(chat_messages).where(eq(chat_messages.id, id)).get()!
    }),

  /**
   * Update a chat session's status.
   *
   * Validates the new status against CHAT_SESSION_STATUS enum.
   * Updates both status and updated_at timestamp.
   *
   * @example
   * ```typescript
   * const updated = await trpc.chatSession.updateStatus.mutate({
   *   sessionId: 'session-123',
   *   status: 'completed'
   * })
   * ```
   */
  updateStatus: publicProcedure
    .input(
      z.object({
        sessionId: z.string().min(1),
        status: z.enum(CHAT_SESSION_STATUS)
      })
    )
    .mutation(({ input }) => {
      const session = db
        .select()
        .from(chat_sessions)
        .where(eq(chat_sessions.id, input.sessionId))
        .get()

      if (!session) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Chat session not found: ${input.sessionId}`
        })
      }

      // Story 10.6 AC: 6 — Kill CLI process when marking as paused or completed
      if (input.status === 'paused' || input.status === 'completed') {
        chatCliService.killSession(input.sessionId)
      }

      const now = new Date()

      db.update(chat_sessions)
        .set({
          status: input.status,
          updated_at: now
        })
        .where(eq(chat_sessions.id, input.sessionId))
        .run()

      return db.select().from(chat_sessions).where(eq(chat_sessions.id, input.sessionId)).get()!
    }),

  /**
   * Update the skip_permissions setting for a chat session.
   * Controls whether tool use is auto-approved or requires explicit user approval.
   */
  updateSkipPermissions: publicProcedure
    .input(
      z.object({
        sessionId: z.string().min(1),
        skipPermissions: z.boolean()
      })
    )
    .mutation(({ input }) => {
      const now = new Date()
      db.update(chat_sessions)
        .set({
          skip_permissions: input.skipPermissions,
          updated_at: now
        })
        .where(eq(chat_sessions.id, input.sessionId))
        .run()

      return db.select().from(chat_sessions).where(eq(chat_sessions.id, input.sessionId)).get()!
    }),

  /**
   * Resolve a pending permission request (approve or deny).
   * Unblocks the held PreToolUse hook HTTP response so Claude Code can proceed.
   */
  resolvePermission: publicProcedure
    .input(
      z.object({
        requestId: z.string().min(1),
        decision: z.enum(['allow', 'deny'])
      })
    )
    .mutation(({ input }) => {
      const { hookListenerService } = require('../../services') as typeof import('../../services')
      const resolved = hookListenerService.resolvePermission(input.requestId, input.decision)
      if (!resolved) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Permission request not found or already resolved: ${input.requestId}`
        })
      }
      return { resolved: true }
    }),

  /**
   * Delete a chat session and all its messages.
   *
   * Kills any running CLI process, then deletes the session from the database.
   * Messages are cascade-deleted by the ON DELETE CASCADE FK constraint.
   *
   * @example
   * ```typescript
   * const result = await trpc.chatSession.deleteSession.mutate({
   *   sessionId: 'session-123'
   * })
   * ```
   *
   * @see Story 10.6: Session Persistence & Resume (AC: 6)
   */
  deleteSession: publicProcedure
    .input(
      z.object({
        sessionId: z.string().min(1)
      })
    )
    .mutation(({ input }) => {
      const session = db
        .select()
        .from(chat_sessions)
        .where(eq(chat_sessions.id, input.sessionId))
        .get()

      if (!session) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Chat session not found: ${input.sessionId}`
        })
      }

      // Kill CLI session if running (safe if not running)
      chatCliService.killSession(input.sessionId)

      // Delete from chat_sessions — cascade deletes messages
      db.delete(chat_sessions).where(eq(chat_sessions.id, input.sessionId)).run()

      return { deleted: true }
    }),

  /**
   * Delete a single message from a chat session.
   */
  deleteMessage: publicProcedure
    .input(
      z.object({
        messageId: z.string().min(1),
        sessionId: z.string().min(1)
      })
    )
    .mutation(({ input }) => {
      const message = db
        .select()
        .from(chat_messages)
        .where(eq(chat_messages.id, input.messageId))
        .get()

      if (!message || message.session_id !== input.sessionId) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Message not found: ${input.messageId}`
        })
      }

      // Delete message (cascade deletes attachments via FK)
      db.delete(chat_messages).where(eq(chat_messages.id, input.messageId)).run()

      return { deleted: true }
    }),

  /**
   * Delete all messages in a chat session (clear chat history).
   */
  clearSessionMessages: publicProcedure
    .input(
      z.object({
        sessionId: z.string().min(1)
      })
    )
    .mutation(({ input }) => {
      const session = db
        .select()
        .from(chat_sessions)
        .where(eq(chat_sessions.id, input.sessionId))
        .get()

      if (!session) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Chat session not found: ${input.sessionId}`
        })
      }

      // Delete all messages for this session
      db.delete(chat_messages)
        .where(eq(chat_messages.session_id, input.sessionId))
        .run()

      // Reset last_message_at
      db.update(chat_sessions)
        .set({ last_message_at: null, updated_at: new Date() })
        .where(eq(chat_sessions.id, input.sessionId))
        .run()

      return { cleared: true }
    }),

  /**
   * Get the last non-tool message for a chat session.
   *
   * Returns the most recent user or assistant message for session list preview.
   *
   * @example
   * ```typescript
   * const message = await trpc.chatSession.getLastMessage.query({
   *   sessionId: 'session-123'
   * })
   * ```
   *
   * @see Story 10.6: Session Persistence & Resume (AC: 1)
   */
  getLastMessage: publicProcedure
    .input(
      z.object({
        sessionId: z.string().min(1)
      })
    )
    .query(({ input }) => {
      return (
        db
          .select()
          .from(chat_messages)
          .where(
            and(
              eq(chat_messages.session_id, input.sessionId),
              inArray(chat_messages.role, ['user', 'assistant'])
            )
          )
          .orderBy(desc(chat_messages.created_at))
          .limit(1)
          .get() ?? null
      )
    }),

  /**
   * List chat sessions with last message preview.
   *
   * Returns sessions ordered by most recently active, with each session
   * including a preview of the last non-tool message content.
   *
   * @example
   * ```typescript
   * const sessions = await trpc.chatSession.listWithPreview.query({
   *   projectId: 'project-123'
   * })
   * ```
   *
   * @see Story 10.6: Session Persistence & Resume (AC: 1)
   */
  listWithPreview: publicProcedure
    .input(
      z.object({
        projectId: z.string().min(1)
      })
    )
    .query(({ input }) => {
      const sessions = db
        .select()
        .from(chat_sessions)
        .where(eq(chat_sessions.project_id, input.projectId))
        .orderBy(
          desc(sql`COALESCE(${chat_sessions.last_message_at}, 0)`),
          desc(chat_sessions.created_at)
        )
        .all()

      // Post-fetch map: get last non-tool message for each session
      return sessions.map((session) => {
        const lastMessage = db
          .select({ content: chat_messages.content })
          .from(chat_messages)
          .where(
            and(
              eq(chat_messages.session_id, session.id),
              inArray(chat_messages.role, ['user', 'assistant'])
            )
          )
          .orderBy(desc(chat_messages.created_at))
          .limit(1)
          .get()

        return {
          ...session,
          lastMessagePreview: lastMessage?.content ?? null
        }
      })
    }),

  /**
   * Get tool activity messages for a chat session.
   *
   * Returns all tool-role messages (PreToolUse, PostToolUse, Notification)
   * ordered by created_at ascending.
   *
   * @example
   * ```typescript
   * const tools = await trpc.chatSession.getToolActivity.query({
   *   sessionId: 'session-123'
   * })
   * ```
   *
   * @see Story 10.5: Tool Activity & Working Indicators (AC: 1, 2, 3, 4)
   */
  getToolActivity: publicProcedure
    .input(
      z.object({
        sessionId: z.string().min(1)
      })
    )
    .query(({ input }) => {
      return db
        .select()
        .from(chat_messages)
        .where(and(eq(chat_messages.session_id, input.sessionId), eq(chat_messages.role, 'tool')))
        .orderBy(asc(chat_messages.created_at))
        .all()
    }),

  /**
   * Get the chat session that produced a specific planning artifact.
   *
   * Finds the most recent `__artifact_created__` message matching the given filename,
   * then returns the associated session details. Returns null if no match found.
   *
   * @example
   * ```typescript
   * const session = await trpc.chatSession.getSessionForArtifact.query({
   *   projectId: 'project-1',
   *   filename: 'prd.md'
   * })
   * ```
   *
   * @see Story 10.7: Artifact Detection & Planning Workspace Integration (AC: 2)
   */
  getSessionForArtifact: publicProcedure
    .input(
      z.object({
        projectId: z.string().min(1),
        filename: z.string().min(1)
      })
    )
    .query(({ input }) => {
      const result = db
        .select({
          sessionId: chat_sessions.id,
          sessionUuid: chat_sessions.session_uuid,
          agentPersona: chat_sessions.agent_persona,
          createdAt: chat_sessions.created_at
        })
        .from(chat_messages)
        .innerJoin(chat_sessions, eq(chat_messages.session_id, chat_sessions.id))
        .where(
          and(
            eq(chat_messages.tool_name, '__artifact_created__'),
            eq(chat_sessions.project_id, input.projectId),
            sql`JSON_EXTRACT(${chat_messages.tool_input}, '$.filename') = ${input.filename}`
          )
        )
        .orderBy(desc(chat_messages.created_at))
        .limit(1)
        .get()

      return result ?? null
    }),

  /**
   * Save an attachment file to disk from base64 data.
   *
   * Renderer reads a File as base64, sends it here. Main process writes to
   * `.tinsu/data/attachments/<session-id>/` and returns file metadata.
   */
  saveAttachment: publicProcedure
    .input(
      z.object({
        sessionId: z.string().min(1),
        fileName: z.string().min(1),
        mimeType: z.string().min(1),
        // ~50MB base64 limit (~37MB decoded file)
        base64Data: z.string().min(1).max(50 * 1024 * 1024)
      })
    )
    .mutation(({ input }) => {
      const session = db
        .select()
        .from(chat_sessions)
        .where(eq(chat_sessions.id, input.sessionId))
        .get()

      if (!session) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Chat session not found: ${input.sessionId}`
        })
      }

      const projectPath = getProjectPath(session.project_id)
      const targetDir = join(projectPath, '.tinsu', 'data', 'attachments', input.sessionId)
      mkdirSync(targetDir, { recursive: true })

      // F1 fix: Sanitize filename — strip path components and dangerous characters
      const sanitizedName = basename(input.fileName).replace(/[^a-zA-Z0-9._-]/g, '_')
      const ext = extname(sanitizedName)
      const nameWithoutExt = basename(sanitizedName, ext) || 'file'
      const uniqueSuffix = crypto.randomUUID().slice(0, 8)
      const uniqueFileName = `${nameWithoutExt}-${uniqueSuffix}${ext}`
      const targetPath = join(targetDir, uniqueFileName)

      const buffer = Buffer.from(input.base64Data, 'base64')
      writeFileSync(targetPath, buffer)

      return {
        filePath: targetPath,
        fileName: uniqueFileName,
        fileSize: buffer.length
      }
    }),

  /**
   * Copy files from external locations to attachment storage.
   *
   * Used by the file picker — files selected via dialog.showOpenDialog are at
   * arbitrary filesystem locations. We copy them to `.tinsu/data/attachments/<session-id>/`.
   */
  copyFilesToAttachments: publicProcedure
    .input(
      z.object({
        sessionId: z.string().min(1),
        filePaths: z.array(z.string().min(1))
      })
    )
    .mutation(({ input }) => {
      const session = db
        .select()
        .from(chat_sessions)
        .where(eq(chat_sessions.id, input.sessionId))
        .get()

      if (!session) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Chat session not found: ${input.sessionId}`
        })
      }

      const projectPath = getProjectPath(session.project_id)
      const targetDir = join(projectPath, '.tinsu', 'data', 'attachments', input.sessionId)
      mkdirSync(targetDir, { recursive: true })

      return input.filePaths.map((srcPath) => {
        // F2 fix: Validate source file exists and is a regular file
        try {
          const srcStat = statSync(srcPath)
          if (!srcStat.isFile()) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Not a regular file: ${srcPath}`
            })
          }
        } catch (err) {
          if (err instanceof TRPCError) throw err
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `File not accessible: ${srcPath}`
          })
        }

        const originalName = basename(srcPath)
        const ext = extname(originalName)
        const nameWithoutExt = basename(originalName, ext)
        const uniqueSuffix = crypto.randomUUID().slice(0, 8)
        const uniqueFileName = `${nameWithoutExt}-${uniqueSuffix}${ext}`
        const targetPath = join(targetDir, uniqueFileName)

        const fileData = readFileSync(srcPath)
        writeFileSync(targetPath, fileData)

        const mimeType = mimeFromExt(srcPath)
        const fileSize = fileData.length

        return {
          filePath: targetPath,
          fileName: uniqueFileName,
          mimeType,
          fileSize
        }
      })
    }),

  /**
   * Open native file picker for attaching files.
   *
   * Returns selected file paths (multi-select enabled).
   * Returns empty array if user cancels.
   */
  pickAttachmentFiles: publicProcedure.mutation(async () => {
    const window = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    if (!window) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'No application window available'
      })
    }
    const result = await dialog.showOpenDialog(window, {
      properties: ['openFile', 'multiSelections'],
      title: 'Attach files'
    })
    return result.canceled ? [] : result.filePaths
  }),

  /**
   * Get attachments for a batch of message IDs.
   *
   * Batching avoids N+1 queries when rendering a message list.
   */
  getMessageAttachments: publicProcedure
    .input(
      z.object({
        messageIds: z.array(z.string().min(1))
      })
    )
    .query(({ input }) => {
      if (input.messageIds.length === 0) return []
      return db
        .select()
        .from(chat_message_attachments)
        .where(inArray(chat_message_attachments.message_id, input.messageIds))
        .all()
    }),

  /**
   * Send a chat message to a Claude Code CLI session.
   *
   * Combines storing the user message in DB AND sending it to the CLI.
   * Handles three cases:
   * 1. No CLI session started yet: spawns a new claude process
   * 2. CLI session alive: sends message to existing process
   * 3. CLI session exited: resumes with --resume flag
   *
   * @see Story 10.3: Claude Code CLI Chat Session Spawning (AC: 1, 2, 5)
   */
  sendChatMessage: publicProcedure
    .input(
      z
        .object({
          sessionId: z.string().min(1),
          content: z.string().min(0),
          attachments: z
            .array(
              z.object({
                filePath: z.string(),
                fileName: z.string(),
                mimeType: z.string(),
                fileSize: z.number()
              })
            )
            .optional()
        })
        .refine((data) => data.content.trim().length > 0 || (data.attachments && data.attachments.length > 0), {
          message: 'Either content or at least one attachment is required'
        })
    )
    .mutation(({ input }) => {
      // 1. Look up session to get session_uuid and project_id
      const session = db
        .select()
        .from(chat_sessions)
        .where(eq(chat_sessions.id, input.sessionId))
        .get()

      if (!session) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Chat session not found: ${input.sessionId}`
        })
      }

      // 2. Store user message in chat_messages
      const messageId = crypto.randomUUID()
      const now = new Date()

      db.insert(chat_messages)
        .values({
          id: messageId,
          session_id: input.sessionId,
          role: 'user',
          content: input.content,
          created_at: now
        })
        .run()

      // 2b. Store attachments if provided
      if (input.attachments && input.attachments.length > 0) {
        for (const att of input.attachments) {
          db.insert(chat_message_attachments)
            .values({
              id: crypto.randomUUID(),
              message_id: messageId,
              file_name: att.fileName,
              file_path: att.filePath,
              mime_type: att.mimeType,
              file_size: att.fileSize,
              created_at: now
            })
            .run()
        }
      }

      // Update session's last_message_at
      db.update(chat_sessions)
        .set({ last_message_at: now })
        .where(eq(chat_sessions.id, input.sessionId))
        .run()

      // 3. Build CLI message — append file paths if attachments exist.
      // IMPORTANT: The message MUST be single-line (no \n). Newlines cause
      // Claude's TUI to enter paste/multi-line mode where \r is treated as
      // a literal newline rather than as Enter (submit). The message then
      // sits in the input buffer and is never submitted.
      let cliMessage = input.content
      if (input.attachments && input.attachments.length > 0) {
        const filePaths = input.attachments.map((a) => a.filePath).join(' ')
        const prefix = input.content.trim() ? `${input.content} ` : ''
        cliMessage = `${prefix}[Attached files: ${filePaths}]`
      }

      // 4. Send to CLI session — three cases:
      try {
        if (chatCliService.isSessionAlive(input.sessionId)) {
          // Case A: CLI session is alive — send to existing process (AC: 2)
          chatCliService.sendMessage(input.sessionId, cliMessage)
        } else if (chatCliService.hasSession(input.sessionId)) {
          // Case B: CLI session was started but has exited — resume with --resume (AC: 5)
          const projectPath = getProjectPath(session.project_id)
          chatCliService.resumeSession(
            input.sessionId,
            session.session_uuid,
            projectPath,
            cliMessage
          )
        } else {
          // Case C: No in-memory CLI session tracked.
          // Check if the session had prior messages (e.g., after app restart the
          // in-memory map is empty but Claude CLI already knows this session UUID).
          // If so, resume instead of spawning fresh to avoid "Session ID already in use".
          const hadPriorMessages = session.last_message_at !== null
          const projectPath = getProjectPath(session.project_id)

          if (hadPriorMessages) {
            // Session was used before (app restart wiped in-memory map) — resume
            chatCliService.resumeSession(
              input.sessionId,
              session.session_uuid,
              projectPath,
              cliMessage
            )
          } else {
            // Truly new session — spawn fresh with persona context
            let personaContext: string | undefined
            try {
              const bmadRoot = join(projectPath, '_bmad')
              const personaContextService = new PersonaContextService(bmadRoot, projectPath)
              personaContext = personaContextService.buildContext(session.agent_persona)
            } catch (personaErr) {
              const msg = personaErr instanceof Error ? personaErr.message : String(personaErr)
              console.warn(
                `[ChatSessionRouter] Warning: Failed to load persona context for ${session.agent_persona}: ${msg}`
              )
            }
            chatCliService.spawnSession(
              input.sessionId,
              session.session_uuid,
              projectPath,
              cliMessage,
              personaContext
            )
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        if (message.includes('not found')) {
          throw new TRPCError({ code: 'NOT_FOUND', message })
        }
        if (message.includes('has exited')) {
          throw new TRPCError({ code: 'PRECONDITION_FAILED', message })
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `CLI session error: ${message}`
        })
      }

      // 5. Return the created user message
      return db.select().from(chat_messages).where(eq(chat_messages.id, messageId)).get()!
    })
})

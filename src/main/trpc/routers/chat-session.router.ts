/**
 * Chat Session Router - Story 10.1, 10.3
 *
 * tRPC router for chat session CRUD operations and CLI session management.
 * Provides procedures for creating, listing, messaging, updating chat sessions,
 * and sending messages to Claude Code CLI sessions.
 *
 * @see Story 10.1: Chat Session Schema & Hook Endpoint (AC: 5)
 * @see Story 10.3: Claude Code CLI Chat Session Spawning (AC: 1, 2, 5)
 */

import { z } from 'zod'
import crypto from 'crypto'
import { join } from 'path'
import { eq, desc, asc, sql } from 'drizzle-orm'
import { router, publicProcedure, TRPCError } from '../trpc'
import { db } from '../../db'
import { chat_sessions, chat_messages, projects, CHAT_SESSION_STATUS, CHAT_MESSAGE_ROLE } from '../../db/schema'
import { chatCliService } from '../../services'
import { PersonaContextService } from '../../services/persona-context.service'

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
        projectId: z.string().min(1)
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
        sessionId: z.string().min(1),
        limit: z.number().int().min(1).max(1000).default(100),
        offset: z.number().int().min(0).default(0)
      })
    )
    .query(({ input }) => {
      return db
        .select()
        .from(chat_messages)
        .where(eq(chat_messages.session_id, input.sessionId))
        .orderBy(asc(chat_messages.created_at))
        .limit(input.limit)
        .offset(input.offset)
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
   * Send a chat message to a Claude Code CLI session.
   *
   * Combines storing the user message in DB AND sending it to the CLI.
   * Handles three cases:
   * 1. No CLI session started yet: spawns a new claude process
   * 2. CLI session alive: sends message to existing process
   * 3. CLI session exited: resumes with --resume flag
   *
   * @example
   * ```typescript
   * const message = await trpc.chatSession.sendChatMessage.mutate({
   *   sessionId: 'session-123',
   *   content: 'Tell me about the architecture'
   * })
   * ```
   *
   * @see Story 10.3: Claude Code CLI Chat Session Spawning (AC: 1, 2, 5)
   */
  sendChatMessage: publicProcedure
    .input(
      z.object({
        sessionId: z.string().min(1),
        content: z.string().min(1)
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

      // Update session's last_message_at
      db.update(chat_sessions)
        .set({ last_message_at: now })
        .where(eq(chat_sessions.id, input.sessionId))
        .run()

      // 3. Send to CLI session — three cases:
      try {
        if (chatCliService.isSessionAlive(input.sessionId)) {
          // Case A: CLI session is alive — send to existing process (AC: 2)
          chatCliService.sendMessage(input.sessionId, input.content)
        } else if (chatCliService.hasSession(input.sessionId)) {
          // Case B: CLI session was started but has exited — resume with --resume (AC: 5)
          // Do NOT inject persona context on resume — Claude Code's --resume
          // restores the full conversation history including the original persona injection.
          const projectPath = getProjectPath(session.project_id)
          chatCliService.resumeSession(
            input.sessionId,
            session.session_uuid,
            projectPath,
            input.content
          )
        } else {
          // Case C: No CLI session ever started — spawn fresh (AC: 1)
          // Build persona context from BMAD agent files (Story 10.4 AC: 1-5)
          const projectPath = getProjectPath(session.project_id)
          let personaContext: string | undefined
          try {
            const bmadRoot = join(projectPath, '_bmad')
            const personaContextService = new PersonaContextService(bmadRoot, projectPath)
            personaContext = personaContextService.buildContext(session.agent_persona)
          } catch (personaErr) {
            // Graceful degradation: if persona loading fails, still send the message
            const msg = personaErr instanceof Error ? personaErr.message : String(personaErr)
            console.warn(
              `[ChatSessionRouter] Warning: Failed to load persona context for ${session.agent_persona}: ${msg}`
            )
          }
          chatCliService.spawnSession(
            input.sessionId,
            session.session_uuid,
            projectPath,
            input.content,
            personaContext
          )
        }
      } catch (err) {
        // Remap CLI service errors to appropriate tRPC error codes
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

      // 4. Return the created user message
      return db.select().from(chat_messages).where(eq(chat_messages.id, messageId)).get()!
    })
})

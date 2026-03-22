/**
 * Chat Session Router - Story 10.1
 *
 * tRPC router for chat session CRUD operations.
 * Provides procedures for creating, listing, messaging, and updating chat sessions.
 *
 * @see Story 10.1: Chat Session Schema & Hook Endpoint (AC: 5)
 */

import { z } from 'zod'
import crypto from 'crypto'
import { eq, desc, asc, sql } from 'drizzle-orm'
import { router, publicProcedure, TRPCError } from '../trpc'
import { db } from '../../db'
import { chat_sessions, chat_messages, CHAT_SESSION_STATUS } from '../../db/schema'

/**
 * Chat session router procedures.
 *
 * - create: Create a new chat session
 * - list: List chat sessions for a project
 * - getMessages: Get messages for a chat session
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
    })
})

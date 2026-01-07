import { z } from 'zod'
import { router, publicProcedure } from '../trpc'
import { tasks } from '../../db/schema'
import { and, eq, gte } from 'drizzle-orm'
import {
  startOfISOWeek,
  endOfISOWeek,
  getISOWeek,
  getISOWeekYear,
  subWeeks,
  subDays,
  startOfDay,
  format
} from 'date-fns'

interface WeekData {
  week: string // e.g., "2026-02"
  count: number
  startDate: Date
  endDate: Date
}

interface DayData {
  date: Date
  count: number
}

export const velocityRouter = router({
  // Get weekly velocity for the last N weeks
  // Story 3.1.5: Filter by current project
  getWeeklyVelocity: publicProcedure
    .input(z.object({ weeks: z.number().default(4) }))
    .query(({ ctx, input }) => {
      // AC12: Return empty data if no project open
      if (!ctx.projectId) {
        return { weeks: [], totalCompleted: 0, avgVelocity: 0 }
      }

      const now = new Date()
      const weeksToFetch = input.weeks

      // Calculate the start of the range (beginning of the oldest week we want)
      const oldestWeekStart = startOfISOWeek(subWeeks(now, weeksToFetch - 1))

      // Query all tasks completed since the oldest week start (scoped to project)
      const completedTasks = ctx.db
        .select()
        .from(tasks)
        .where(
          and(
            eq(tasks.status, 'done'),
            gte(tasks.updated_at, oldestWeekStart),
            eq(tasks.project_id, ctx.projectId)
          )
        )
        .all()

      // Group tasks by ISO week
      const tasksByWeek = new Map<string, number>()
      for (const task of completedTasks) {
        const taskDate = task.updated_at
        const weekStart = startOfISOWeek(taskDate)
        const weekKey = `${getISOWeekYear(weekStart)}-${String(getISOWeek(weekStart)).padStart(2, '0')}`

        tasksByWeek.set(weekKey, (tasksByWeek.get(weekKey) || 0) + 1)
      }

      // Build the weeks array (most recent first)
      const weeks: WeekData[] = []
      for (let i = 0; i < weeksToFetch; i++) {
        const weekStart = startOfISOWeek(subWeeks(now, i))
        const weekEnd = endOfISOWeek(weekStart)
        const weekKey = `${getISOWeekYear(weekStart)}-${String(getISOWeek(weekStart)).padStart(2, '0')}`

        weeks.push({
          week: weekKey,
          count: tasksByWeek.get(weekKey) || 0,
          startDate: weekStart,
          endDate: weekEnd
        })
      }

      // Calculate totals
      const totalCompleted = completedTasks.length
      const avgVelocity = weeksToFetch > 0 ? Math.round(totalCompleted / weeksToFetch) : 0

      return {
        weeks,
        totalCompleted,
        avgVelocity
      }
    }),

  // Get daily velocity for the last N days
  // Story 3.1.5: Filter by current project
  getDailyVelocity: publicProcedure
    .input(z.object({ days: z.number().default(28) }))
    .query(({ ctx, input }) => {
      // AC12: Return empty data if no project open
      if (!ctx.projectId) {
        return { days: [], totalCompleted: 0 }
      }

      const now = new Date()
      const daysToFetch = input.days

      // Calculate the start of the range (beginning of the oldest day we want)
      const today = startOfDay(now)
      const oldestDayStart = subDays(today, daysToFetch - 1)

      // Query all tasks completed since the oldest day start (scoped to project)
      const completedTasks = ctx.db
        .select()
        .from(tasks)
        .where(
          and(
            eq(tasks.status, 'done'),
            gte(tasks.updated_at, oldestDayStart),
            eq(tasks.project_id, ctx.projectId)
          )
        )
        .all()

      // Group tasks by day
      const tasksByDay = new Map<string, number>()
      for (const task of completedTasks) {
        const taskDate = task.updated_at
        const dayKey = format(startOfDay(taskDate), 'yyyy-MM-dd')

        tasksByDay.set(dayKey, (tasksByDay.get(dayKey) || 0) + 1)
      }

      // Build the days array (most recent first)
      const days: DayData[] = []
      for (let i = 0; i < daysToFetch; i++) {
        const day = subDays(today, i)
        const dayKey = format(day, 'yyyy-MM-dd')

        days.push({
          date: day,
          count: tasksByDay.get(dayKey) || 0
        })
      }

      // Calculate totals
      const totalCompleted = completedTasks.length

      return {
        days,
        totalCompleted
      }
    })
})

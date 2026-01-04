import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// Initial minimal table for testing - full schema in Story 1.4
export const settings = sqliteTable('settings', {
  id: text('id').primaryKey(),
  key: text('key').notNull().unique(),
  value: text('value'),
  created_at: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

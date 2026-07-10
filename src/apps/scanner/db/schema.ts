import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const trackedRepos = pgTable('tracked_repos', {
  id: uuid('id').primaryKey(),
  repo: text('repo').notNull().unique(),
  last_seen_tag: text('last_seen_tag').notNull(),
  checkedAt: timestamp('checked_at').defaultNow().notNull(),
});

import { boolean, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const repos = pgTable('repos', {
  id: uuid('id').primaryKey().defaultRandom(),
  repo: text('repo').notNull().unique(),
  last_seen_tag: text('last_seen_tag').notNull(),
  checkedAt: timestamp('checked_at').defaultNow().notNull(),
});

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  repoId: uuid('repo_id')
    .notNull()
    .references(() => repos.id, { onDelete: 'cascade' }),
  token: uuid('token').notNull().defaultRandom(),
  confirmed: boolean('confirmed').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

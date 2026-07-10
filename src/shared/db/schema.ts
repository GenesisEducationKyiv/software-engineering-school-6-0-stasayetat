import { boolean, jsonb, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

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

export const sagaTypeEnum = pgEnum('saga_type', ['SUBSCRIBE', 'UNSUBSCRIBE']);
export const sagaStatusEnum = pgEnum('saga_status', ['STARTED', 'COMPLETED', 'COMPENSATING', 'COMPENSATED', 'FAILED']);

export const sagas = pgTable('sagas', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: sagaTypeEnum('type').notNull(),
  status: sagaStatusEnum('status').notNull().default('STARTED'),
  payload: jsonb('payload').notNull(),
  stepsDone: jsonb('steps_done').notNull().default([]),
  error: text('error'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

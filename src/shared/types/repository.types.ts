import { repos } from '@shared/db';
import { InferSelectModel } from 'drizzle-orm';

export type Repository = InferSelectModel<typeof repos>;

import { sagas } from '@shared/db';
import { InferSelectModel } from 'drizzle-orm';

export type Saga = InferSelectModel<typeof sagas>;
export type SagaType = Saga['type'];
export type SagaStatus = Saga['status'];

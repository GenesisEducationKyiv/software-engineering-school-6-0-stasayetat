import { db, sagas } from '@shared/db';
import { Saga, SagaType } from '@shared/types';
import { eq, sql } from 'drizzle-orm';
import { injectable } from 'tsyringe';

import { ISagaRepository } from './saga.repository.interface';

@injectable()
export class SagaRepository implements ISagaRepository {
  async create(type: SagaType, payload: object): Promise<Saga> {
    const [saga] = await db.insert(sagas).values({ type, payload, status: 'STARTED', stepsDone: [] }).returning();

    return saga;
  }

  async markStepDone(sagaId: string, stepName: string): Promise<void> {
    await db
      .update(sagas)
      .set({ stepsDone: sql`${sagas.stepsDone} || ${JSON.stringify([stepName])}::jsonb`, updatedAt: new Date() })
      .where(eq(sagas.id, sagaId));
  }

  async markCompleted(sagaId: string): Promise<void> {
    await db.update(sagas).set({ status: 'COMPLETED', updatedAt: new Date() }).where(eq(sagas.id, sagaId));
  }

  async markCompensating(sagaId: string, error: string): Promise<void> {
    await db.update(sagas).set({ status: 'COMPENSATING', error, updatedAt: new Date() }).where(eq(sagas.id, sagaId));
  }

  async markCompensated(sagaId: string): Promise<void> {
    await db.update(sagas).set({ status: 'COMPENSATED', updatedAt: new Date() }).where(eq(sagas.id, sagaId));
  }

  async markFailed(sagaId: string, error: string): Promise<void> {
    await db.update(sagas).set({ status: 'FAILED', error, updatedAt: new Date() }).where(eq(sagas.id, sagaId));
  }
}

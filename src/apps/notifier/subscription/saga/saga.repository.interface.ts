import { Saga, SagaType } from '@shared/types';

export const SAGA_REPOSITORY = Symbol.for('SagaRepository');

export interface ISagaRepository {
  create(type: SagaType, payload: object): Promise<Saga>;
  markStepDone(sagaId: string, stepName: string): Promise<void>;
  markCompleted(sagaId: string): Promise<void>;
  markCompensating(sagaId: string, error: string): Promise<void>;
  markCompensated(sagaId: string): Promise<void>;
  markFailed(sagaId: string, error: string): Promise<void>;
}

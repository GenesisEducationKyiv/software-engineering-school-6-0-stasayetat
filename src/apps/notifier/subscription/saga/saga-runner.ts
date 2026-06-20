import { Saga, SagaType } from '@shared/types';
import { getErrorMessage } from '@shared/utils';
import { inject, injectable } from 'tsyringe';

import { ISagaRepository, SAGA_REPOSITORY } from './saga.repository.interface';

export type SagaStep<Ctx> = {
  name: string;
  run: (ctx: Ctx) => Promise<void>;
  undo: (ctx: Ctx) => Promise<void>;
};

@injectable()
export class SagaRunner {
  constructor(@inject(SAGA_REPOSITORY) private readonly sagaRepository: ISagaRepository) {}

  async run<Ctx>(type: SagaType, payload: object, steps: SagaStep<Ctx>[], ctx: Ctx): Promise<void> {
    const saga = await this.sagaRepository.create(type, payload);
    const done: SagaStep<Ctx>[] = [];

    try {
      for (const step of steps) {
        await step.run(ctx);
        await this.sagaRepository.markStepDone(saga.id, step.name);
        done.push(step);
      }

      await this.sagaRepository.markCompleted(saga.id);
    } catch (error) {
      await this.handleStepError(error, saga, done, ctx);
    }
  }

  private async handleStepError<Ctx>(error: unknown, saga: Saga, done: SagaStep<Ctx>[], ctx: Ctx) {
    const message = getErrorMessage(error);
    await this.sagaRepository.markCompensating(saga.id, message);

    try {
      for (const step of done.reverse()) {
        await step.undo(ctx);
      }

      await this.sagaRepository.markCompensated(saga.id);
    } catch (error) {
      await this.sagaRepository.markFailed(saga.id, getErrorMessage(error));
    }

    throw error;
  }
}

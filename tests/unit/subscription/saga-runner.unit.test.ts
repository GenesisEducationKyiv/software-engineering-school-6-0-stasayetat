import { ISagaRepository } from '@notifier/subscription/saga/saga.repository.interface';
import { SagaRunner, SagaStep } from '@notifier/subscription/saga/saga-runner';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('SagaRunner', () => {
  let sagaRepository: ISagaRepository;
  let runner: SagaRunner;

  beforeEach(() => {
    sagaRepository = {
      create: vi.fn().mockResolvedValue({ id: 'saga-1' }),
      markStepDone: vi.fn().mockResolvedValue(undefined),
      markCompleted: vi.fn().mockResolvedValue(undefined),
      markCompensating: vi.fn().mockResolvedValue(undefined),
      markCompensated: vi.fn().mockResolvedValue(undefined),
      markFailed: vi.fn().mockResolvedValue(undefined),
    };

    runner = new SagaRunner(sagaRepository);
  });

  it('runs all steps and marks the saga completed on success', async () => {
    const ctx = { value: 0 };

    const incrementBy = (amount: number) => (c: typeof ctx) => {
      c.value += amount;

      return Promise.resolve();
    };

    const steps: SagaStep<typeof ctx>[] = [
      { name: 'step1', run: incrementBy(1), undo: vi.fn() },
      { name: 'step2', run: incrementBy(10), undo: vi.fn() },
    ];

    await runner.run('SUBSCRIBE', { foo: 'bar' }, steps, ctx);

    expect(ctx.value).toBe(11);
    expect(sagaRepository.markStepDone).toHaveBeenNthCalledWith(1, 'saga-1', 'step1');
    expect(sagaRepository.markStepDone).toHaveBeenNthCalledWith(2, 'saga-1', 'step2');
    expect(sagaRepository.markCompleted).toHaveBeenCalledWith('saga-1');
  });

  it('compensates completed steps in reverse order when a later step fails', async () => {
    const calls: string[] = [];

    const record = (label: string) => () => {
      calls.push(label);

      return Promise.resolve();
    };

    const steps: SagaStep<object>[] = [
      { name: 'step1', run: record('run1'), undo: record('undo1') },
      { name: 'step2', run: () => Promise.reject(new Error('boom')), undo: vi.fn() },
    ];

    await expect(runner.run('SUBSCRIBE', {}, steps, {})).rejects.toThrow('boom');

    expect(calls).toEqual(['run1', 'undo1']);
    expect(sagaRepository.markCompensating).toHaveBeenCalledWith('saga-1', 'boom');
    expect(sagaRepository.markCompensated).toHaveBeenCalledWith('saga-1');
    expect(sagaRepository.markCompleted).not.toHaveBeenCalled();
  });

  it('marks the saga FAILED if a compensation step itself throws', async () => {
    const steps: SagaStep<object>[] = [
      { name: 'step1', run: () => Promise.resolve(), undo: () => Promise.reject(new Error('undo failed')) },
      { name: 'step2', run: () => Promise.reject(new Error('boom')), undo: vi.fn() },
    ];

    await expect(runner.run('SUBSCRIBE', {}, steps, {})).rejects.toThrow('boom');

    expect(sagaRepository.markFailed).toHaveBeenCalledWith('saga-1', 'undo failed');
    expect(sagaRepository.markCompensated).not.toHaveBeenCalled();
  });
});

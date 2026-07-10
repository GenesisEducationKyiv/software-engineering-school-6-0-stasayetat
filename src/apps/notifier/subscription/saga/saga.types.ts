export type SagaStep<Ctx> = {
  name: string;
  run: (ctx: Ctx) => Promise<void>;
  undo: (ctx: Ctx) => Promise<void>;
};

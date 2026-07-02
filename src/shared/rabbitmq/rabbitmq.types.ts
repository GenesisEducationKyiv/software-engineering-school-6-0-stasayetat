import zod from 'zod';

export type RabbitMqRequest = {
  queue: string;
  exchange: string;
  routingKey: string;
  handler: (payload: unknown) => Promise<void>;
};

export const NewReleaseDetectedEventSchema = zod.object({
  repoId: zod.string(),
  tag: zod.string(),
});

export type RabbitMqRequest = {
  queue: string;
  exchange: string;
  routingKey: string;
  handler: (payload: unknown) => Promise<void>;
};

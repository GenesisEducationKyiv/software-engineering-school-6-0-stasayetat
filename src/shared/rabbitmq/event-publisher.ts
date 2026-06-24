import { inject, injectable } from 'tsyringe';

import { RABBITMQ_CLIENT, RabbitMQClient } from './rabbitmq.client';

@injectable()
export class EventPublisher {
  constructor(@inject(RABBITMQ_CLIENT) private readonly client: RabbitMQClient) {}

  async publish(exchange: string, routingKey: string, payload: unknown): Promise<void> {
    const channel = this.client.getChannel();
    await channel.assertExchange(exchange, 'direct', { durable: true });

    channel.publish(exchange, routingKey, Buffer.from(JSON.stringify(payload)));
  }
}

import { logger } from '@shared/logger';
import { RabbitMqRequest } from '@shared/rabbitmq/rabbitmq.types';
import { inject, injectable } from 'tsyringe';

import { RABBITMQ_CLIENT, RabbitMQClient } from './rabbitmq.client';

@injectable()
export class EventConsumer {
  constructor(@inject(RABBITMQ_CLIENT) private readonly client: RabbitMQClient) {}

  async consume({ exchange, queue, routingKey, handler }: RabbitMqRequest) {
    const channel = this.client.getChannel();
    await channel.assertExchange(exchange, 'direct', { durable: true });
    await channel.assertQueue(queue, { durable: true });
    await channel.bindQueue(queue, exchange, routingKey);

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    await channel.consume(queue, async msg => {
      if (!msg) return;

      try {
        const payload = JSON.parse(msg.content.toString()) as unknown;

        await handler(payload);
        channel.ack(msg);
      } catch (error) {
        logger.error(`Consumer error on queue ${queue}: ${String(error)}`);
        channel.reject(msg, false);
      }
    });
  }
}

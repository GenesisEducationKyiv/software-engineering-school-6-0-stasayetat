import { DependencyContainer } from 'tsyringe';

import { EventConsumer } from './event-consumer';
import { EventPublisher } from './event-publisher';
import { RABBITMQ_CLIENT, RabbitMQClient } from './rabbitmq.client';

export { RABBITMQ_CLIENT };
export const EVENT_PUBLISHER = 'EVENT_PUBLISHER';
export const EVENT_CONSUMER = 'EVENT_CONSUMER';

export function registerRabbitMQModule(container: DependencyContainer): void {
  container.registerSingleton(RABBITMQ_CLIENT, RabbitMQClient);
  container.registerSingleton(EVENT_PUBLISHER, EventPublisher);
  container.registerSingleton(EVENT_CONSUMER, EventConsumer);
}

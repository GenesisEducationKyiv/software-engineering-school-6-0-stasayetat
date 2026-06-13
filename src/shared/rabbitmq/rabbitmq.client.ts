import { env } from '@shared/env';
import amqp, { Channel, ChannelModel } from 'amqplib';
import { injectable } from 'tsyringe';

export const RABBITMQ_CLIENT = 'RABBITMQ_CLIENT';

@injectable()
export class RabbitMQClient {
  private connection!: ChannelModel;
  private channel!: Channel;

  async connect(): Promise<void> {
    this.connection = await amqp.connect(env.RABBITMQ_URL);
    this.channel = await this.connection.createChannel();
  }

  getChannel(): Channel {
    return this.channel;
  }
}

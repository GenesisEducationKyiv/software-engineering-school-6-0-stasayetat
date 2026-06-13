import { ReleaseNotificationService } from '@notifier/subscription/service/release-notification.service';
import { EventConsumer } from '@shared/rabbitmq/event-consumer';
import { EVENT_CONSUMER } from '@shared/rabbitmq/rabbitmq.module';
import { inject, injectable } from 'tsyringe';

@injectable()
export class ReleaseNotificationConsumer {
  constructor(
    @inject(EVENT_CONSUMER) private readonly consumer: EventConsumer,
    private readonly releaseNotificationService: ReleaseNotificationService,
  ) {}

  async start(): Promise<void> {
    await this.consumer.consume({
      queue: 'release_notifications',
      exchange: 'releases',
      routingKey: 'new_release_detected',
      handler: async payload => {
        const { repoId, tag } = payload as { repoId: string; tag: string };

        await this.releaseNotificationService.notifyNewRelease(repoId, tag);
      },
    });
  }
}

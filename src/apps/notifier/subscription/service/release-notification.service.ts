import { IRepoRepository, REPO_REPOSITORY } from '@notifier/subscription/repository/repo.repository.interface';
import {
  ISubscriptionRepository,
  SUBSCRIPTION_REPOSITORY,
} from '@notifier/subscription/repository/subscription.repository.interface';
import { NOTIFICATION_SERVICE, NotificationService } from '@shared/notification/notification-service.interface';
import { inject, injectable } from 'tsyringe';

@injectable()
export class ReleaseNotificationService {
  constructor(
    @inject(REPO_REPOSITORY) private readonly repoRepository: IRepoRepository,
    @inject(SUBSCRIPTION_REPOSITORY) private readonly subscriptionRepository: ISubscriptionRepository,
    @inject(NOTIFICATION_SERVICE) private readonly notificationService: NotificationService,
  ) {}

  async notifyNewRelease(repoId: string, tag: string): Promise<boolean> {
    const repo = await this.repoRepository.getRepoById(repoId);

    if (!repo) {
      return false;
    }

    const subscribers = await this.subscriptionRepository.getSubscriptionsByRepoIds([repoId]);

    await Promise.allSettled(
      subscribers.map(({ email, token }) => this.notificationService.sendReleaseNotification(email, repo, tag, token)),
    );

    await this.repoRepository.updateLastSeenTag(repoId, tag);

    return true;
  }
}

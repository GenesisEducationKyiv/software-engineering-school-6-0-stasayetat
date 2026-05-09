import { RepoTagFetcher } from '@modules/scanner/service/repo-tag.fetcher';
import { NotificationEmailService } from '@shared/email';
import { logger } from '@shared/logger';
import { scannerRunDuration } from '@shared/metrics';
import { E, Subscription } from '@shared/types';
import { Repository } from '@shared/types/repository.types';
import { getErrorMessage } from '@shared/utils';
import { injectable } from 'tsyringe';

import { RepoRepository } from '../../subscription/repository/repo.repository';
import { SubscriptionRepository } from '../../subscription/repository/subscription.repository';
import { RepoNotifyInfo, RepoScanError, RepoScanSuccess } from '../scanner.types';
import { hasNewRelease } from '../scanner.utils';

@injectable()
export class ScannerService {
  constructor(
    private readonly repoRepository: RepoRepository,
    private readonly repoTagFetcher: RepoTagFetcher,
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly notifierService: NotificationEmailService,
  ) {}

  async run(): Promise<void> {
    const end = scannerRunDuration.startTimer();

    try {
      logger.info('Start scanning...');
      const allRepos = await this.repoRepository.getAllRepos();

      if (!allRepos.length) {
        logger.info(`There is no repos. Finishing job...`);

        return;
      }

      const successful = await this.scanAllRepos(allRepos);

      logger.info(`Scanned ${successful.length} repos`);

      const repoToNotify = successful.filter(hasNewRelease);

      if (!repoToNotify.length) {
        logger.info('No repos to notify. Finishing job...');

        return;
      }

      logger.info(`Repos ready to notify: ${repoToNotify.length}`);

      const repoIds = repoToNotify.map(repo => repo.currentRepo.id);

      const subscriptions = await this.subscriptionRepository.getSubscriptionsByRepoIds(repoIds);

      if (!subscriptions.length) {
        logger.info(`There is no subscriptions. Finishing job...`);

        return;
      }

      logger.info(`Subscribers ready to notify: ${repoToNotify.length}`);

      const notifyInfos = this.buildNotifyInfos(repoToNotify, subscriptions);

      await Promise.all(notifyInfos.map(info => this.notifySubscribers(info)));

      logger.info(`Scanning successfully end`);
    } catch (error) {
      const message = getErrorMessage(error);

      logger.error(`Something went wrong while scanning repos: ${message}`);
    } finally {
      end();
    }
  }

  private async notifySubscribers({ subscribers, newTag, repo }: RepoNotifyInfo) {
    await Promise.all(
      subscribers.map(subscriber =>
        this.notifierService.sendReleaseNotification(subscriber.email, repo, newTag, subscriber.token),
      ),
    );

    await this.repoRepository.updateLastSeenTag(repo.id, newTag);
  }

  private buildNotifyInfos(repoToNotify: RepoScanSuccess[], subscriptions: Subscription[]): RepoNotifyInfo[] {
    const subscriptionsByRepoId = new Map<string, Subscription[]>();

    for (const subscription of subscriptions) {
      const existingSubscription = subscriptionsByRepoId.get(subscription.repoId) ?? [];
      existingSubscription.push(subscription);
      subscriptionsByRepoId.set(subscription.repoId, existingSubscription);
    }

    return repoToNotify.map(({ currentRepo, latestTag }) => ({
      newTag: latestTag,
      repo: currentRepo,
      subscribers: subscriptionsByRepoId.get(currentRepo.id) ?? [],
    }));
  }

  private async scanAllRepos(allRepos: Repository[]) {
    const resultEithers = await Promise.all(
      allRepos.map(repo => {
        return this.repoTagFetcher.getTags(repo);
      }),
    );

    const { successful, failed } = resultEithers.reduce<{
      successful: RepoScanSuccess[];
      failed: RepoScanError[];
    }>(
      (acc, result) => {
        if (E.isRight(result)) {
          acc.successful.push(result.value);
        } else {
          acc.failed.push(result.value);
        }

        return acc;
      },
      { successful: [], failed: [] },
    );

    for (const { currentRepo, error } of failed) {
      logger.warn(`Failed to fetch repo ${currentRepo.repo}: ${error.message}`);
    }

    return successful;
  }
}

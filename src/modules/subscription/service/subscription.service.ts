import { GithubApiClient } from '@shared/apis';
import { NotificationEmailService } from '@shared/email';
import { logger } from '@shared/logger';
import { activeSubscriptionCount, subscriptionsTotal, totalReposCount } from '@shared/metrics';
import { ApiResponse, E, GetSubscriptionsResponse, MinifiedSubscription, Subscription } from '@shared/types';
import { Repository } from '@shared/types/repository.types';

import { RepoRepository } from '../repository/repo.repository';
import { SubscriptionRepository } from '../repository/subscription.repository';

export class SubscriptionService {
  constructor(
    private readonly subscriptionRepository = new SubscriptionRepository(),
    private readonly repoRepository = new RepoRepository(),
    private readonly notificationEmailService = new NotificationEmailService(),
  ) {}

  async subscribe(email: string, repo: string): Promise<ApiResponse> {
    const foundRepo = await this.repoRepository.findByRepo(repo);

    if (foundRepo) {
      return await this.subscribeToExistingRepo(email, foundRepo);
    }

    return await this.subscribeToNewRepo(email, repo);
  }

  async confirmSubscribe(token: string): Promise<ApiResponse> {
    const foundSubscriptionEither = await this.findSubscriptionByTokenOrFail(token);

    if (E.isLeft(foundSubscriptionEither)) {
      subscriptionsTotal.inc({ status: 'token_not_found' });

      return foundSubscriptionEither.value;
    }

    await this.subscriptionRepository.confirmSubscription(foundSubscriptionEither.value);

    activeSubscriptionCount.inc();

    logger.info(`Subscription confirmed successfully for ${token}`);

    return { status: 200, message: 'Subscription confirmed successfully' };
  }

  async confirmUnsubscribe(token: string): Promise<ApiResponse> {
    const foundSubscriptionEither = await this.findSubscriptionByTokenOrFail(token, true);

    if (E.isLeft(foundSubscriptionEither)) {
      subscriptionsTotal.inc({ status: 'token_not_found' });

      return foundSubscriptionEither.value;
    }

    await this.subscriptionRepository.removeSubscription(foundSubscriptionEither.value);
    activeSubscriptionCount.dec();

    await this.removeRepoIfEmpty(foundSubscriptionEither);

    logger.info(`Subscription removed successfully for ${token}`);

    subscriptionsTotal.inc({ status: 'unsubscribed' });

    return { status: 200, message: 'Subscription removed successfully' };
  }

  async getAllSubscriptionsByEmail(email: string): Promise<GetSubscriptionsResponse> {
    const foundSubscriptions = await this.subscriptionRepository.getAllActiveSubscriptionByEmail(email);

    const mappedValue = foundSubscriptions.map<MinifiedSubscription>(({ repos, subscriptions }) => ({
      email: subscriptions.email,
      repo: repos.repo,
      confirmed: true,
      last_seen_tag: repos.last_seen_tag,
    }));

    logger.info(`Active subscription for ${email} - ${mappedValue.length}`);

    return { status: 200, data: mappedValue };
  }

  private async findSubscriptionByTokenOrFail(
    token: string,
    isConfirmed: boolean = false,
  ): Promise<E.Either<ApiResponse, Subscription>> {
    const subscription = await this.subscriptionRepository.getSubscriptionByToken(token, isConfirmed);

    if (!subscription) {
      logger.info(`Subscription for ${token} not found`);

      return E.left({ status: 404, message: 'No token found' });
    }

    return E.right(subscription);
  }

  private async subscribeToExistingRepo(email: string, repository: Repository) {
    const foundSubscription = await this.subscriptionRepository.getSubscriptionByEmailAndRepoId(email, repository.id);

    if (foundSubscription) {
      return await this.handleExistingSubscription(email, foundSubscription, repository.repo);
    }

    const newSubscription = await this.subscriptionRepository.createNewSubscription(email, repository.id);

    const responseEither = await this.sendConfirmationOrFail(email, newSubscription.token, repository.repo);

    if (E.isLeft(responseEither)) {
      return responseEither.value;
    }

    subscriptionsTotal.inc({ status: 'sent' });

    return { status: 200, message: 'Confirmation email sent' };
  }

  private async handleExistingSubscription(
    email: string,
    subscription: Subscription,
    repo: string,
  ): Promise<ApiResponse> {
    if (subscription.confirmed) {
      logger.info(`Subscription for ${subscription.repoId} from ${email} already exists`);

      subscriptionsTotal.inc({ status: 'already_exists' });

      return { status: 409, message: 'Subscription already exists' };
    }

    logger.info(`Subscription for ${subscription.repoId} from ${email} already exists but not confirmed`);

    const responseEither = await this.sendConfirmationOrFail(email, subscription.token, repo);

    if (E.isLeft(responseEither)) {
      return responseEither.value;
    }

    subscriptionsTotal.inc({ status: 'resent' });

    return { status: 200, message: 'Confirmation email resent' };
  }

  private async subscribeToNewRepo(email: string, repo: string) {
    const tagsResponseEither = await GithubApiClient.getTags(repo);

    if (E.isLeft(tagsResponseEither)) {
      logger.info(`Something went wrong. Message: ${JSON.stringify(tagsResponseEither.value.message)}`);

      subscriptionsTotal.inc({ status: 'repo_not_found' });

      return tagsResponseEither.value;
    }

    const tags = tagsResponseEither.value;

    if (!tags.length) {
      subscriptionsTotal.inc({ status: 'tags_not_found' });

      return { status: 404, message: 'Repository has no tags' };
    }

    const newRepo = await this.repoRepository.createRepo(repo, tags[0].name);

    totalReposCount.inc();

    const newSubscription = await this.subscriptionRepository.createNewSubscription(email, newRepo.id);
    const responseEither = await this.sendConfirmationOrFail(email, newSubscription.token, repo);

    if (E.isLeft(responseEither)) {
      return responseEither.value;
    }

    logger.info(`Confirmation for ${repo} successfully sent to ${email}`);

    subscriptionsTotal.inc({ status: 'created' });

    return { status: 200, message: 'Confirmation email sent' };
  }

  private async removeRepoIfEmpty(foundSubscriptionEither: E.Right<Subscription>) {
    const subscriptionsCount = await this.subscriptionRepository.countByRepoId(foundSubscriptionEither.value.repoId);

    if (!subscriptionsCount) {
      await this.repoRepository.deleteRepo(foundSubscriptionEither.value.repoId);

      totalReposCount.dec();
    }
  }

  private async sendConfirmationOrFail(
    email: string,
    token: string,
    repo: string,
  ): Promise<E.Either<ApiResponse, null>> {
    const responseEither = await this.notificationEmailService.sendConfirmationEmail(email, token, repo);

    if (E.isLeft(responseEither)) {
      subscriptionsTotal.inc({ status: 'failed_to_send_email' });

      return E.left({ status: 500, message: responseEither.value.message });
    }

    return E.right(null);
  }
}

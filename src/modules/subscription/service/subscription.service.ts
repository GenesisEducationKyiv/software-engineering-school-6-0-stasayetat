import {
  ISubscriptionRepository,
  SUBSCRIPTION_REPOSITORY,
} from '@modules/subscription/repository/subscription.repository.interface';
import { RepoService } from '@modules/subscription/service/repo.service';
import { E } from '@shared/either';
import { logger } from '@shared/logger';
import { activeSubscriptionCount, subscriptionsTotal } from '@shared/metrics';
import { NOTIFICATION_SERVICE, NotificationService } from '@shared/notification/notification-service.interface';
import { ApiResponseException, ApiResponseExceptionCode, MinifiedSubscription, Subscription } from '@shared/types';
import { Repository } from '@shared/types/repository.types';
import { inject, injectable } from 'tsyringe';

@injectable()
export class SubscriptionService {
  constructor(
    @inject(SUBSCRIPTION_REPOSITORY) private readonly subscriptionRepository: ISubscriptionRepository,
    @inject(NOTIFICATION_SERVICE) private readonly notificationService: NotificationService,
    private readonly repoService: RepoService,
  ) {}

  async subscribe(email: string, repo: string): Promise<E.Either<ApiResponseException, void>> {
    const foundRepo = await this.repoService.findOrCreateRepo(repo);

    if (E.isLeft(foundRepo)) {
      return foundRepo;
    }

    return await this.subscribeToExistingRepo(email, foundRepo.value);
  }

  async confirmSubscribe(token: string): Promise<E.Either<ApiResponseException, void>> {
    const foundSubscriptionEither = await this.findSubscriptionByTokenOrFail(token);

    if (E.isLeft(foundSubscriptionEither)) {
      subscriptionsTotal.inc({ status: 'token_not_found' });

      return foundSubscriptionEither;
    }

    await this.subscriptionRepository.confirmSubscription(foundSubscriptionEither.value);

    activeSubscriptionCount.inc();

    logger.info(`Subscription confirmed successfully`);

    return E.right(undefined);
  }

  async confirmUnsubscribe(token: string): Promise<E.Either<ApiResponseException, void>> {
    const foundSubscriptionEither = await this.findSubscriptionByTokenOrFail(token, true);

    if (E.isLeft(foundSubscriptionEither)) {
      subscriptionsTotal.inc({ status: 'token_not_found' });

      return foundSubscriptionEither;
    }

    await this.subscriptionRepository.removeSubscription(foundSubscriptionEither.value);
    activeSubscriptionCount.dec();

    const repoId = foundSubscriptionEither.value.repoId;

    const subscriptionsCount = await this.subscriptionRepository.countByRepoId(repoId);

    if (!subscriptionsCount) {
      await this.repoService.removeRepo(repoId);
    }

    logger.info(`Subscription removed successfully`);

    subscriptionsTotal.inc({ status: 'unsubscribed' });

    return E.right(undefined);
  }

  async getAllSubscriptionsByEmail(email: string): Promise<E.Either<ApiResponseException, MinifiedSubscription[]>> {
    const foundSubscriptions = await this.subscriptionRepository.getAllActiveSubscriptionByEmail(email);

    const mappedValue = foundSubscriptions.map<MinifiedSubscription>(({ repos, subscriptions }) => ({
      email: subscriptions.email,
      repo: repos.repo,
      confirmed: true,
      last_seen_tag: repos.last_seen_tag,
    }));

    logger.info(`Active subscription for ${email} - ${mappedValue.length}`);

    return E.right(mappedValue);
  }

  private async findSubscriptionByTokenOrFail(
    token: string,
    isConfirmed: boolean = false,
  ): Promise<E.Either<ApiResponseException, Subscription>> {
    const subscription = await this.subscriptionRepository.getSubscriptionByToken(token, isConfirmed);

    if (!subscription) {
      logger.info(`Subscription not found`);

      return E.left({ code: ApiResponseExceptionCode.NOT_FOUND, message: 'No token found' });
    }

    return E.right(subscription);
  }

  private async subscribeToExistingRepo(
    email: string,
    repository: Repository,
  ): Promise<E.Either<ApiResponseException, void>> {
    const foundSubscription = await this.subscriptionRepository.getSubscriptionByEmailAndRepoId(email, repository.id);

    if (foundSubscription) {
      return await this.handleExistingSubscription(email, foundSubscription, repository.repo);
    }

    const newSubscription = await this.subscriptionRepository.createNewSubscription(email, repository.id);

    const responseEither = await this.sendConfirmationOrFail(email, newSubscription.token, repository.repo);

    if (E.isLeft(responseEither)) {
      return responseEither;
    }

    logger.info(`Email for ${repository.repo} successfully sent to ${email}`);

    subscriptionsTotal.inc({ status: 'sent' });

    return responseEither;
  }

  private async handleExistingSubscription(
    email: string,
    subscription: Subscription,
    repo: string,
  ): Promise<E.Either<ApiResponseException, void>> {
    if (subscription.confirmed) {
      logger.info(`Subscription for ${subscription.repoId} from ${email} already exists`);

      subscriptionsTotal.inc({ status: 'already_exists' });

      return E.left({ code: ApiResponseExceptionCode.ALREADY_EXISTS, message: 'Subscription already exists' });
    }

    logger.info(`Subscription for ${subscription.repoId} from ${email} already exists but not confirmed`);

    const responseEither = await this.sendConfirmationOrFail(email, subscription.token, repo);

    if (E.isLeft(responseEither)) {
      return responseEither;
    }

    subscriptionsTotal.inc({ status: 'resent' });

    return responseEither;
  }

  private async sendConfirmationOrFail(
    email: string,
    token: string,
    repo: string,
  ): Promise<E.Either<ApiResponseException, void>> {
    const responseEither = await this.notificationService.sendConfirmationEmail(email, token, repo);

    if (E.isLeft(responseEither)) {
      subscriptionsTotal.inc({ status: 'failed_to_send_email' });

      return E.left({ code: ApiResponseExceptionCode.GENERAL_FAILURE, message: responseEither.value.message });
    }

    return E.right(undefined);
  }
}

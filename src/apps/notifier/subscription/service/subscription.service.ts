import { E } from '@shared/either';
import { logger } from '@shared/logger';
import { activeSubscriptionCount, subscriptionOperationDuration, subscriptionsTotal } from '@shared/metrics';
import { NOTIFICATION_SERVICE, NotificationService } from '@shared/notification/notification-service.interface';
import { DomainError, DomainErrorCode, MinifiedSubscription, Subscription } from '@shared/types';
import { Repository } from '@shared/types/repository.types';
import { getErrorMessage } from '@shared/utils';
import { inject, injectable } from 'tsyringe';

import { ISubscriptionRepository, SUBSCRIPTION_REPOSITORY } from '../repository/subscription.repository.interface';
import { SubscriptionSagaService } from '../saga/subscription-saga.service';
import { RepoService } from './repo.service';

@injectable()
export class SubscriptionService {
  constructor(
    @inject(SUBSCRIPTION_REPOSITORY) private readonly subscriptionRepository: ISubscriptionRepository,
    @inject(NOTIFICATION_SERVICE) private readonly notificationService: NotificationService,
    private readonly repoService: RepoService,
    private readonly subscriptionSagaService: SubscriptionSagaService,
  ) {}

  async subscribe(email: string, repo: string): Promise<E.Either<DomainError, void>> {
    const end = subscriptionOperationDuration.startTimer({ type: 'subscribe' });

    try {
      const existingRepo = await this.repoService.findRepo(repo);

      if (existingRepo) {
        return await this.subscribeToExistingRepo(email, existingRepo);
      }

      const validatedEither = await this.repoService.validateNewRepo(repo);

      if (E.isLeft(validatedEither)) {
        logger.info(`Something went wrong. Message: ${JSON.stringify(validatedEither.value.message)}`);

        return validatedEither;
      }

      let sagaResult: { subscription: Subscription };

      try {
        sagaResult = await this.subscriptionSagaService.subscribeNewRepo(email, repo, validatedEither.value);
      } catch (error) {
        logger.error(`Failed to enroll ${repo} in scanner: ${getErrorMessage(error)}`);

        return E.left({ code: DomainErrorCode.SCANNER_ENROLLMENT_FAILED, message: getErrorMessage(error) });
      }

      const responseEither = await this.sendConfirmationOrFail(email, sagaResult.subscription.token, repo);

      if (E.isLeft(responseEither)) {
        return responseEither;
      }

      logger.info(`Email for ${repo} successfully sent to ${email}`);

      subscriptionsTotal.inc({ status: 'sent' });

      return responseEither;
    } finally {
      end();
    }
  }

  async confirmSubscribe(token: string): Promise<E.Either<DomainError, void>> {
    const end = subscriptionOperationDuration.startTimer({ type: 'confirmSubscribe' });

    try {
      const foundSubscriptionEither = await this.findSubscriptionByTokenOrFail(token);

      if (E.isLeft(foundSubscriptionEither)) {
        subscriptionsTotal.inc({ status: 'token_not_found' });

        return foundSubscriptionEither;
      }

      await this.subscriptionRepository.confirmSubscription(foundSubscriptionEither.value);

      activeSubscriptionCount.inc();

      logger.info(`Subscription confirmed successfully`);

      return E.right(undefined);
    } finally {
      end();
    }
  }

  async confirmUnsubscribe(token: string): Promise<E.Either<DomainError, void>> {
    const end = subscriptionOperationDuration.startTimer({ type: 'confirmUnsubscribe' });

    try {
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
        const orphanedRepo = await this.repoService.getRepoById(repoId);

        if (orphanedRepo) {
          try {
            await this.subscriptionSagaService.unenrollOrphanedRepo(orphanedRepo);
          } catch (error) {
            logger.error(
              `Failed to unenroll orphaned repo ${orphanedRepo.repo} from scanner: ${getErrorMessage(error)}`,
            );
          }
        }
      }

      logger.info(`Subscription removed successfully`);

      subscriptionsTotal.inc({ status: 'unsubscribed' });

      return E.right(undefined);
    } finally {
      end();
    }
  }

  async getAllSubscriptionsByEmail(email: string): Promise<E.Either<DomainError, MinifiedSubscription[]>> {
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
  ): Promise<E.Either<DomainError, Subscription>> {
    const subscription = await this.subscriptionRepository.getSubscriptionByToken(token, isConfirmed);

    if (!subscription) {
      logger.info(`Subscription not found`);

      return E.left({ code: DomainErrorCode.SUBSCRIPTION_NOT_FOUND, message: 'No token found' });
    }

    return E.right(subscription);
  }

  private async subscribeToExistingRepo(email: string, repository: Repository): Promise<E.Either<DomainError, void>> {
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
  ): Promise<E.Either<DomainError, void>> {
    if (subscription.confirmed) {
      logger.info(`Subscription for ${subscription.repoId} from ${email} already exists`);

      subscriptionsTotal.inc({ status: 'already_exists' });

      return E.left({ code: DomainErrorCode.SUBSCRIPTION_ALREADY_EXISTS, message: 'Subscription already exists' });
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
  ): Promise<E.Either<DomainError, void>> {
    const responseEither = await this.notificationService.sendConfirmationEmail(email, token, repo);

    if (E.isLeft(responseEither)) {
      subscriptionsTotal.inc({ status: 'failed_to_send_email' });

      return E.left({ code: DomainErrorCode.EMAIL_SEND_FAILURE, message: responseEither.value.message });
    }

    return E.right(undefined);
  }
}

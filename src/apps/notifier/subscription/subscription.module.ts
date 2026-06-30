import { DependencyContainer } from 'tsyringe';

import { RepoRepository } from './repository/repo.repository';
import { REPO_REPOSITORY } from './repository/repo.repository.interface';
import { SubscriptionRepository } from './repository/subscription.repository';
import { SUBSCRIPTION_REPOSITORY } from './repository/subscription.repository.interface';
import { SagaRepository } from './saga/saga.repository';
import { SAGA_REPOSITORY } from './saga/saga.repository.interface';
import { SagaRunner } from './saga/saga-runner';
import { ScannerApiClient } from './saga/scanner-api.client';
import { SCANNER_API_CLIENT } from './saga/scanner-api.client.interface';
import { SubscriptionSagaService } from './saga/subscription-saga.service';
import { ReleaseNotificationService } from './service/release-notification.service';
import { RepoService } from './service/repo.service';
import { SubscriptionService } from './service/subscription.service';

export function registerSubscriptionModule(container: DependencyContainer): void {
  container.registerSingleton(REPO_REPOSITORY, RepoRepository);
  container.registerSingleton(SUBSCRIPTION_REPOSITORY, SubscriptionRepository);
  container.registerSingleton(SAGA_REPOSITORY, SagaRepository);
  container.registerSingleton(SagaRunner);
  container.registerSingleton(SCANNER_API_CLIENT, ScannerApiClient);
  container.registerSingleton(SubscriptionSagaService);
  container.registerSingleton(RepoService);
  container.registerSingleton(SubscriptionService);
  container.registerSingleton(ReleaseNotificationService);
}

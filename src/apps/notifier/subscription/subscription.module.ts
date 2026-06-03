import { DependencyContainer } from 'tsyringe';

import { RepoRepository } from './repository/repo.repository';
import { REPO_REPOSITORY } from './repository/repo.repository.interface';
import { SubscriptionRepository } from './repository/subscription.repository';
import { SUBSCRIPTION_REPOSITORY } from './repository/subscription.repository.interface';
import { RepoService } from './service/repo.service';
import { SubscriptionService } from './service/subscription.service';

export function registerSubscriptionModule(container: DependencyContainer): void {
  container.registerSingleton(REPO_REPOSITORY, RepoRepository);
  container.registerSingleton(SUBSCRIPTION_REPOSITORY, SubscriptionRepository);
  container.registerSingleton(RepoService);
  container.registerSingleton(SubscriptionService);
}

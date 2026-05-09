import { RepoRepository } from '@modules/subscription/repository/repo.repository';
import { REPO_REPOSITORY } from '@modules/subscription/repository/repo.repository.interface';
import { SubscriptionRepository } from '@modules/subscription/repository/subscription.repository';
import { SUBSCRIPTION_REPOSITORY } from '@modules/subscription/repository/subscription.repository.interface';
import { RepoService } from '@modules/subscription/service/repo.service';
import { SubscriptionService } from '@modules/subscription/service/subscription.service';
import { DependencyContainer } from 'tsyringe';

export function registerSubscriptionModule(container: DependencyContainer): void {
  container.registerSingleton(REPO_REPOSITORY, RepoRepository);
  container.registerSingleton(SUBSCRIPTION_REPOSITORY, SubscriptionRepository);
  container.registerSingleton(RepoService);
  container.registerSingleton(SubscriptionService);
}

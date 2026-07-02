import {
  ISubscriptionRepository,
  SUBSCRIPTION_REPOSITORY,
} from '@notifier/subscription/repository/subscription.repository.interface';
import { SagaStep } from '@notifier/subscription/saga/saga.types';
import { RepoService } from '@notifier/subscription/service/repo.service';
import { Subscription } from '@shared/types';
import { Repository } from '@shared/types/repository.types';
import { inject, injectable } from 'tsyringe';

import { SagaRunner } from './saga-runner';
import { IScannerApiClient, SCANNER_API_CLIENT } from './scanner-api.client.interface';

type SubscribeCtx = { repo?: Repository; subscription?: Subscription };

@injectable()
export class SubscriptionSagaService {
  constructor(
    private readonly sagaRunner: SagaRunner,
    private readonly repoService: RepoService,
    @inject(SUBSCRIPTION_REPOSITORY) private readonly subscriptionRepository: ISubscriptionRepository,
    @inject(SCANNER_API_CLIENT) private readonly scannerApiClient: IScannerApiClient,
  ) {}

  async subscribeNewRepo(
    email: string,
    repo: string,
    lastSeenTag: string,
  ): Promise<{ repo: Repository; subscription: Subscription }> {
    const ctx: SubscribeCtx = {};

    const steps: SagaStep<SubscribeCtx>[] = [
      {
        name: 'createRepoAndSubscriptionLocally',
        run: async context => {
          context.repo = await this.repoService.createRepoRecord(repo, lastSeenTag);
          context.subscription = await this.subscriptionRepository.createNewSubscription(email, context.repo.id);
        },
        undo: async context => {
          if (context.subscription) {
            await this.subscriptionRepository.removeSubscription(context.subscription);
          }

          if (context.repo) {
            await this.repoService.deleteRepoRecord(context.repo.id);
          }
        },
      },
      {
        name: 'trackRepoInScanner',
        run: async context => {
          await this.scannerApiClient.trackRepo(context.repo!.id, context.repo!.repo, context.repo!.last_seen_tag);
        },
        undo: async context => {
          if (context.repo) {
            await this.scannerApiClient.untrackRepo(context.repo.id);
          }
        },
      },
    ];

    await this.sagaRunner.run('SUBSCRIBE', { email, repo }, steps, ctx);

    return { repo: ctx.repo!, subscription: ctx.subscription! };
  }

  async untrackOrphanedRepo(repo: Repository): Promise<void> {
    const steps: SagaStep<object>[] = [
      {
        name: 'untrackRepoInScanner',
        run: async () => {
          await this.scannerApiClient.untrackRepo(repo.id);
        },
        undo: async () => {
          await this.scannerApiClient.trackRepo(repo.id, repo.repo, repo.last_seen_tag);
        },
      },
      {
        name: 'deleteRepoLocally',
        run: async () => {
          await this.repoService.deleteRepoRecord(repo.id);
        },
        undo: async () => {
          await this.repoService.recreateRepoRecord(repo);
        },
      },
    ];

    await this.sagaRunner.run('UNSUBSCRIBE', { repoId: repo.id, repo: repo.repo }, steps, {});
  }
}

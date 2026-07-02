import { TrackedRepository } from '@scanner/db';
import { ITrackedRepoRepository, TRACKED_REPO_REPOSITORY } from '@scanner/repository/tracked-repo.repository.interface';
import { logger } from '@shared/logger';
import { EventPublisher } from '@shared/rabbitmq/event-publisher';
import { EVENT_PUBLISHER } from '@shared/rabbitmq/rabbitmq.module';
import { inject, injectable } from 'tsyringe';

@injectable()
export class ScannerDataFetcher {
  constructor(
    @inject(TRACKED_REPO_REPOSITORY) private readonly trackedRepoRepository: ITrackedRepoRepository,
    @inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisher,
  ) {}

  async getAllRepos(): Promise<TrackedRepository[]> {
    const repos = await this.trackedRepoRepository.getAllRepos();

    logger.info(`Fetched ${repos.length} repos from scanner's own database`);

    return repos;
  }

  async notifyNewRelease(repoId: string, tag: string): Promise<void> {
    await this.trackedRepoRepository.updateLastSeenTag(repoId, tag);
    await this.eventPublisher.publish('releases', 'new_release_detected', { repoId, tag });
  }
}

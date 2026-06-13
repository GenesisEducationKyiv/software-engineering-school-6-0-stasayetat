import { env } from '@shared/env';
import { logger } from '@shared/logger';
import { EventPublisher } from '@shared/rabbitmq/event-publisher';
import { EVENT_PUBLISHER } from '@shared/rabbitmq/rabbitmq.module';
import { Repository } from '@shared/types/repository.types';
import axios, { AxiosInstance } from 'axios';
import { inject, injectable } from 'tsyringe';

@injectable()
export class ScannerDataFetcher {
  private readonly http: AxiosInstance;

  constructor(@inject(EVENT_PUBLISHER) private readonly eventPublisher: EventPublisher) {
    this.http = axios.create({
      baseURL: env.NOTIFIER_API_URL,
      headers: { 'x-api-key': env.APP_API_KEY },
    });
  }

  async getAllRepos(): Promise<Repository[]> {
    const response = await this.http.get<{ data: Repository[] }>('/internal/repos');

    logger.info(`Fetched ${response.data.data.length} repos from API service`);

    return response.data.data;
  }

  notifyNewRelease(repoId: string, tag: string): Promise<void> {
    return this.eventPublisher.publish('releases', 'new_release_detected', { repoId, tag });
  }
}

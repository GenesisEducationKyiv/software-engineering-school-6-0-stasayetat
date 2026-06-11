import { env } from '@shared/env';
import { logger } from '@shared/logger';
import { Repository } from '@shared/types/repository.types';
import axios, { AxiosInstance } from 'axios';
import { injectable } from 'tsyringe';

@injectable()
export class ScannerDataFetcher {
  private readonly http: AxiosInstance;

  constructor() {
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

  async notifyNewRelease(repoId: string, tag: string): Promise<void> {
    await this.http.post(`/internal/repos/${repoId}/notify`, { tag });
  }
}

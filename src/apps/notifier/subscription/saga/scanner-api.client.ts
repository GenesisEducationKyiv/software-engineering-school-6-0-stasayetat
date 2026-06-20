import { env } from '@shared/env';
import axios, { AxiosInstance } from 'axios';
import { injectable } from 'tsyringe';

import { IScannerApiClient } from './scanner-api.client.interface';

@injectable()
export class ScannerApiClient implements IScannerApiClient {
  private readonly http: AxiosInstance;

  constructor() {
    this.http = axios.create({
      baseURL: env.SCANNER_API_URL,
      headers: { 'x-api-key': env.APP_API_KEY },
    });
  }

  async enrollRepo(id: string, repo: string, lastSeenTag: string): Promise<void> {
    await this.http.post('/internal/repos/enroll', { id, repo, lastSeenTag });
  }

  async unenrollRepo(id: string): Promise<void> {
    await this.http.delete(`/internal/repos/${id}`);
  }
}

import * as grpc from '@grpc/grpc-js';
import { TrackedRepoServiceClient } from '@scanner/grpc/proto-types/tracked_repo';
import { env } from '@shared/env';
import ms from 'ms';
import { injectable } from 'tsyringe';

import { IScannerApiClient } from './scanner-api.client.interface';

@injectable()
export class ScannerGrpcClient implements IScannerApiClient {
  private readonly client: TrackedRepoServiceClient;

  constructor() {
    this.client = new TrackedRepoServiceClient(env.SCANNER_GRPC_URL, grpc.credentials.createInsecure());
  }

  trackRepo(id: string, repo: string, lastSeenTag: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client.trackRepo(
        { id, repo, lastSeenTag },
        this.addAuthToken(),
        { deadline: this.getRequestTimeout() },
        error => (error ? reject(error) : resolve()),
      );
    });
  }

  untrackRepo(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client.untrackRepo({ id }, this.addAuthToken(), { deadline: this.getRequestTimeout() }, error =>
        error ? reject(error) : resolve(),
      );
    });
  }

  private addAuthToken() {
    const metadata = new grpc.Metadata();

    metadata.set('x-api-key', env.APP_API_KEY);

    return metadata;
  }

  private getRequestTimeout() {
    return new Date(Date.now() + ms('5 seconds'));
  }
}

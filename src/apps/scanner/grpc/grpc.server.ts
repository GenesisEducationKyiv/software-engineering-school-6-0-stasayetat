import * as grpc from '@grpc/grpc-js';
import { TrackRepoDto, UntrackRepoDto } from '@scanner/dtos/grpc.dto';
import { ITrackedRepoRepository, TRACKED_REPO_REPOSITORY } from '@scanner/repository/tracked-repo.repository.interface';
import { authInterceptor } from '@shared/grpc/auth.interceptor';
import { validateGrpc } from '@shared/grpc/validate-grpc';
import { logger } from '@shared/logger';
import { container } from 'tsyringe';

import {
  TrackedRepoServiceServer,
  TrackedRepoServiceService,
  TrackRepoRequest,
  TrackRepoResponse,
  UntrackRepoRequest,
  UntrackRepoResponse,
} from './proto-types/tracked_repo';

async function trackRepo(
  call: grpc.ServerUnaryCall<TrackRepoRequest, TrackRepoResponse>,
  callback: grpc.sendUnaryData<TrackRepoResponse>,
) {
  const dto = await validateGrpc(TrackRepoDto, call.request, callback);

  if (!dto) {
    return;
  }

  try {
    const trackedRepoRepository = container.resolve<ITrackedRepoRepository>(TRACKED_REPO_REPOSITORY);
    const tracked = await trackedRepoRepository.track(dto.id, dto.repo, dto.lastSeenTag);

    callback(null, { id: tracked.id, repo: tracked.repo, lastSeenTag: tracked.last_seen_tag });
  } catch (error) {
    logger.error(`TrackRepo failed: ${JSON.stringify(error)}`);
    callback({ code: grpc.status.INTERNAL, details: 'Failed to track repo' });
  }
}

async function untrackRepo(
  call: grpc.ServerUnaryCall<UntrackRepoRequest, UntrackRepoResponse>,
  callback: grpc.sendUnaryData<UntrackRepoResponse>,
) {
  const dto = await validateGrpc(UntrackRepoDto, call.request, callback);

  if (!dto) {
    return;
  }

  try {
    const trackedRepoRepository = container.resolve<ITrackedRepoRepository>(TRACKED_REPO_REPOSITORY);
    const found = await trackedRepoRepository.untrack(dto.id);

    if (!found) {
      callback({ code: grpc.status.NOT_FOUND, details: `Repo ${dto.id} is not tracked` });

      return;
    }

    callback(null, { message: 'Repo untracked' });
  } catch (error) {
    logger.error(`UntrackRepo failed: ${JSON.stringify(error)}`);
    callback({ code: grpc.status.INTERNAL, details: 'Failed to untrack repo' });
  }
}

const trackedRepoServiceImpl: TrackedRepoServiceServer = {
  trackRepo: (call, callback) => void trackRepo(call, callback),
  untrackRepo: (call, callback) => void untrackRepo(call, callback),
};

export function startGrpcServer(port: number) {
  const server = new grpc.Server({
    interceptors: [authInterceptor],
  });

  server.addService(TrackedRepoServiceService, trackedRepoServiceImpl);

  server.bindAsync(`0.0.0.0:${port}`, grpc.ServerCredentials.createInsecure(), (error, boundPort) => {
    if (error) {
      logger.error(`gRPC server error: ${error.message}`);

      return;
    }

    logger.info(`Scanner gRPC server started on port ${boundPort}`);
  });
}

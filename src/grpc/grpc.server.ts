import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { SubscriptionService } from '@modules/subscription';
import { ConfirmDto, GetSubscriptionsDto, SubscribeDto, UnsubscribeDto } from '@shared/dtos';
import { logger } from '@shared/logger';
import { ApiResponseException, E, MinifiedSubscription } from '@shared/types';
import path from 'path';
import { container } from 'tsyringe';

import { toGrpcError } from './grpc.utils';
import { authInterceptor } from './interceptors/auth.interceptor';
import { validateGrpc } from './interceptors/validate-grpc';
import { ProtoGrpcType } from './proto-types/subscription';

const PROTO_PATH = path.resolve(__dirname, './subscription.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const proto = grpc.loadPackageDefinition(packageDefinition) as unknown as ProtoGrpcType;

const subscriptionService = container.resolve(SubscriptionService);

async function subscribe(
  call: grpc.ServerUnaryCall<SubscribeDto, ApiResponseException>,
  callback: grpc.sendUnaryData<string>,
) {
  const dto = await validateGrpc(SubscribeDto, call.request, callback);

  if (!dto) {
    return;
  }

  const result = await subscriptionService.subscribe(dto.email, dto.repo);

  if (E.isLeft(result)) {
    return callback(toGrpcError(result.value));
  }

  callback(null, 'Email notification sent');
}

async function confirm(
  call: grpc.ServerUnaryCall<ConfirmDto, ApiResponseException>,
  callback: grpc.sendUnaryData<string>,
) {
  const dto = await validateGrpc(ConfirmDto, call.request, callback);

  if (!dto) {
    return;
  }

  const result = await subscriptionService.confirmSubscribe(dto.token);

  if (E.isLeft(result)) {
    return callback(toGrpcError(result.value));
  }

  callback(null, 'Subscription confirmed successfully');
}

async function unsubscribe(
  call: grpc.ServerUnaryCall<UnsubscribeDto, ApiResponseException>,
  callback: grpc.sendUnaryData<string>,
) {
  const dto = await validateGrpc(UnsubscribeDto, call.request, callback);

  if (!dto) {
    return;
  }

  const result = await subscriptionService.confirmUnsubscribe(dto.token);

  if (E.isLeft(result)) {
    return callback(toGrpcError(result.value));
  }

  callback(null, 'Subscription removed successfully');
}

async function getSubscriptions(
  call: grpc.ServerUnaryCall<GetSubscriptionsDto, MinifiedSubscription[]>,
  callback: grpc.sendUnaryData<MinifiedSubscription[]>,
) {
  const dto = await validateGrpc(GetSubscriptionsDto, call.request, callback);

  if (!dto) {
    return;
  }

  const result = await subscriptionService.getAllSubscriptionsByEmail(dto.email);

  if (E.isLeft(result)) {
    return callback(toGrpcError(result.value));
  }

  callback(null, result.value);
}

export function startGrpcServer(port: number) {
  const server = new grpc.Server({
    interceptors: [authInterceptor],
  });

  server.addService(proto.subscription.SubscriptionService.service, {
    subscribe: (call: grpc.ServerUnaryCall<SubscribeDto, ApiResponseException>, callback: grpc.sendUnaryData<string>) =>
      void subscribe(call, callback),

    confirm: (call: grpc.ServerUnaryCall<ConfirmDto, ApiResponseException>, callback: grpc.sendUnaryData<string>) =>
      void confirm(call, callback),

    unsubscribe: (
      call: grpc.ServerUnaryCall<UnsubscribeDto, ApiResponseException>,
      callback: grpc.sendUnaryData<string>,
    ) => void unsubscribe(call, callback),

    getSubscriptions: (
      call: grpc.ServerUnaryCall<GetSubscriptionsDto, MinifiedSubscription[]>,
      callback: grpc.sendUnaryData<MinifiedSubscription[]>,
    ) => void getSubscriptions(call, callback),
  });

  server.bindAsync(`0.0.0.0:${port}`, grpc.ServerCredentials.createInsecure(), (err, boundPort) => {
    if (err) {
      logger.error(`gRPC server error: ${err.message}`);

      return;
    }

    logger.info(`gRPC server started on port ${boundPort}`);
  });
}
